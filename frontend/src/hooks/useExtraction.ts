import { useState } from 'react';
import { upload } from '@vercel/blob/client';
import type {
  ExtractedReport,
  ExtractionApiResponse,
  ExtractionJobPollResponse,
  ExtractionWarning
} from '../types/extraction';

/** When the job is `completed` but the payload is missing shape, still leave extracting UI. */
function isCompletedResultBody(
  value: ExtractionJobPollResponse['result']
): value is ExtractionApiResponse {
  return (
    value != null &&
    typeof value === 'object' &&
    'summary' in value &&
    value.summary != null &&
    typeof value.summary === 'object'
  );
}

const FALLBACK_COMPLETED_BODY: ExtractionApiResponse = {
  summary: {
    watershedName: '',
    planYear: 0,
    totalGoals: 0,
    totalBMPs: 0,
    completionRate: 0,
    completionRateBasis: 'none',
    totalEstimatedCost: 0,
    geographicScope: ''
  },
  goals: [],
  bmps: [],
  implementation: [],
  monitoring: [],
  outreach: [],
  geographicAreas: [],
  extractionWarnings: []
};

const POLL_MS = import.meta.env.MODE === 'test' ? 0 : 2000;
const MAX_CONSECUTIVE_TRANSIENT_POLLS = 25;

const POLL_FETCH_INIT: RequestInit = { cache: 'no-store' };

function logExtractionWarnings(warnings: ExtractionWarning[]): void {
  if (warnings.length === 0) return;
  console.groupCollapsed(`[extraction] Extraction notices (${warnings.length})`);
  for (const w of warnings) {
    console.info(`%c${w.code}`, 'font-weight:600;color:#92400e', w.message);
  }
  console.groupEnd();
}

export type Stage = 'idle' | 'uploading' | 'extracting' | 'done' | 'error';

interface ExtractionState {
  stage: Stage;
  progress: number;
  result: ExtractedReport | null;
  extractionWarnings: ExtractionWarning[];
  error: string | null;
  filename: string | null;
  jobStage: string | null;
  jobProgress: ExtractionJobPollResponse['progress'] | null;
  pollNotice: string | null;
}

function parseJsonErrorField(text: string): string | undefined {
  const trimmed = text.trim();
  if (!trimmed) return undefined;
  try {
    const parsed = JSON.parse(trimmed) as { error?: string };
    return parsed.error ?? trimmed.slice(0, 500);
  } catch {
    return trimmed.slice(0, 500);
  }
}

/** Parses error JSON from failed poll / job create responses. */
function parsePollErrorBody(text: string): { message?: string; retryable: boolean } {
  const trimmed = text.trim();
  if (!trimmed) return { retryable: true };
  try {
    const parsed = JSON.parse(trimmed) as { error?: string; retryable?: boolean };
    return {
      message: parsed.error ?? trimmed.slice(0, 500),
      retryable: parsed.retryable !== false
    };
  } catch {
    return { message: trimmed.slice(0, 500), retryable: true };
  }
}

/** Backend `ocrChunk` is completed chunks; show 1-based in-flight chunk for users. */
function displayOcrChunk(ocrChunk: number | null, ocrChunksTotal: number | null): number | null {
  if (ocrChunksTotal == null || ocrChunksTotal <= 0) return null;
  const completed = ocrChunk ?? 0;
  return Math.min(completed + 1, ocrChunksTotal);
}

/** Backend `claudeBatch` counts finished batches from 0; show 1-based in-flight batch. */
function displayClaudeBatch(claudeBatch: number | null, claudeBatchesTotal: number | null): number | null {
  if (claudeBatchesTotal == null || claudeBatchesTotal <= 0) return null;
  if (claudeBatch == null) return null;
  return Math.min(claudeBatch + 1, claudeBatchesTotal);
}

function labelForJobStage(
  stage: string,
  progress: ExtractionJobPollResponse['progress'] | null
): string {
  const { ocrChunk, ocrChunksTotal, claudeBatch, claudeBatchesTotal } = progress ?? {
    ocrChunk: null,
    ocrChunksTotal: null,
    claudeBatch: null,
    claudeBatchesTotal: null
  };
  switch (stage) {
    case 'queued':
      return 'Queued…';
    case 'fetching':
      return 'Reading PDF…';
    case 'ocr': {
      const display = displayOcrChunk(ocrChunk, ocrChunksTotal);
      if (display != null && ocrChunksTotal != null) {
        return `OCR: chunk ${display} of ${ocrChunksTotal}…`;
      }
      return 'Running OCR…';
    }
    case 'annotating':
      return 'Preparing text for extraction…';
    case 'claude': {
      const display = displayClaudeBatch(claudeBatch, claudeBatchesTotal);
      if (display != null && claudeBatchesTotal != null) {
        return `Extracting with AI: batch ${display} of ${claudeBatchesTotal}…`;
      }
      return 'Extracting with AI…';
    }
    case 'merging':
      return 'Validating and merging…';
    default:
      return 'Extracting data…';
  }
}

