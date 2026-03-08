import { describe, expect, it } from "vitest";

import type { BuilderConfig } from "./config";
import { defaultConfig } from "./config";
import { normalizeRow } from "./normalize";
import type { SourceMapping } from "./sqlite-adapter";

describe("normalizeRow", () => {
  it("maps a source row into metadata and payload", () => {
    const mapping: SourceMapping = {
      table: "documents",
      columns: {
        id: "id",
        officialDocId: "official_id",
        publicationDate: "published_at",
        series: "series",
        documentType: "type",
        number: "number",
        title: "title",
        summary: "summary",
        bodyText: "body",
        officialUrl: "url"
      }
    };

    const document = normalizeRow(
      {
        id: 1,
        official_id: "2196-2025",
        published_at: "2025-02-01",
        series: "I",
        type: "Despacho",
        number: "2196/2025",
        title: "Despacho n.º 2196/2025",
        summary: "Resumo curto",
        body: "Texto legal",
        url: "https://example.com/doc"
      },
      mapping,
      "2026-03-01",
      defaultConfig as BuilderConfig
    );

    expect(document.metadata.officialDocId).toBe("2196-2025");
    expect(document.metadata.title).toContain("Despacho");
    expect(document.bodyText).toBe("Texto legal");
    expect(document.metadata.r2Key).toContain("2026-03-01");
  });
});
