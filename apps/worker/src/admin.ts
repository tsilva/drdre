import { json, isAuthorized, upsertDocument } from "./helpers";
import type { UpsertDocumentsRequest, UpsertVectorsRequest, WorkerEnv } from "./types";

export async function handleUpsertDocuments(request: Request, env: WorkerEnv): Promise<Response> {
  if (!isAuthorized(request, env)) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = (await request.json()) as UpsertDocumentsRequest;
  const documents = payload.documents ?? [];

  for (const document of documents) {
    await upsertDocument(env, document);
  }

  return json({ upserted: documents.length });
}

export async function handleUpsertVectors(request: Request, env: WorkerEnv): Promise<Response> {
  if (!isAuthorized(request, env)) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!env.HOT_INDEX) {
    return json({ error: "Vectorize binding is not configured" }, { status: 503 });
  }

  const payload = (await request.json()) as UpsertVectorsRequest;
  const vectors = payload.vectors ?? [];

  if (vectors.length === 0) {
    return json({ upserted: 0 });
  }

  await env.HOT_INDEX.upsert(vectors);
  return json({ upserted: vectors.length });
}
