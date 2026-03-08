import type { DocumentMetadata } from "@drdre/shared";

export interface WorkerEnv {
  DB: D1Database;
  DOCUMENTS: R2Bucket;
  HOT_INDEX?: VectorizeIndex;
  ADMIN_TOKEN?: string;
  QUERY_EMBEDDING_URL?: string;
  QUERY_EMBEDDING_TOKEN?: string;
  SEARCH_CACHE_TTL_SECONDS?: string;
  HOT_WINDOW_MONTHS?: string;
}

export interface SearchRequestBody {
  q?: string;
  topK?: number;
  from?: string;
  to?: string;
  type?: string;
  queryVector?: number[];
}

export interface VectorDocument {
  id: string;
  values: number[];
  metadata: {
    documentId: string;
    title: string;
    citation: string;
    publicationDate: string;
    documentType?: string;
    officialUrl: string;
    snippet: string;
  };
}

export interface UpsertDocumentsRequest {
  documents: Array<DocumentMetadata>;
}

export interface UpsertVectorsRequest {
  vectors: VectorDocument[];
}
