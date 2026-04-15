import { Router } from 'express';
import { handleUpload } from '@vercel/blob/client';

const router = Router();

router.post('/blob-upload', async (req, res) => {
  const jsonResponse = await handleUpload({
    body: req.body,
    request: req as any,
    onBeforeGenerateToken: async (_pathname) => ({
      allowedContentTypes: ['application/pdf'],
      maximumSizeInBytes: 150 * 1024 * 1024 // 150MB
    }),
    onUploadCompleted: async () => {}
  });
  res.json(jsonResponse);
});

export default router;
