import { useState } from 'react';
import { upload } from '@vercel/blob/client';
import type {
  ExtractedReport,
  ExtractionJobPollResponse,
  ExtractionWarning
} from '../types/extraction';

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
}

const POLL_MS = import.meta.env.MODE === 'test' ? 0 : 2000;

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
    case 'ocr':
      if (ocrChunksTotal != null && ocrChunksTotal > 0 && ocrChunk != null) {
        return `OCR: chunk ${ocrChunk} of ${ocrChunksTotal}…`;
      }
      return 'Running OCR…';
    case 'annotating':
      return 'Preparing text for extraction…';
    case 'claude':
      if (claudeBatchesTotal != null && claudeBatchesTotal > 0 && claudeBatch != null) {
        return `Extracting with AI: batch ${claudeBatch} of ${claudeBatchesTotal}…`;
      }
      return 'Extracting with AI…';
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
    jobProgress: null
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
      jobProgress: null
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

    setState(s => ({ ...s, stage: 'extracting', progress: 100, jobStage: 'queued', jobProgress: null }));
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

      for (;;) {
        await new Promise(r => setTimeout(r, POLL_MS));
        const pollRes = await fetch(`${apiBase}/api/extract/jobs/${encodeURIComponent(jobId)}`);
        const pollRaw = await pollRes.text();
        if (!pollRes.ok) {
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
          jobProgress: poll.progress
        }));

        if (poll.status === 'failed') {
          throw new Error(poll.error ?? 'Extraction job failed');
        }
        if (poll.status === 'completed' && poll.result) {
          const body = poll.result;
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
            jobProgress: poll.progress
          }));
          return;
        }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setState(s => ({
        ...s,
        stage: 'error',
        error: 'Extraction failed: ' + message
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
      jobProgress: null
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