export function useExtraction() {
  const [state, setState] = useState<ExtractionState>({
    stage: 'idle',
    progress: 0,
    result: null,
    extractionWarnings: [],
    error: null,
    filename: null,
    jobStage: null,
    jobProgress: null,
    pollNotice: null
  });

  async function extract(file: File) {
    setState({
      stage: 'uploading',
      progress: 0,
      result: null,
      extractionWarnings: [],
      error: null,
      filename: file.name,
      jobStage: null,
      jobProgress: null,
      pollNotice: null
    });

    let blobUrl: string;
    try {
      const blob = await upload(file.name, file, {
        access: 'public',
        handleUploadUrl: '/api/blob-upload',

        onUploadProgress: ({ percentage }) => {
          setState(s => ({ ...s, progress: Math.round(percentage) }));
        }
      });
      blobUrl = blob.url;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setState(s => ({ ...s, stage: 'error', error: 'Upload failed: ' + message }));
      return;
    }

    setState(s => ({
      ...s,
      stage: 'extracting',
      progress: 100,
      jobStage: 'queued',
      jobProgress: null,
      pollNotice: null
    }));
    const apiBase = import.meta.env.VITE_API_BASE_URL ?? '';

    try {
      const createRes = await fetch(`${apiBase}/api/extract/jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blobUrl, filename: file.name })
      });
      const createRaw = await createRes.text();
      if (createRes.status === 503 || createRes.status === 501) {
        const errMsg = parseJsonErrorField(createRaw) ?? 'Async extraction is not configured on the server.';
        throw new Error(errMsg);
      }
      if (createRes.status !== 202) {
        const errMsg =
          parseJsonErrorField(createRaw) ?? (createRaw.trim().slice(0, 500) || `HTTP ${createRes.status}`);
        throw new Error(errMsg);
      }
      let jobId: string;
      try {
        jobId = (JSON.parse(createRaw) as { jobId: string }).jobId;
      } catch {
        throw new Error('Invalid JSON from extraction job API');
      }
      if (!jobId) throw new Error('Missing jobId from extraction job API');

      let transientStreak = 0;
      const jobUrl = `${apiBase}/api/extract/jobs/${encodeURIComponent(jobId)}`;

      for (;;) {
        const pollRes = await fetch(jobUrl, POLL_FETCH_INIT);
        const pollRaw = await pollRes.text();

        if (pollRes.status === 503) {
          const { message, retryable } = parsePollErrorBody(pollRaw);
          if (retryable && transientStreak < MAX_CONSECUTIVE_TRANSIENT_POLLS) {
            transientStreak += 1;
            setState(s => ({
              ...s,
              pollNotice: 'Reconnecting to server…',
              jobStage: s.jobStage,
              jobProgress: s.jobProgress
            }));
            await new Promise(r => setTimeout(r, POLL_MS));
            continue;
          }
          throw new Error(message ?? 'Job status temporarily unavailable');
        }

        transientStreak = 0;

        if (!pollRes.ok) {
          if (pollRes.status === 404) {
            throw new Error(parseJsonErrorField(pollRaw) ?? 'Job not found');
          }
          throw new Error(parseJsonErrorField(pollRaw) ?? `Job status HTTP ${pollRes.status}`);
        }

        let poll: ExtractionJobPollResponse;
        try {
          poll = JSON.parse(pollRaw) as ExtractionJobPollResponse;
        } catch {
          throw new Error('Invalid JSON while polling extraction job');
        }

        setState(s => ({
          ...s,
          jobStage: poll.stage,
          jobProgress: poll.progress,
          pollNotice: null
        }));

        if (poll.status === 'failed') {
          throw new Error(poll.error ?? 'Extraction job failed');
        }
        if (poll.status === 'completed') {
          const body: ExtractionApiResponse = isCompletedResultBody(poll.result)
            ? poll.result
            : {
                ...FALLBACK_COMPLETED_BODY,
                extractionWarnings:
                  poll.result &&
                  typeof poll.result === 'object' &&
                  'extractionWarnings' in poll.result &&
                  Array.isArray((poll.result as ExtractionApiResponse).extractionWarnings)
                    ? ((poll.result as ExtractionApiResponse).extractionWarnings ?? [])
                    : FALLBACK_COMPLETED_BODY.extractionWarnings
              };
          const { extractionWarnings, ...report } = body;
          const warnings = extractionWarnings ?? [];
          logExtractionWarnings(warnings);
          setState(s => ({
            ...s,
            stage: 'done',
            progress: 100,
            result: report as ExtractedReport,
            extractionWarnings: warnings,
            error: null,
            jobStage: 'done',
            jobProgress: poll.progress,
            pollNotice: null
          }));
          return;
        }

        await new Promise(r => setTimeout(r, POLL_MS));
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setState(s => ({
        ...s,
        stage: 'error',
        error: 'Extraction failed: ' + message,
        pollNotice: null
      }));
    }
  }

  function reset() {
    setState({
      stage: 'idle',
      progress: 0,
      result: null,
      extractionWarnings: [],
      error: null,
      filename: null,
      jobStage: null,
      jobProgress: null,
      pollNotice: null
    });
  }

  return {
    ...state,
    extract,
    reset,
    jobLabel:
      state.stage === 'extracting' && state.jobStage
        ? labelForJobStage(state.jobStage, state.jobProgress)
        : null
  };
}
