import Anthropic from '@anthropic-ai/sdk';
import { logger } from '../lib/logger';
import { parseLlmJsonResponse } from '../lib/parseLlmJson';
import { buildClaudeUserContentForBatch, type BatchHint } from '../lib/pageBatches';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const EXTRACTION_SCHEMA = {
  summary: {
    watershedName: "string",
    planYear: "number",
    totalGoals: "number (computed)",
    totalBMPs: "number (computed)",
    completionRate: "number 0-100 (computed)",
    reportedProgressPercent: "number 0-100 (optional, only if document explicitly states project/BMP/installation progress as a single percent)",
    reportedProgressSource: "string (optional, short quote or section reference for reportedProgressPercent)",
    totalEstimatedCost: "number",
    geographicScope: "string"
  },
  goals: [{
    id: "string e.g. 'Goal 1'",
    title: "string",
    description: "string",
    benchmarks: [{ description: "string", target: "number", unit: "string", current: "number", status: "'met'|'in-progress'|'not-started'" }],
    pollutants: ["string"],
    targetReduction: "number percent"
  }],
  bmps: [{ name: "string", category: "string", targetAcres: "number|null", implementedAcres: "number|null", cost: "number|null", priority: "'high'|'medium'|'low'" }],
  implementation: [{ activity: "string", year: "number", responsible: "string", cost: "number|null", status: "'planned'|'in-progress'|'complete'" }],
  monitoring: [{ parameter: "string", location: "string", frequency: "string", target: "string", unit: "string" }],
  outreach: [{ activity: "string", targetAudience: "string", timeline: "string", responsible: "string" }],
  geographicAreas: [{ name: "string", county: "string", watershed: "string", acres: "number" }]
};

export const WATERSHED_EXTRACTION_SYSTEM_PROMPT = `You are a technical analyst specializing in government watershed management plans.
Extract structured data from annotated watershed plan text and return ONLY valid JSON matching this exact schema:

${JSON.stringify(EXTRACTION_SCHEMA, null, 2)}

Rules:
- Use [SECTION:*] markers to locate content categories
- Lines tagged [BMP_ROW_WITH_ACRES] combine acre figures with BMP-related text; assign targetAcres/implementedAcres from [NUM:*] on that row when it clearly belongs to the named BMP
- Use [NUM:*] markers as ground truth for numeric values
- Extract proper nouns exactly as they appear in the source text
- If a field has no data, use an empty array [] or null
- Benchmark status: use "met" only when the document clearly states the benchmark target has been achieved; "in-progress" when work is ongoing or partial; "not-started" when not yet begun. Do not mark "met" unless the source supports it.
- For reportedProgressPercent/reportedProgressSource: only fill when the plan explicitly states an overall percent complete, percent of BMPs installed, or percent of budget expended for the project. Omit both fields for plans that only list milestones, schedules, or budgets without a single progress percentage (common for Mississippi WIPs).
- Return ONLY the JSON object, no explanation`;

export type ClaudeExtractionLogContext = {
  estimatedInputTokens?: number;
  pageCount?: number;
  ocrEngine?: string;
  ocrAppliedToPages?: number[];
  sparsePageIndices?: number[];
  batchIndex?: number;
  totalBatches?: number;
  batchedExtraction?: boolean;
};

export async function extractWithClaude(
  annotatedText: string,
  logContext?: ClaudeExtractionLogContext,
  batch?: BatchHint
): Promise<string> {
  const userContent = batch ? buildClaudeUserContentForBatch(annotatedText, batch) : annotatedText;
  const model = 'claude-sonnet-4-6';
  const t0 = Date.now();
  const response = await anthropic.messages.create({
    model,
    max_tokens: 8192,
    system: [
      {
        type: 'text',
        text: WATERSHED_EXTRACTION_SYSTEM_PROMPT,
        cache_control: { type: 'ephemeral' }
      }
    ],
    messages: [{ role: 'user', content: userContent }]
  });

  const durationMs = Date.now() - t0;
  const usageLog: Record<string, number> = {};
  if (response.usage) {
    const u = response.usage as unknown as Record<string, unknown>;
    for (const key of Object.keys(u)) {
      const v = u[key];
      if (typeof v === 'number') usageLog[key] = v;
    }
  }

  logger.info('claude.response', {
    stage: 'claude',
    durationMs,
    model,
    stopReason: response.stop_reason,
    ...usageLog,
    annotatedInputChars: annotatedText.length,
    userMessageChars: userContent.length,
    ...logContext
  });

  if (response.stop_reason === 'max_tokens') {
    logger.error('claude.truncated', new Error('max_tokens'), { stage: 'claude', model });
    throw new Error(
      'LLM response truncated (max_tokens); increase max_tokens or reduce input'
    );
  }

  const content = response.content[0];
  if (content.type !== 'text') {
    logger.error('claude.unexpected_block', new Error(`type:${content.type}`), { stage: 'claude', blockType: content.type });
    throw new Error('Unexpected Claude response type');
  }

  logger.info('claude.output', {
    stage: 'claude',
    rawTextChars: content.text.length
  });

  return parseLlmJsonResponse(content.text);
}
