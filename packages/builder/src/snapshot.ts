import { basename, join } from "node:path";

import { ensureDir, extractBz2, fileExists, downloadFile } from "./fs-utils";

const SQLITE_SNAPSHOT_RE = /href="([^"]+DRE\.sqlite3\.bz2)"/gi;

export async function resolveLatestSnapshotUrl(baseUrl: string): Promise<string> {
  const response = await fetch(`${baseUrl}/?P=*DRE*.bz2`);
  if (!response.ok) {
    throw new Error(`Failed to read snapshot listing: ${response.status}`);
  }

  const html = await response.text();
  const matches = [...html.matchAll(SQLITE_SNAPSHOT_RE)].map((match) => match[1]);
  if (matches.length === 0) {
    throw new Error("Could not find a SQLite snapshot in the listing");
  }

  const latest = matches.sort().at(-1);
  if (!latest) {
    throw new Error("Snapshot listing was empty");
  }

  return `${baseUrl}/${latest}`;
}

export async function ensureSnapshotFiles(params: {
  snapshotUrl: string;
  workingDirectory: string;
}): Promise<{ archivePath: string; sqlitePath: string }> {
  const archivePath = join(params.workingDirectory, "downloads", basename(params.snapshotUrl));
  const sqlitePath = archivePath.replace(/\.bz2$/, "");

  await ensureDir(join(params.workingDirectory, "downloads"));

  if (!(await fileExists(archivePath))) {
    await downloadFile(params.snapshotUrl, archivePath);
  }

  if (!(await fileExists(sqlitePath))) {
    await extractBz2(archivePath, sqlitePath);
  }

  return { archivePath, sqlitePath };
}
