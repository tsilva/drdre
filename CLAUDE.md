# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

DR.DRE is a free-tier-first semantic search engine for Portugal's Diário da República (Official Journal). It uses hybrid search combining FTS5 full-text search with semantic vector search (multilingual-e5-small, 384-dim). Browser-side embedding generation keeps server costs near zero.

## Architecture

Monorepo with npm workspaces:

- **apps/web** — Next.js 15 frontend (Vercel). Search UI with client-side embedding via `@xenova/transformers`.
- **apps/worker** — Cloudflare Worker API. Hybrid search over D1 (SQLite/FTS5) + Vectorize, cold document retrieval from R2.
- **packages/shared** — Shared types, embedding wrapper, RRF ranking logic, text utilities. Imported as `@drdre/shared`.
- **packages/builder** — Node.js CLI tool. Downloads DRE SQLite snapshots, normalizes documents, generates embeddings, shards to R2, syncs metadata/vectors to the Worker.

Data flow: SQLite snapshot → normalize/embed (builder) → shard to R2 + sync D1/Vectorize → Worker serves hybrid search → browser re-ranks.

## Commands

```bash
# Install
npm install

# Dev servers
npm run dev:web          # Next.js on :3000
npm run dev:worker       # Wrangler on :8787

# Build & check
npm run build            # Build all workspaces
npm run typecheck        # TypeScript check all workspaces

# Tests
npm test                 # All workspaces
npx vitest run -t "test name"                    # Single test by name
npx vitest run packages/shared/src/search.test.ts # Single test file

# Builder CLI
npx tsx packages/builder/src/index.ts pipeline --config builder.config.json
npx tsx packages/builder/src/index.ts sync-r2 --config builder.config.json --manifest <path>
npx tsx packages/builder/src/index.ts sync-worker --config builder.config.json --manifest <path>

# Worker deployment
cd apps/worker && npx wrangler deploy
```

## Key Patterns

- **Hybrid search**: RRF (Reciprocal Rank Fusion, K=60) merges FTS5 and semantic results. Core logic in `packages/shared/src/search.ts`.
- **Embedding prefix convention**: queries use `"query: ..."`, documents use `"passage: ..."` (E5 model requirement).
- **Graceful degradation**: if Vectorize is unavailable, Worker falls back to FTS-only search.
- **Worker bindings**: typed via `WorkerEnv` in `apps/worker/src/types.ts`. D1, R2, Vectorize, and KV bindings configured in `wrangler.toml`.
- **Admin endpoints**: `POST /admin/documents/upsert` and `POST /admin/vectors/upsert` are protected by `ADMIN_TOKEN` secret.
- **Document IDs**: slugified `officialDocId-publicationDate` hash. Cold storage uses R2 shards (200 docs/shard default).
- **Hot window**: last 24 months of semantic vectors in Vectorize; older docs searchable via FTS only.

## Configuration

- `builder.config.json` — Builder CLI config (see `builder.config.example.json` for template)
- `apps/worker/wrangler.toml` — Cloudflare Worker bindings and env vars
- `tsconfig.base.json` — Shared TypeScript config (target ES2022, strict mode)

## Maintenance

- README.md must be kept up to date with any significant project changes.
