# Backend (Express + extraction pipeline)

- **Run locally:** from repo root, `npm run dev:backend` (listens on port 3001; see root [README.md](../README.md)).
- **Entry:** `src/app.ts` (routes, Inngest serve path); `src/server.ts` for `app.listen`.
- **Extraction:** `src/extraction/pipeline.ts` (sync + Inngest job steps), `src/services/*` (blob, PDF, regex, Claude, OCR, validator).
- **Docs:** [Extraction logic](../docs/extraction/extraction-logic.md), [Large files and accuracy](../docs/extraction/large-files-and-accuracy.md), [HTTP API](../docs/api/http-reference.md).
