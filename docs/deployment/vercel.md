# Deployment Guide

This guide covers deploying the PDF Extractor to Vercel for the first time, including Blob storage setup, environment variable configuration, and troubleshooting common issues.

---

## 1. Prerequisites

- **Node.js 18 or higher** — check with `node --version`
- **A [Vercel account](https://vercel.com)**
- **Vercel CLI** — install globally: `npm i -g vercel`
- **An Anthropic API key** — obtain one at [console.anthropic.com](https://console.anthropic.com)

---

## 2. First-Time Vercel Setup

Run these steps once from the project root before your first deploy.

1. **Link the project to Vercel:**
   ```bash
   vercel link
   ```
   Follow the prompts to connect to an existing Vercel project or create a new one.

2. **Provision Vercel Blob storage:**
   ```bash
   vercel storage add blob
   ```
   This creates a Blob store and automatically adds the `BLOB_READ_WRITE_TOKEN` environment variable to your Vercel project.

3. **Add the Anthropic API key:**
   ```bash
   vercel env add ANTHROPIC_API_KEY
   ```
   When prompted, select all environments (Production, Preview, Development), then paste your key.

4. **Pull environment variables for local development:**
   ```bash
   vercel env pull .env.local
   ```
   This writes a local `.env.local` file with all project env vars so your local dev server can reach Blob and Claude.

---

## 3. Deploy

**One-shot deploy to production:**
```bash
vercel --prod
```
Run this from the project root. Vercel will build the frontend and deploy the serverless function.

**Git-connected CI/CD (recommended):**
Connect the GitHub repository in the Vercel dashboard under **Settings → Git**. After connecting, every push to `main` triggers an automatic production deployment — no manual `vercel --prod` needed.

---

## 4. Environment Variables

| Variable | Required | Purpose | Where to get |
|---|---|---|---|
| `ANTHROPIC_API_KEY` | Yes | Authenticates Claude API calls | [console.anthropic.com](https://console.anthropic.com) |
| `BLOB_READ_WRITE_TOKEN` | Yes | Vercel Blob read/write access | Auto-added by `vercel storage add blob` |
| `INNGEST_EVENT_KEY` | Yes (production UI) | Queues `POST /api/extract/jobs` work to Inngest | [app.inngest.com](https://app.inngest.com) → Manage → API keys |
| `INNGEST_SIGNING_KEY` | Yes (production UI) | Verifies Inngest calls to `POST/GET /api/inngest` on your app | Same Inngest dashboard |
| `NODE_ENV` | No | Runtime environment (defaults to `production` on Vercel) | Set to `development` locally |
| `VITE_API_BASE_URL` | Local dev only | Frontend API base URL | `http://localhost:3001` locally; not set on Vercel (same-origin) |

After deploy, confirm async extraction is wired: **`GET https://<your-deployment>/api/health`** should return JSON with `asyncExtraction.ready: true`. If `ready` is `false`, open `asyncExtraction.missing` — add those variables in **Vercel → Settings → Environment Variables**, redeploy, and confirm the Inngest app is synced to the same deployment URL (Inngest dashboard → Apps → your app → sync / serve).

### 4b. Verification checklist (Blob 403 / Inngest)

Use this when jobs upload but **Inngest steps** or **`GET /api/extract/jobs/:id`** intermittently fail with Blob `403 Forbidden`:

1. **Inngest sync URL** — In [Inngest](https://app.inngest.com) → your app → **Sync** (or environment URL), the base URL must be exactly the Vercel deployment that serves **`/api/inngest`** (for example `https://your-project.vercel.app`), not an old preview URL, not `localhost`, and not a different Vercel project. Inngest invokes that host for every pipeline step; a mismatched URL can point at an app missing or using the wrong env.
2. **`BLOB_READ_WRITE_TOKEN` per environment** — In **Vercel → Settings → Environment Variables**, confirm `BLOB_READ_WRITE_TOKEN` is set for **Production** (and **Preview** if you use preview deployments). It must belong to the **same** Blob store the app writes to. After rotating the token in Vercel Storage, **redeploy** so running functions pick up the new value.
3. **Health check** — `GET /api/health` → `asyncExtraction.ready: true` confirms both `BLOB_READ_WRITE_TOKEN` and `INNGEST_EVENT_KEY` are present (trimmed non-empty) in that deployment.

### 4a. Scan-only PDFs (OCR)

Image-only or non-selectable PDFs need **server-side OCR**. Without it, native text is empty and extraction returns little or no structured data.

| Variable | Example value | Purpose |
|---|---|---|
| `OCR_ENGINE` | `tesseract` | **Default in code is `tesseract`.** Set `OCR_ENGINE=none` to skip OCR. Override in Vercel only if you need that behavior in deploy. |
| `OCR_SPARSE_CHAR_THRESHOLD` | `80` | Page is an OCR candidate when native trimmed length is below this (or fails the alphanumeric ratio below). |
| `OCR_SPARSE_MIN_ALNUM_RATIO` | `0.12` | Set `0` or empty to disable. Long junk native layers with ratio below this still count as sparse. |
| `AUTO_OCR_NATIVE_TOTAL_CHARS_THRESHOLD` | `500` | When **total** native characters across the whole PDF is below this and `OCR_ENGINE=tesseract`, **all** pages are treated as OCR candidates (still capped by `OCR_MAX_PAGES`). |
| `OCR_RENDER_SCALE` | `1.75` | Raster scale for pdf.js → PNG; max `4`. Increase slightly if OCR is unreadable. |
| `OCR_MAX_PAGES` | `60` | Max sparse pages OCR’d per request; raise (e.g. `120`) only if function time and memory allow. |
| `TESSERACT_USE_CDN` | `1` | **Optional override:** forces Tesseract’s WASM `corePath` to jsDelivr. Use if you see `ENOENT` on `tesseract-core-*.wasm` in logs and CDN auto-detection did not run (for example, an unusual host). On Vercel, the app already prefers CDN when `VERCEL` or `VERCEL_ENV` is set, unless disabled below. |
| `TESSERACT_DISABLE_CDN` | `1` | **Opt-out:** forces local `node_modules` WASM only. On Vercel, pair with `vercel.json` `includeFiles` for `tesseract.js-core` or OCR will fail when the bundle omits `.wasm` files. |

**Local:** after `vercel env pull .env.local`, append the OCR lines from the project root `.env.example` (uncomment `OCR_ENGINE=tesseract` and adjust as needed), then restart the backend dev server.

**Vercel:** **Settings → Environment Variables** → add `OCR_ENGINE` = `tesseract` for Production and Preview, or run `vercel env add OCR_ENGINE` and paste `tesseract`. Redeploy after changes.

**Diagnostics:** from the `backend/` folder, `npm run diagnose:pdf -- [optional/path/to.pdf]` logs native page lengths, sparse indices, and OCR application (set `OCR_ENGINE=tesseract` first). Default path is `docs/superpowers/specs/Bogue_Chitto_Creek_Watershed_Plan_2004.pdf` when no argument is passed.

These variables are also documented in `.env.example` at the project root. **Never commit `.env.local` or any file containing real credentials.**

---

## 5. Vercel Configuration (`vercel.json`)

The project root `vercel.json` configures rewrites, the frontend build, output directory, API **function duration** (300s for large PDFs + OCR + Claude), and **extra files** for Tesseract’s WASM binaries (Node file tracing often ships `.js` without sibling `.wasm`):

```json
{
  "rewrites": [{ "source": "/api/:path*", "destination": "/api/index" }],
  "buildCommand": "cd frontend && npm run build",
  "outputDirectory": "frontend/dist",
  "functions": {
    "api/index.ts": {
      "maxDuration": 300,
      "includeFiles": "**/tesseract.js-core/**/*.wasm"
    }
  }
}
```

- **`rewrites`** — routes every request matching `/api/:path*` to the single serverless entry point at `/api/index`. The Express router in `backend/src/app.ts` handles sub-routing (`/api/extract/jobs`, `/api/health`, `/api/inngest`, etc.) without Vercel declaring each route separately.
- **`buildCommand`** — runs only the Vite frontend build (`cd frontend && npm run build`). The backend is not built separately; it is bundled by Vercel when it processes `api/index.ts`.
- **`outputDirectory`** — tells Vercel to serve `frontend/dist` as the static asset root. Vite writes its production output there.
- **`includeFiles`** — copies `tesseract.js-core` `.wasm` files into the function bundle so `TESSERACT_DISABLE_CDN=1` (local WASM) can still work; when CDN mode is on (default on Vercel), WASM is loaded from jsDelivr instead.

---

## 6. Serverless Function Architecture

`api/index.ts` is two lines:

```typescript
import app from '../backend/src/app';
export default app;
```

Vercel detects any file under `api/` that exports a default value and wraps it in a serverless function. By re-exporting the Express `app` instance directly, the entire Express application — middleware, routes, and error handling — runs inside that single function.

All requests to `/api/*` are handled here; Express dispatches to handlers such as **`/api/extract/jobs`** (async extraction the UI uses), **`POST /api/extract`** (sync path for tests / short runs only), **`/api/inngest`** (Inngest), and **`/api/health`**.

**Function timeout** — `vercel.json` sets `maxDuration: 300` for `api/index.ts`. Long PDFs should use **Inngest-backed jobs** so work is split across invocations; a single synchronous `POST /api/extract` cannot exceed this budget per request. If individual **job steps** still time out (heavy OCR), reduce `OCR_MAX_PAGES` or `OCR_RENDER_SCALE`, or raise `maxDuration` only if your plan allows it. Check logs for `ENOENT` on `*.wasm` if Tesseract fails to load.

**Memory** — Raster + Tesseract increases memory use. If the function OOMs, lower `OCR_RENDER_SCALE` or `OCR_MAX_PAGES` before raising allocated memory.

---

## 7. Vercel Blob Storage

PDFs are uploaded **directly from the browser to Vercel Blob** before the backend is involved. This bypasses the 4.5 MB body size limit that Vercel imposes on serverless function requests — the function itself never receives the raw PDF bytes over HTTP.

The flow used by the app UI is:

1. Browser uploads the file to Blob and receives a `blobUrl`.
2. Browser **`POST /api/extract/jobs`** with `{ blobUrl, filename }` → **202** and `jobId`; Inngest runs the pipeline in steps.
3. Browser polls **`GET /api/extract/jobs/:jobId`** until `completed` or `failed`.

The first Inngest step fetches the PDF from `blobUrl` and deletes the source blob after fetch (same cleanup idea as the legacy sync route). Job state and results are stored in Blob under job-specific paths until completion.

**Legacy sync** `POST /api/extract` still fetches from `blobUrl` and deletes after fetch in one request; avoid it for large documents on Vercel (see function timeout above).

---

## 8. Troubleshooting

**CORS errors in the browser console**
- Cause: `cors()` middleware not applied, or applied after route registration.
- Fix: verify that `app.use(cors())` appears before `app.use('/api', extractRouter)` in `backend/src/app.ts`. In the current implementation it does — confirm no one has reordered those lines.

**`BLOB_READ_WRITE_TOKEN` errors / 401 responses from Blob**
- Cause: the environment variable is missing from the Vercel project for the target environment (Production, Preview, or Development).
- Fix: go to **Vercel dashboard → your project → Settings → Environment Variables** and confirm `BLOB_READ_WRITE_TOKEN` is present and assigned to the environment where the error occurs. Re-run `vercel env pull .env.local` locally if the issue is in local dev.

**Intermittent `403 Forbidden` from Blob on `getJobState` / Inngest OCR steps**
- Cause: often **pathname + token** reads on the Blob API edge, **Inngest hitting a deployment** whose token or store does not match where the job was created, or **throttling** after many sequential reads/writes.
- Fix: follow **Section 4b** (sync URL + token + redeploy). The backend prefers **`head` + `get(publicUrl)`** for public job blobs (same idea as reading the uploaded PDF URL) and falls back to pathname + token. If 403 continues, check Vercel / Blob usage for rate limits and align **`@vercel/blob`** with the version in the repo lockfile or newer per [Vercel Blob changelog](https://github.com/vercel/storage/releases).

**Frontend error “Async extraction is not configured” (503 on `POST /api/extract/jobs`)**
- Cause: `BLOB_READ_WRITE_TOKEN` or `INNGEST_EVENT_KEY` missing in that environment.
- Fix: set both on Vercel (see Section 4), redeploy, and call **`GET /api/health`** — `asyncExtraction.ready` must be `true`.

**Function timeout (504 errors)**
- Cause: a **single** serverless invocation exceeded `maxDuration` (for example sync `POST /api/extract` on a huge PDF), OCR + Claude in one step without job chunking, or Tesseract hung on missing WASM until timeout.
- Fix: use **`/api/extract/jobs`** from the client (default in the bundled UI). Confirm `maxDuration` in `vercel.json` (Section 5). For OCR-heavy **steps**, lower `OCR_MAX_PAGES` / `OCR_RENDER_SCALE`. **WASM:** set `TESSERACT_USE_CDN=1` if logs show `ENOENT` on `tesseract-core-*.wasm`; avoid `TESSERACT_DISABLE_CDN=1` on Vercel unless bundled WASM is verified.

**Tesseract / `ENOENT: tesseract-core-*.wasm`**
- Cause: the serverless bundle included `tesseract.js-core` JavaScript but not the sibling `.wasm` files, and Tesseract was not using the jsDelivr `corePath`.
- Fix: redeploy with current `vercel.json` (`includeFiles` for `*.wasm`) and backend logic that enables CDN on Vercel (`VERCEL` / `VERCEL_ENV`) or set `TESSERACT_USE_CDN=1`. Do not set `TESSERACT_DISABLE_CDN=1` on Vercel unless you rely on bundled WASM only.

**413 Payload Too Large**
- Cause: `express.json({ limit: '1mb' })` in `backend/src/app.ts`. The standard upload flow sends only a short `blobUrl` string and will not hit this limit, but any client posting a large JSON body directly will.
- Fix: if you need to POST large JSON payloads directly (outside the standard Blob flow), change the limit in `backend/src/app.ts`:
  ```typescript
  app.use(express.json({ limit: '10mb' }));
  ```

**Frontend shows no data / API calls return 404**
- Cause: `VITE_API_BASE_URL` is set to `http://localhost:3001` in `.env.local` but the app is running on Vercel, or vice versa.
- Fix: on Vercel, do not set `VITE_API_BASE_URL` at all — the frontend and API share the same origin, so relative `/api/*` paths resolve correctly. Only set it locally when running the Vite dev server against a separately running Express dev server.

**Scan PDF / “no results” after extraction**
- Cause: `OCR_ENGINE=none` (or unset in an environment that does not load defaults), so image-only pages never get Tesseract text; the model sees almost nothing and the validator drops unsupported names.
- Fix: remove `OCR_ENGINE=none` or set `OCR_ENGINE=tesseract`, redeploy, and re-upload. Check server logs for `extract.stage` (`nativeTotalTrimmedChars`, `ocrAppliedToPages`) or run `npm run diagnose:pdf` from `backend/`.
- The API may return `extractionWarnings` (e.g. `ocr_disabled_low_native_text`); the dashboard shows these above the report when present.
