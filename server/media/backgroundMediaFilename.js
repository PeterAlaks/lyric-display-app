import path from 'path';
import { getAllRoutableOutputIds } from '../../shared/outputRegistry.js';

const ROUTABLE_OUTPUTS = new Set(getAllRoutableOutputIds());
const ALLOWED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.avif', '.mp4', '.webm', '.ogg', '.mov']);
const MIME_EXTENSIONS = new Map([
  ['image/jpeg', new Set(['.jpg', '.jpeg'])],
  ['image/png', new Set(['.png'])],
  ['image/gif', new Set(['.gif'])],
  ['image/webp', new Set(['.webp'])],
  ['image/avif', new Set(['.avif'])],
  ['video/mp4', new Set(['.mp4'])],
  ['video/webm', new Set(['.webm'])],
  ['video/ogg', new Set(['.ogg'])],
  ['video/quicktime', new Set(['.mov'])],
]);
const MIME_EXTENSION = new Map([
  ['image/jpeg', '.jpg'],
  ['image/png', '.png'],
  ['image/gif', '.gif'],
  ['image/webp', '.webp'],
  ['image/avif', '.avif'],
  ['video/mp4', '.mp4'],
  ['video/webm', '.webm'],
  ['video/ogg', '.ogg'],
  ['video/quicktime', '.mov'],
]);
const BACKGROUND_FILENAME_PATTERN = /^bg-(output[1-6])-(\d{10,})-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(\.[a-z0-9]+)$/i;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const normalizeBackgroundOutputKey = (value) => {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return ROUTABLE_OUTPUTS.has(normalized) ? normalized : null;
};

export const resolveBackgroundMediaExtension = ({ originalName, mimeType } = {}) => {
  const supplied = path.extname(String(originalName || '')).toLowerCase();
  if (MIME_EXTENSIONS.get(mimeType)?.has(supplied)) return supplied;
  return MIME_EXTENSION.get(mimeType) || null;
};

export const buildBackgroundMediaFilename = ({ outputKey, timestamp, uuid, originalName, mimeType } = {}) => {
  const normalizedOutput = normalizeBackgroundOutputKey(outputKey);
  const extension = resolveBackgroundMediaExtension({ originalName, mimeType });
  const normalizedTimestamp = Number.isFinite(timestamp) ? Math.max(0, Math.floor(timestamp)) : null;
  const normalizedUuid = typeof uuid === 'string' ? uuid.trim().toLowerCase() : '';
  if (!normalizedOutput || !extension || normalizedTimestamp === null || !UUID_PATTERN.test(normalizedUuid)) {
    return null;
  }
  return `bg-${normalizedOutput}-${normalizedTimestamp}-${normalizedUuid}${extension}`;
};

export const parseBackgroundMediaFilename = (filename) => {
  const basename = path.basename(String(filename || ''));
  const match = BACKGROUND_FILENAME_PATTERN.exec(basename);
  if (!match) return null;
  const outputKey = normalizeBackgroundOutputKey(match[1]);
  const extension = match[4].toLowerCase();
  if (!outputKey || !ALLOWED_EXTENSIONS.has(extension)) return null;
  return {
    filename: basename,
    outputKey,
    timestamp: Number(match[2]),
    uuid: match[3].toLowerCase(),
    extension,
  };
};
