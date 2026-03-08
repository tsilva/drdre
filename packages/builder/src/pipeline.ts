import { dirname, join } from "node:path";

import type { BuilderManifest, ChunkRecord, DocumentPayload } from "@drdre/shared";

import type { BuilderConfig } from "./config";
import { pushDocumentsToWorker, pushVectorsToWorker, uploadFilesToR2 } from "./cloudflare";
import { ensureDir, readJson, writeGzipJson, writeJson, writeText } from "./fs-utils";
import { buildChunkRecords, isHotDocument, normalizeRow } from "./normalize";
import { resolveLatestSnapshotUrl, ensureSnapshotFiles } from "./snapshot";
import { discoverSourceMapping, readSourceRows } from "./sqlite-adapter";

export async function bootstrap(config: BuilderConfig): Promise<{ snapshotUrl: string; sqlitePath: string }> {
  const snapshotUrl = await resolveLatestSnapshotUrl(config.sourceBaseUrl);
  const files = await ensureSnapshotFiles({
    snapshotUrl,
    workingDirectory: config.workingDirectory
  });

  return {
    snapshotUrl,
    sqlitePath: files.sqlitePath
  };
}

function escapeSqlString(value: string | null | undefined): string {
  return value === null || value === undefined ? "NULL" : `'${value.replace(/'/g, "''")}'`;
}

function buildD1SeedSql(documents: DocumentPayload[]): string {
  const lines = [
    "DELETE FROM documents;",
    "DELETE FROM documents_fts;"
  ];

  for (const document of documents) {
    const metadata = document.metadata;
    lines.push(
      `INSERT INTO documents (id, official_doc_id, publication_date, series, document_type, number, title, summary, preview, citation, official_url, r2_key, snapshot_date, updated_at) VALUES (${[
        metadata.id,
        metadata.officialDocId,
        metadata.publicationDate,
        metadata.series,
        metadata.documentType,
        metadata.number,
        metadata.title,
        metadata.summary,
        metadata.preview,
        metadata.citation,
        metadata.officialUrl,
        metadata.r2Key,
        metadata.snapshotDate,
        metadata.updatedAt
      ]
        .map(escapeSqlString)
        .join(", ")});`
    );

    lines.push(
      `INSERT INTO documents_fts (id, title, summary, citation, number) VALUES (${[
        metadata.id,
        metadata.title,
        metadata.summary,
        metadata.citation,
        metadata.number
      ]
        .map(escapeSqlString)
        .join(", ")});`
    );
  }

  return lines.join("\n");
}

function shardDocuments(snapshotDate: string, documents: DocumentPayload[], shardSize: number) {
  const shards: Array<{ key: string; rows: DocumentPayload[] }> = [];

  for (let index = 0; index < documents.length; index += shardSize) {
    const rows = documents.slice(index, index + shardSize);
    const shardIndex = String(Math.floor(index / shardSize)).padStart(5, "0");
    shards.push({
      key: `shards/${snapshotDate}/documents-${shardIndex}.jsonl.gz`,
      rows
    });
  }

  return shards;
}

export async function buildArtifacts(params: {
  config: BuilderConfig;
  sqlitePath: string;
  snapshotUrl: string;
  snapshotDate: string;
}): Promise<BuilderManifest> {
  const { config, sqlitePath, snapshotDate, snapshotUrl } = params;
  const outputDirectory = join(config.workingDirectory, "build", snapshotDate);
  await ensureDir(outputDirectory);

  const mapping = discoverSourceMapping(sqlitePath, config);
  const rows = readSourceRows(sqlitePath, mapping);
  const documents = rows.map((row) => normalizeRow(row, mapping, snapshotDate, config));
  const hotDocuments = documents.filter((document) =>
    isHotDocument(document.metadata.publicationDate, config.hotWindowMonths)
  );
  const chunks = await buildChunkRecords(hotDocuments);

  const shards = shardDocuments(snapshotDate, documents, config.shardSize);
  for (const shard of shards) {
    await writeGzipJson(join(outputDirectory, basenameForKey(shard.key)), shard.rows);
  }

  const seedSqlPath = join(outputDirectory, "catalog.seed.sql");
  await writeText(seedSqlPath, buildD1SeedSql(documents));

  const vectorFile = join(outputDirectory, "hot-vectors.json");
  await writeJson(
    vectorFile,
    chunks.map((chunk) => ({
      id: chunk.id,
      values: chunk.embedding,
      metadata: {
        documentId: chunk.documentId,
        title: chunk.title,
        citation: chunk.citation,
        publicationDate: chunk.publicationDate,
        ...(chunk.documentType ? { documentType: chunk.documentType } : {}),
        officialUrl: chunk.officialUrl,
        snippet: chunk.text.slice(0, 320)
      }
    }))
  );

  const manifest: BuilderManifest = {
    snapshotDate,
    downloadedFrom: snapshotUrl,
    sourceSqlitePath: sqlitePath,
    generatedAt: new Date().toISOString(),
    documentCount: documents.length,
    hotDocumentCount: hotDocuments.length,
    chunkCount: chunks.length,
    shards: shards.map((shard) => ({
      key: shard.key,
      file: join(outputDirectory, basenameForKey(shard.key)),
      count: shard.rows.length
    })),
    d1: {
      seedSqlFile: seedSqlPath
    },
    vectorize: {
      file: vectorFile,
      count: chunks.length
    }
  };

  await writeJson(join(outputDirectory, "manifest.json"), manifest);
  return manifest;
}

function basenameForKey(key: string): string {
  return key.split("/").at(-1) ?? key;
}

export async function syncR2(config: BuilderConfig, manifestPath: string): Promise<void> {
  const manifest = await readJson<BuilderManifest>(manifestPath);
  const uploads = manifest.shards.map((shard) => ({
    file: shard.file,
    key: shard.key
  }));

  await uploadFilesToR2(config, uploads);
}

export async function syncWorker(config: BuilderConfig, manifestPath: string): Promise<void> {
  const manifest = await readJson<BuilderManifest>(manifestPath);
  const documents = await Promise.all(
    manifest.shards.map(async (shard) => {
      const rows = await readJsonLinesGzip(shard.file);
      return rows.map((row) => row.metadata);
    })
  );
  await pushDocumentsToWorker(config, documents.flat());

  const vectors = await readJson<unknown[]>(manifest.vectorize.file);
  await pushVectorsToWorker(config, vectors);
}

async function readJsonLinesGzip(path: string): Promise<DocumentPayload[]> {
  const zlib = await import("node:zlib");
  const { readFile } = await import("node:fs/promises");
  const raw = await readFile(path);
  const text = zlib.gunzipSync(raw).toString("utf8");
  return text
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as DocumentPayload);
}
