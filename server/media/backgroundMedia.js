import fs from 'fs';
import path from 'path';
import { normalizeBackgroundOutputKey, parseBackgroundMediaFilename } from './backgroundMediaFilename.js';

export function createBackgroundMediaService({ backgroundMediaDir }) {
  const cleanupOldMediaFiles = async (outputKey, { keepFilename = null } = {}) => {
    const normalizedOutput = normalizeBackgroundOutputKey(outputKey);
    if (!normalizedOutput) return { deleted: 0, skipped: 0 };

    let deleted = 0;
    let skipped = 0;
    try {
      const files = await fs.promises.readdir(backgroundMediaDir);

      for (const file of files) {
        const parsed = parseBackgroundMediaFilename(file);
        if (!parsed || parsed.outputKey !== normalizedOutput || parsed.filename === keepFilename) {
          skipped += 1;
          continue;
        }

        const filePath = path.join(backgroundMediaDir, parsed.filename);
        try {
          await fs.promises.unlink(filePath);
          deleted += 1;
          console.log(`Cleaned up old media file: ${parsed.filename}`);
        } catch (error) {
          if (error?.code !== 'ENOENT') throw error;
        }
      }
    } catch (error) {
      console.warn('Media cleanup warning (non-critical):', error.message);
    }
    return { deleted, skipped };
  };

  return { cleanupOldMediaFiles };
}
