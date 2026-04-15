interface ProcessingStateProps {
  stage: 'uploading' | 'extracting';
  progress: number;
}

export function ProcessingState({ stage, progress }: ProcessingStateProps) {
  const label = stage === 'uploading' ? 'Uploading PDF...' : 'Extracting data with AI...';
  return (
    <div className="text-center py-16">
      <div className="animate-spin h-10 w-10 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4" />
      <p className="text-gray-700 font-medium">{label}</p>
      {stage === 'uploading' && (
        <div className="mt-4 w-64 mx-auto bg-gray-200 rounded-full h-2">
          <div className="bg-blue-600 h-2 rounded-full transition-all" style={{ width: `${progress}%` }} />
        </div>
      )}
    </div>
  );
}
