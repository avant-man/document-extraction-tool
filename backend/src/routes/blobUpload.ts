import { Router } from 'express';
import { handleUpload } from '@vercel/blob/client';

const router = Router();

router.post('/blob-upload', async (req, res, next) => {
  try {
    const url = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      if (value) headers.set(key, Array.isArray(value) ? value.join(', ') : value);
    }
    const webRequest = new Request(url, {
      method: req.method,
      headers,
      body: JSON.stringify(req.body),
    });

    const jsonResponse = await handleUpload({
      body: req.body,
      request: webRequest,
      onBeforeGenerateToken: async (_pathname) => ({
        allowedContentTypes: ['application/pdf'],
        maximumSizeInBytes: 150 * 1024 * 1024,
        addRandomSuffix: true,
      }),
    });
    res.json(jsonResponse);
  } catch (err) {
    next(err);
  }
});

export default router;
