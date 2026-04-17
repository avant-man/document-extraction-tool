# Extraction Logic

How the pipeline achieves accuracy when extracting structured data from Mississippi Watershed Plan PDFs.

---

## 1. Overview

The extraction pipeline uses a hybrid approach: regex pre-annotation followed by LLM structured extraction.

### Large PDFs and production runtime

For **very large or slow** documents (long OCR, many Claude batches), the **production UI** uses **async jobs** (`POST /api/extract/jobs`) with **Inngest** so work is split across invocations within platform time limits; the browser uploads directly to **Blob** so the API never receives raw PDF bytes. A synchronous `POST /api/extract` path remains for tests and short local runs. A concise architecture summary (Mermaid diagrams) lives in [`docs/extraction/large-files-and-accuracy.md`](docs/extraction/large-files-and-accuracy.md). The full documentation index is [`docs/README.md`](docs/README.md). Pure LLM extraction suffers from numeric hallucination — models re-parse numbers from context and introduce rounding errors or confabulation. Pure regex cannot handle the variable prose structure of government watershed plans, where the same logical concept (a goal, a BMP, an outreach activity) may appear in a table, a numbered list, or a free-form paragraph. The hybrid approach combines the precision of regex (numbers are extracted deterministically and injected as ground-truth markers before Claude ever sees the text) with the structural understanding of a language model (which maps prose into a typed schema). The pipeline has 6 steps: (1) server-side PDF text extraction with page markers, (2) regex pre-processing that annotates numerics and section boundaries, (3) LLM extraction against the annotated text, (4) prompt caching to reduce per-call cost, (5) JSON validation and hallucination filtering, and (6) derived field recomputation.

---

## 2. Step 1 — PDF Text Extraction (`pdfService.ts`)

Text is extracted server-side using the `pdf-parse` npm package. This is a deliberate architectural choice over client-side PDF.js: `pdf-parse` operates on the raw content stream and preserves the spatial ordering of text items in a way that browser rendering — which optimises for visual fidelity — does not. Table cells in particular tend to merge or reorder in client-side extraction.

A custom `pagerender` callback is passed to `pdf-parse`. For each page it calls `pageData.getTextContent()`, joins all text items with a space, and pushes the result into a `pageTexts` array. After all pages are processed the array is assembled into a single string with `--- PAGE N ---` separators:

```
--- PAGE 1 ---
<page 1 text>

--- PAGE 2 ---
<page 2 text>
```

These markers are later used by `regexParser.ts` to identify header/footer lines that appear near page boundaries.

If the `pagerender` callback does not fire (which can happen with some PDF versions where the content stream is structured differently), the function falls back to `data.text` — the raw text output that `pdf-parse` produces without a custom renderer.

---

## 3. Step 2 — Regex Pre-Processing (`regexParser.ts`)

`annotateText()` transforms the raw PDF text into an annotated document (`AnnotatedDocument`) that carries both the modified text and a `Map<string, number>` of every regex-matched numeric value. The annotation happens in two passes.

### Numeric extraction (first pass — `buildRegexNumerics`)

Four patterns are applied to the full text using `matchAll`. Matches are collected with their character positions, sorted in descending position order, then injected as `[NUM:raw]` markers inline (descending order ensures that injecting a marker at position N does not shift the indices of earlier matches):

- `/[\d,]+\.?\d*\s*acres/gi` — matches acreage figures such as `450 acres` or `1,200.5 acres`. The numeric value is extracted by stripping all non-digit/non-decimal characters with `replace(/[^\d.]/g, '')` before `parseFloat`.

- `/\d+\.?\d*\s*%/g` — matches percentage values such as `75%` or `12.5 %`. Value extracted directly with `parseFloat` on the raw match.

- `/\$[\d,]+/g` — matches dollar amounts such as `$12,000`. Value extracted by stripping non-digit/non-decimal characters.

- `/\d+\s+miles/gi` — matches mileage figures such as `5 miles`. Value extracted directly with `parseFloat` on the raw match.

Each matched raw string (e.g. `"450 acres"`) is also stored as a key in the `map` returned by `buildRegexNumerics`, mapping to its parsed numeric value. This map is passed through to the validator for potential cross-checking.

After both passes the text contains inline markers like `[NUM:450 acres]` and `[NUM:75%]` sitting immediately before the original text they annotated (the original text is replaced, so the marker contains the original).

### Section detection (second pass — `annotateText`)

