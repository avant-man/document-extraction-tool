import { useEffect, useState } from 'react';
import type { Stage } from '../hooks/useExtraction';

interface ProcessingStateProps {
  stage: Extract<Stage, 'uploading' | 'extracting'>;
  progress: number;
  /** When extracting, optional server-reported step (OCR / Claude batches). */
  detailLabel?: string | null;
  /** Shown under the main label when polls are retrying (e.g. transient 503). */
  pollNotice?: string | null;
  /** Set when extraction begins; drives a ticking elapsed clock while extracting. */
  extractingStartedAt?: number | null;
  /** Last server job state write (ISO); from successful polls only. */
  jobUpdatedAt?: string | null;
}

function formatElapsed(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

export function ProcessingState({
  stage,
  progress,
  detailLabel,
  pollNotice,
  extractingStartedAt,
  jobUpdatedAt
}: ProcessingStateProps) {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (stage !== 'extracting' || extractingStartedAt == null) return;
    const id = window.setInterval(() => setTick(t => t + 1), 1000);
    return () => window.clearInterval(id);
  }, [stage, extractingStartedAt]);

  const label =
    stage === 'uploading'
      ? 'Uploading PDF…'
      : detailLabel && detailLabel.length > 0
        ? detailLabel
        : 'Extracting data with AI…';

  const elapsedSec =
    stage === 'extracting' && extractingStartedAt != null
      ? Math.max(0, Math.floor((Date.now() - extractingStartedAt) / 1000))
      : null;

  let serverUpdatedLine: string | null = null;
  if (jobUpdatedAt) {
    const d = new Date(jobUpdatedAt);
    if (!Number.isNaN(d.getTime())) {
      serverUpdatedLine = `Server last saved state: ${d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
    }
  }

  const ocrChunkHint =
    stage === 'extracting' && typeof detailLabel === 'string' && detailLabel.startsWith('OCR:');

  return (
    <div className="text-center py-16">
      <div className="animate-spin h-10 w-10 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4" />
      <p className="text-gray-700 font-medium">{label}</p>
      {elapsedSec != null ? (
        <p className="mt-1 text-sm text-gray-600" aria-live="polite">
          Elapsed {formatElapsed(elapsedSec)}
        </p>
      ) : null}
      {serverUpdatedLine ? (
        <p className="mt-1 text-xs text-gray-500" aria-live="polite">
          {serverUpdatedLine}
        </p>
      ) : null}
      {ocrChunkHint ? (
        <p className="mt-2 max-w-md mx-auto text-xs text-gray-500">
          The chunk number updates when each OCR step finishes. Image-heavy pages can take several minutes per chunk.
        </p>
      ) : null}
      {pollNotice ? (
        <p className="mt-1 text-sm text-amber-800" role="status">
          {pollNotice}
        </p>
      ) : null}
      {stage === 'extracting' ? (
        <div
          className="mt-4 w-64 mx-auto h-2 bg-gray-200 rounded-full overflow-hidden"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuetext="Extraction in progress"
        >
          <div
            className="h-full w-1/3 rounded-full bg-blue-600"
            style={{ animation: 'extraction-bar 1.4s ease-in-out infinite' }}
          />
        </div>
      ) : (
        <div className="mt-4 w-64 mx-auto bg-gray-200 rounded-full h-2">
          <div className="bg-blue-600 h-2 rounded-full transition-all" style={{ width: `${progress}%` }} />
        </div>
      )}
    </div>
  );
}
