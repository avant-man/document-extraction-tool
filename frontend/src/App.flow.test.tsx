import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import type { ExtractedReport } from './types/extraction';

vi.mock('@vercel/blob/client', () => ({
  upload: vi.fn(() =>
    Promise.resolve({ url: 'https://example.com/blob.pdf' })
  ),
}));

const minimalReport: ExtractedReport = {
  summary: {
    watershedName: 'Test',
    planYear: 2024,
    totalGoals: 0,
    totalBMPs: 0,
    completionRate: 0,
    completionRateBasis: 'none',
    totalEstimatedCost: 0,
    geographicScope: '',
  },
  goals: [],
  bmps: [],
  implementation: [],
  monitoring: [],
  outreach: [],
  geographicAreas: [],
};

function resolveFetchUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

describe('App extraction flow', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = resolveFetchUrl(input);
        if (url.includes('/api/extract')) {
          return Promise.resolve(
            new Response(JSON.stringify(minimalReport), {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            })
          );
        }
        return Promise.resolve(new Response('not found', { status: 404 }));
      })
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('shows dashboard after mock upload and extract', async () => {
    const user = userEvent.setup();
    render(<App />);

    const file = new File(['%PDF-1.4'], 'watershed.pdf', {
      type: 'application/pdf',
    });
    await user.upload(screen.getByLabelText(/select pdf/i), file);

    expect(await screen.findByRole('tab', { name: 'Summary' })).toBeInTheDocument();
    expect(
      screen.getByText(/Derived from extracted benchmark statuses/)
    ).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Geographic' })).toBeInTheDocument();
    expect(screen.getByText('Total Goals')).toBeInTheDocument();
    expect(screen.getByText('Export:')).toBeInTheDocument();
  });
});
