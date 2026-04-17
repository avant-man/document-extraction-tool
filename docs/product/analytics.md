# Analytics Reference

How every dashboard value and chart is computed.

**Audience:** developers and assessors who want to trace each displayed number back to its source.

---

## 1. Overview

All analytics are derived from the structured `ExtractedReport` JSON produced by the extraction pipeline (async job result or sync `POST /api/extract` for tests). Summary statistics are recomputed from structured array fields — `goals.length`, `benchmarks[].status`, `bmps.length` — rather than copied from the LLM's prose `summary` block. This ensures that the numbers shown in the dashboard accurately reflect the structured data Claude extracted, and makes the computation fully auditable without trusting free-text LLM output.

---

## 2. Summary Statistics (`SummaryTab`)

`SummaryTab` reads three values from `report.summary` and renders them as stat cards. These three fields are **overwritten by `validator.ts`** before the response leaves the backend, so their values always reflect the structured arrays, not whatever the LLM wrote in the summary object.

### Total Goals

```ts
data.summary.totalGoals = data.goals.length;
```

Count of `Goal` objects surviving the hallucination filter in `validator.ts`. Any goal whose `title` does not appear verbatim in the source PDF text is removed before this count is set.

### Total BMPs

```ts
data.summary.totalBMPs = data.bmps.length;
```

Count of `BMP` objects surviving the hallucination filter. Any BMP whose `name` does not appear verbatim in the source PDF text is removed before this count is set.

### Completion Rate

```ts
const allBenchmarks = data.goals.flatMap(g => g.benchmarks ?? []);
const metBenchmarks = allBenchmarks.filter(b => b.status === 'met');
data.summary.completionRate = allBenchmarks.length > 0
  ? Math.round((metBenchmarks.length / allBenchmarks.length) * 100)
  : 0;
```

This value is **recomputed in `validator.ts`** from the actual `Benchmark.status` values across all goals. It is **not** taken from the LLM's raw `summary.completionRate` field, which may be unreliable or inconsistent with the structured benchmark data. The validator overwrites the LLM's value with `Math.round(metCount / totalCount * 100)`, or `0` when there are no benchmarks.

`SummaryTab` renders it as:

```tsx
const { totalGoals, totalBMPs, completionRate } = report.summary;
// ...
<StatCard value={`${completionRate}%`} label="Completion Rate" />
```

---

## 3. Goals Bar Chart (`GoalsBarChart.tsx`)

- **Type:** D3 grouped bar chart
- **Data source:** `report.goals[]` — passed as `goals` prop directly from `SummaryTab`
- **Grouping:** goals are grouped by `Goal.category` (e.g., `"water quality"`, `"monitoring"`, `"habitat"`); each category group renders two bars
- **Bar values:**
  - "Met Benchmarks" bar — count of benchmarks within the category where `Benchmark.status === 'met'`
  - "Total Benchmarks" bar — total count of benchmarks within the category
- **Why this view:** shows which watershed goal areas are most or least complete at a glance, enabling quick identification of lagging categories

---

## 4. Benchmark Pie Chart (`BenchmarkPieChart.tsx`)

- **Type:** D3 donut chart
- **Data source:** all benchmarks across all goals — `report.goals.flatMap(g => g.benchmarks)`
- **Slices:** one slice per distinct `Benchmark.status` value:
  - `'met'`
  - `'not_met'`
  - `'in_progress'`
- **Status origin:** Claude extracts benchmark status from PDF language (phrases such as "has been completed", "achieved X of Y target", "currently in progress") and normalizes each to the three-value enum. The validator does not modify `Benchmark.status` — it trusts Claude's normalization at this step.
- **Why this view:** provides an immediate visual summary of overall plan progress across every benchmark in the document

---

## 5. Implementation Bar Chart (`ImplementationBarChart.tsx`)

- **Type:** D3 horizontal bar chart (overlapping bars, target behind achieved)
- **Data source:** `report.bmps[]` — each `BMP` object has `targetAcres: number | null` and `achievedAcres: number | null`
- **Pre-processing before rendering:**
  1. BMPs with `targetAcres === null` are filtered out
  2. Remaining BMPs are sorted descending by gap: `(b.targetAcres - (b.achievedAcres ?? 0))` — BMPs furthest from their target appear first, surfacing highest-priority remaining work
  3. The sorted list is sliced to the top 15 BMPs
  4. Names longer than 25 characters are truncated to 22 + `'...'`
- **Bars per row:** two overlapping `<rect>` elements per BMP:
  - Target bar (teal `#0d9488`, 30% opacity) — width proportional to `BMP.targetAcres`
  - Achieved bar (green `#16a34a`, solid) — width proportional to `BMP.achievedAcres ?? 0`, overlaid on the target bar
- **Labels:** the achieved value is printed in `d3.format` notation to the right of the achieved bar
- **X axis unit:** acres (displayed as axis label)
- **Numeric trustworthiness:** acreage values come from Claude's structured extraction. The `regexParser.ts` service injects `[NUM:*]` markers for all numeric patterns found in the source text directly into the prompt context, giving Claude ground-truth numeric anchors during extraction. The `regexNumerics` Map built by `regexParser` is also available in `validator.ts` for future cross-validation (currently deferred — see validator comment).

---

## 6. Data Integrity Note

All displayed numbers are derived from structured JSON fields (`goals.length`, `benchmarks[].status`, `bmps.targetAcres`, etc.), not from LLM prose summaries.

`completionRate` is the clearest example of this principle: even if Claude writes "65% completion rate" in a summary sentence, the value displayed in the dashboard comes from actually counting `benchmark.status === 'met'` entries across the structured `goals` array, then dividing by the total benchmark count. The LLM's prose value is silently overwritten.

The same applies to `totalGoals` and `totalBMPs`: both are recomputed from array lengths after the hallucination filter removes any items whose names could not be verified against the source PDF text.

This design means the dashboard reflects structured data quality, which is fully auditable — every displayed number can be traced to a specific field in the `ExtractedReport` JSON, independent of whatever narrative the LLM may have written.
