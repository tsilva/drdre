import type { FtsMatch, SearchResult, SemanticMatch } from "./types";

const RRF_K = 60;

function mergeCandidate(
  map: Map<string, SearchResult>,
  candidate: FtsMatch | SemanticMatch,
  source: SearchResult["source"],
  rank: number
): void {
  const existing = map.get(candidate.documentId);
  const rrfScore = 1 / (RRF_K + rank + 1);

  if (!existing) {
    map.set(candidate.documentId, {
      documentId: candidate.documentId,
      title: candidate.title,
      citation: candidate.citation,
      publicationDate: candidate.publicationDate,
      snippet: candidate.snippet,
      score: rrfScore,
      officialUrl: candidate.officialUrl,
      source
    });
    return;
  }

  existing.score += rrfScore;

  if (source === "fts" || existing.source === "fts") {
    existing.source = source === existing.source ? source : "hybrid";
  } else if (source !== existing.source) {
    existing.source = "hybrid";
  }

  if (candidate.snippet.length > existing.snippet.length) {
    existing.snippet = candidate.snippet;
  }
}

export function reciprocalRankFuse(
  ftsMatches: FtsMatch[],
  semanticMatches: SemanticMatch[],
  limit = 10
): SearchResult[] {
  const byDocument = new Map<string, SearchResult>();

  ftsMatches.forEach((match, index) => mergeCandidate(byDocument, match, "fts", index));
  semanticMatches.forEach((match, index) => mergeCandidate(byDocument, match, "semantic", index));

  return [...byDocument.values()]
    .sort((left, right) => right.score - left.score)
    .slice(0, limit)
    .map((item) => ({
      ...item,
      score: Number(item.score.toFixed(6))
    }));
}

export function buildFtsQuery(query: string): string {
  const tokens = query.match(/[\p{L}\p{N}-]+/gu) ?? [];

  if (tokens.length === 0) {
    return "";
  }

  return tokens.map((token) => `"${token}"*`).join(" AND ");
}
