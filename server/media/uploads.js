import crypto from 'crypto';
import path from 'path';
import multer from 'multer';
import { allowedMediaTypes, inferMediaKind } from './mediaTypes.js';
import {
  buildBackgroundMediaFilename,
  normalizeBackgroundOutputKey,
} from './backgroundMediaFilename.js';

export function createUploadMiddleware({ backgroundMediaDir, getMediaDirectory }) {
  const backgroundStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, backgroundMediaDir),
    filename: (req, file, cb) => {
      const outputKey = normalizeBackgroundOutputKey(req.body.outputKey || 'output1');
      const uniqueName = buildBackgroundMediaFilename({
        outputKey,
        timestamp: Date.now(),
        uuid: crypto.randomUUID(),
        originalName: file.originalname,
        mimeType: file.mimetype,
      });
      if (!uniqueName) return cb(new Error('Invalid background media filename or output key'));
      cb(null, uniqueName);
    }
  });

  const backgroundUpload = multer({
    storage: backgroundStorage,
    limits: {
      fileSize: 200 * 1024 * 1024,
    },
    fileFilter: (req, file, cb) => {
      if (!file?.mimetype || !allowedMediaTypes.has(file.mimetype)) {
        return cb(new Error('Unsupported media type'));
      }
      cb(null, true);
    },
  });

  const userMediaStorage = multer.diskStorage({
    destination: (req, file, cb) => {
      const mediaKind = inferMediaKind(file?.mimetype);
      const directory = getMediaDirectory(mediaKind);
      if (!directory) {
        return cb(new Error('Unsupported media type'));
      }
      cb(null, directory);
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname || '').slice(0, 16) || '.bin';
      const safeOriginalName = path.basename(file.originalname || 'media').replace(/[^\w.\- ]+/g, '').trim() || 'media';
      cb(null, `media-${Date.now()}-${crypto.randomUUID()}-${safeOriginalName}${ext && safeOriginalName.toLowerCase().endsWith(ext.toLowerCase()) ? '' : ext}`);
    }
  });

  const userMediaUpload = multer({
    storage: userMediaStorage,
    limits: {
      fileSize: 200 * 1024 * 1024,
    },
    fileFilter: (req, file, cb) => {
      const mediaKind = inferMediaKind(file?.mimetype);
      const requestedType = req.body?.type;
      if (!mediaKind) {
        return cb(new Error('Unsupported media type'));
      }
      if (requestedType && requestedType !== 'all' && requestedType !== mediaKind) {
        return cb(new Error(`Please upload a ${requestedType} file`));
      }
      cb(null, true);
    },
  });

  return {
    backgroundUpload,
    userMediaUpload,
  };
}
