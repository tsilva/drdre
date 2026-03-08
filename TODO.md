# TODO

## 1. Create Cloudflare resources

Run these from [/Users/tsilva/repos/tsilva/drdre](/Users/tsilva/repos/tsilva/drdre):

```bash
npx wrangler login
npx wrangler d1 create drdre-catalog
npx wrangler r2 bucket create drdre-documents
npx wrangler vectorize create drdre-hot --dimensions=384 --metric=cosine
```

Copy the returned IDs and names.

## 2. Update Worker config

Edit [apps/worker/wrangler.toml](/Users/tsilva/repos/tsilva/drdre/apps/worker/wrangler.toml):

- Replace `database_id = "replace-me"`
- Confirm the D1, R2, and Vectorize names match what you created

## 3. Apply the D1 schema

```bash
npx wrangler d1 execute drdre-catalog --file apps/worker/migrations/0001_init.sql
```

## 4. Set the Worker admin secret

```bash
npx wrangler secret put ADMIN_TOKEN
```

Use a strong random value and save it for the builder config.

## 5. Deploy the Worker

```bash
npx wrangler deploy
```

After deploy, note the Worker URL, for example:

`https://drdre-api.<your-subdomain>.workers.dev`

## 6. Prepare the web app env

Create `.env.local` in [/Users/tsilva/repos/tsilva/drdre/apps/web](/Users/tsilva/repos/tsilva/drdre/apps/web) with:

```env
NEXT_PUBLIC_SEARCH_API_BASE_URL=https://drdre-api.<your-subdomain>.workers.dev
```

## 7. Test the UI locally

```bash
npm run dev:web
```

Open `http://localhost:3000`.

It will load, but search will be empty until data is ingested.

## 8. Create the builder config

Copy the example:

```bash
cp builder.config.example.json builder.config.json
```

Edit [builder.config.json](/Users/tsilva/repos/tsilva/drdre/builder.config.json) and fill in:

- `adminApiBaseUrl`: your Worker URL
- `adminToken`: the same secret from step 4
- `r2.endpoint`
- `r2.bucket`
- `r2.accessKeyId`
- `r2.secretAccessKey`

If you do not have R2 API keys yet, create them in the Cloudflare dashboard first.

## 9. Download and build the DR dataset

```bash
npx tsx packages/builder/src/index.ts pipeline --config builder.config.json
```

This will:

- find the latest DR SQLite snapshot
- download it
- extract it
- normalize records
- generate:
  - `data/build/<snapshot-date>/manifest.json`
  - `data/build/<snapshot-date>/catalog.seed.sql`
  - `data/build/<snapshot-date>/hot-vectors.json`
  - shard files for R2

## 10. Inspect the build output

Check:

- [data/build](/Users/tsilva/repos/tsilva/drdre/data/build)
- the generated `manifest.json`
- document and chunk counts

If the builder fails on SQLite schema detection, stop there and adapt the mapping in `builder.config.json`.

## 11. Upload the cold artifacts to R2

```bash
npx tsx packages/builder/src/index.ts sync-r2 --config builder.config.json --manifest data/build/<snapshot-date>/manifest.json
```

Replace `<snapshot-date>` with the real folder name.

## 12. Push metadata and vectors to Cloudflare

```bash
npx tsx packages/builder/src/index.ts sync-worker --config builder.config.json --manifest data/build/<snapshot-date>/manifest.json
```

This populates:

- D1 `documents`
- D1 `documents_fts`
- Vectorize hot index

## 13. Smoke test the API

Try:

```bash
curl "https://drdre-api.<your-subdomain>.workers.dev/api/search?q=despacho%202196%202025"
```

Then fetch one returned document:

```bash
curl "https://drdre-api.<your-subdomain>.workers.dev/api/document/<document-id>"
```

## 14. Deploy the frontend to Vercel

In Vercel:

- import the repo
- set Root Directory to `apps/web`
- add env var:
  - `NEXT_PUBLIC_SEARCH_API_BASE_URL=https://drdre-api.<your-subdomain>.workers.dev`

Then deploy.

## 15. Set the regular refresh routine

For now, run this manually on your machine weekly:

```bash
npx tsx packages/builder/src/index.ts pipeline --config builder.config.json
npx tsx packages/builder/src/index.ts sync-r2 --config builder.config.json --manifest data/build/<snapshot-date>/manifest.json
npx tsx packages/builder/src/index.ts sync-worker --config builder.config.json --manifest data/build/<snapshot-date>/manifest.json
```

Best next move: complete steps 1 to 5 first. Once the Worker is live, fill [builder.config.json](/Users/tsilva/repos/tsilva/drdre/builder.config.json).
