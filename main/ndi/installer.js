import { createHash } from 'crypto';
import { Readable, Transform, Writable } from 'stream';
import { pipeline } from 'stream/promises';
import { NDI_MANAGED_INSTALL_MARKER } from '../appIdentity.js';
import { extractZipArchive } from '../archiveExtraction.js';

const RELEASE_CHECK_INTERVAL = 60 * 60 * 1000; // 1 hour
const CHECKSUM_REQUIRED_FROM_VERSION = '1.0.6';
const API_TIMEOUT_MS = 15_000;
const REQUEST_TIMEOUT_MS = 30_000;
const STREAM_IDLE_TIMEOUT_MS = 60_000;
const MAX_REDIRECTS = 8;
const MAX_API_RESPONSE_BYTES = 2 * 1024 * 1024;
const MAX_CHECKSUM_RESPONSE_BYTES = 4096;
const MAX_COMPANION_ARCHIVE_BYTES = 1024 * 1024 * 1024;

class NdiInstallError extends Error {
  constructor(message, { stage = 'unknown', code = 'NDI_INSTALL_FAILED', url = '', cause = null } = {}) {
    super(message, cause ? { cause } : undefined);
    this.name = 'NdiInstallError';
    this.stage = stage;
    this.code = code;
    this.host = getUrlHost(url);
  }
}

function getUrlHost(value) {
  try {
    return new URL(value).hostname;
  } catch {
    return '';
  }
}

function getHeader(headers, name) {
  if (!headers) return '';
  if (typeof headers.get === 'function') return headers.get(name) || '';
  const direct = headers[name] ?? headers[name.toLowerCase()];
  return Array.isArray(direct) ? direct[0] || '' : direct || '';
}

function isAbortError(error) {
  return error?.name === 'AbortError' || error?.code === 'ABORT_ERR';
}

function throwIfAborted(signal) {
  if (!signal?.aborted) return;
  throw new NdiInstallError('Download cancelled by user', {
    stage: 'cancelled',
    code: 'DOWNLOAD_CANCELLED',
  });
}

function createLinkedAbortController(signal, timeoutMs = 0) {
  const controller = new AbortController();
  let timedOut = false;
  const onAbort = () => controller.abort(signal?.reason);
  if (signal) {
    if (signal.aborted) onAbort();
    else signal.addEventListener('abort', onAbort, { once: true });
  }
  const timer = timeoutMs > 0
    ? setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs)
    : null;
  timer?.unref?.();

  return {
    controller,
    didTimeout: () => timedOut,
    cleanup() {
      if (timer) clearTimeout(timer);
      signal?.removeEventListener?.('abort', onAbort);
    },
  };
}

function toNodeReadable(body) {
  if (!body) return Readable.from([]);
  if (typeof body.getReader === 'function') return Readable.fromWeb(body);
  return body;
}

function createIdleAbortController(signal, idleTimeoutMs) {
  const linked = createLinkedAbortController(signal);
  let idleTimedOut = false;
  let timer = null;
  const reset = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      idleTimedOut = true;
      linked.controller.abort();
    }, idleTimeoutMs);
    timer.unref?.();
  };
  const cleanup = () => {
    if (timer) clearTimeout(timer);
    linked.cleanup();
  };
  reset();
  return { ...linked, reset, cleanup, didTimeout: () => idleTimedOut };
}

function parseSha256Checksum(value) {
  const match = /^[ \t]*([a-f0-9]{64})(?:[ \t]+[*]?[^\r\n]*)?[ \t]*(?:\r?\n)?$/i.exec(String(value || ''));
  return match ? match[1].toLowerCase() : null;
}

function replaceDirectoryAtomically({ fs, stagedPath, destinationPath }) {
  const backupPath = `${destinationPath}-backup-${process.pid}-${Date.now()}`;
  const hadExistingDestination = fs.existsSync(destinationPath);

  if (hadExistingDestination) {
    fs.renameSync(destinationPath, backupPath);
  }

  try {
    fs.renameSync(stagedPath, destinationPath);
  } catch (error) {
    if (hadExistingDestination && fs.existsSync(backupPath) && !fs.existsSync(destinationPath)) {
      try {
        fs.renameSync(backupPath, destinationPath);
      } catch (rollbackError) {
        error.message += `; rollback failed: ${rollbackError.message}`;
      }
    }
    throw error;
  }

  let backupCleanupError = null;
  if (hadExistingDestination && fs.existsSync(backupPath)) {
    try {
      fs.rmSync(backupPath, { recursive: true, force: true });
    } catch (error) {
      backupCleanupError = error;
    }
  }

  return { backupPath, backupCleanupError };
}

