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

These variables are also documented in `.env.example` at the project root. **Never commit `.env.local` or any file containing real credentials.**

---

## 5. Vercel Configuration (`vercel.json`)

The project root `vercel.json` contains three directives:

```json
{
  "rewrites": [{ "source": "/api/:path*", "destination": "/api/index" }],
  "buildCommand": "cd frontend && npm run build",
  "outputDirectory": "frontend/dist"
}
```

- **`rewrites`** — routes every request matching `/api/:path*` to the single serverless entry point at `/api/index`. This means the Express router in `backend/src/app.ts` handles all sub-routing (`/api/extract`, `/api/health`, etc.) without Vercel needing to know about individual routes.
- **`buildCommand`** — runs only the Vite frontend build (`cd frontend && npm run build`). The backend is not built separately; it is bundled by Vercel when it processes `api/index.ts`.
- **`outputDirectory`** — tells Vercel to serve `frontend/dist` as the static asset root. Vite writes its production output there.

---

## 6. Serverless Function Architecture

`api/index.ts` is two lines:

```typescript
import app from '../backend/src/app';
export default app;
```

Vercel detects any file under `api/` that exports a default value and wraps it in a serverless function. By re-exporting the Express `app` instance directly, the entire Express application — middleware, routes, and error handling — runs inside that single function.

All requests to `/api/*` are handled here; Express's own router dispatches to the correct handler (`/api/extract` for PDF processing, `/api/health` for the health check).

**Function timeout** — Vercel's default execution limit is 10 seconds. Very long PDFs (many pages, dense text) can push past this when pdf-parse + Claude are both invoked. If you observe 504 errors, add a `functions` block to `vercel.json`:

```json
{
  "rewrites": [{ "source": "/api/:path*", "destination": "/api/index" }],
  "buildCommand": "cd frontend && npm run build",
  "outputDirectory": "frontend/dist",
  "functions": {
    "api/index.ts": {
      "maxDuration": 60
    }
  }
}
```

**Memory** — the default 1024 MB allocation is sufficient for pdf-parse + Claude API calls. No change needed unless you profile a memory issue.

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
- Cause: a long PDF takes more than 10 seconds for pdf-parse + Claude to process.
- Fix: add `maxDuration: 60` to the `functions` config in `vercel.json` as shown in Section 6.

**413 Payload Too Large**
- Cause: `express.json({ limit: '1mb' })` in `backend/src/app.ts`. The standard upload flow sends only a short `blobUrl` string and will not hit this limit, but any client posting a large JSON body directly will.
- Fix: if you need to POST large JSON payloads directly (outside the standard Blob flow), change the limit in `backend/src/app.ts`:
  ```typescript
  app.use(express.json({ limit: '10mb' }));
  ```

**Frontend shows no data / API calls return 404**
- Cause: `VITE_API_BASE_URL` is set to `http://localhost:3001` in `.env.local` but the app is running on Vercel, or vice versa.
- Fix: on Vercel, do not set `VITE_API_BASE_URL` at all — the frontend and API share the same origin, so relative `/api/*` paths resolve correctly. Only set it locally when running the Vite dev server against a separately running Express dev server.
