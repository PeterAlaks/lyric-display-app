import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createNdiInstaller, parseSha256Checksum, replaceDirectoryAtomically } from '../main/ndi/installer.js';

const HASH = 'a'.repeat(64);
const ASSET_NAME = 'lyricdisplay-ndi-win.zip';

const sha256 = (value) => createHash('sha256').update(value).digest('hex');

function jsonResponse(value, init = {}) {
  return new Response(JSON.stringify(value), {
    status: init.status || 200,
    headers: { 'content-type': 'application/json', ...(init.headers || {}) },
  });
}

function createInstallerHarness({ networkFetch, archiveBytes = Buffer.from('PK\x03\x04test') } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lyricdisplay-ndi-harness-'));
  const installPath = path.join(root, 'user-data', 'NDI', 'Companion');
  const tempPath = path.join(root, 'temp');
  fs.mkdirSync(tempPath, { recursive: true });
  const store = new Map();
  const events = [];
  let stopCount = 0;
  let extractCount = 0;
  const entryFor = (basePath) => path.join(basePath, 'LyricDisplay NDI.exe');

  const installer = createNdiInstaller({
    app: {
      getPath(name) {
        if (name === 'temp') return tempPath;
        throw new Error(`Unexpected app path: ${name}`);
      },
    },
    fs,
    path,
    isDev: false,
    ndiStore: {
      get(key) { return store.get(key); },
      set(key, value) { store.set(key, value); },
    },
    githubOwner: 'PeterAlaks',
    githubRepo: 'lyricdisplay-ndi',
    notifyAllWindows(channel, payload) { events.push({ channel, payload }); },
    getInstallPath: () => installPath,
    getResolvedInstallPath: () => installPath,
    getLegacyInstallPaths: () => [],
    getRemovableLegacyInstallPaths: () => [],
    getUninstallPaths: () => [installPath],
    getCompanionEntryPath: () => entryFor(installPath),
    resolveCompanionEntryPath: entryFor,
    getPlatformAssetName: () => ASSET_NAME,
    async stopCompanion() { stopCount += 1; return { success: true }; },
    networkFetch,
    async extractArchive(_zipPath, options) {
      extractCount += 1;
      fs.mkdirSync(options.dir, { recursive: true });
      fs.writeFileSync(entryFor(options.dir), 'companion', 'utf8');
      options.onEntry?.({}, { entryCount: 1 });
    },
  });

  return {
    archiveBytes,
    events,
    installPath,
    installer,
    root,
    store,
    entryFor,
    getExtractCount: () => extractCount,
    getStopCount: () => stopCount,
    cleanup: () => fs.rmSync(root, { recursive: true, force: true }),
  };
}

test('NDI installer parses standard SHA-256 sidecar formats', () => {
  assert.equal(parseSha256Checksum(HASH), HASH);
  assert.equal(parseSha256Checksum(`${HASH}  lyricdisplay-ndi-win.zip\n`), HASH);
  assert.equal(parseSha256Checksum(`${HASH} *lyricdisplay-ndi-win.zip`), HASH);
});

test('NDI installer rejects malformed checksum sidecars', () => {
  assert.equal(parseSha256Checksum('not-a-checksum'), null);
  assert.equal(parseSha256Checksum('b'.repeat(63)), null);
  assert.equal(parseSha256Checksum(`${HASH}unexpected`), null);
  assert.equal(parseSha256Checksum(`${HASH}\n${HASH}`), null);
});

