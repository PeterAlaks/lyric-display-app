import https from 'https';
import http from 'http';

const RELEASE_CHECK_INTERVAL = 60 * 60 * 1000; // 1 hour

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
  getCompanionEntryPath,
  getPlatformAssetName,
  stopCompanion,
}) {
  const GITHUB_API_BASE = `https://api.github.com/repos/${githubOwner}/${githubRepo}`;

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

  function githubApiRequest(urlPath) {
    return new Promise((resolve, reject) => {
      const url = urlPath.startsWith('http') ? urlPath : `${GITHUB_API_BASE}${urlPath}`;

      https.get(url, {
        headers: {
          'User-Agent': 'LyricDisplay-App',
          Accept: 'application/vnd.github.v3+json',
        },
        timeout: 10000,
      }, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          if (res.statusCode === 200) {
            try { resolve(JSON.parse(data)); } catch { reject(new Error('Invalid JSON response')); }
          } else if (res.statusCode === 404) {
            resolve(null);
          } else {
            reject(new Error(`GitHub API returned ${res.statusCode}`));
          }
        });
      }).on('error', reject)
        .on('timeout', function () { this.destroy(); reject(new Error('Request timeout')); });
    });
  }

  async function checkForCompanionUpdate() {
    if (isDev) {
      const status = checkInstalled();
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

    const now = Date.now();
    if (latestReleaseCache && (now - lastReleaseCheck) < RELEASE_CHECK_INTERVAL) {
      return latestReleaseCache;
    }

    try {
      const release = await githubApiRequest('/releases/latest');
      if (!release || !release.tag_name) {
        return { updateAvailable: false, latestVersion: '', currentVersion: ndiStore.get('version') || '' };
      }

      const latestVersion = release.tag_name.replace(/^v/, '');
      const currentVersion = ndiStore.get('version') || '';
      const installed = checkInstalled().installed;

      const expectedAssetName = getPlatformAssetName();
      const asset = release.assets?.find((a) => a.name === expectedAssetName)
        || release.assets?.find((a) => a.name.includes(process.platform === 'win32' ? 'win' : process.platform === 'darwin' ? 'mac' : 'linux'));

      const result = {
        updateAvailable: installed && currentVersion && compareVersions(latestVersion, currentVersion) > 0,
        latestVersion,
        currentVersion,
        downloadUrl: asset?.browser_download_url || null,
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
      console.warn('[NDI] Failed to check for companion updates:', error.message);
      return {
        updateAvailable: false,
        latestVersion: '',
        currentVersion: ndiStore.get('version') || '',
        error: error.message,
      };
    }
  }

  function followRedirects(url, maxRedirects = 5) {
    return new Promise((resolve, reject) => {
      if (maxRedirects <= 0) return reject(new Error('Too many redirects'));
      const protocol = url.startsWith('https') ? https : http;
      protocol.get(url, {
        headers: { 'User-Agent': 'LyricDisplay-App' },
        timeout: 30000,
      }, (response) => {
        if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          followRedirects(response.headers.location, maxRedirects - 1).then(resolve).catch(reject);
        } else if (response.statusCode === 200) {
          resolve(response);
        } else {
          reject(new Error(`Download failed with status ${response.statusCode}`));
        }
      }).on('error', reject)
        .on('timeout', function () { this.destroy(); reject(new Error('Download timeout')); });
    });
  }

  function streamToFile(response, filePath, abortController) {
    return new Promise((resolve, reject) => {
      const totalSize = parseInt(response.headers['content-length'], 10) || 0;
      let downloadedSize = 0;
      let cancelled = false;
      const file = fs.createWriteStream(filePath);

      const onAbort = () => {
        cancelled = true;
        response.destroy();
        file.destroy();
        try { fs.unlinkSync(filePath); } catch { /* ignore */ }
        reject(new Error('Download cancelled by user'));
      };

      if (abortController) {
        abortController.signal.addEventListener('abort', onAbort, { once: true });
      }

      response.on('data', (chunk) => {
        if (cancelled) return;
        downloadedSize += chunk.length;
        const percent = totalSize > 0 ? Math.round((downloadedSize / totalSize) * 100) : 0;

        notifyAllWindows('ndi:download-progress', {
          percent,
          downloaded: downloadedSize,
          total: totalSize,
          status: 'downloading',
        });
      });

      response.pipe(file);

      file.on('finish', () => {
        if (cancelled) return;
        if (abortController) {
          abortController.signal.removeEventListener('abort', onAbort);
        }
        file.close(() => resolve());
      });

      file.on('error', (err) => {
        if (cancelled) return;
        if (abortController) {
          abortController.signal.removeEventListener('abort', onAbort);
        }
        try { fs.unlinkSync(filePath); } catch { /* ignore */ }
        reject(err);
      });
    });
  }

  async function extractZip(zipPath, destPath) {
    const extract = (await import('extract-zip')).default;

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

      await extract(zipPath, {
        dir: tempExtractPath,
        onEntry(_entry, zipfile) {
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

      const elapsed = ((Date.now() - start) / 1000).toFixed(1);
      console.log(`[NDI] Extraction completed in ${elapsed}s, moving to final location`);

      if (fs.existsSync(destPath)) {
        fs.rmSync(destPath, { recursive: true, force: true });
      }

      fs.renameSync(tempExtractPath, destPath);
      console.log('[NDI] Moved extracted files to:', destPath);
    } catch (err) {
      try { fs.rmSync(tempExtractPath, { recursive: true, force: true }); } catch { /* ignore */ }
      throw err;
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
    for (const legacyInstallPath of getLegacyInstallPaths()) {
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

  async function downloadCompanion(updateInfo = null) {
    if (activeDownloadOperation) {
      console.warn('[NDI] Download already in progress, returning existing operation');
      return activeDownloadOperation;
    }

    const abortController = new AbortController();
    activeDownloadAbortController = abortController;

    const operation = (async () => {
      let downloadUrl;
      let resolvedVersion = updateInfo?.latestVersion || '';

      if (updateInfo?.downloadUrl) {
        downloadUrl = updateInfo.downloadUrl;
      } else {
        try {
          const releaseInfo = await checkForCompanionUpdate();
          if (releaseInfo?.downloadUrl) {
            downloadUrl = releaseInfo.downloadUrl;
            resolvedVersion = releaseInfo.latestVersion || '';
          }
        } catch { /* fallback below */ }

        if (!downloadUrl) {
          const assetName = getPlatformAssetName();
          downloadUrl = `https://github.com/${githubOwner}/${githubRepo}/releases/latest/download/${assetName}`;
        }
      }

      const installPath = getInstallPath();
      const zipPath = path.join(app.getPath('temp'), `ndi-companion-${Date.now()}.zip`);

      try {
        console.log(`[NDI] Downloading from: ${downloadUrl}`);
        const response = await followRedirects(downloadUrl);

        await streamToFile(response, zipPath, abortController);

        stopCompanion();
        await extractZip(zipPath, installPath);
        removeLegacyInstallPaths();
        try { fs.unlinkSync(zipPath); } catch { /* ignore */ }

        if (!resolvedVersion) {
          try {
            const candidates = [
              path.join(installPath, 'package.json'),
              path.join(installPath, 'resources', 'app', 'package.json'),
            ];
            for (const pkgPath of candidates) {
              if (fs.existsSync(pkgPath)) {
                const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
                if (pkg.version) { resolvedVersion = pkg.version; break; }
              }
            }
          } catch { /* ignore */ }
        }

        if (!resolvedVersion) {
          try {
            resetUpdateCache();
            const latest = await checkForCompanionUpdate();
            if (latest?.latestVersion) resolvedVersion = latest.latestVersion;
          } catch { /* ignore */ }
        }

        ndiStore.set('installed', true);
        ndiStore.set('version', resolvedVersion);
        ndiStore.set('installPath', installPath);

        resetUpdateCache();

        const result = {
          success: true,
          version: resolvedVersion,
          path: installPath,
          installPath,
          companionPath: getCompanionEntryPath(),
        };
        console.log(`[NDI] Companion installed: v${resolvedVersion} at ${installPath}`);
        notifyAllWindows('ndi:download-complete', result);
        return result;
      } catch (err) {
        try { fs.unlinkSync(zipPath); } catch { /* ignore */ }

        const isCancelled = err.message === 'Download cancelled by user';
        const errorResult = {
          success: false,
          error: isCancelled ? 'Download cancelled' : `Download/install failed: ${err.message}`,
          cancelled: isCancelled,
        };

        notifyAllWindows('ndi:download-failed', errorResult);
        return errorResult;
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

  function cancelDownload() {
    if (activeDownloadAbortController) {
      console.log('[NDI] Cancelling active download');
      activeDownloadAbortController.abort();
      return { success: true };
    }
    return { success: false, error: 'No active download to cancel' };
  }

  function uninstallCompanion() {
    stopCompanion();
    const installPaths = [getInstallPath(), ...getLegacyInstallPaths()];

    if (isDev) {
      console.warn('[NDI] Cannot uninstall in dev mode (source directory)');
      return { success: false, error: 'Cannot uninstall in dev mode' };
    }

    try {
      for (const installPath of installPaths) {
        if (fs.existsSync(installPath)) {
          fs.rmSync(installPath, { recursive: true, force: true });
        }
      }
    } catch (error) {
      console.error('[NDI] Error removing companion files:', error);
    }

    ndiStore.set('installed', false);
    ndiStore.set('version', '');
    ndiStore.set('installPath', '');
    resetUpdateCache();

    return { success: true };
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
    cancelDownload,
    uninstallCompanion,
    getPendingUpdateInfo,
    clearPendingUpdateInfo,
    performStartupUpdateCheck,
    cleanupStaleArtifacts,
  };
}

export { createNdiInstaller };