function createNdiInstaller({
  app,
  fs,
  path,
  isDev,
  ndiStore,
  githubOwner,
  githubRepo,
  notifyAllWindows,
  getInstallPath,
  getResolvedInstallPath = getInstallPath,
  getLegacyInstallPaths = () => [],
  getRemovableLegacyInstallPaths = getLegacyInstallPaths,
  getUninstallPaths = () => [getInstallPath(), ...getRemovableLegacyInstallPaths()],
  getCompanionEntryPath,
  resolveCompanionEntryPath = (installPath) => path.join(installPath, path.basename(getCompanionEntryPath())),
  getPlatformAssetName,
  stopCompanion,
  networkFetch,
  extractArchive = null,
}) {
  const GITHUB_API_BASE = `https://api.github.com/repos/${githubOwner}/${githubRepo}`;

  if (typeof networkFetch !== 'function') {
    throw new Error('NDI installer requires a proxy-aware network fetch implementation');
  }

  let latestReleaseCache = null;
  let lastReleaseCheck = 0;
  let activeDownloadOperation = null;
  let activeDownloadAbortController = null;

  function resetUpdateCache() {
    latestReleaseCache = null;
    lastReleaseCheck = 0;
  }

  function compareVersions(a, b) {
    if (!a || !b) return 0;
    const pa = a.replace(/^v/, '').split('.').map(Number);
    const pb = b.replace(/^v/, '').split('.').map(Number);
    for (let i = 0; i < 3; i += 1) {
      const na = pa[i] || 0;
      const nb = pb[i] || 0;
      if (na > nb) return 1;
      if (na < nb) return -1;
    }
    return 0;
  }

  function checkInstalled() {
    const entryPath = getCompanionEntryPath();
    const resolvedInstallPath = getResolvedInstallPath();

    if (isDev) {
      const installed = fs.existsSync(entryPath);
      let version = ndiStore.get('version') || '';
      if (installed) {
        try {
          const companionPkg = JSON.parse(fs.readFileSync(path.join(resolvedInstallPath, 'package.json'), 'utf8'));
          if (companionPkg.version) version = companionPkg.version;
        } catch { /* fallback to store value */ }
      }
      return {
        installed,
        version,
        installPath: resolvedInstallPath,
        companionPath: entryPath,
      };
    }

    const installed = fs.existsSync(entryPath);
    if (installed) {
      ndiStore.set('installed', true);
      ndiStore.set('installPath', resolvedInstallPath);

      return {
        installed: true,
        version: ndiStore.get('version') || '',
        installPath: resolvedInstallPath,
        companionPath: entryPath,
      };
    }

    if (ndiStore.get('installed')) {
      ndiStore.set('installed', false);
    }
    if (ndiStore.get('installPath')) {
      ndiStore.set('installPath', '');
    }

    return {
      installed: false,
      version: ndiStore.get('version') || '',
      installPath: '',
      companionPath: entryPath,
    };
  }

  async function requestWithRedirects(url, {
    signal,
    headers = {},
    timeoutMs = REQUEST_TIMEOUT_MS,
    stage = 'request',
  } = {}) {
    let currentUrl = url;
    let resolvedVersion = '';

    for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
      throwIfAborted(signal);
      let parsedUrl;
      try {
        parsedUrl = new URL(currentUrl);
      } catch (error) {
        throw new NdiInstallError('The download service returned an invalid URL', {
          stage,
          code: 'INVALID_DOWNLOAD_URL',
          url: currentUrl,
          cause: error,
        });
      }
      if (parsedUrl.protocol !== 'https:') {
        throw new NdiInstallError('The download service attempted an insecure redirect', {
          stage,
          code: 'INSECURE_REDIRECT',
          url: currentUrl,
        });
      }

      const linked = createLinkedAbortController(signal, timeoutMs);
      let response;
      try {
        response = await networkFetch(currentUrl, {
          method: 'GET',
          headers,
          redirect: 'manual',
          signal: linked.controller.signal,
          cache: 'no-store',
        });
      } catch (error) {
        if (signal?.aborted) throwIfAborted(signal);
        if (linked.didTimeout()) {
          throw new NdiInstallError('The download service did not respond in time', {
            stage,
            code: 'REQUEST_TIMEOUT',
            url: currentUrl,
            cause: error,
          });
        }
        throw new NdiInstallError(error?.message || 'Could not reach the download service', {
          stage,
          code: error?.code || 'NETWORK_REQUEST_FAILED',
          url: currentUrl,
          cause: error,
        });
      } finally {
        linked.cleanup();
      }

      const status = Number(response?.status ?? response?.statusCode ?? 0);
      if (status >= 300 && status < 400) {
        const location = getHeader(response.headers, 'location');
        if (!location) {
          throw new NdiInstallError(`The download service returned redirect ${status} without a location`, {
            stage,
            code: 'INVALID_REDIRECT',
            url: currentUrl,
          });
        }
        if (redirectCount >= MAX_REDIRECTS) {
          throw new NdiInstallError('The download service returned too many redirects', {
            stage,
            code: 'TOO_MANY_REDIRECTS',
            url: currentUrl,
          });
        }
        try { await response.body?.cancel?.(); } catch { /* redirect body is not needed */ }
        currentUrl = new URL(location, currentUrl).toString();
        const versionMatch = /\/releases\/download\/v?([^/]+)\//i.exec(currentUrl);
        if (versionMatch?.[1]) resolvedVersion = decodeURIComponent(versionMatch[1]);
        continue;
      }

      // Electron documents Response.url as unreliable for net.fetch(); the
      // explicitly followed URL is authoritative here.
      const responseUrl = currentUrl;
      const versionMatch = /\/releases\/download\/v?([^/]+)\//i.exec(responseUrl);
      if (versionMatch?.[1]) resolvedVersion = decodeURIComponent(versionMatch[1]);
      return { response, status, url: responseUrl, resolvedVersion };
    }

    throw new NdiInstallError('The download service returned too many redirects', {
      stage,
      code: 'TOO_MANY_REDIRECTS',
      url: currentUrl,
    });
  }

  async function readResponseBuffer(response, {
    signal,
    maxBytes,
    stage,
    url,
    idleTimeoutMs = STREAM_IDLE_TIMEOUT_MS,
  }) {
    const declaredSize = Number.parseInt(getHeader(response.headers, 'content-length'), 10) || 0;
    const contentEncoded = Boolean(getHeader(response.headers, 'content-encoding'));
    if (declaredSize > maxBytes) {
      throw new NdiInstallError('The download service returned more data than expected', {
        stage,
        code: 'RESPONSE_TOO_LARGE',
        url,
      });
    }

    const chunks = [];
    let received = 0;
    const idle = createIdleAbortController(signal, idleTimeoutMs);
    const sink = new Writable({
      write(chunk, _encoding, callback) {
        idle.reset();
        received += chunk.length;
        if (received > maxBytes) {
          callback(new NdiInstallError('The download service returned more data than expected', {
            stage,
            code: 'RESPONSE_TOO_LARGE',
            url,
          }));
          return;
        }
        chunks.push(Buffer.from(chunk));
        callback();
      },
    });

    try {
      await pipeline(toNodeReadable(response.body), sink, { signal: idle.controller.signal });
    } catch (error) {
      if (signal?.aborted) throwIfAborted(signal);
      if (idle.didTimeout()) {
        throw new NdiInstallError('The download stalled before it completed', {
          stage,
          code: 'DOWNLOAD_STALLED',
          url,
          cause: error,
        });
      }
      if (error instanceof NdiInstallError) throw error;
      throw new NdiInstallError(error?.message || 'The download ended unexpectedly', {
        stage,
        code: isAbortError(error) ? 'DOWNLOAD_ABORTED' : 'RESPONSE_STREAM_FAILED',
        url,
        cause: error,
      });
    } finally {
      idle.cleanup();
    }

    if (!contentEncoded && declaredSize > 0 && received !== declaredSize) {
      throw new NdiInstallError(`The download was incomplete (${received} of ${declaredSize} bytes)`, {
        stage,
        code: 'DOWNLOAD_TRUNCATED',
        url,
      });
    }
    return Buffer.concat(chunks, received);
  }

  async function githubApiRequest(urlPath, signal) {
    const url = urlPath.startsWith('http') ? urlPath : `${GITHUB_API_BASE}${urlPath}`;
    const result = await requestWithRedirects(url, {
      signal,
      headers: {
        'User-Agent': 'LyricDisplay-App',
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      timeoutMs: API_TIMEOUT_MS,
      stage: 'release-metadata',
    });

    if (result.status === 404) {
      try { await result.response.body?.cancel?.(); } catch { /* error body is not needed */ }
      return null;
    }
    if (result.status !== 200) {
      const rateLimitRemaining = getHeader(result.response.headers, 'x-ratelimit-remaining');
      const rateLimited = (result.status === 403 || result.status === 429) && rateLimitRemaining === '0';
      try { await result.response.body?.cancel?.(); } catch { /* error body is not needed */ }
      throw new NdiInstallError(
        rateLimited
          ? 'GitHub API rate limit reached for this network'
          : `GitHub API returned ${result.status}`,
        {
          stage: 'release-metadata',
          code: rateLimited ? 'GITHUB_RATE_LIMITED' : `GITHUB_HTTP_${result.status}`,
          url: result.url,
        }
      );
    }

    const body = await readResponseBuffer(result.response, {
      signal,
      maxBytes: MAX_API_RESPONSE_BYTES,
      stage: 'release-metadata',
      url: result.url,
    });
    try {
      return JSON.parse(body.toString('utf8'));
    } catch (error) {
      throw new NdiInstallError('GitHub returned invalid release metadata', {
        stage: 'release-metadata',
        code: 'INVALID_RELEASE_METADATA',
        url: result.url,
        cause: error,
      });
    }
  }

  async function checkForCompanionUpdate({ signal, bypassCache = false } = {}) {
    if (isDev) {
      const status = checkInstalled();
      const usingDevelopmentSource = path.resolve(status.installPath || '') !== path.resolve(getInstallPath());
      if (usingDevelopmentSource) {
        const currentVersion = status.version || '';
        return {
          updateAvailable: false,
          latestVersion: currentVersion,
          currentVersion,
          downloadUrl: null,
          downloadSize: 0,
          releaseNotes: '[Development Mode] Using local companion source',
          releaseName: '',
          releaseDate: '',
          htmlUrl: '',
        };
      }
    }

    const now = Date.now();
    if (!bypassCache && latestReleaseCache && (now - lastReleaseCheck) < RELEASE_CHECK_INTERVAL) {
      return latestReleaseCache;
    }

    try {
      const release = await githubApiRequest('/releases/latest', signal);
      if (!release || !release.tag_name) {
        return { updateAvailable: false, latestVersion: '', currentVersion: ndiStore.get('version') || '' };
      }

      const latestVersion = release.tag_name.replace(/^v/, '');
      const currentVersion = ndiStore.get('version') || '';
      const installed = checkInstalled().installed;

      const expectedAssetName = getPlatformAssetName();
      const asset = release.assets?.find((a) => a.name === expectedAssetName)
        || release.assets?.find((a) => (
          a.name.endsWith('.zip')
          && a.name.includes(process.platform === 'win32' ? 'win' : process.platform === 'darwin' ? 'mac' : 'linux')
        ));
      const checksumAsset = asset
        ? release.assets?.find((candidate) => candidate.name === `${asset.name}.sha256`)
        : null;

      const result = {
        updateAvailable: installed && currentVersion && compareVersions(latestVersion, currentVersion) > 0,
        latestVersion,
        currentVersion,
        downloadUrl: asset?.browser_download_url || null,
        checksumUrl: checksumAsset?.browser_download_url || null,
        downloadSize: asset?.size || 0,
        releaseNotes: release.body || '',
        releaseName: release.name || '',
        releaseDate: release.published_at || '',
        htmlUrl: release.html_url || '',
      };

      latestReleaseCache = result;
      lastReleaseCheck = now;
      return result;
    } catch (error) {
      if (signal?.aborted) throwIfAborted(signal);
      console.warn('[NDI] Failed to check for companion updates:', error.message);
      return {
        updateAvailable: false,
        latestVersion: '',
        currentVersion: ndiStore.get('version') || '',
        error: error.message,
        errorCode: error.code || 'RELEASE_CHECK_FAILED',
        errorStage: error.stage || 'release-metadata',
        errorHost: error.host || '',
      };
    }
  }

  async function fetchText(url, { signal, stage = 'checksum-download' } = {}) {
    const result = await requestWithRedirects(url, {
      signal,
      headers: { 'User-Agent': 'LyricDisplay-App' },
      stage,
    });
    if (result.status !== 200) {
      try { await result.response.body?.cancel?.(); } catch { /* error body is not needed */ }
      throw new NdiInstallError(`Download failed with status ${result.status}`, {
        stage,
        code: `HTTP_${result.status}`,
        url: result.url,
      });
    }
    const body = await readResponseBuffer(result.response, {
      signal,
      maxBytes: MAX_CHECKSUM_RESPONSE_BYTES,
      stage,
      url: result.url,
    });
    return { text: body.toString('utf8'), resolvedVersion: result.resolvedVersion, url: result.url };
  }

  async function streamToFile(response, filePath, { signal, url }) {
    const contentEncoded = Boolean(getHeader(response.headers, 'content-encoding'));
    const declaredSize = Number.parseInt(getHeader(response.headers, 'content-length'), 10) || 0;
    const totalSize = contentEncoded ? 0 : declaredSize;
    if (totalSize > MAX_COMPANION_ARCHIVE_BYTES) {
      throw new NdiInstallError('The Companion archive is unexpectedly large', {
        stage: 'archive-download',
        code: 'ARCHIVE_TOO_LARGE',
        url,
      });
    }

    let downloadedSize = 0;
    const idle = createIdleAbortController(signal, STREAM_IDLE_TIMEOUT_MS);
    const progress = new Transform({
      transform(chunk, _encoding, callback) {
        idle.reset();
        downloadedSize += chunk.length;
        if (downloadedSize > MAX_COMPANION_ARCHIVE_BYTES) {
          callback(new NdiInstallError('The Companion archive is unexpectedly large', {
            stage: 'archive-download',
            code: 'ARCHIVE_TOO_LARGE',
            url,
          }));
          return;
        }
        const percent = totalSize > 0 ? Math.min(100, Math.round((downloadedSize / totalSize) * 100)) : 0;
        notifyAllWindows('ndi:download-progress', {
          percent,
          downloaded: downloadedSize,
          total: totalSize,
          status: 'downloading',
        });
        callback(null, chunk);
      },
    });

    try {
      await pipeline(
        toNodeReadable(response.body),
        progress,
        fs.createWriteStream(filePath, { flags: 'wx' }),
        { signal: idle.controller.signal }
      );
    } catch (error) {
      try { fs.unlinkSync(filePath); } catch { /* ignore */ }
      if (signal?.aborted) throwIfAborted(signal);
      if (idle.didTimeout()) {
        throw new NdiInstallError('The Companion download stalled before it completed', {
          stage: 'archive-download',
          code: 'DOWNLOAD_STALLED',
          url,
          cause: error,
        });
      }
      if (error instanceof NdiInstallError) throw error;
      throw new NdiInstallError(error?.message || 'The Companion download ended unexpectedly', {
        stage: 'archive-download',
        code: isAbortError(error) ? 'DOWNLOAD_ABORTED' : 'DOWNLOAD_STREAM_FAILED',
        url,
        cause: error,
      });
    } finally {
      idle.cleanup();
    }

    if (totalSize > 0 && downloadedSize !== totalSize) {
      try { fs.unlinkSync(filePath); } catch { /* ignore */ }
      throw new NdiInstallError(`The Companion download was incomplete (${downloadedSize} of ${totalSize} bytes)`, {
        stage: 'archive-download',
        code: 'DOWNLOAD_TRUNCATED',
        url,
      });
    }
  }

  async function stageLocalArchive(sourcePath, stagedPath, totalSize, signal) {
    let copied = 0;
    const progress = new Transform({
      transform(chunk, _encoding, callback) {
        copied += chunk.length;
        notifyAllWindows('ndi:download-progress', {
          percent: totalSize > 0 ? Math.min(100, Math.round((copied / totalSize) * 100)) : 0,
          downloaded: copied,
          total: totalSize,
          status: 'copying',
        });
        callback(null, chunk);
      },
    });
    try {
      await pipeline(
        fs.createReadStream(sourcePath),
        progress,
        fs.createWriteStream(stagedPath, { flags: 'wx' }),
        { signal }
      );
    } catch (error) {
      try { fs.unlinkSync(stagedPath); } catch { /* ignore */ }
      if (signal?.aborted) throwIfAborted(signal);
      throw new NdiInstallError(error?.message || 'Could not stage the selected ZIP file', {
        stage: 'local-archive-copy',
        code: error?.code || 'LOCAL_ARCHIVE_COPY_FAILED',
        cause: error,
      });
    }
    if (copied !== totalSize) {
      try { fs.unlinkSync(stagedPath); } catch { /* ignore */ }
      throw new NdiInstallError('The selected ZIP file changed while it was being read', {
        stage: 'local-archive-copy',
        code: 'LOCAL_ARCHIVE_CHANGED',
      });
    }
  }

  function calculateFileSha256(filePath, signal) {
    return new Promise((resolve, reject) => {
      const hash = createHash('sha256');
      const stream = fs.createReadStream(filePath);
      const total = (() => {
        try { return fs.statSync(filePath).size; } catch { return 0; }
      })();
      let processed = 0;
      const onAbort = () => stream.destroy(new NdiInstallError('Download cancelled by user', {
        stage: 'cancelled',
        code: 'DOWNLOAD_CANCELLED',
      }));
      if (signal?.aborted) {
        onAbort();
      } else {
        signal?.addEventListener?.('abort', onAbort, { once: true });
      }
      stream.on('data', (chunk) => {
        hash.update(chunk);
        processed += chunk.length;
        notifyAllWindows('ndi:download-progress', {
          percent: total > 0 ? Math.min(100, Math.round((processed / total) * 100)) : 0,
          downloaded: processed,
          total,
          status: 'verifying',
        });
      });
      stream.on('end', () => {
        signal?.removeEventListener?.('abort', onAbort);
        resolve(hash.digest('hex'));
      });
      stream.on('error', (error) => {
        signal?.removeEventListener?.('abort', onAbort);
        reject(error);
      });
    });
  }

  async function verifyDownloadedCompanion(zipPath, checksumUrl, version, signal) {
    throwIfAborted(signal);
    notifyAllWindows('ndi:download-progress', { percent: 0, status: 'verifying' });
    const checksumRequired = !version
      || compareVersions(version, CHECKSUM_REQUIRED_FROM_VERSION) >= 0;

    if (!checksumUrl) {
      if (checksumRequired) {
        throw new NdiInstallError(`Companion v${version || 'unknown'} is missing its SHA-256 checksum asset`, {
          stage: 'checksum-download',
          code: 'CHECKSUM_MISSING',
        });
      }
      console.warn('[NDI] Installing legacy companion without a published checksum');
      return { verified: false, legacy: true };
    }

    const checksum = await fetchText(checksumUrl, { signal, stage: 'checksum-download' });
    const expected = parseSha256Checksum(checksum.text);
    if (!expected) {
      throw new NdiInstallError('Companion checksum asset is invalid', {
        stage: 'checksum-verification',
        code: 'CHECKSUM_INVALID',
        url: checksum.url,
      });
    }

    let actual;
    try {
      actual = await calculateFileSha256(zipPath, signal);
    } catch (error) {
      if (signal?.aborted) throwIfAborted(signal);
      if (error instanceof NdiInstallError) throw error;
      throw new NdiInstallError(error?.message || 'Could not read the Companion archive for verification', {
        stage: 'checksum-verification',
        code: error?.code || 'ARCHIVE_HASH_FAILED',
        cause: error,
      });
    }
    if (actual !== expected) {
      throw new NdiInstallError('Companion download failed SHA-256 verification', {
        stage: 'checksum-verification',
        code: 'CHECKSUM_MISMATCH',
        url: checksum.url,
      });
    }
    console.log('[NDI] Companion download SHA-256 verified');
    return { verified: true, legacy: false, resolvedVersion: checksum.resolvedVersion || version || '' };
  }

  function validateZipSignature(zipPath) {
    const fileDescriptor = fs.openSync(zipPath, 'r');
    const signature = Buffer.alloc(4);
    try {
      const bytesRead = fs.readSync(fileDescriptor, signature, 0, signature.length, 0);
      const valid = bytesRead === 4
        && signature[0] === 0x50
        && signature[1] === 0x4b
        && ((signature[2] === 0x03 && signature[3] === 0x04)
          || (signature[2] === 0x05 && signature[3] === 0x06)
          || (signature[2] === 0x07 && signature[3] === 0x08));
      if (!valid) {
        throw new NdiInstallError('The selected file is not a valid ZIP archive', {
          stage: 'archive-validation',
          code: 'INVALID_ZIP_SIGNATURE',
        });
      }
    } finally {
      fs.closeSync(fileDescriptor);
    }
  }

  async function replaceInstallDirectoryWithRetry(stagedPath, destinationPath, signal) {
    const retryableCodes = new Set(['EBUSY', 'EACCES', 'EPERM']);
    const delays = [150, 300, 600, 1000];
    let lastError = null;

    for (let attempt = 0; attempt <= delays.length; attempt += 1) {
      throwIfAborted(signal);
      try {
        return replaceDirectoryAtomically({ fs, stagedPath, destinationPath });
      } catch (error) {
        lastError = error;
        if (!retryableCodes.has(error?.code) || attempt >= delays.length) break;
        await new Promise((resolve, reject) => {
          const timer = setTimeout(() => {
            signal?.removeEventListener?.('abort', onAbort);
            resolve();
          }, delays[attempt]);
          const onAbort = () => {
            clearTimeout(timer);
            signal?.removeEventListener?.('abort', onAbort);
            reject(new NdiInstallError('Download cancelled by user', {
              stage: 'cancelled',
              code: 'DOWNLOAD_CANCELLED',
            }));
          };
          if (signal?.aborted) onAbort();
          else signal?.addEventListener?.('abort', onAbort, { once: true });
        });
      }
    }

    throw new NdiInstallError(
      'Could not replace the existing Companion files. Close any running NDI Companion process and check antivirus or folder permissions, then try again.',
      {
        stage: 'installation-replacement',
        code: lastError?.code || 'INSTALL_REPLACEMENT_FAILED',
        cause: lastError,
      }
    );
  }

  async function extractZip(zipPath, destPath, signal) {
    throwIfAborted(signal);
    validateZipSignature(zipPath);
    const extract = extractArchive || extractZipArchive;

    const tempExtractPath = destPath + '-extracting-' + Date.now();
    console.log('[NDI] Starting extraction to temp:', tempExtractPath);
    const start = Date.now();

    notifyAllWindows('ndi:download-progress', { percent: 0, status: 'extracting' });

    const previousNoAsar = process.noAsar;
    process.noAsar = true;

    try {
      fs.mkdirSync(tempExtractPath, { recursive: true });

      let entriesProcessed = 0;
      let totalEntries = 0;
      let activeZipFile = null;
      const onAbort = () => {
        try { activeZipFile?.close?.(); } catch { /* extraction will observe cancellation below */ }
      };
      signal?.addEventListener?.('abort', onAbort, { once: true });

      try {
        await extract(zipPath, {
          dir: tempExtractPath,
          onEntry(_entry, zipfile) {
            activeZipFile = zipfile;
            throwIfAborted(signal);
            if (!totalEntries && zipfile.entryCount) {
              totalEntries = zipfile.entryCount;
            }
            entriesProcessed += 1;
            if (totalEntries > 0) {
              const percent = Math.min(99, Math.round((entriesProcessed / totalEntries) * 100));
              notifyAllWindows('ndi:download-progress', { percent, status: 'extracting' });
            }
          },
        });
      } finally {
        signal?.removeEventListener?.('abort', onAbort);
        activeZipFile = null;
      }

      throwIfAborted(signal);
      const stagedEntryPath = resolveCompanionEntryPath(tempExtractPath);
      if (!stagedEntryPath || !fs.existsSync(stagedEntryPath)) {
        throw new NdiInstallError('The archive does not contain the expected NDI Companion application', {
          stage: 'archive-validation',
          code: 'COMPANION_EXECUTABLE_MISSING',
        });
      }

      fs.writeFileSync(
        path.join(tempExtractPath, NDI_MANAGED_INSTALL_MARKER),
        JSON.stringify({ installedAt: new Date().toISOString() }),
        'utf8'
      );

      const elapsed = ((Date.now() - start) / 1000).toFixed(1);
      console.log(`[NDI] Extraction completed in ${elapsed}s, moving to final location`);

      const replacement = await replaceInstallDirectoryWithRetry(tempExtractPath, destPath, signal);
      if (replacement.backupCleanupError) {
        console.warn('[NDI] Installed update but could not remove its backup directory:', replacement.backupCleanupError.message);
      }
      console.log('[NDI] Moved extracted files to:', destPath);
    } catch (err) {
      try { fs.rmSync(tempExtractPath, { recursive: true, force: true }); } catch { /* ignore */ }
      if (signal?.aborted) throwIfAborted(signal);
      if (err instanceof NdiInstallError) throw err;
      throw new NdiInstallError(err?.message || 'Could not extract the Companion archive', {
        stage: 'archive-extraction',
        code: err?.code || 'ARCHIVE_EXTRACTION_FAILED',
        cause: err,
      });
    } finally {
      process.noAsar = previousNoAsar;
    }

    notifyAllWindows('ndi:download-progress', { percent: 100, status: 'extracting' });

    if (process.platform !== 'win32') {
      try {
        const entryPath = getCompanionEntryPath();
        if (entryPath && fs.existsSync(entryPath)) {
          fs.chmodSync(entryPath, 0o755);
        }
      } catch { /* non-critical */ }
    }
  }

  function removeLegacyInstallPaths() {
    for (const legacyInstallPath of getRemovableLegacyInstallPaths()) {
      if (!legacyInstallPath || legacyInstallPath === getInstallPath()) continue;
      try {
        if (fs.existsSync(legacyInstallPath)) {
          fs.rmSync(legacyInstallPath, { recursive: true, force: true });
          console.log('[NDI] Removed legacy companion install directory:', legacyInstallPath);
        }
      } catch (error) {
        console.warn('[NDI] Failed to remove legacy companion install directory:', legacyInstallPath, error.message);
      }
    }
  }

  function deriveChecksumUrl(downloadUrl) {
    if (!downloadUrl) return null;
    try {
      const parsed = new URL(downloadUrl);
      parsed.pathname = `${parsed.pathname}.sha256`;
      return parsed.toString();
    } catch {
      return null;
    }
  }

  function shouldDeriveChecksum(version) {
    return !version || compareVersions(version, CHECKSUM_REQUIRED_FROM_VERSION) >= 0;
  }

  function getDirectDownloadInfo() {
    const assetName = getPlatformAssetName();
    const downloadUrl = `https://github.com/${githubOwner}/${githubRepo}/releases/latest/download/${assetName}`;
    return {
      downloadUrl,
      checksumUrl: `${downloadUrl}.sha256`,
      latestVersion: '',
      usedFallback: true,
    };
  }

  async function resolveDownloadInfo(updateInfo, signal) {
    if (updateInfo?.downloadUrl) {
      return {
        ...updateInfo,
        checksumUrl: updateInfo.checksumUrl
          || (shouldDeriveChecksum(updateInfo.latestVersion) ? deriveChecksumUrl(updateInfo.downloadUrl) : null),
      };
    }

    const releaseInfo = await checkForCompanionUpdate({ signal });
    if (releaseInfo?.downloadUrl) {
      return {
        ...releaseInfo,
        checksumUrl: releaseInfo.checksumUrl
          || (shouldDeriveChecksum(releaseInfo.latestVersion) ? deriveChecksumUrl(releaseInfo.downloadUrl) : null),
      };
    }

    console.warn('[NDI] Release metadata unavailable; using direct release URLs', {
      code: releaseInfo?.errorCode || 'RELEASE_ASSET_UNAVAILABLE',
      stage: releaseInfo?.errorStage || 'release-metadata',
      host: releaseInfo?.errorHost || 'api.github.com',
    });
    return {
      ...getDirectDownloadInfo(),
      metadataError: releaseInfo?.error || 'Release asset metadata was unavailable',
    };
  }

  function readInstalledVersion(installPath) {
    try {
      const candidates = [
        path.join(installPath, 'package.json'),
        path.join(installPath, 'resources', 'app', 'package.json'),
      ];
      for (const pkgPath of candidates) {
        if (!fs.existsSync(pkgPath)) continue;
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        if (pkg.version) return pkg.version;
      }
    } catch { /* version is non-critical after a verified install */ }
    return '';
  }

  async function installVerifiedArchive({ zipPath, checksumUrl, version, signal, source }) {
    throwIfAborted(signal);
    const verification = await verifyDownloadedCompanion(zipPath, checksumUrl, version, signal);
    let resolvedVersion = version || verification.resolvedVersion || '';
    const installPath = getInstallPath();

    await stopCompanion();
    throwIfAborted(signal);
    await extractZip(zipPath, installPath, signal);
    removeLegacyInstallPaths();

    resolvedVersion = resolvedVersion || readInstalledVersion(installPath);
    ndiStore.set('installed', true);
    ndiStore.set('version', resolvedVersion);
    ndiStore.set('installPath', installPath);
    ndiStore.set('pendingUpdateInfo', null);
    resetUpdateCache();

    const result = {
      success: true,
      version: resolvedVersion,
      path: installPath,
      installPath,
      companionPath: getCompanionEntryPath(),
      source,
    };
    console.log(`[NDI] Companion installed from ${source}: v${resolvedVersion || 'unknown'} at ${installPath}`);
    notifyAllWindows('ndi:download-complete', result);
    return result;
  }

  function buildOperationError(error) {
    const cancelled = error?.code === 'DOWNLOAD_CANCELLED'
      || error?.stage === 'cancelled'
      || error?.message === 'Download cancelled by user';
    const stage = cancelled ? 'cancelled' : error?.stage || 'installation';
    const code = cancelled ? 'DOWNLOAD_CANCELLED' : error?.code || 'NDI_INSTALL_FAILED';
    const host = error?.host || '';
    const message = cancelled ? 'Operation cancelled' : error?.message || 'Unknown installation error';
    const errorResult = {
      success: false,
      error: cancelled ? message : `Download/install failed during ${stage}: ${message}`,
      cancelled,
      stage,
      code,
      host,
    };
    if (!cancelled) {
      console.error('[NDI] Companion operation failed', { stage, code, host, message });
    }
    notifyAllWindows('ndi:download-failed', errorResult);
    return errorResult;
  }

  async function runInstallOperation(operationFactory) {
    if (activeDownloadOperation) {
      console.warn('[NDI] Companion operation already in progress, returning existing operation');
      return activeDownloadOperation;
    }

    const abortController = new AbortController();
    activeDownloadAbortController = abortController;
    const operation = (async () => {
      try {
        return await operationFactory(abortController.signal);
      } catch (error) {
        return buildOperationError(error);
      }
    })();
    activeDownloadOperation = operation;

    try {
      return await operation;
    } finally {
      activeDownloadOperation = null;
      activeDownloadAbortController = null;
    }
  }

  async function downloadCompanion(updateInfo = null) {
    return runInstallOperation(async (signal) => {
      const downloadInfo = await resolveDownloadInfo(updateInfo, signal);
      throwIfAborted(signal);
      const zipPath = path.join(app.getPath('temp'), `ndi-companion-${process.pid}-${Date.now()}.zip`);
      try {
        console.log('[NDI] Downloading Companion', {
          host: getUrlHost(downloadInfo.downloadUrl),
          fallback: Boolean(downloadInfo.usedFallback),
        });
        const download = await requestWithRedirects(downloadInfo.downloadUrl, {
          signal,
          headers: { 'User-Agent': 'LyricDisplay-App' },
          stage: 'archive-download',
        });
        if (download.status !== 200) {
          try { await download.response.body?.cancel?.(); } catch { /* error body is not needed */ }
          throw new NdiInstallError(`Download failed with status ${download.status}`, {
            stage: 'archive-download',
            code: `HTTP_${download.status}`,
            url: download.url,
          });
        }
        await streamToFile(download.response, zipPath, { signal, url: download.url });
        return await installVerifiedArchive({
          zipPath,
          checksumUrl: downloadInfo.checksumUrl,
          version: downloadInfo.latestVersion || download.resolvedVersion || '',
          signal,
          source: 'download',
        });
      } finally {
        try { fs.unlinkSync(zipPath); } catch { /* ignore */ }
      }
    });
  }

  async function installCompanionFromZip(zipPath) {
    return runInstallOperation(async (signal) => {
      if (path.extname(zipPath || '').toLowerCase() !== '.zip') {
        throw new NdiInstallError('Select an official NDI Companion ZIP release asset', {
          stage: 'local-archive-selection',
          code: 'UNEXPECTED_ARCHIVE_TYPE',
        });
      }
      let archiveStat;
      try {
        archiveStat = fs.statSync(zipPath);
      } catch (error) {
        throw new NdiInstallError('The selected ZIP file could not be read', {
          stage: 'local-archive-selection',
          code: 'ARCHIVE_NOT_READABLE',
          cause: error,
        });
      }
      if (!archiveStat.isFile() || archiveStat.size <= 0 || archiveStat.size > MAX_COMPANION_ARCHIVE_BYTES) {
        throw new NdiInstallError('The selected ZIP file has an invalid size', {
          stage: 'local-archive-selection',
          code: 'INVALID_ARCHIVE_SIZE',
        });
      }

      const downloadInfo = await resolveDownloadInfo(null, signal);
      const stagedPath = path.join(app.getPath('temp'), `ndi-companion-local-${process.pid}-${Date.now()}.zip`);
      try {
        await stageLocalArchive(zipPath, stagedPath, archiveStat.size, signal);
        return await installVerifiedArchive({
          zipPath: stagedPath,
          checksumUrl: downloadInfo.checksumUrl,
          version: downloadInfo.latestVersion || '',
          signal,
          source: 'local ZIP',
        });
      } finally {
        try { fs.unlinkSync(stagedPath); } catch { /* ignore */ }
      }
    });
  }

  function cancelDownload() {
    if (activeDownloadAbortController) {
      console.log('[NDI] Cancelling active download');
      activeDownloadAbortController.abort();
      return { success: true };
    }
    return { success: false, error: 'No active download to cancel' };
  }

  async function uninstallCompanion() {
    const managedEntryPath = resolveCompanionEntryPath(getInstallPath());
    if (isDev && !fs.existsSync(managedEntryPath)) {
      console.warn('[NDI] The development source companion is not a managed installation');
      return { success: false, error: 'The local development source cannot be uninstalled from LyricDisplay' };
    }

    await stopCompanion();
    const installPaths = [...new Set(getUninstallPaths())];
    const removalErrors = [];
    for (const installPath of installPaths) {
      try {
        if (fs.existsSync(installPath)) {
          fs.rmSync(installPath, { recursive: true, force: true });
        }
        if (fs.existsSync(installPath)) {
          throw new Error('Path still exists after removal');
        }
      } catch (error) {
        removalErrors.push({ path: installPath, message: error.message });
        console.error('[NDI] Error removing companion path:', installPath, error);
      }
    }

    const remainingStatus = checkInstalled();
    const stillInstalled = remainingStatus.installed;
    ndiStore.set('installed', stillInstalled);
    ndiStore.set('version', remainingStatus.version || '');
    ndiStore.set('installPath', remainingStatus.installPath || '');
    ndiStore.set('pendingUpdateInfo', null);
    resetUpdateCache();

    if (removalErrors.length > 0) {
      return {
        success: false,
        partial: !stillInstalled,
        error: `NDI companion cleanup failed for ${removalErrors.length} path(s)`,
        errors: removalErrors,
      };
    }

    return { success: true, status: remainingStatus };
  }

  function storePendingUpdateInfo(updateInfo) {
    if (updateInfo && updateInfo.updateAvailable) {
      ndiStore.set('pendingUpdateInfo', updateInfo);
      return true;
    }
    return false;
  }

  function getPendingUpdateInfo() {
    return ndiStore.get('pendingUpdateInfo') || null;
  }

  function clearPendingUpdateInfo() {
    ndiStore.set('pendingUpdateInfo', null);
  }

  async function performStartupUpdateCheck() {
    try {
      if (isDev) {
        console.log('[NDI] Skipping startup update check in development mode');
        ndiStore.set('pendingUpdateInfo', null);
        return;
      }

      const status = checkInstalled();
      if (!status.installed) return;

      const pending = ndiStore.get('pendingUpdateInfo');
      if (pending?.latestVersion && status.version && compareVersions(status.version, pending.latestVersion) >= 0) {
        ndiStore.set('pendingUpdateInfo', null);
      }
      const updateInfo = await checkForCompanionUpdate();
      if (updateInfo.updateAvailable) {
        console.log(`[NDI] Companion update available: v${updateInfo.currentVersion} -> v${updateInfo.latestVersion}`);
        storePendingUpdateInfo(updateInfo);
        notifyAllWindows('ndi:update-available', updateInfo);
      }
    } catch (error) {
      console.warn('[NDI] Startup update check failed:', error.message);
    }
  }

  function cleanupStaleArtifacts() {
    if (!isDev) {
      try {
        const installPath = getInstallPath();
        const parentDir = path.dirname(installPath);
        const backupPrefix = path.basename(installPath) + '-backup-';
        if (fs.existsSync(parentDir)) {
          const backups = fs.readdirSync(parentDir)
            .filter((entry) => entry.startsWith(backupPrefix))
            .map((entry) => path.join(parentDir, entry))
            .sort((a, b) => {
              try {
                return fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs;
              } catch {
                return 0;
              }
            });

          if (!fs.existsSync(installPath) && backups.length > 0) {
            fs.renameSync(backups[0], installPath);
            console.warn('[NDI] Recovered companion install after an interrupted update:', installPath);
          }

          if (fs.existsSync(installPath)) {
            for (const backupPath of backups) {
              if (!fs.existsSync(backupPath)) continue;
              try {
                fs.rmSync(backupPath, { recursive: true, force: true });
              } catch (error) {
                console.warn('[NDI] Failed to clean stale companion backup:', backupPath, error.message);
              }
            }
          }
        }
      } catch (error) {
        console.warn('[NDI] Interrupted update recovery failed:', error.message);
      }
    }

    try {
      const installPaths = [getInstallPath(), ...getLegacyInstallPaths()];

      for (const installPath of installPaths) {
        const parentDir = path.dirname(installPath);
        const baseName = path.basename(installPath);

        if (!fs.existsSync(parentDir)) continue;

        const entries = fs.readdirSync(parentDir);
        for (const entry of entries) {
          if (entry.startsWith(baseName + '-extracting-')) {
            const fullPath = path.join(parentDir, entry);
            try {
              fs.rmSync(fullPath, { recursive: true, force: true });
              console.log('[NDI] Cleaned up stale extraction directory:', fullPath);
            } catch (err) {
              console.warn('[NDI] Failed to clean up stale directory:', fullPath, err.message);
            }
          }
        }
      }
    } catch (err) {
      console.warn('[NDI] Stale artifact cleanup failed:', err.message);
    }

    try {
      const tempDir = app.getPath('temp');
      const tempEntries = fs.readdirSync(tempDir);
      for (const entry of tempEntries) {
        if (entry.startsWith('ndi-companion-') && entry.endsWith('.zip')) {
          const fullPath = path.join(tempDir, entry);
          try {
            fs.unlinkSync(fullPath);
            console.log('[NDI] Cleaned up stale temp zip:', fullPath);
          } catch { /* may be in use by another process */ }
        }
      }
    } catch { /* non-critical */ }
  }

  return {
    checkInstalled,
    checkForCompanionUpdate,
    resetUpdateCache,
    downloadCompanion,
    installCompanionFromZip,
    cancelDownload,
    uninstallCompanion,
    getPendingUpdateInfo,
    clearPendingUpdateInfo,
    performStartupUpdateCheck,
    cleanupStaleArtifacts,
  };
}

export { createNdiInstaller, parseSha256Checksum, replaceDirectoryAtomically };
