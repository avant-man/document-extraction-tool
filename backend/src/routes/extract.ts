import { Router } from 'express';
import { fetchPdfBuffer, deleteBlobSafe } from '../services/blobService';
import { extractTextFromBuffer } from '../services/pdfService';
import { annotateText } from '../services/regexParser';
import { extractWithClaude } from '../services/claudeService';
import { validate } from '../services/validator';

const router = Router();

router.post('/extract', async (req, res) => {
  const { blobUrl, filename } = req.body;
  if (!blobUrl || typeof blobUrl !== 'string') {
    return res.status(400).json({ error: 'blobUrl required' });
  }

  let buffer: Buffer;
  try {
    buffer = await fetchPdfBuffer(blobUrl);
  } catch (err) {
    return res.status(502).json({ error: 'Failed to fetch PDF from storage' });
  }

  // Fire-and-forget blob deletion
  deleteBlobSafe(blobUrl);

  try {
    const rawText = await extractTextFromBuffer(buffer);
    const { text: annotatedText, regexNumerics } = annotateText(rawText);
    const rawJson = await extractWithClaude(annotatedText);
    const result = validate(rawJson, regexNumerics, rawText);
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ error: err.message ?? 'Extraction failed' });
  }
});

export default router;
