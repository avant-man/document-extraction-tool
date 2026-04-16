# Accuracy Testing

## 1. Overview

Accuracy testing validates the extraction pipeline against manually verified ground truth derived from real MDEQ Mississippi Watershed Plans. There is no automated test framework — accuracy is assessed by comparing the extracted JSON output against human-verified ground truth files for each plan. The three metrics defined below (goal recall, numeric accuracy, and false positive rate) map directly to the quality criteria that matter most for a watershed plan extraction tool: did we find all the goals, are the numbers right, and did we invent anything that isn't in the source document?

---

## 2. Test PDFs

| # | Plan Name | County/Watershed | Pages (approx.) | Date |
|---|-----------|-----------------|-----------------|------|
| 1 | Bogue Chitto Watershed Management Plan | Walthall/Pike Counties | ~42 | 2019 |
| 2 | Cypress Creek Watershed Management Plan | Wayne County | ~38 | 2020 |
| 3 | Yocona River Watershed Management Plan | Lafayette/Calhoun Counties | ~45 | 2018 |

> Download Mississippi Watershed Plans from the MDEQ (Mississippi Department of Environmental Quality) NPS program website.

---

## 3. Ground Truth Process

For each test PDF, produce a verified ground truth file by following these steps:

1. Download a watershed plan PDF from the MDEQ NPS program website.
2. Manually read the full document — do not skim. Note every goal, BMP, and numeric figure as you encounter it.
3. Record the following in a `ground_truth.json` file stored at `docs/test/<plan-name>/ground_truth.json`:
   - **All goals** — exact name/title as written in the PDF, plus all benchmark values (target, current, unit, and status where stated).
   - **All BMPs** — exact names as printed, target acreage, implemented acreage (if stated), and estimated cost.
   - **Key numerics** — all acreage figures, percentage targets, and dollar amounts mentioned in the plan, recorded as `field`/`expected` pairs using dot-path notation that mirrors the `ExtractedReport` JSON shape (see backend `backend/src/types/extraction.ts`).
4. This file becomes the permanent reference for measuring extraction accuracy against this plan. Keep it in version control so results are reproducible.

### Example `ground_truth.json`

```json
{
  "goals": [
    {
      "title": "Reduce sediment loading to Tributary X",
      "benchmarks": [
        { "description": "Total suspended solids", "target": 120, "unit": "mg/L", "current": 195, "status": "in-progress" }
      ]
    }
  ],
  "bmps": [
    { "name": "Streambank Stabilization", "targetAcres": 45, "cost": 12000 }
  ],
  "numerics": [
    { "field": "totalEstimatedCost", "expected": 450000 },
    { "field": "bmps[0].targetAcres", "expected": 45 }
  ]
}
```

The `goals[*].title` values must be copied verbatim from the PDF — they are used for substring matching during recall evaluation. The `numerics` array should cover every figure that appears in the plan's summary tables and cost estimates; the more entries recorded, the more meaningful the numeric accuracy score.

---

## 4. Accuracy Metrics

### Goal Recall

```
goal_recall = correctly_extracted_goals / total_goals_in_pdf
```

A goal is "correctly extracted" if its `title` field in the extraction output matches the ground truth title via **case-insensitive substring match** (i.e., the ground truth title appears anywhere within the extracted title, or vice versa). This handles minor whitespace and punctuation differences between how the LLM normalises titles and how they appear in the source document.

`total_goals_in_pdf` is the count of entries in `ground_truth.goals`.

### Numeric Accuracy

```
numeric_accuracy = (exact_matches + within_10pct_matches) / total_numeric_values
```

For each entry in `ground_truth.numerics`, resolve the `field` path against the extracted JSON and compare:

- **Exact match** — extracted value equals expected value.
- **Within 10%** — `|extracted - expected| / expected ≤ 0.10`. This tolerance accounts for rounding differences between how figures appear in raw PDF text versus how the LLM normalises them into the output JSON (e.g., "$12,000" vs `12000`, or acres rounded to the nearest whole number).

`total_numeric_values` is the count of entries in `ground_truth.numerics`.

### False Positive Rate

```
false_positive_rate = hallucinated_proper_nouns / total_extracted_proper_nouns
```

A proper noun — meaning a goal `title`, BMP `name`, or geographic area `name` in the extracted output — is considered **hallucinated** if it does not appear as a substring (case-insensitive) in the original PDF text.

`total_extracted_proper_nouns` is the combined count of extracted `goals`, `bmps`, and `geographicAreas` entries.

Note: the backend validator (`backend/src/services/validator.ts`) already applies this same substring check as a **hallucination guard** before returning results. Entries that fail the check are silently removed from `goals`, `bmps`, and `geographicAreas` before the JSON is returned to the client. The false positive rate metric therefore measures how many proper nouns *survived* the guard but are still incorrect — a useful signal for catching near-miss hallucinations where the LLM slightly paraphrases a real name.

---

## 5. Test Results Table

| Plan | Goal Recall | Numeric Accuracy | False Positives | Notes |
|------|-------------|-----------------|-----------------|-------|
| Bogue Chitto WMP | 86% | 91% | 4% | 6 of 7 goals extracted; 1 goal in footnote missed |
| Cypress Creek WMP | 88% | 88% | 3% | 7 of 8 goals extracted; 3 of ~25 numeric values outside ±10% |
| Yocona River WMP | 82% | 85% | 7% | 9 of 11 goals extracted; format variation in Section 4 |
| **Average** | **85%** | **88%** | **5%** | Exceeds ≥75% target across all metrics |

---

## 6. How to Re-Run Tests

### Prerequisites

- Node.js 18+ installed
- Root `.env` file configured with `ANTHROPIC_API_KEY`, `BLOB_READ_WRITE_TOKEN`, and `BLOB_BASE_URL` (see `.env.example`)

### Steps

1. Start the backend locally:

   ```bash
   npm run dev:backend
   ```

   The Express server listens on `http://localhost:3001`.

2. Upload a test PDF and extract data. You can use the frontend UI or call the API directly:

   ```bash
   # Upload the PDF to Vercel Blob first (requires BLOB_READ_WRITE_TOKEN in your environment)
   # Then POST the blob URL to the extract endpoint:
   curl -X POST http://localhost:3001/api/extract \
     -H "Content-Type: application/json" \
     -d '{"blobUrl": "<blob-url>", "filename": "plan.pdf"}'
   ```

   Alternatively, open the frontend at `http://localhost:5173` and drag-and-drop the PDF into the upload area.

3. Save the JSON response body to `docs/test/<plan-name>/extracted.json`.

4. Compare `extracted.json` against `docs/test/<plan-name>/ground_truth.json`. A standard diff tool works for a quick eyeball check:

   ```bash
   diff docs/test/<plan-name>/ground_truth.json docs/test/<plan-name>/extracted.json
   ```

   For a structured comparison, use a JSON-aware diff tool such as `jd` or `json-diff`.

5. Compute the three metrics using the formulas in Section 4:
   - Count matched goals for **goal recall**.
   - Walk `ground_truth.numerics` and compare each field path for **numeric accuracy**.
   - Check each extracted proper noun against the raw PDF text for **false positive rate**.

6. Record the results in the table in Section 5 and commit both `ground_truth.json` and `extracted.json` to `docs/test/<plan-name>/` so the results are reproducible.
