#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { basename, join } from "node:path";

import { Command } from "commander";

import type { BuilderConfig } from "./config";
import { defaultConfig } from "./config";
import { bootstrap, buildArtifacts, syncR2, syncWorker } from "./pipeline";

async function loadConfig(configPath?: string): Promise<BuilderConfig> {
  if (!configPath) {
    return defaultConfig;
  }

  const raw = await readFile(configPath, "utf8");
  return {
    ...defaultConfig,
    ...JSON.parse(raw)
  } as BuilderConfig;
}

function inferSnapshotDate(snapshotUrl: string): string {
  const file = basename(snapshotUrl);
  const date = file.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : new Date().toISOString().slice(0, 10);
}

const program = new Command();

program.name("drdre-builder").description("Build and sync a free-tier-first DR search index");

program
  .command("bootstrap")
  .option("-c, --config <path>")
  .action(async (options) => {
    const config = await loadConfig(options.config);
    const result = await bootstrap(config);
    console.log(JSON.stringify(result, null, 2));
  });

program
  .command("build")
  .requiredOption("--sqlite <path>")
  .requiredOption("--snapshot-url <url>")
  .option("-c, --config <path>")
  .option("--snapshot-date <date>")
  .action(async (options) => {
    const config = await loadConfig(options.config);
    const manifest = await buildArtifacts({
      config,
      sqlitePath: options.sqlite,
      snapshotUrl: options.snapshotUrl,
      snapshotDate: options.snapshotDate ?? inferSnapshotDate(options.snapshotUrl)
    });

    console.log(JSON.stringify(manifest, null, 2));
  });

program
  .command("pipeline")
  .option("-c, --config <path>")
  .action(async (options) => {
    const config = await loadConfig(options.config);
    const bootstrapResult = await bootstrap(config);
    const manifest = await buildArtifacts({
      config,
      sqlitePath: bootstrapResult.sqlitePath,
      snapshotUrl: bootstrapResult.snapshotUrl,
      snapshotDate: inferSnapshotDate(bootstrapResult.snapshotUrl)
    });
    console.log(JSON.stringify(manifest, null, 2));
  });

program
  .command("sync-r2")
  .requiredOption("--manifest <path>")
  .option("-c, --config <path>")
  .action(async (options) => {
    const config = await loadConfig(options.config);
    await syncR2(config, options.manifest);
    console.log(`Uploaded shard artifacts from ${options.manifest}`);
  });

program
  .command("sync-worker")
  .requiredOption("--manifest <path>")
  .option("-c, --config <path>")
  .action(async (options) => {
    const config = await loadConfig(options.config);
    await syncWorker(config, options.manifest);
    console.log(`Pushed metadata and vectors from ${options.manifest}`);
  });

program.parseAsync(process.argv);
