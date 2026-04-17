import { isBlankEnv } from './stringUtils';

/**
 * Conservative Claude input sizing: Anthropic tokenizer is ~4 chars/token for English;
 * we use a slightly tighter ratio so preflight errs on the safe side.
 */
const DEFAULT_CHARS_PER_TOKEN = 3.5;

/** Claude Sonnet family context is 200k tokens; reserve output + structural overhead. */
const DEFAULT_MAX_INPUT_TOKENS = 175_000;

export class DocumentTextExceedsModelContextError extends Error {
  readonly code = 'document_text_exceeds_model_context' as const;
  readonly estimatedInputTokens: number;
  readonly budgetTokens: number;

  constructor(estimatedInputTokens: number, budgetTokens: number) {
    super('Document text exceeds model context after annotation');
    this.name = 'DocumentTextExceedsModelContextError';
    this.estimatedInputTokens = estimatedInputTokens;
    this.budgetTokens = budgetTokens;
  }
}

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  if (isBlankEnv(raw)) return fallback;
  const n = Number.parseInt(String(raw), 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function parsePositiveFloat(raw: string | undefined, fallback: number): number {
  if (isBlankEnv(raw)) return fallback;
  const n = Number.parseFloat(String(raw));
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/** Max estimated input tokens allowed before blocking extraction (env override). */
export function getExtractionInputTokenBudget(): number {
  return parsePositiveInt(process.env.EXTRACTION_INPUT_TOKEN_BUDGET, DEFAULT_MAX_INPUT_TOKENS);
}

export function getCharsPerTokenEstimate(): number {
  return parsePositiveFloat(process.env.EXTRACTION_CHARS_PER_TOKEN, DEFAULT_CHARS_PER_TOKEN);
}

export function estimateTokensFromCharCount(charCount: number): number {
  const ratio = getCharsPerTokenEstimate();
  return Math.ceil(charCount / ratio);
}

export function estimateClaudeExtractionInputTokens(systemPrompt: string, annotatedUserText: string): number {
  return estimateTokensFromCharCount(systemPrompt.length + annotatedUserText.length);
}

export function isExtractionInputOverBudget(
  systemPrompt: string,
  annotatedUserText: string,
  budgetTokens = getExtractionInputTokenBudget()
): boolean {
  return estimateClaudeExtractionInputTokens(systemPrompt, annotatedUserText) > budgetTokens;
}

export function assertExtractionInputWithinBudget(
  systemPrompt: string,
  annotatedUserText: string,
  budgetTokens = getExtractionInputTokenBudget()
): void {
  const estimated = estimateClaudeExtractionInputTokens(systemPrompt, annotatedUserText);
  if (estimated > budgetTokens) {
    throw new DocumentTextExceedsModelContextError(estimated, budgetTokens);
  }
}
