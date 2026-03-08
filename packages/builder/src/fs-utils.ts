import { createWriteStream } from "node:fs";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { pipeline } from "node:stream/promises";
import { gzipSync } from "node:zlib";

import bz2 from "unbzip2-stream";

export async function ensureDir(path: string): Promise<void> {
  await mkdir(path, { recursive: true });
}

export async function writeJson(path: string, value: unknown): Promise<void> {
  await ensureDir(dirname(path));
  await writeFile(path, JSON.stringify(value, null, 2));
}

export async function writeText(path: string, value: string): Promise<void> {
  await ensureDir(dirname(path));
  await writeFile(path, value);
}

export async function fileExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

export async function downloadFile(url: string, destination: string): Promise<void> {
  const response = await fetch(url);
  if (!response.ok || !response.body) {
    throw new Error(`Failed to download ${url}: ${response.status}`);
  }

  await ensureDir(dirname(destination));
  await pipeline(response.body as any, createWriteStream(destination));
}

export async function extractBz2(source: string, destination: string): Promise<void> {
  await ensureDir(dirname(destination));
  const input = (await import("node:fs")).createReadStream(source);
  const output = createWriteStream(destination);
  await pipeline(input, bz2(), output);
}

export async function writeGzipJson(path: string, rows: unknown[]): Promise<void> {
  await ensureDir(dirname(path));
  const payload = rows.map((row) => JSON.stringify(row)).join("\n");
  await writeFile(path, gzipSync(payload));
}

export async function readJson<T>(path: string): Promise<T> {
  const raw = await readFile(path, "utf8");
  return JSON.parse(raw) as T;
}
