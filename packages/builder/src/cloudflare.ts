import { readFile } from "node:fs/promises";
import { basename } from "node:path";

import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

import type { BuilderConfig } from "./config";

function createR2Client(config: BuilderConfig): S3Client {
  if (!config.r2) {
    throw new Error("Missing R2 configuration");
  }

  return new S3Client({
    region: "auto",
    endpoint: config.r2.endpoint,
    credentials: {
      accessKeyId: config.r2.accessKeyId,
      secretAccessKey: config.r2.secretAccessKey
    }
  });
}

export async function uploadFilesToR2(config: BuilderConfig, uploads: Array<{ file: string; key: string }>): Promise<void> {
  if (!config.r2) {
    throw new Error("Missing R2 configuration");
  }

  const client = createR2Client(config);

  for (const upload of uploads) {
    const body = await readFile(upload.file);
    await client.send(
      new PutObjectCommand({
        Bucket: config.r2.bucket,
        Key: upload.key,
        Body: body,
        ContentType: upload.file.endsWith(".json") ? "application/json" : "application/gzip"
      })
    );
  }
}

export async function pushDocumentsToWorker(config: BuilderConfig, documents: unknown[]): Promise<void> {
  if (!config.adminApiBaseUrl || !config.adminToken) {
    throw new Error("Missing Worker admin API configuration");
  }

  const response = await fetch(`${config.adminApiBaseUrl}/admin/documents/upsert`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-admin-token": config.adminToken
    },
    body: JSON.stringify({ documents })
  });

  if (!response.ok) {
    throw new Error(`Document upsert failed: ${response.status} ${await response.text()}`);
  }
}

export async function pushVectorsToWorker(config: BuilderConfig, vectors: unknown[]): Promise<void> {
  if (!config.adminApiBaseUrl || !config.adminToken) {
    throw new Error("Missing Worker admin API configuration");
  }

  const response = await fetch(`${config.adminApiBaseUrl}/admin/vectors/upsert`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-admin-token": config.adminToken
    },
    body: JSON.stringify({ vectors })
  });

  if (!response.ok) {
    throw new Error(`Vector upsert failed: ${response.status} ${await response.text()}`);
  }
}
