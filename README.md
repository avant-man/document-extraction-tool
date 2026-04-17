# PDF Extractor

Automated extraction of goals, BMPs, and key metrics from Mississippi Watershed Plans (MDEQ).

**Live demo:** [deploy to Vercel and fill in URL]

## Documentation (assessment deliverables)

| Doc | What it covers |
|-----|------------------|
| [EXTRACTION_LOGIC.md](EXTRACTION_LOGIC.md) | Hybrid regex + Claude pipeline, validation, format handling |
| [TESTING.md](TESTING.md) | Accuracy validation against MDEQ watershed plans |
| [ANALYTICS.md](ANALYTICS.md) | Dashboard metrics from structured data (not LLM prose) |
| [DEPLOYMENT.md](DEPLOYMENT.md) | Vercel, Blob, Inngest, environment variables |

**Topic index:** [docs/README.md](docs/README.md) — includes [Large files and accuracy](docs/extraction/large-files-and-accuracy.md) (serverless upload path, job chunking, accuracy layers).

## Stack

| Layer | Tech |
|---|---|
| Frontend | React 18 · TypeScript · Vite · Tailwind CSS · D3.js |
| Backend | Express.js · TypeScript |
| LLM | Claude claude-sonnet-4-6 (`claude-sonnet-4-6`) |
| Storage | Vercel Blob |
| Deployment | Vercel (monorepo, serverless) |

## Architecture

**Upload and extract (production):** browser → **Vercel Blob** → **`POST /api/extract/jobs`** (202 + `jobId`) → **Inngest** (fetch, OCR chunks, Claude batches, merge/validate) → poll **`GET /api/extract/jobs/:jobId`** → dashboard. Diagrams: [docs/extraction/large-files-and-accuracy.md](docs/extraction/large-files-and-accuracy.md).

Sync **`POST /api/extract`** exists for integration tests and short local runs only (not for long runs on serverless).

**Health:** `GET /api/health` → `{ ok, asyncExtraction: { ready, missing } }` — use to confirm `BLOB_READ_WRITE_TOKEN` and `INNGEST_EVENT_KEY` on Vercel.

## Local Development Setup

1. Clone the repo and `cd pdf-extract`
2. Copy the environment template and fill in your credentials:
   ```bash
   cp .env.example .env
   ```
   Set `ANTHROPIC_API_KEY`, `BLOB_READ_WRITE_TOKEN`, and for the real UI flow `INNGEST_EVENT_KEY` (and `INNGEST_SIGNING_KEY` for `/api/inngest`) — see [Environment Variables](#environment-variables) below.
3. Install all workspace dependencies from the repo root:
   ```bash
   npm install
   ```
4. Start both dev servers in separate terminals:
   ```bash
   # Terminal 1 — Vite dev server at http://localhost:5173
   npm run dev:frontend

   # Terminal 2 — Express at http://localhost:3001
   npm run dev:backend
   ```

> **Note:** `VITE_API_BASE_URL=http://localhost:3001` in `.env` points the frontend at your local Express server. This variable is not needed on Vercel (frontend and API share the same origin).

## Project Structure

```
pdf-extract/
├── api/
│   └── index.ts              # Vercel serverless entry — re-exports Express app
├── backend/
│   └── src/
│       ├── app.ts            # Express setup: CORS, body parser, routes
│       ├── server.ts         # Local dev entry: app.listen(3001)
│       ├── routes/
│       │   ├── extract.ts       # POST /api/extract (sync; tests / short local runs)
│       │   └── extractJobs.ts # POST/GET /api/extract/jobs (production path)
│       ├── services/
│       │   ├── blobService.ts   # Vercel Blob fetch + cleanup
│       │   ├── pdfService.ts    # pdf-parse text extraction
│       │   ├── regexParser.ts   # Regex annotation and numeric extraction
│       │   ├── claudeService.ts # Claude API call with schema prompt
│       │   └── validator.ts     # Schema check, hallucination guard, stat recompute
│       └── types/
│           └── extraction.ts    # Backend TypeScript interfaces
├── frontend/
│   └── src/
│       ├── App.tsx              # Root component
│       ├── components/
│       │   ├── Dashboard.tsx    # 7-tab shell with ARIA tablist
│       │   ├── ExportPanel.tsx  # JSON/CSV/PDF export buttons
│       │   ├── tabs/            # SummaryTab, GoalsTab, BMPsTab, ImplementationTab, MonitoringTab, OutreachTab
│       │   └── charts/          # GoalsBarChart, BenchmarkPieChart, ImplementationBarChart (D3)
│       ├── lib/
│       │   ├── mockData.ts      # MOCK_REPORT for local dev without backend
│       │   ├── download.ts      # triggerDownload() helper
│       │   ├── exportJson.ts    # JSON export
│       │   ├── exportCsv.ts     # CSV export (PapaParse)
│       │   └── exportPdf.ts     # PDF export (jsPDF)
│       └── types/
│           └── extraction.ts    # Frontend TypeScript interfaces
├── docs/
│   └── superpowers/specs/       # Implementation specs (spec-01 through spec-07)
├── .env.example                  # Environment variable template
├── vercel.json                   # Vercel deployment configuration
└── package.json                  # Root workspace config
```

## Environment Variables

| Variable | Purpose | Where to get |
|---|---|---|
| `ANTHROPIC_API_KEY` | Authenticates Claude API calls | [console.anthropic.com](https://console.anthropic.com) |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob read/write access | Vercel dashboard → Storage → your blob store |
| `INNGEST_EVENT_KEY` | Sends extraction job events to Inngest | [app.inngest.com](https://app.inngest.com) → Manage → API keys |
| `INNGEST_SIGNING_KEY` | Verifies Inngest → `/api/inngest` requests | Same Inngest dashboard |
| `NODE_ENV` | Runtime environment | Set to `development` locally, auto-set on Vercel |
| `VITE_API_BASE_URL` | Frontend API base URL for local dev | `http://localhost:3001` (not needed on Vercel) |
