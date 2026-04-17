import type { Stage } from '../hooks/useExtraction';

interface ProcessingStateProps {
  stage: Extract<Stage, 'uploading' | 'extracting'>;
  progress: number;
  /** When extracting, optional server-reported step (OCR / Claude batches). */
  detailLabel?: string | null;
  /** Shown under the main label when polls are retrying (e.g. transient 503). */
  pollNotice?: string | null;
}

export function ProcessingState({ stage, progress, detailLabel, pollNotice }: ProcessingStateProps) {
  const label =
    stage === 'uploading'
      ? 'Uploading PDF…'
      : detailLabel && detailLabel.length > 0
        ? detailLabel
        : 'Extracting data with AI…';
  return (
    <div className="text-center py-16">
      <div className="animate-spin h-10 w-10 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4" />
      <p className="text-gray-700 font-medium">{label}</p>
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
