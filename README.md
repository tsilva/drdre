# DR.DRE

Free-tier-first semantic search for Portugal's Diário da República.

## What is implemented

- `apps/web`: Vercel-ready Next.js frontend.
- `apps/worker`: Cloudflare Worker API backed by D1, R2, and Vectorize.
- `packages/builder`: local builder that downloads the weekly SQLite snapshot, normalizes documents, creates cold-storage shards, generates the hot semantic vector file, and syncs metadata/vectors to the Worker.
- `packages/shared`: shared types, ranking logic, text utilities, and the `multilingual-e5-small` embedding helper used by both the builder and the browser search client.

## Repository layout

- [`apps/web`](/Users/tsilva/repos/tsilva/drdre/apps/web)
- [`apps/worker`](/Users/tsilva/repos/tsilva/drdre/apps/worker)
- [`packages/builder`](/Users/tsilva/repos/tsilva/drdre/packages/builder)
- [`packages/shared`](/Users/tsilva/repos/tsilva/drdre/packages/shared)
- [`builder.config.example.json`](/Users/tsilva/repos/tsilva/drdre/builder.config.example.json)

## Runtime architecture

- Vercel serves the UI.
- Cloudflare Worker serves `/api/search` and `/api/document/:id`.
- D1 stores metadata and FTS5 lexical search.
- R2 stores full document payloads as compressed shard artifacts.
- Vectorize stores embeddings for the hot semantic window.
- The browser can generate the query embedding locally for hybrid search, which keeps hosted runtime costs down and matches the local builder model.

## Local setup

```bash
npm install
npm run build
npm test
```

To run the UI locally:

```bash
NEXT_PUBLIC_SEARCH_API_BASE_URL=http://127.0.0.1:8787 npm run dev:web
```

To run the Worker locally:

```bash
npm run dev:worker
```

## Cloudflare setup

1. Create the D1 database, R2 bucket, and Vectorize index.
2. Update [`apps/worker/wrangler.toml`](/Users/tsilva/repos/tsilva/drdre/apps/worker/wrangler.toml) with the real D1 database ID and bucket/index names.
3. Apply the schema:

```bash
npx wrangler d1 execute drdre-catalog --file apps/worker/migrations/0001_init.sql
```

4. Set the Worker secret used by the local builder for admin sync:

```bash
npx wrangler secret put ADMIN_TOKEN
```

5. Deploy the Worker:

```bash
npm run build --workspace @drdre/worker
npx wrangler deploy
```

## Vercel setup

Set:

- `NEXT_PUBLIC_SEARCH_API_BASE_URL=https://<your-worker-domain>`

Then deploy [`apps/web`](/Users/tsilva/repos/tsilva/drdre/apps/web) to Vercel.

## Builder workflow

Copy the example config:

```bash
cp builder.config.example.json builder.config.json
```

Fill in:

- `adminApiBaseUrl`
- `adminToken`
- R2 credentials and endpoint
- optional SQLite table/column overrides if the snapshot schema changes

### Bootstrap and build

```bash
npx tsx packages/builder/src/index.ts pipeline --config builder.config.json
```

This:

- finds the latest `DRE.sqlite3.bz2`
- downloads and extracts it into `data/downloads/`
- normalizes documents
- writes build artifacts into `data/build/<snapshot-date>/`

Important build outputs:

- `manifest.json`
- `catalog.seed.sql`
- `hot-vectors.json`
- compressed shard files for R2

### Upload cold artifacts to R2

```bash
npx tsx packages/builder/src/index.ts sync-r2 --config builder.config.json --manifest data/build/<snapshot-date>/manifest.json
```

### Push metadata and vectors to the Worker

```bash
npx tsx packages/builder/src/index.ts sync-worker --config builder.config.json --manifest data/build/<snapshot-date>/manifest.json
```

The Worker exposes two protected admin endpoints for this:

- `POST /admin/documents/upsert`
- `POST /admin/vectors/upsert`

## Search behavior

- `POST /api/search` accepts `q`, optional filters, and optional `queryVector`.
- `GET /api/search?q=...` works for lexical search without a client-side embedding.
- `GET /api/document/:id` resolves metadata from D1 and body text from R2.
- If Vectorize is unavailable, the Worker degrades to FTS-only search.
- If R2 is unavailable, search still returns metadata hits and snippets.

## Notes and current limits

- The builder currently assumes the DR mirror SQLite file is the main bootstrap source.
- Source-table detection is heuristic; if the upstream SQLite schema changes, set explicit overrides in `builder.config.json`.
- The browser-side embedding model increases first-search payload size. That is intentional for free-tier hosting, but if you later add a paid component, a dedicated query-embedding service is the first thing to move server-side.
