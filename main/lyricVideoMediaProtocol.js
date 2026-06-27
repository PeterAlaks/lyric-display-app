import { protocol } from 'electron';
import { createReadStream } from 'fs';
import { stat } from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import { Readable } from 'stream';

const SCHEME = 'lyricdisplay-media';
const mediaGrants = new Map();

export function registerLyricVideoMediaScheme() {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: SCHEME,
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        stream: true,
      },
    },
  ]);
}

function parseRange(rangeHeader, size) {
  if (!rangeHeader) return null;
  const match = /^bytes=(\d*)-(\d*)$/i.exec(rangeHeader.trim());
  if (!match) return null;

  let start = match[1] ? Number(match[1]) : 0;
  let end = match[2] ? Number(match[2]) : size - 1;

  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  if (match[1] === '' && match[2] !== '') {
    const suffixLength = Math.max(0, end);
    start = Math.max(0, size - suffixLength);
    end = size - 1;
  }

  start = Math.max(0, start);
  end = Math.min(size - 1, end);
  if (start > end) return null;

  return { start, end };
}

export function registerLyricVideoMediaProtocol() {
  protocol.handle(SCHEME, async (request) => {
    const url = new URL(request.url);
    const token = url.hostname;
    const grant = mediaGrants.get(token);

    if (!grant) {
      return new Response('Media grant not found', { status: 404 });
    }

    const fileStat = await stat(grant.filePath);
    const range = parseRange(request.headers.get('Range'), fileStat.size);
    const start = range?.start ?? 0;
    const end = range?.end ?? fileStat.size - 1;
    const contentLength = end - start + 1;

    const headers = {
      'Content-Type': grant.mimeType || 'application/octet-stream',
      'Content-Length': String(contentLength),
      'Accept-Ranges': 'bytes',
    };

    if (range) {
      headers['Content-Range'] = `bytes ${start}-${end}/${fileStat.size}`;
    }

    return new Response(
      Readable.toWeb(createReadStream(grant.filePath, { start, end })),
      {
        status: range ? 206 : 200,
        headers,
      }
    );
  });
}

export function grantLyricVideoMediaFile(filePath, mimeType) {
  const token = randomUUID();
  mediaGrants.set(token, {
    filePath,
    mimeType,
  });

  const fileName = encodeURIComponent(path.basename(filePath));
  return `${SCHEME}://${token}/${fileName}`;
}

export function revokeLyricVideoMediaFile(sourceUrl) {
  if (typeof sourceUrl !== 'string' || !sourceUrl.startsWith(`${SCHEME}://`)) {
    return false;
  }

  try {
    const url = new URL(sourceUrl);
    return mediaGrants.delete(url.hostname);
  } catch {
    return false;
  }
}
