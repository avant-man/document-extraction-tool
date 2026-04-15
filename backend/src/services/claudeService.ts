import Anthropic from '@anthropic-ai/sdk';
import { ExtractedReport } from '../types/extraction';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const EXTRACTION_SCHEMA = {
  summary: {
    watershedName: "string",
    planYear: "number",
    totalGoals: "number (computed)",
    totalBMPs: "number (computed)",
    completionRate: "number 0-100 (computed)",
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
  bmps: [{ name: "string", category: "string", targetAcres: "number", implementedAcres: "number", cost: "number", priority: "'high'|'medium'|'low'" }],
  implementation: [{ activity: "string", year: "number", responsible: "string", cost: "number", status: "'planned'|'in-progress'|'complete'" }],
  monitoring: [{ parameter: "string", location: "string", frequency: "string", target: "string", unit: "string" }],
  outreach: [{ activity: "string", targetAudience: "string", timeline: "string", responsible: "string" }],
  geographicAreas: [{ name: "string", county: "string", watershed: "string", acres: "number" }]
};

const WATERSHED_SYSTEM_PROMPT = `You are a technical analyst specializing in government watershed management plans.
Extract structured data from annotated watershed plan text and return ONLY valid JSON matching this exact schema:

${JSON.stringify(EXTRACTION_SCHEMA, null, 2)}

Rules:
- Use [SECTION:*] markers to locate content categories
- Use [NUM:*] markers as ground truth for numeric values
- Extract proper nouns exactly as they appear in the source text
- If a field has no data, use an empty array [] or null
- Return ONLY the JSON object, no explanation`;

// ExtractedReport imported for type-safety of callers; used indirectly via the return type
void (null as unknown as ExtractedReport);

export async function extractWithClaude(annotatedText: string): Promise<string> {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 8192,
    system: [
      {
        type: 'text',
        text: WATERSHED_SYSTEM_PROMPT,
        cache_control: { type: 'ephemeral' }
      }
    ],
    messages: [{ role: 'user', content: annotatedText }]
  });

  const content = response.content[0];
  if (content.type !== 'text') throw new Error('Unexpected Claude response type');
  return content.text;
}
