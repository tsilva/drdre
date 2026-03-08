export type SearchResultSource = "fts" | "semantic" | "hybrid";

export interface SearchFilters {
  from?: string;
  to?: string;
  type?: string;
}

export interface DocumentMetadata {
  id: string;
  officialDocId: string;
  publicationDate: string;
  series: string | null;
  documentType: string | null;
  number: string | null;
  title: string;
  summary: string | null;
  preview: string | null;
  citation: string;
  officialUrl: string;
  r2Key: string;
  snapshotDate: string;
  updatedAt: string;
}

export interface DocumentPayload {
  metadata: DocumentMetadata;
  bodyText: string;
}

export interface SearchResult {
  documentId: string;
  title: string;
  citation: string;
  publicationDate: string;
  snippet: string;
  score: number;
  officialUrl: string;
  source: SearchResultSource;
}

export interface SemanticMatch {
  documentId: string;
  title: string;
  citation: string;
  publicationDate: string;
  officialUrl: string;
  snippet: string;
  score: number;
}

export interface FtsMatch {
  documentId: string;
  title: string;
  citation: string;
  publicationDate: string;
  officialUrl: string;
  snippet: string;
  score: number;
}

export interface ChunkRecord {
  id: string;
  documentId: string;
  chunkIndex: number;
  text: string;
  tokenCount: number;
  embedding: number[];
  title: string;
  citation: string;
  publicationDate: string;
  documentType: string | null;
  officialUrl: string;
}

export interface BuilderManifest {
  snapshotDate: string;
  downloadedFrom: string;
  sourceSqlitePath: string;
  generatedAt: string;
  documentCount: number;
  hotDocumentCount: number;
  chunkCount: number;
  shards: Array<{
    key: string;
    file: string;
    count: number;
  }>;
  d1: {
    seedSqlFile: string;
  };
  vectorize: {
    file: string;
    count: number;
  };
}