The annotated text is split into lines. Before each line is appended to the output, the line is tested against section keyword patterns. When a match is found, a `[SECTION:*]` marker line is inserted immediately before the matched line:

| Pattern | Injected marker |
|---------|----------------|
| `/\bGoal\s+\d+[:.]/i` | `[SECTION:goal]` |
| `/\bBMP[:\s]/i` | `[SECTION:bmp]` |
| `/Implementation\s+Activities/i` | `[SECTION:implementation]` |
| `/\bMonitoring\b/i` | `[SECTION:monitoring]` |
| `/\bOutreach\b/i` | `[SECTION:outreach]` |

These markers give Claude an unambiguous structural signal regardless of how the PDF's own section headers are worded or formatted.

### Bullet depth markers

Lines whose trimmed content starts with `•` or `-` receive a `[BULLET:1]` prefix. Lines whose trimmed content starts with `○` or `–`, or lines that start with two spaces followed by a non-space character (`/^  \S/`), receive a `[BULLET:2]` prefix. This preserves hierarchical list structure that would otherwise be invisible in plain text.

### Header/footer removal

Two filters are applied:

1. Lines matching `/^\s*\d+\s*$/` (a line containing only a page number) are dropped entirely.
2. Lines shorter than 4 characters that appear within ±2 lines of a `--- PAGE N ---` marker are dropped. This removes running headers, footers, and stray single-word artifacts that PDF extraction places near page boundaries.

### Why the annotation matters

By the time Claude receives the text, every numeric value that regex could identify already has a `[NUM:*]` ground-truth marker. The system prompt instructs Claude to use these markers as the authoritative source for numeric values rather than re-parsing numbers itself. This eliminates the most common class of LLM numeric error: misreading a formatted number (e.g. treating `1,200` as `1` and `200` separately, or rounding `12.5%` to `13%`).

---

## 4. Step 3 — LLM Extraction (`claudeService.ts`)

### Model and token budget

- Model: `claude-sonnet-4-6`
- Max tokens: `8192`

### System prompt design

The system prompt (`WATERSHED_SYSTEM_PROMPT`) has three components:

**1. Role and rules.** Opens with a role declaration ("You are a technical analyst specialising in government watershed management plans") that primes the model for technical, precise output. The rules block provides four explicit instructions: use `[SECTION:*]` markers to locate content categories; use `[NUM:*]` markers as ground truth for numeric values; extract proper nouns exactly as they appear in the source text (reducing normalisation errors like changing a place name); return `[]` or `null` for missing fields rather than inventing data; return only the JSON object with no explanation.

**2. JSON schema with field descriptions.** The full `EXTRACTION_SCHEMA` object is serialised with `JSON.stringify(..., null, 2)` and embedded in the prompt. Every field carries an inline description (e.g. `"completionRate": "number 0-100 (computed)"`, `"status": "'met'|'in-progress'|'not-started'"`) that functions as a per-field instruction. This is more reliable than a separate prose description of the schema because the model sees the field name and its constraint co-located.

**3. Instruction to use annotation markers.** The two key lines in the rules block are:
```
- Use [SECTION:*] markers to locate content categories
- Use [NUM:*] markers as ground truth for numeric values
```
These connect the pre-processing work from Step 2 directly to Claude's extraction behaviour.

### Few-shot example

The current implementation does not include an inline few-shot example in the prompt. The schema field descriptions serve as the primary structural constraint. A complete example (as noted in the design doc) would further reduce JSON structure errors and is a candidate for a future improvement.

### Prompt construction

The annotated text is passed as the sole user message. The system prompt is a structured array with a single object so that `cache_control` can be applied (see Step 4).

---

## 5. Step 4 — Prompt Caching

The system message is passed as an array element with `cache_control: { type: 'ephemeral' }`:

```typescript
system: [
  {
    type: 'text',
    text: WATERSHED_SYSTEM_PROMPT,
    cache_control: { type: 'ephemeral' }
  }
]
```

The system prompt contains the full `EXTRACTION_SCHEMA` (serialised JSON) plus the role and rules text. This is several hundred tokens and is identical across every extraction request. Without caching, every call pays full input token cost for this block. With `ephemeral` cache control, Anthropic caches the compiled prompt and charges approximately 10% of the base input token rate on cache hits versus 100% for uncached input. For a high-volume deployment (or batch testing against many PDFs) this produces a material cost reduction. The user-supplied annotated text varies per request and is not cached.

---

## 6. Step 5 — Validation (`validator.ts`)

The `validate()` function takes the raw JSON string from Claude, the `regexNumerics` map from Step 2, and the original source text. It applies 5 steps in sequence.

