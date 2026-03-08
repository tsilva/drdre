import Database from "better-sqlite3";

import type { BuilderConfig, NormalizedColumnName } from "./config";

const CANDIDATES: Record<NormalizedColumnName, string[]> = {
  id: ["id", "document_id", "doc_id"],
  officialDocId: ["dre_id", "official_doc_id", "official_id", "doc_id", "id"],
  publicationDate: ["date", "publication_date", "doc_date", "published_at"],
  series: ["series", "serie"],
  documentType: ["doc_type", "document_type", "type"],
  number: ["number", "doc_number"],
  title: ["title", "name", "doc_name"],
  summary: ["summary", "digesto", "digest", "notes"],
  bodyText: ["text", "body", "body_text", "content", "full_text"],
  officialUrl: ["url", "official_url", "document_url"]
};

export interface SourceMapping {
  table: string;
  columns: Record<NormalizedColumnName, string | null>;
}

function scoreTable(columnNames: string[]): number {
  const lower = new Set(columnNames.map((name) => name.toLowerCase()));
  let score = 0;

  for (const candidates of Object.values(CANDIDATES)) {
    if (candidates.some((candidate) => lower.has(candidate))) {
      score += 1;
    }
  }

  return score;
}

export function discoverSourceMapping(sqlitePath: string, config: BuilderConfig): SourceMapping {
  const database = new Database(sqlitePath, { readonly: true });

  try {
    if (config.sqlite?.table && config.sqlite.columns) {
      return {
        table: config.sqlite.table,
        columns: {
          id: config.sqlite.columns.id ?? null,
          officialDocId: config.sqlite.columns.officialDocId ?? null,
          publicationDate: config.sqlite.columns.publicationDate ?? null,
          series: config.sqlite.columns.series ?? null,
          documentType: config.sqlite.columns.documentType ?? null,
          number: config.sqlite.columns.number ?? null,
          title: config.sqlite.columns.title ?? null,
          summary: config.sqlite.columns.summary ?? null,
          bodyText: config.sqlite.columns.bodyText ?? null,
          officialUrl: config.sqlite.columns.officialUrl ?? null
        }
      };
    }

    const tables = database
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
      .all() as Array<{ name: string }>;

    const ranked = tables
      .map((table) => {
        const columns = database.prepare(`PRAGMA table_info(${table.name})`).all() as Array<{ name: string }>;
        return {
          table: table.name,
          columnNames: columns.map((column) => column.name),
          score: scoreTable(columns.map((column) => column.name))
        };
      })
      .sort((left, right) => right.score - left.score);

    const selected = ranked.at(0);
    if (!selected) {
      throw new Error("No candidate tables found in the SQLite snapshot");
    }

    const lowerNames = selected.columnNames.map((column) => column.toLowerCase());
    const columns = Object.fromEntries(
      Object.entries(CANDIDATES).map(([key, candidates]) => {
        const exact = candidates.find((candidate) => lowerNames.includes(candidate));
        if (!exact) {
          return [key, null];
        }
        const index = lowerNames.indexOf(exact);
        return [key, selected.columnNames[index] ?? null];
      })
    ) as Record<NormalizedColumnName, string | null>;

    return {
      table: selected.table,
      columns
    };
  } finally {
    database.close();
  }
}

export function readSourceRows(sqlitePath: string, mapping: SourceMapping): Record<string, unknown>[] {
  const database = new Database(sqlitePath, { readonly: true });

  try {
    return database.prepare(`SELECT * FROM ${mapping.table}`).all() as Record<string, unknown>[];
  } finally {
    database.close();
  }
}
