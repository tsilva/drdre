CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  official_doc_id TEXT NOT NULL,
  publication_date TEXT NOT NULL,
  series TEXT,
  document_type TEXT,
  number TEXT,
  title TEXT NOT NULL,
  summary TEXT,
  preview TEXT,
  citation TEXT NOT NULL,
  official_url TEXT NOT NULL,
  r2_key TEXT NOT NULL,
  snapshot_date TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_documents_publication_date ON documents(publication_date);
CREATE INDEX IF NOT EXISTS idx_documents_document_type ON documents(document_type);
CREATE INDEX IF NOT EXISTS idx_documents_number ON documents(number);

CREATE VIRTUAL TABLE IF NOT EXISTS documents_fts USING fts5(
  id UNINDEXED,
  title,
  summary,
  citation,
  number,
  tokenize = "unicode61 remove_diacritics 2"
);
