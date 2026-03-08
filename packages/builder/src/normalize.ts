import { createHash } from "node:crypto";

import {
  buildCitation,
  buildPreview,
  chunkText,
  compactWhitespace,
  embedTexts,
  estimateTokenCount,
  slugId,
  type ChunkRecord,
  type DocumentMetadata,
  type DocumentPayload
} from "@drdre/shared";

import type { BuilderConfig } from "./config";
import type { SourceMapping } from "./sqlite-adapter";

function getString(row: Record<string, unknown>, key: string | null): string | null {
  if (!key) {
    return null;
  }

  const value = row[key];
  if (value === null || value === undefined) {
    return null;
  }

  return compactWhitespace(String(value));
}

function addMonths(date: Date, months: number): Date {
  const clone = new Date(date);
  clone.setMonth(clone.getMonth() + months);
  return clone;
}

export function normalizeRow(
  row: Record<string, unknown>,
  mapping: SourceMapping,
  snapshotDate: string,
  config: BuilderConfig
): DocumentPayload {
  const officialDocId = getString(row, mapping.columns.officialDocId) ?? getString(row, mapping.columns.id) ?? crypto.randomUUID();
  const publicationDate = getString(row, mapping.columns.publicationDate) ?? snapshotDate;
  const documentType = getString(row, mapping.columns.documentType);
  const number = getString(row, mapping.columns.number);
  const title = getString(row, mapping.columns.title) ?? `${documentType ?? "Documento"} ${number ?? officialDocId}`;
  const summary = getString(row, mapping.columns.summary);
  const bodyText = getString(row, mapping.columns.bodyText) ?? "";
  const id = slugId(`${officialDocId}-${publicationDate}`) || createHash("sha1").update(officialDocId).digest("hex");
  const officialUrl =
    getString(row, mapping.columns.officialUrl) ??
    config.sqlite?.officialUrlTemplate?.replace("{id}", officialDocId) ??
    `https://diariodarepublica.pt/dr/detalhe/${officialDocId}`;
  const updatedAt = new Date().toISOString();

  return {
    metadata: {
      id,
      officialDocId,
      publicationDate,
      series: getString(row, mapping.columns.series),
      documentType,
      number,
      title,
      summary,
      preview: buildPreview(summary, bodyText),
      citation: buildCitation({ documentType, number, publicationDate }),
      officialUrl,
      r2Key: `documents/${snapshotDate}/${id}.json`,
      snapshotDate,
      updatedAt
    },
    bodyText
  };
}

export function isHotDocument(publicationDate: string, hotWindowMonths: number): boolean {
  const cutoff = addMonths(new Date(), -hotWindowMonths);
  const documentDate = new Date(publicationDate);
  return !Number.isNaN(documentDate.getTime()) && documentDate >= cutoff;
}

export async function buildChunkRecords(documents: DocumentPayload[]): Promise<ChunkRecord[]> {
  const chunks: Array<Omit<ChunkRecord, "embedding">> = [];

  for (const document of documents) {
    const chunkTexts = chunkText(document.bodyText);
    chunkTexts.forEach((text, index) => {
      chunks.push({
        id: `${document.metadata.id}::${index}`,
        documentId: document.metadata.id,
        chunkIndex: index,
        text,
        tokenCount: estimateTokenCount(text),
        title: document.metadata.title,
        citation: document.metadata.citation,
        publicationDate: document.metadata.publicationDate,
        documentType: document.metadata.documentType,
        officialUrl: document.metadata.officialUrl
      });
    });
  }

  const embeddings = await embedTexts(
    chunks.map((chunk) => chunk.text),
    "passage"
  );

  return chunks.map((chunk, index) => ({
    ...chunk,
    embedding: embeddings[index] ?? []
  }));
}
