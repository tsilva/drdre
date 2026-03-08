import { pipeline } from "@xenova/transformers";

let extractorPromise: Promise<any> | undefined;

async function getExtractor() {
  if (!extractorPromise) {
    extractorPromise = pipeline("feature-extraction", "Xenova/multilingual-e5-small");
  }

  return extractorPromise;
}

export async function embedTexts(texts: string[], prefix: "query" | "passage"): Promise<number[][]> {
  const extractor = await getExtractor();
  const vectors: number[][] = [];

  for (const text of texts) {
    const output = await extractor(`${prefix}: ${text}`, {
      pooling: "mean",
      normalize: true
    });

    vectors.push(Array.from(output.data as Float32Array));
  }

  return vectors;
}