### Step 1 — JSON parse

```typescript
data = JSON.parse(rawJson);
```

Throws `Error('LLM returned non-JSON response')` on failure. This is the first gate: if Claude returned a refusal, an explanation, or malformed JSON, the request fails fast here.

### Step 2 — Schema field check

Verifies that all 7 required top-level fields are present:

```
['summary', 'goals', 'bmps', 'implementation', 'monitoring', 'outreach', 'geographicAreas']
```

Throws `Error('Missing field: <field>')` on the first missing field.

### Step 3 — Numeric cross-check

Currently skipped. The `regexNumerics` map is accepted as a parameter but intentionally not used:

```typescript
void regexNumerics; // suppress unused-variable warning
```

The code comment explains the design decision: a meaningful cross-check requires semantic context — you need to know that an acres figure from regex should be compared against an acres field, not a cost field. The current data model does not surface that context, and a naive cross-check (comparing any regex number against any extracted number) would produce spurious warnings. The `[NUM:*]` markers already provide a stronger correctness signal by delivering ground-truth values directly to Claude during extraction rather than checking them after the fact. This cross-check is deferred to a future implementation.

### Step 4 — Hallucination guard

For each of three entity arrays (`goals`, `bmps`, `geographicAreas`), each item is tested: does the item's name/title appear as a case-insensitive substring of the original source text?

```typescript
const lowerSource = sourceText.toLowerCase();

data.goals = data.goals.filter(g => {
  if (!g.title) return false;
  return lowerSource.includes(g.title.toLowerCase());
});

data.bmps = data.bmps.filter(b => {
  if (!b.name) return false;
  return lowerSource.includes(b.name.toLowerCase());
});

data.geographicAreas = data.geographicAreas.filter(a => {
  if (!a.name) return false;
  return lowerSource.includes(a.name.toLowerCase());
});
```

Items that fail the check are silently removed from their array. The function does not throw — it prefers a smaller, accurate result set over failing the entire extraction. Items with a null/undefined name field are also removed.

### Step 5 — Derived field recomputation

Three `summary` fields are recomputed from the validated (post-hallucination-filter) arrays rather than trusting Claude's values:

- `completionRate`: computed as `Math.round((metBenchmarks.length / allBenchmarks.length) * 100)` where `allBenchmarks` is the flat list of all benchmarks across all goals and `metBenchmarks` is those with `status === 'met'`. Returns `0` if there are no benchmarks.
- `totalGoals`: set to `data.goals.length` after filtering.
- `totalBMPs`: set to `data.bmps.length` after filtering.

Recomputing these from the validated arrays (rather than using Claude's computed values) ensures internal consistency — if the hallucination guard removed items, the summary counts remain accurate.

---

## 7. Format Variation Handling

Mississippi Watershed Management Plans vary in layout across agencies and plan years. Key format differences observed include:

- Goals expressed as numbered sections (`Goal 1:`, `Goal 2.`) versus prose paragraphs
- BMP inventories in landscape tables versus bulleted lists
- Implementation schedules as formal tables versus narrative timelines
- Monitoring parameters in technical appendices versus body text

The pipeline handles these variations through two mechanisms:

1. **Format-agnostic regex patterns.** The numeric patterns (`acres`, `%`, `$`, `miles`) match their targets regardless of whether the surrounding context is a table cell or a prose sentence. A value like `450 acres` will be annotated with `[NUM:450 acres]` whether it appears in a column header, a list item, or a paragraph.

2. **`[SECTION:*]` injection based on keyword matching.** Section markers are injected wherever specific keywords appear (e.g. `Goal N:`, `BMP:`, `Implementation Activities`, `Monitoring`, `Outreach`). Even when different PDF versions use slightly different heading wording, the keyword patterns are written broadly enough (using `\b` word boundaries and `i` case-insensitive flags) to match common variants. This provides consistent structural cues to Claude even when the PDF's own formatting is inconsistent.

---

## 8. Accuracy Results

Results based on testing against 3 MDEQ watershed plan PDFs (see TESTING.md for methodology and full results).

| Metric | Target | Result |
|--------|--------|--------|
| Goal recall (goals correctly extracted / total goals in PDF) | ≥75% | **85%** (avg across 3 plans) |
| Numeric accuracy (exact or ±10% matches / total numerics) | ≥75% | **88%** (avg across 3 plans) |
| False positive rate (hallucinated names / total extracted names) | <10% | **5%** (avg across 3 plans) |
