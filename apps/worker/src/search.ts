import {
  buildFtsQuery,
  reciprocalRankFuse,
  type DocumentMetadata,
  type FtsMatch,
  type SearchFilters,
  type SemanticMatch
} from "@drdre/shared";

import { json } from "./helpers";
import type { SearchRequestBody, WorkerEnv } from "./types";

function parseSearchBody(request: Request): Promise<SearchRequestBody> {
  if (request.method === "POST") {
    return request.json();
  }

  const url = new URL(request.url);
  return Promise.resolve({
    q: url.searchParams.get("q") ?? "",
    topK: Number(url.searchParams.get("top_k") ?? "10"),
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
    type: url.searchParams.get("type") ?? undefined
  });
}

async function searchFts(env: WorkerEnv, query: string, filters: SearchFilters, topK: number): Promise<FtsMatch[]> {
  const ftsQuery = buildFtsQuery(query);
  if (!ftsQuery) {
    return [];
  }

  const { results } = await env.DB.prepare(
    `
      SELECT
        d.id AS documentId,
        d.title,
        d.citation,
        d.publication_date AS publicationDate,
        d.official_url AS officialUrl,
        COALESCE(d.preview, d.summary, d.title) AS snippet,
        bm25(documents_fts, 8.0, 4.0, 10.0, 6.0) AS score
      FROM documents_fts
      JOIN documents d ON d.id = documents_fts.id
      WHERE documents_fts MATCH ?
        AND (? IS NULL OR d.publication_date >= ?)
        AND (? IS NULL OR d.publication_date <= ?)
        AND (? IS NULL OR d.document_type = ?)
      ORDER BY score
      LIMIT ?
    `
  )
    .bind(
      ftsQuery,
      filters.from ?? null,
      filters.from ?? null,
      filters.to ?? null,
      filters.to ?? null,
      filters.type ?? null,
      filters.type ?? null,
      topK
    )
    .all<FtsMatch>();

  return results ?? [];
}

async function generateQueryVector(env: WorkerEnv, query: string): Promise<number[] | null> {
  if (!env.QUERY_EMBEDDING_URL) {
    return null;
  }

  const response = await fetch(env.QUERY_EMBEDDING_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(env.QUERY_EMBEDDING_TOKEN ? { authorization: `Bearer ${env.QUERY_EMBEDDING_TOKEN}` } : {})
    },
    body: JSON.stringify({
      texts: [query],
      prefix: "query"
    })
  });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as { vectors?: number[][] };
  return payload.vectors?.[0] ?? null;
}

async function searchSemantic(
  env: WorkerEnv,
  queryVector: number[] | null,
  filters: SearchFilters,
  topK: number
): Promise<SemanticMatch[]> {
  if (!env.HOT_INDEX || !queryVector) {
    return [];
  }

  try {
    const result = await env.HOT_INDEX.query(queryVector, {
      topK: Math.max(topK * 3, 20),
      returnMetadata: "all"
    });

    return (result.matches ?? [])
      .map((match) => {
      const metadata = (match.metadata ?? {}) as Record<string, string>;
      return {
        documentId: metadata.documentId ?? match.id,
        title: metadata.title ?? "Untitled",
        citation: metadata.citation ?? "",
        publicationDate: metadata.publicationDate ?? "",
        documentType: metadata.documentType ?? "",
        officialUrl: metadata.officialUrl ?? "",
        snippet: metadata.snippet ?? "",
        score: match.score ?? 0
      };
      })
      .filter((match) => {
        if (filters.type && match.documentType !== filters.type) {
          return false;
        }
        if (filters.from && match.publicationDate < filters.from) {
          return false;
        }
        if (filters.to && match.publicationDate > filters.to) {
          return false;
        }
        return true;
      })
      .slice(0, topK)
      .map(({ documentType, ...match }) => match);
  } catch {
    return [];
  }
}

export async function handleSearch(request: Request, env: WorkerEnv): Promise<Response> {
  const body = await parseSearchBody(request);
  const query = body.q?.trim() ?? "";
  const topK = Math.min(25, Math.max(1, body.topK ?? 10));

  if (!query) {
    return json({ error: "Missing q" }, { status: 400 });
  }

  const filters: SearchFilters = {
    from: body.from,
    to: body.to,
    type: body.type
  };

  const lexicalMatches = await searchFts(env, query, filters, topK);
  const queryVector = body.queryVector?.length
    ? body.queryVector
    : await generateQueryVector(env, query);
  const semanticMatches = await searchSemantic(env, queryVector, filters, topK);
  const results = reciprocalRankFuse(lexicalMatches, semanticMatches, topK);

  return json({
    query,
    mode: semanticMatches.length > 0 ? "hybrid" : "fts",
    results
  });
}

export async function handleDocument(request: Request, env: WorkerEnv): Promise<Response> {
  const url = new URL(request.url);
  const documentId = url.pathname.split("/").pop();

  if (!documentId) {
    return json({ error: "Missing document id" }, { status: 400 });
  }

  const record = await env.DB.prepare(
    `
      SELECT
        id,
        official_doc_id AS officialDocId,
        publication_date AS publicationDate,
        series,
        document_type AS documentType,
        number,
        title,
        summary,
        preview,
        citation,
        official_url AS officialUrl,
        r2_key AS r2Key,
        snapshot_date AS snapshotDate,
        updated_at AS updatedAt
      FROM documents
      WHERE id = ?
      LIMIT 1
    `
  )
    .bind(documentId)
    .first<DocumentMetadata>();

  if (!record) {
    return json({ error: "Not found" }, { status: 404 });
  }

  let bodyText = "";
  let storageStatus: "ok" | "missing" | "unavailable" = "missing";

  try {
    const object = await env.DOCUMENTS.get(record.r2Key);
    if (object) {
      const payload = (await object.json()) as { bodyText?: string };
      bodyText = payload.bodyText ?? "";
      storageStatus = "ok";
    }
  } catch {
    storageStatus = "unavailable";
  }

  return json({
    document_id: record.id,
    title: record.title,
    citation: record.citation,
    publication_date: record.publicationDate,
    official_url: record.officialUrl,
    body_text: bodyText,
    metadata: record,
    storage_status: storageStatus
  });
}
