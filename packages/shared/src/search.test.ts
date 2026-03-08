import { describe, expect, it } from "vitest";

import { buildFtsQuery, reciprocalRankFuse } from "./search";

describe("buildFtsQuery", () => {
  it("normalizes tokens into an FTS query", () => {
    expect(buildFtsQuery("despacho 2196/2025")).toBe("\"despacho\"* AND \"2196\"* AND \"2025\"*");
  });
});

describe("reciprocalRankFuse", () => {
  it("merges sources into a hybrid result set", () => {
    const results = reciprocalRankFuse(
      [
        {
          documentId: "doc-1",
          title: "Despacho",
          citation: "Despacho | 2196/2025",
          publicationDate: "2025-02-01",
          officialUrl: "https://example.com/1",
          snippet: "fts snippet",
          score: 0.9
        }
      ],
      [
        {
          documentId: "doc-1",
          title: "Despacho",
          citation: "Despacho | 2196/2025",
          publicationDate: "2025-02-01",
          officialUrl: "https://example.com/1",
          snippet: "semantic snippet that is longer",
          score: 0.8
        },
        {
          documentId: "doc-2",
          title: "Portaria",
          citation: "Portaria | 12/2024",
          publicationDate: "2024-01-12",
          officialUrl: "https://example.com/2",
          snippet: "semantic only",
          score: 0.5
        }
      ],
      10
    );

    expect(results[0]?.documentId).toBe("doc-1");
    expect(results[0]?.source).toBe("hybrid");
    expect(results[0]?.snippet).toContain("semantic");
    expect(results[1]?.documentId).toBe("doc-2");
  });
});
