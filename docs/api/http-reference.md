# HTTP API reference

Base URL: same origin as the frontend in production; locally often `http://localhost:3001` when using `VITE_API_BASE_URL`.

## Health

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/health` | Returns `{ ok, asyncExtraction: { ready, missing } }`. Use to confirm Blob + Inngest env vars for async jobs. |

## Extraction

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/extract` | Synchronous extraction from `{ blobUrl, filename }`. Fetches PDF from Blob, runs full pipeline in one invocation. Prefer for tests / small files. |
| `POST` | `/api/extract/jobs` | Creates async job; returns **202** and `jobId`. Production UI path. Requires Inngest + Blob configuration. |
| `GET` | `/api/extract/jobs/:jobId` | Poll job status, stages, and final `ExtractedReport` when `status` is `completed`. |

## Inngest

| Method | Path | Description |
|--------|------|-------------|
| `GET`, `POST`, `PUT` | `/api/inngest` | Inngest serve endpoint (signing key). |

## Request bodies (JSON)

- **Jobs and sync extract** — `{ "blobUrl": string, "filename": string }` where `blobUrl` is the client-uploaded Blob URL (not raw PDF bytes).

## Errors

- **503** on `POST /api/extract/jobs` when async extraction is not configured (`asyncExtraction.ready === false` on health).
- **4xx / 5xx** with message body for validation failures, timeouts, or upstream LLM/Blob errors (see server logs).

## Related

- [System overview](../architecture/system-overview.md)
- [Vercel deployment](../deployment/vercel.md)
