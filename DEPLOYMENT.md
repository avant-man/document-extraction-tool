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
| `NODE_ENV` | No | Runtime environment (defaults to `production` on Vercel) | Set to `development` locally |
| `VITE_API_BASE_URL` | Local dev only | Frontend API base URL | `http://localhost:3001` locally; not set on Vercel (same-origin) |

### 4a. Scan-only PDFs (OCR)

Image-only or non-selectable PDFs need **server-side OCR**. Without it, native text is empty and extraction returns little or no structured data.

| Variable | Example value | Purpose |
|---|---|---|
| `OCR_ENGINE` | `tesseract` | **`none` is the default in code** — OCR is skipped. Set to `tesseract` in Production and Preview (and local `.env.local`) for scan plans. |
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
      "includeFiles": [
        "node_modules/tesseract.js-core/**/*.wasm",
        "backend/node_modules/tesseract.js-core/**/*.wasm"
      ]
    }
  }
}
```

- **`rewrites`** — routes every request matching `/api/:path*` to the single serverless entry point at `/api/index`. This means the Express router in `backend/src/app.ts` handles all sub-routing (`/api/extract`, `/api/health`, etc.) without Vercel needing to know about individual routes.
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

All requests to `/api/*` are handled here; Express's own router dispatches to the correct handler (`/api/extract` for PDF processing, `/api/health` for the health check).

**Function timeout** — The repo `vercel.json` sets `maxDuration: 300` for `api/index.ts`. If you still hit the wall with **OCR** on very long plans, reduce `OCR_MAX_PAGES` or `OCR_RENDER_SCALE`, or raise `maxDuration` further only if your Vercel plan allows it. A stuck Tesseract init (for example missing WASM before this fix) can also burn the full budget; check logs for `ENOENT` on `*.wasm` first.

**Memory** — Raster + Tesseract increases memory use. If the function OOMs, lower `OCR_RENDER_SCALE` or `OCR_MAX_PAGES` before raising allocated memory.

---

## 7. Vercel Blob Storage

PDFs are uploaded **directly from the browser to Vercel Blob** before the backend is involved. This bypasses the 4.5 MB body size limit that Vercel imposes on serverless function requests — the function itself never receives the raw PDF bytes over HTTP.

The flow is:

1. Browser uploads the file to Blob and receives a `blobUrl`.
2. Browser POSTs only the `blobUrl` (a short string) to `/api/extract`.
3. The backend fetches the PDF Buffer from the `blobUrl`, runs pdf-parse and Claude, then calls `deleteBlobSafe()` (fire-and-forget) to remove the file from Blob immediately.

Because blobs are deleted right after processing, Blob storage stays near-zero between requests — uploaded PDFs do not accumulate.

---

## 8. Troubleshooting

**CORS errors in the browser console**
- Cause: `cors()` middleware not applied, or applied after route registration.
- Fix: verify that `app.use(cors())` appears before `app.use('/api', extractRouter)` in `backend/src/app.ts`. In the current implementation it does — confirm no one has reordered those lines.

**`BLOB_READ_WRITE_TOKEN` errors / 401 responses from Blob**
- Cause: the environment variable is missing from the Vercel project for the target environment (Production, Preview, or Development).
- Fix: go to **Vercel dashboard → your project → Settings → Environment Variables** and confirm `BLOB_READ_WRITE_TOKEN` is present and assigned to the environment where the error occurs. Re-run `vercel env pull .env.local` locally if the issue is in local dev.

**Function timeout (504 errors)**
- Cause: a long PDF plus OCR and Claude exceeds the serverless time limit, or Tesseract failed to load WASM and the request hung until `maxDuration`.
- Fix: confirm `maxDuration` in `vercel.json` (see Section 5). For OCR-heavy runs, lower `OCR_MAX_PAGES` / `OCR_RENDER_SCALE`. **Immediate WASM unblock:** set `TESSERACT_USE_CDN=1` in Vercel env and redeploy if logs show `ENOENT` on `tesseract-core-*.wasm`; ensure `TESSERACT_DISABLE_CDN` is not `1` unless you intend local WASM with `includeFiles` present.

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
- Cause: `OCR_ENGINE` defaults to `none`, so image-only pages never get Tesseract text; the model sees almost nothing and the validator drops unsupported names.
- Fix: set `OCR_ENGINE=tesseract` on the server (see §4a), redeploy, and re-upload. Check server logs for `extract.stage` (`nativeTotalTrimmedChars`, `ocrAppliedToPages`) or run `npm run diagnose:pdf` from `backend/`.
- The API may return `extractionWarnings` (e.g. `ocr_disabled_low_native_text`); the dashboard shows these above the report when present.
