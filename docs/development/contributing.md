# Development notes

## Workspaces

From the repository root:

```bash
npm install
npm run dev:frontend   # Vite — http://localhost:5173
npm run dev:backend    # Express — http://localhost:3001
```

Set `VITE_API_BASE_URL=http://localhost:3001` for local UI → API routing. See root [README.md](../../README.md) and [.env.example](../../.env.example).

## Where to change behavior

| Concern | Primary location |
|---------|-------------------|
| Upload + polling UX | `frontend/src/hooks/useExtraction.ts` |
| Dashboard tabs | `frontend/src/components/Dashboard.tsx`, `frontend/src/components/tabs/` |
| Pipeline orchestration | `backend/src/extraction/pipeline.ts` |
| PDF / regex / LLM / validate | `backend/src/services/` |
| API routes | `backend/src/routes/` |

## Verification

- Frontend tests: `npm run test:frontend` (from root).
- Accuracy methodology and manual regression: [Accuracy testing](../quality/testing.md).

## Documentation

When you add user-facing API or deployment behavior, update [HTTP reference](../api/http-reference.md) and/or [Vercel deployment](../deployment/vercel.md), and link from [docs/README.md](../README.md) if you introduce a new top-level guide.
