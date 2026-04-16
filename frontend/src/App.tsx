import { Dashboard } from './components/Dashboard';
import { MOCK_REPORT } from './lib/mockData';

function App() {
  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">PDF Extractor</h1>
      <Dashboard report={MOCK_REPORT} filename="test.pdf" />
    </div>
  );
}

export default App;
