/** Shared D3 chart colors — keep goals/BMP/benchmark visuals consistent. */

export const chartColors = {
  target: '#0d9488',
  achieved: '#16a34a',
  benchmarkMet: '#16a34a',
  benchmarkNotStarted: '#ef4444',
  benchmarkInProgress: '#f59e0b',
  benchmarkOther: '#64748b',
} as const;

/** Semi-transparent target bar (BMP chart background). */
export const targetBarOpacity = 0.3;

export const axisMuted = '#6b7280';
