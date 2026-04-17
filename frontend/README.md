# Frontend (React + Vite)

- **Run locally:** from repo root, `npm run dev:frontend` (Vite, default port 5173).
- **API base:** set `VITE_API_BASE_URL=http://localhost:3001` when the backend runs separately; omit on Vercel (same origin).
- **Extraction UX:** `src/hooks/useExtraction.ts` — Blob client upload, async job create, poll every ~2s, progress labels from job `stage` / `progress`.
- **Docs:** root [README.md](../README.md), [docs/README.md](../docs/README.md), [Contributing](../docs/development/contributing.md).
