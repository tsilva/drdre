const SPACE_RE = /\s+/g;

export function compactWhitespace(value: string | null | undefined): string {
  return (value ?? "").replace(SPACE_RE, " ").trim();
}

export function buildCitation(input: {
  documentType?: string | null;
  number?: string | null;
  publicationDate?: string | null;
}): string {
  const parts = [input.documentType, input.number, input.publicationDate]
    .map((part) => compactWhitespace(part))
    .filter(Boolean);

  return parts.join(" | ");
}

export function buildPreview(summary: string | null | undefined, bodyText: string, maxChars = 280): string {
  const primary = compactWhitespace(summary);
  if (primary) {
    return primary.slice(0, maxChars);
  }

  return compactWhitespace(bodyText).slice(0, maxChars);
}

export function chunkText(text: string, targetTokens = 500, overlapTokens = 80): string[] {
  const words = compactWhitespace(text).split(" ").filter(Boolean);
  if (words.length === 0) {
    return [];
  }

  const step = Math.max(1, targetTokens - overlapTokens);
  const chunks: string[] = [];

  for (let index = 0; index < words.length; index += step) {
    const chunk = words.slice(index, index + targetTokens).join(" ");
    if (chunk) {
      chunks.push(chunk);
    }
    if (index + targetTokens >= words.length) {
      break;
    }
  }

  return chunks;
}

export function estimateTokenCount(text: string): number {
  return compactWhitespace(text).split(" ").filter(Boolean).length;
}

export function slugId(value: string): string {
  return compactWhitespace(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
