import type { DocumentMetadata } from "@drdre/shared";

import type { WorkerEnv } from "./types";

export function json(data: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("access-control-allow-origin", "*");
  headers.set("access-control-allow-methods", "GET,POST,OPTIONS");
  headers.set("access-control-allow-headers", "content-type,x-admin-token");
  return new Response(JSON.stringify(data, null, 2), { ...init, headers });
}

export function isAuthorized(request: Request, env: WorkerEnv): boolean {
  if (!env.ADMIN_TOKEN) {
    return false;
  }

  return request.headers.get("x-admin-token") === env.ADMIN_TOKEN;
}

export function parseNumber(value: string | null, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function buildCacheKey(request: Request, body: string): Promise<string> {
  return crypto.subtle
    .digest("SHA-256", new TextEncoder().encode(`${request.url}::${body}`))
    .then((buffer) => Array.from(new Uint8Array(buffer)).map((item) => item.toString(16).padStart(2, "0")).join(""));
}

export async function upsertDocument(env: WorkerEnv, document: DocumentMetadata): Promise<void> {
  await env.DB.prepare(
    `
      INSERT INTO documents (
        id,
        official_doc_id,
        publication_date,
        series,
        document_type,
        number,
        title,
        summary,
        preview,
        citation,
        official_url,
        r2_key,
        snapshot_date,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        official_doc_id = excluded.official_doc_id,
        publication_date = excluded.publication_date,
        series = excluded.series,
        document_type = excluded.document_type,
        number = excluded.number,
        title = excluded.title,
        summary = excluded.summary,
        preview = excluded.preview,
        citation = excluded.citation,
        official_url = excluded.official_url,
        r2_key = excluded.r2_key,
        snapshot_date = excluded.snapshot_date,
        updated_at = excluded.updated_at
    `
  )
    .bind(
      document.id,
      document.officialDocId,
      document.publicationDate,
      document.series,
      document.documentType,
      document.number,
      document.title,
      document.summary,
      document.preview,
      document.citation,
      document.officialUrl,
      document.r2Key,
      document.snapshotDate,
      document.updatedAt
    )
    .run();

  await env.DB.prepare("DELETE FROM documents_fts WHERE id = ?").bind(document.id).run();
  await env.DB.prepare(
    `
      INSERT INTO documents_fts (id, title, summary, citation, number)
      VALUES (?, ?, ?, ?, ?)
    `
  )
    .bind(document.id, document.title, document.summary, document.citation, document.number)
    .run();
}
