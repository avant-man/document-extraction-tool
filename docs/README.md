# Documentation

Technical documentation for the PDF Extractor (Mississippi Watershed Plans). Start at the root [README.md](../README.md) for overview, quickstart, and environment variables.

## By topic

| Area | Document | Contents |
|------|----------|----------|
| Architecture | [System overview](architecture/system-overview.md) | Monorepo layout, runtime flows (Mermaid) |
| API | [HTTP reference](api/http-reference.md) | Health, sync extract, async jobs, Inngest |
| Extraction | [Extraction logic](extraction/extraction-logic.md) | Hybrid regex + Claude pipeline, validation |
| Extraction | [Large files and accuracy](extraction/large-files-and-accuracy.md) | Blob upload, Inngest steps, accuracy layers |
| Quality | [Accuracy testing](quality/testing.md) | Ground truth, metrics, re-run steps |
| Product | [Analytics reference](product/analytics.md) | How dashboard metrics map to `ExtractedReport` |
| Deployment | [Vercel deployment](deployment/vercel.md) | Blob, Inngest, OCR env, troubleshooting |
| Development | [Contributing](development/contributing.md) | Workspaces, where to change code |

## Personas

- **Assessor / reviewer** — Extraction logic, large-files note, testing methodology, analytics traceability.
- **Developer** — Root README quickstart, API reference, deployment guide, package READMEs under `frontend/` and `backend/`.
- **Operator** — Deployment guide, `.env.example`, `GET /api/health` for async readiness.

## Implementation specs

Design and build specs (when present in the repo) live under `docs/superpowers/specs/` — see [CLAUDE.md](../CLAUDE.md) for the spec index and progress.
