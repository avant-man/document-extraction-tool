import { describe, it, expect } from 'vitest';
import { annotateText, buildRegexNumerics } from './regexParser';

describe('regexParser', () => {
  it('tags Management Goals with SECTION goal', () => {
    const { text } = annotateText('Introduction\nMississippi Management Goals\nGoal text');
    expect(text).toContain('[SECTION:goal]');
  });

  it('tags dollar amounts with cents as single NUM marker', () => {
    const { annotatedText } = buildRegexNumerics('Fee is $7,037.01 per unit.');
    expect(annotatedText).toContain('[NUM:$7,037.01]');
  });

  it('injects BMP_ROW_WITH_ACRES when acre marker and BMP vocabulary align', () => {
    const { text } = annotateText(
      'Pasture and Hay Land Planting 100 acres with structural BMP practice'
    );
    expect(text).toContain('[BMP_ROW_WITH_ACRES]');
  });
});
