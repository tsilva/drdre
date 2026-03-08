import { handleUpsertDocuments, handleUpsertVectors } from "./admin";
import { json, parseNumber } from "./helpers";
import { handleDocument, handleSearch } from "./search";
import type { WorkerEnv } from "./types";

function getEdgeCache(): Cache {
  return (caches as CacheStorage & { default: Cache }).default;
}

async function maybeServeCached(request: Request, env: WorkerEnv): Promise<Response | null> {
  if (request.method !== "GET") {
    return null;
  }

  const cache = getEdgeCache();
  const cacheKey = new Request(request.url);
  return (await cache.match(cacheKey)) ?? null;
}

async function maybeStoreCached(request: Request, env: WorkerEnv, response: Response): Promise<Response> {
  if (request.method !== "GET" || !response.ok) {
    return response;
  }

  const cache = getEdgeCache();
  const ttlSeconds = parseNumber(env.SEARCH_CACHE_TTL_SECONDS ?? null, 300);
  const cacheable = new Response(response.body, response);
  cacheable.headers.set("cache-control", `public, max-age=${ttlSeconds}`);
  await cache.put(new Request(request.url), cacheable.clone());
  return cacheable;
}

export default {
  async fetch(request: Request, env: WorkerEnv): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return json({ ok: true });
    }

    if (url.pathname === "/api/search") {
      const cached = await maybeServeCached(request, env);
      if (cached) {
        return cached;
      }

      const response = await handleSearch(request, env);
      return maybeStoreCached(request, env, response);
    }

    if (url.pathname.startsWith("/api/document/")) {
      return handleDocument(request, env);
    }

    if (url.pathname === "/admin/documents/upsert" && request.method === "POST") {
      return handleUpsertDocuments(request, env);
    }

    if (url.pathname === "/admin/vectors/upsert" && request.method === "POST") {
      return handleUpsertVectors(request, env);
    }

    return json({ error: "Not found" }, { status: 404 });
  }
};
