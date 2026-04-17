import { useState } from 'react';
import { upload } from '@vercel/blob/client';
import type { ExtractedReport, ExtractionApiResponse, ExtractionWarning } from '../types/extraction';

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
  progress: number;       // 0–100 (upload progress tracked via onUploadProgress)
  result: ExtractedReport | null;
  extractionWarnings: ExtractionWarning[];
  error: string | null;
  filename: string | null;
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

export function useExtraction() {
  const [state, setState] = useState<ExtractionState>({
    stage: 'idle',
    progress: 0,
    result: null,
    extractionWarnings: [],
    error: null,
    filename: null
  });

  async function extract(file: File) {
    setState({
      stage: 'uploading',
      progress: 0,
      result: null,
      extractionWarnings: [],
      error: null,
      filename: file.name
    });

    // Step 1: Upload to Vercel Blob
    let blobUrl: string;
    try {
      const blob = await upload(file.name, file, {
        access: 'public',
        handleUploadUrl: '/api/blob-upload',

        onUploadProgress: ({ percentage }) => {
          setState(s => ({ ...s, progress: Math.round(percentage) }));
        },
      });
      blobUrl = blob.url;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setState(s => ({ ...s, stage: 'error', error: 'Upload failed: ' + message }));
      return;
    }

    // Step 2: POST blobUrl to extraction API
    setState(s => ({ ...s, stage: 'extracting', progress: 100 }));
    try {
      const apiBase = import.meta.env.VITE_API_BASE_URL ?? '';
      const response = await fetch(`${apiBase}/api/extract`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blobUrl, filename: file.name })
      });
      const rawBody = await response.text();
      if (!response.ok) {
        const errMsg =
          parseJsonErrorField(rawBody) ?? (rawBody.trim().slice(0, 500) || `HTTP ${response.status}`);
        throw new Error(errMsg);
      }
      let body: ExtractionApiResponse;
      try {
        body = JSON.parse(rawBody) as ExtractionApiResponse;
      } catch {
        throw new Error(
          rawBody.trim().startsWith('<')
            ? 'Extraction service returned an HTML error page instead of JSON.'
            : `Invalid JSON from extraction API: ${rawBody.trim().slice(0, 120)}`
        );
      }
      const { extractionWarnings, ...report } = body;
      const warnings = extractionWarnings ?? [];
      logExtractionWarnings(warnings);
      setState(s => ({
        ...s,
        stage: 'done',
        progress: 100,
        result: report as ExtractedReport,
        extractionWarnings: warnings,
        error: null
      }));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setState(s => ({ ...s, stage: 'error', error: 'Extraction failed: ' + message }));
    }
  }

  function reset() {
    setState({
      stage: 'idle',
      progress: 0,
      result: null,
      extractionWarnings: [],
      error: null,
      filename: null
    });
  }

  return { ...state, extract, reset };
}
