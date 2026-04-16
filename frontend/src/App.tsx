import { DropZone } from './components/DropZone';
import { ProcessingState } from './components/ProcessingState';
import { Dashboard } from './components/Dashboard';
import { useExtraction } from './hooks/useExtraction';

export default function App() {
  const { stage, progress, result, error, extract, reset } = useExtraction();

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm px-6 py-4 flex items-center gap-3">
        <svg className="h-6 w-6 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <h1 className="text-xl font-semibold text-gray-800">PDF Data Extractor</h1>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-12">
        {stage === 'idle' && (
          <>
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-gray-900">PDF Data Extractor</h2>
              <p className="text-gray-500 mt-2">Upload any watershed plan PDF to extract relevant data</p>
            </div>
            <DropZone onFile={extract} />
          </>
        )}

        {(stage === 'uploading' || stage === 'extracting') && (
          <ProcessingState stage={stage} progress={progress} />
        )}

        {stage === 'error' && (
          <div className="text-center py-16">
            <p className="text-red-600 font-medium">{error}</p>
            <button onClick={reset} className="mt-4 px-6 py-2 bg-gray-200 rounded-lg hover:bg-gray-300">
              Try again
            </button>
          </div>
        )}

        {stage === 'done' && result && (
          <div>
            <Dashboard report={result} />
            <button onClick={reset} className="mt-6 px-4 py-2 text-sm text-gray-600 hover:text-gray-800">
              ← Upload another PDF
            </button>
          </div>
        )}

        {stage === 'done' && !result && (
          <div className="text-center py-16">
            <p className="text-red-600 font-medium">Extraction returned no data.</p>
            <button onClick={reset} className="mt-4 px-6 py-2 bg-gray-200 rounded-lg hover:bg-gray-300">Try again</button>
          </div>
        )}
      </main>
    </div>
  );
}
