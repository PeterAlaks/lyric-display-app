import express from 'express';
import multer from 'multer';
import { isOutputClientType } from '../config/clientTypes.js';
import { parseBackgroundMediaFilename } from '../media/backgroundMediaFilename.js';
import { inferMediaKind } from '../media/mediaTypes.js';
import { isStorageCapacityError, toStorageWriteFailure } from '../../shared/storageErrors.js';

const sendUploadError = (res, error, subject) => {
  if (isStorageCapacityError(error)) {
    const failure = toStorageWriteFailure(error, { subject });
    return res.status(507).json(failure);
  }
  if (error instanceof multer.MulterError) {
    return res.status(400).json({ error: error.message, code: error.code });
  }
  return res.status(400).json({ error: error?.message || 'Upload failed' });
};

export function registerMediaRoutes(app, {
  authenticateRequest,
  backgroundUpload,
  userMediaUpload,
  userMediaService,
  backgroundMediaService,
  uploadsRoot,
}) {
  app.post(
    '/api/media/backgrounds',
    authenticateRequest('settings:write'),
    async (req, res, next) => {
      backgroundUpload.single('background')(req, res, async (err) => {
        if (err) {
          console.error('Background upload error:', err);
          return sendUploadError(res, err, 'this background file');
        }
        if (!req.file) {
          return res.status(400).json({ error: 'No file uploaded' });
        }

        const relativePath = `/media/backgrounds/${req.file.filename}`;

        const outputKey = parseBackgroundMediaFilename(req.file.filename)?.outputKey;
        if (outputKey && isOutputClientType(outputKey)) {
          backgroundMediaService.cleanupOldMediaFiles(outputKey, { keepFilename: req.file.filename }).catch(err =>
            console.warn('Background cleanup failed (non-blocking):', err.message)
          );
        }

        res.json({
          url: relativePath,
          originalName: req.file.originalname,
          mimeType: req.file.mimetype,
          size: req.file.size,
          uploadedAt: Date.now(),
        });
      });
    }
  );

  app.get('/api/user-media', authenticateRequest('settings:read'), async (req, res) => {
    try {
      const [entries, usage] = await Promise.all([
        userMediaService.listUserMedia(req.query?.type || 'all'),
        userMediaService.getUserMediaUsage(),
      ]);
      res.json({ success: true, media: entries, usage });
    } catch (error) {
      if (error.statusCode) {
        return res.status(error.statusCode).json({ error: error.message });
      }
      console.error('User media list error:', error);
      res.status(500).json({ error: 'Could not list user media' });
    }
  });

  app.post('/api/user-media', authenticateRequest('settings:write'), async (req, res) => {
    let releaseUploadSlot;
    try {
      releaseUploadSlot = await userMediaService.reserveUserMediaSlot();
    } catch (error) {
      return res.status(error.statusCode || 500).json({
        error: error.message || 'Could not reserve media library space',
        code: error.code,
      });
    }

    userMediaUpload.single('media')(req, res, async (err) => {
      try {
        if (err) {
          console.error('User media upload error:', err);
          return sendUploadError(res, err, 'this media file');
        }
        if (!req.file) {
          return res.status(400).json({ error: 'No file uploaded' });
        }

        try {
          const mediaKind = inferMediaKind(req.file.mimetype);
          const payload = await userMediaService.toUserMediaPayload(mediaKind, req.file.filename);
          res.json({
            ...payload,
            name: req.file.originalname,
            originalName: req.file.originalname,
            mimeType: req.file.mimetype,
            size: req.file.size,
            uploadedAt: Date.now(),
          });
        } catch (error) {
          console.error('User media upload response error:', error);
          res.status(500).json({ error: 'Upload completed but media could not be indexed' });
        }
      } finally {
        releaseUploadSlot?.();
      }
    });
  });

  app.delete('/api/user-media/:type/:filename', authenticateRequest('settings:write'), async (req, res) => {
    try {
      await userMediaService.deleteUserMedia(req.params.type, req.params.filename);
      res.json({ success: true });
    } catch (error) {
      if (error.statusCode) {
        return res.status(error.statusCode).json({ error: error.message });
      }
      if (error?.code === 'ENOENT') {
        return res.status(404).json({ error: 'Media not found' });
      }
      console.error('User media delete error:', error);
      res.status(500).json({ error: 'Could not delete media' });
    }
  });

  app.delete('/api/user-media', authenticateRequest('settings:write'), async (req, res) => {
    try {
      const deleted = await userMediaService.deleteAllUserMedia(req.query?.type || 'all');
      res.json({ success: true, deleted });
    } catch (error) {
      if (error.statusCode) {
        return res.status(error.statusCode).json({ error: error.message });
      }
      console.error('User media delete all error:', error);
      res.status(500).json({ error: 'Could not delete media' });
    }
  });

  app.use('/media', express.static(uploadsRoot, {
    acceptRanges: true,
    immutable: true,
    maxAge: '30d',
    setHeaders: (res) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      res.setHeader('X-Content-Type-Options', 'nosniff');
    },
  }));
}