test('NDI installer atomically replaces an existing companion directory', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lyricdisplay-ndi-install-'));
  const destinationPath = path.join(root, 'Companion');
  const stagedPath = path.join(root, 'Companion-extracting');

  try {
    fs.mkdirSync(destinationPath, { recursive: true });
    fs.mkdirSync(stagedPath, { recursive: true });
    fs.writeFileSync(path.join(destinationPath, 'version.txt'), 'old', 'utf8');
    fs.writeFileSync(path.join(stagedPath, 'version.txt'), 'new', 'utf8');

    const result = replaceDirectoryAtomically({ fs, stagedPath, destinationPath });

    assert.equal(fs.readFileSync(path.join(destinationPath, 'version.txt'), 'utf8'), 'new');
    assert.equal(fs.existsSync(stagedPath), false);
    assert.equal(fs.existsSync(result.backupPath), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('NDI installer restores the prior companion when replacement fails', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lyricdisplay-ndi-rollback-'));
  const destinationPath = path.join(root, 'Companion');
  const missingStagedPath = path.join(root, 'missing-extraction');

  try {
    fs.mkdirSync(destinationPath, { recursive: true });
    fs.writeFileSync(path.join(destinationPath, 'version.txt'), 'old', 'utf8');

    assert.throws(
      () => replaceDirectoryAtomically({ fs, stagedPath: missingStagedPath, destinationPath }),
      /ENOENT/
    );
    assert.equal(fs.readFileSync(path.join(destinationPath, 'version.txt'), 'utf8'), 'old');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('NDI installer falls back to direct ZIP and checksum URLs when GitHub API metadata fails', async () => {
  const archiveBytes = Buffer.from('PK\x03\x04fallback-archive');
  const expectedHash = sha256(archiveBytes);
  const requestedUrls = [];
  const latestBase = 'https://github.com/PeterAlaks/lyricdisplay-ndi/releases/latest/download';
  const versionedBase = 'https://github.com/PeterAlaks/lyricdisplay-ndi/releases/download/v1.0.7';
  const harness = createInstallerHarness({
    archiveBytes,
    async networkFetch(url) {
      requestedUrls.push(url);
      if (url.includes('api.github.com')) {
        return new Response(null, {
          status: 403,
          headers: { 'x-ratelimit-remaining': '0' },
        });
      }
      if (url === `${latestBase}/${ASSET_NAME}`) {
        return new Response(null, {
          status: 302,
          headers: { location: `${versionedBase}/${ASSET_NAME}` },
        });
      }
      if (url === `${versionedBase}/${ASSET_NAME}`) {
        return new Response(archiveBytes, {
          status: 200,
          headers: { 'content-length': String(archiveBytes.length) },
        });
      }
      if (url === `${latestBase}/${ASSET_NAME}.sha256`) {
        return new Response(null, {
          status: 302,
          headers: { location: `${versionedBase}/${ASSET_NAME}.sha256` },
        });
      }
      if (url === `${versionedBase}/${ASSET_NAME}.sha256`) {
        return new Response(`${expectedHash}  ${ASSET_NAME}\n`, { status: 200 });
      }
      throw new Error(`Unexpected URL: ${url}`);
    },
  });

  try {
    const result = await harness.installer.downloadCompanion();

    assert.equal(result.success, true);
    assert.equal(result.version, '1.0.7');
    assert.equal(fs.existsSync(harness.entryFor(harness.installPath)), true);
    assert.equal(harness.getExtractCount(), 1);
    assert.equal(harness.getStopCount(), 1);
    assert.equal(harness.store.get('installed'), true);
    assert.ok(requestedUrls.includes(`${latestBase}/${ASSET_NAME}.sha256`));
    assert.ok(harness.events.some((entry) => entry.channel === 'ndi:download-complete'));
  } finally {
    harness.cleanup();
  }
});

test('NDI installer rejects and removes a truncated Companion download', async () => {
  const archiveBytes = Buffer.from('PK\x03\x04truncated');
  const assetUrl = `https://github.com/PeterAlaks/lyricdisplay-ndi/releases/download/v1.0.7/${ASSET_NAME}`;
  const checksumUrl = `${assetUrl}.sha256`;
  const harness = createInstallerHarness({
    archiveBytes,
    async networkFetch(url) {
      if (url.includes('api.github.com')) {
        return jsonResponse({
          tag_name: 'v1.0.7',
          assets: [
            { name: ASSET_NAME, browser_download_url: assetUrl, size: archiveBytes.length + 5 },
            { name: `${ASSET_NAME}.sha256`, browser_download_url: checksumUrl, size: 91 },
          ],
        });
      }
      if (url === assetUrl) {
        return new Response(archiveBytes, {
          status: 200,
          headers: { 'content-length': String(archiveBytes.length + 5) },
        });
      }
      throw new Error(`Unexpected URL: ${url}`);
    },
  });

  try {
    const result = await harness.installer.downloadCompanion();

    assert.equal(result.success, false);
    assert.equal(result.code, 'DOWNLOAD_TRUNCATED');
    assert.equal(result.stage, 'archive-download');
    assert.equal(harness.getExtractCount(), 0);
    assert.equal(harness.getStopCount(), 0);
    assert.equal(fs.existsSync(harness.installPath), false);
    assert.ok(harness.events.some((entry) => (
      entry.channel === 'ndi:download-failed' && entry.payload.code === 'DOWNLOAD_TRUNCATED'
    )));
  } finally {
    harness.cleanup();
  }
});

test('NDI installer reports an interrupted response stream without extracting partial data', async () => {
  const assetUrl = `https://github.com/PeterAlaks/lyricdisplay-ndi/releases/download/v1.0.7/${ASSET_NAME}`;
  const checksumUrl = `${assetUrl}.sha256`;
  const harness = createInstallerHarness({
    async networkFetch(url) {
      if (url.includes('api.github.com')) {
        return jsonResponse({
          tag_name: 'v1.0.7',
          assets: [
            { name: ASSET_NAME, browser_download_url: assetUrl, size: 100 },
            { name: `${ASSET_NAME}.sha256`, browser_download_url: checksumUrl, size: 91 },
          ],
        });
      }
      if (url === assetUrl) {
        let sent = false;
        const body = new ReadableStream({
          pull(controller) {
            if (!sent) {
              sent = true;
              controller.enqueue(new Uint8Array(Buffer.from('PK\x03\x04partial')));
              return;
            }
            controller.error(new Error('simulated connection reset'));
          },
        });
        return new Response(body, { status: 200 });
      }
      throw new Error(`Unexpected URL: ${url}`);
    },
  });

  try {
    const result = await harness.installer.downloadCompanion();

    assert.equal(result.success, false);
    assert.equal(result.code, 'DOWNLOAD_STREAM_FAILED');
    assert.equal(result.stage, 'archive-download');
    assert.match(result.error, /simulated connection reset/);
    assert.equal(harness.getExtractCount(), 0);
    assert.equal(harness.getStopCount(), 0);
  } finally {
    harness.cleanup();
  }
});

test('NDI installer cancellation aborts the release metadata request', async () => {
  let requestAborted = false;
  const harness = createInstallerHarness({
    networkFetch(_url, options) {
      return new Promise((_resolve, reject) => {
        options.signal.addEventListener('abort', () => {
          requestAborted = true;
          const error = new Error('aborted');
          error.name = 'AbortError';
          reject(error);
        }, { once: true });
      });
    },
  });

  try {
    const pending = harness.installer.downloadCompanion();
    const cancelResult = harness.installer.cancelDownload();
    const result = await pending;

    assert.equal(cancelResult.success, true);
    assert.equal(requestAborted, true);
    assert.equal(result.success, false);
    assert.equal(result.cancelled, true);
    assert.equal(result.code, 'DOWNLOAD_CANCELLED');
    assert.equal(harness.getExtractCount(), 0);
  } finally {
    harness.cleanup();
  }
});

test('NDI installer verifies a user-selected ZIP and replaces an existing Companion update safely', async () => {
  const archiveBytes = Buffer.from('PK\x03\x04local-archive');
  const expectedHash = sha256(archiveBytes);
  const assetUrl = `https://github.com/PeterAlaks/lyricdisplay-ndi/releases/download/v1.0.7/${ASSET_NAME}`;
  const checksumUrl = `${assetUrl}.sha256`;
  const harness = createInstallerHarness({
    archiveBytes,
    async networkFetch(url) {
      if (url.includes('api.github.com')) {
        return jsonResponse({
          tag_name: 'v1.0.7',
          assets: [
            { name: ASSET_NAME, browser_download_url: assetUrl, size: archiveBytes.length },
            { name: `${ASSET_NAME}.sha256`, browser_download_url: checksumUrl, size: 91 },
          ],
        });
      }
      if (url === checksumUrl) {
        return new Response(`${expectedHash} *${ASSET_NAME}\n`, { status: 200 });
      }
      throw new Error(`Unexpected URL: ${url}`);
    },
  });
  const localZipPath = path.join(harness.root, ASSET_NAME);
  fs.writeFileSync(localZipPath, archiveBytes);
  fs.mkdirSync(harness.installPath, { recursive: true });
  fs.writeFileSync(harness.entryFor(harness.installPath), 'old-companion', 'utf8');
  harness.store.set('version', '1.0.6');
  harness.store.set('pendingUpdateInfo', { updateAvailable: true, latestVersion: '1.0.7' });

  try {
    const result = await harness.installer.installCompanionFromZip(localZipPath);

    assert.equal(result.success, true);
    assert.equal(result.source, 'local ZIP');
    assert.equal(result.version, '1.0.7');
    assert.equal(fs.existsSync(localZipPath), true);
    assert.equal(fs.existsSync(harness.entryFor(harness.installPath)), true);
    assert.equal(fs.readFileSync(harness.entryFor(harness.installPath), 'utf8'), 'companion');
    assert.equal(harness.store.get('version'), '1.0.7');
    assert.equal(harness.store.get('pendingUpdateInfo'), null);
    assert.equal(harness.getExtractCount(), 1);
    assert.equal(harness.getStopCount(), 1);
  } finally {
    harness.cleanup();
  }
});

test('NDI installer rejects a non-ZIP local archive before network access', async () => {
  let requestCount = 0;
  const harness = createInstallerHarness({
    async networkFetch() {
      requestCount += 1;
      throw new Error('network should not be used');
    },
  });
  const localZipPath = path.join(harness.root, 'some-other-file.exe');
  fs.writeFileSync(localZipPath, Buffer.from('PK\x03\x04other'));

  try {
    const result = await harness.installer.installCompanionFromZip(localZipPath);

    assert.equal(result.success, false);
    assert.equal(result.code, 'UNEXPECTED_ARCHIVE_TYPE');
    assert.equal(result.stage, 'local-archive-selection');
    assert.equal(requestCount, 0);
    assert.equal(harness.getExtractCount(), 0);
  } finally {
    harness.cleanup();
  }
});
