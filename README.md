# PDF Extractor

Automated extraction of goals, BMPs, and key metrics from Mississippi Watershed Plans (MDEQ).

**Live demo:** [deploy to Vercel and fill in URL]

## Documentation

All technical write-ups live under [`docs/`](docs/README.md).

| Guide | Description |
|-------|-------------|
| [Documentation index](docs/README.md) | Full map of architecture, API, extraction, testing, analytics, deployment |
| [Extraction logic](docs/extraction/extraction-logic.md) | Hybrid regex + Claude pipeline, validation, format handling |
| [Large files and accuracy](docs/extraction/large-files-and-accuracy.md) | Serverless upload path, job chunking, accuracy layers (Mermaid) |
| [Accuracy testing](docs/quality/testing.md) | Ground truth methodology and metrics |
| [Analytics reference](docs/product/analytics.md) | Dashboard metrics from structured data |
| [Vercel deployment](docs/deployment/vercel.md) | Blob, Inngest, environment variables, troubleshooting |

## Stack

| Layer | Tech |
|---|---|
| Frontend | React 18 · TypeScript · Vite · Tailwind CSS · D3.js |
| Backend | Express.js · TypeScript |
| LLM | Claude claude-sonnet-4-6 (`claude-sonnet-4-6`) |
| Storage | Vercel Blob |
| Deployment | Vercel (monorepo, serverless) |

## Architecture

Production flow: browser → **Vercel Blob** → **`POST /api/extract/jobs`** → **Inngest** (fetch, OCR chunks, Claude batches, merge/validate) → poll **`GET /api/extract/jobs/:jobId`** → dashboard. Diagrams and narrative: [System overview](docs/architecture/system-overview.md), [Large files and accuracy](docs/extraction/large-files-and-accuracy.md).

Sync **`POST /api/extract`** remains for integration tests and short local runs (not for long runs on serverless).

**Health:** `GET /api/health` → `{ ok, asyncExtraction: { ready, missing } }` — confirms `BLOB_READ_WRITE_TOKEN` and `INNGEST_EVENT_KEY` where needed.

## Local development

1. `cd pdf-extract` and `cp .env.example .env` — set `ANTHROPIC_API_KEY`, `BLOB_READ_WRITE_TOKEN`, and for the real UI flow `INNGEST_EVENT_KEY` (and `INNGEST_SIGNING_KEY` for `/api/inngest`); see [Vercel deployment](docs/deployment/vercel.md).
2. `npm install`
3. Two terminals: `npm run dev:frontend` (port 5173) and `npm run dev:backend` (port 3001).

Use `VITE_API_BASE_URL=http://localhost:3001` in `.env` so the UI talks to local Express. Omit on Vercel (same origin).

## Project layout (summary)

| Path | Role |
|------|------|
| `api/index.ts` | Vercel serverless entry — re-exports Express |
| `backend/src/` | Express app, routes, `extraction/pipeline.ts`, `services/*` |
| `frontend/src/` | App, `hooks/useExtraction`, `components/` (dashboard, tabs, charts), `lib/` exports |
| `docs/` | Architecture, API, extraction, quality, product, deployment guides |

Package-level notes: [frontend/README.md](frontend/README.md), [backend/README.md](backend/README.md).

## Environment variables

| Variable | Purpose | Where to get |
|---|---|---|
| `ANTHROPIC_API_KEY` | Claude API | [console.anthropic.com](https://console.anthropic.com) |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob | Vercel dashboard → Storage |
| `INNGEST_EVENT_KEY` | Async job events | [app.inngest.com](https://app.inngest.com) |
| `INNGEST_SIGNING_KEY` | Verify Inngest → `/api/inngest` | Same Inngest dashboard |
| `NODE_ENV` | Runtime | `development` locally; auto on Vercel |
| `VITE_API_BASE_URL` | Local UI → API | `http://localhost:3001`; unset on Vercel |

OCR-related variables are listed in `.env.example` and [Vercel deployment](docs/deployment/vercel.md).
