import { useState } from 'react';
import { upload } from '@vercel/blob/client';
import type { ExtractedReport } from '../types/extraction';

export type Stage = 'idle' | 'uploading' | 'extracting' | 'done' | 'error';

interface ExtractionState {
  stage: Stage;
  progress: number;       // 0–100 (upload progress tracked via onUploadProgress)
  result: ExtractedReport | null;
  error: string | null;
  filename: string | null;
}

export function useExtraction() {
  const [state, setState] = useState<ExtractionState>({
    stage: 'idle', progress: 0, result: null, error: null, filename: null
  });

  async function extract(file: File) {
    setState({
      stage: 'uploading',
      progress: 0,
      result: null,
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
      if (!response.ok) {
        const errBody = await response.json() as { error?: string };
        throw new Error(errBody.error ?? `HTTP ${response.status}`);
      }
      const result: ExtractedReport = await response.json() as ExtractedReport;
      setState(s => ({ ...s, stage: 'done', progress: 100, result, error: null }));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setState(s => ({ ...s, stage: 'error', error: 'Extraction failed: ' + message }));
    }
  }

  function reset() {
    setState({ stage: 'idle', progress: 0, result: null, error: null, filename: null });
  }

  return { ...state, extract, reset };
}
