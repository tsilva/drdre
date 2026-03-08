"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";

import type { SearchResult } from "@drdre/shared";
import { embedTexts } from "@drdre/shared";

interface SearchPayload {
  query: string;
  mode: string;
  results: SearchResult[];
}

async function runSearch(params: {
  query: string;
  mode: "fts" | "hybrid";
  type: string;
}): Promise<SearchPayload> {
  const baseUrl = process.env.NEXT_PUBLIC_SEARCH_API_BASE_URL;
  if (!baseUrl) {
    throw new Error("NEXT_PUBLIC_SEARCH_API_BASE_URL is not configured");
  }

  const requestBody: Record<string, unknown> = {
    q: params.query,
    topK: 10,
    ...(params.type ? { type: params.type } : {})
  };

  if (params.mode === "hybrid") {
    const [vector] = await embedTexts([params.query], "query");
    requestBody.queryVector = vector;
  }

  const response = await fetch(`${baseUrl}/api/search`, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    throw new Error(`Search request failed with ${response.status}`);
  }

  return (await response.json()) as SearchPayload;
}

export function SearchShell() {
  const [query, setQuery] = useState("");
  const [type, setType] = useState("");
  const [mode, setMode] = useState<"fts" | "hybrid">("hybrid");
  const [result, setResult] = useState<SearchPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const canSubmit = useMemo(() => query.trim().length > 2, [query]);

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    startTransition(async () => {
      try {
        const payload = await runSearch({
          query,
          mode,
          type
        });
        setResult(payload);
      } catch (caught) {
        setResult(null);
        setError(caught instanceof Error ? caught.message : "Search failed");
      }
    });
  }

  return (
    <>
      <section className="search-panel">
        <form onSubmit={onSubmit}>
          <div className="search-row">
            <input
              className="search-input"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Try: despacho sobre teletrabalho na administração pública"
            />
            <select className="search-select" value={type} onChange={(event) => setType(event.target.value)}>
              <option value="">All document types</option>
              <option value="Despacho">Despacho</option>
              <option value="Portaria">Portaria</option>
              <option value="Lei">Lei</option>
              <option value="Decreto-Lei">Decreto-Lei</option>
            </select>
            <select
              className="search-select"
              value={mode}
              onChange={(event) => setMode(event.target.value as "fts" | "hybrid")}
            >
              <option value="hybrid">Hybrid</option>
              <option value="fts">Citation + lexical</option>
            </select>
            <button className="search-button" disabled={!canSubmit || isPending} type="submit">
              {isPending ? "Searching..." : "Search"}
            </button>
          </div>
        </form>
        <div className="search-toolbar" style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap" }}>
          <span className="chip">Browser embeddings keep runtime costs low.</span>
          <span className="chip">Hybrid mode uses the same E5 model as the builder.</span>
        </div>
      </section>

      {error ? <p className="error-state">{error}</p> : null}

      {!error && result && result.results.length === 0 ? (
        <p className="empty-state">No results yet. This usually means the Worker catalog is empty or the query needs a citation hint.</p>
      ) : null}

      <section className="results-grid">
        {result?.results.map((item) => (
          <article className="result-card" key={item.documentId}>
            <div className="source-badge">{item.source}</div>
            <h2>{item.title}</h2>
            <div className="result-meta">
              <span>{item.citation}</span>
              <span>{item.publicationDate}</span>
              <span>score {item.score.toFixed(3)}</span>
            </div>
            <p>{item.snippet}</p>
            <div className="result-meta">
              <Link className="result-link" href={`/documents/${item.documentId}`}>
                Open cached detail
              </Link>
              <a className="result-link" href={item.officialUrl} target="_blank" rel="noreferrer">
                Official Diário da República
              </a>
            </div>
          </article>
        ))}
      </section>
    </>
  );
}
