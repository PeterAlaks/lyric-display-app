import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import useToast from '@/hooks/useToast';
import useModal from '@/hooks/useModal';
import { convertMarkdownToHTML, trimReleaseNotes, formatReleaseNotes } from '../../utils/markdownParser';
import { useLiveSafetyBridge } from '../../hooks/useLiveSafetyBridge';
import { MAX_OLDER_RELEASES } from '../../../shared/updateReleaseHistory.js';

const escapeRegExp = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const normalizeVersionText = (value = '') => String(value).trim().toLowerCase().replace(/^v/, '');

const isDuplicateVersionLabel = (label, version) => {
  if (!label || !version) return false;

  const normalizedVersion = normalizeVersionText(version);
  const normalizedLabel = normalizeVersionText(label);
  if (normalizedLabel === normalizedVersion) return true;

  const versionPattern = new RegExp(`\\bv?${escapeRegExp(normalizedVersion)}\\b`, 'gi');
  const remaining = normalizedLabel
    .replace(versionPattern, '')
    .replace(/\b(lyricdisplay|release|version|update|available)\b/g, '')
    .replace(/[-_:()[\]\s.]+/g, '');

  return remaining.length === 0;
};

const formatReleaseDate = (value) => {
  if (!value) return '';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

const formatReleaseNotesHtml = (releaseNotes) => convertMarkdownToHTML(
  trimReleaseNotes(formatReleaseNotes(releaseNotes)),
);

function OlderReleaseNotes({ releases, isDark }) {
  const [expandedVersion, setExpandedVersion] = useState(null);

  if (releases.length === 0) return null;

  return (
    <section aria-labelledby="previous-release-notes-title">
      <h4
        id="previous-release-notes-title"
        className={`mb-2 text-xs font-semibold uppercase tracking-wide ${isDark ? 'text-gray-400' : 'text-gray-500'}`}
      >
        Previous release notes
      </h4>
      <div className={`overflow-hidden rounded-lg border ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
        {releases.map((release, index) => {
          const isExpanded = expandedVersion === release.version;
          const panelId = `older-release-${String(release.version).replace(/[^a-z0-9_-]/gi, '-')}`;
          const releaseDate = formatReleaseDate(release.releaseDate);
          const displayName = isDuplicateVersionLabel(release.releaseName, release.version)
            ? ''
            : release.releaseName;

          return (
            <article
              key={release.version}
              className={index > 0 ? (isDark ? 'border-t border-gray-700' : 'border-t border-gray-200') : ''}
            >
              <button
                type="button"
                className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors ${isDark
                  ? 'bg-gray-800/50 hover:bg-gray-800'
                  : 'bg-gray-50 hover:bg-gray-100'
                }`}
                aria-expanded={isExpanded}
                aria-controls={panelId}
                onClick={() => setExpandedVersion(isExpanded ? null : release.version)}
              >
                <span className="min-w-0 flex-1">
                  <span className={`block text-sm font-semibold ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>
                    LyricDisplay v{normalizeVersionText(release.version)}
                  </span>
                  {(displayName || releaseDate) && (
                    <span className={`mt-0.5 block truncate text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                      {[displayName, releaseDate].filter(Boolean).join(' · ')}
                    </span>
                  )}
                </span>
                <ChevronDown
                  className={`h-4 w-4 shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''} ${isDark ? 'text-gray-400' : 'text-gray-500'}`}
                  aria-hidden
                />
              </button>
              {isExpanded && (
                <div
                  id={panelId}
                  className={`border-t px-4 py-3 ${isDark
                    ? 'border-gray-700 bg-gray-900/40 text-gray-300'
                    : 'border-gray-200 bg-white text-gray-700'
                  }`}
                >
                  <div
                    className="text-sm"
                    style={{ lineHeight: '1.6' }}
                    dangerouslySetInnerHTML={{ __html: release.formattedNotes }}
                  />
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}

function UpdateAvailableBody({ info, formattedNotes, isDark }) {
  const version = info?.version || '';
  const isManualMacUpdate = Boolean(info?.manualDownload);
  const assetName = info?.assetName || '';
  const hasMacDmgAsset = Boolean(assetName);
  const [olderReleases, setOlderReleases] = useState(
    Array.isArray(info?.olderReleases) ? info.olderReleases : [],
  );

  useEffect(() => {
    if (Array.isArray(info?.olderReleases)) {
      setOlderReleases(info.olderReleases);
    }
  }, [info?.olderReleases]);

  useEffect(() => {
    const acceptUpdaterState = (payload) => {
      const updateInfo = payload?.state?.updateInfo ?? payload?.updateInfo;
      if (
        normalizeVersionText(updateInfo?.version) === normalizeVersionText(version)
        && Array.isArray(updateInfo?.olderReleases)
      ) {
        setOlderReleases(updateInfo.olderReleases);
      }
    };

    const offState = window.electronAPI?.onUpdaterState?.(acceptUpdaterState);
    window.electronAPI?.getUpdaterState?.().then(acceptUpdaterState).catch(() => { });
    return () => offState?.();
  }, [version]);

  const formattedOlderReleases = useMemo(() => olderReleases
    .slice(0, MAX_OLDER_RELEASES)
    .map((release) => ({
      ...release,
      formattedNotes: formatReleaseNotesHtml(release?.releaseNotes),
    }))
    .filter((release) => release.version && release.formattedNotes), [olderReleases]);

  return (
    <div className="space-y-4">
      {formattedNotes && (
        <div className={`rounded-lg overflow-hidden border ${isDark
          ? 'bg-gray-800/50 border-gray-700'
          : 'bg-gray-50 border-gray-200'
        }`}>
          <div className={`px-4 py-2.5 border-b ${isDark
            ? 'bg-gray-800 border-gray-700'
            : 'bg-gray-100 border-gray-200'
          }`}>
            <h4 className={`text-sm font-semibold ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>
              Release Notes
            </h4>
          </div>
          <div className="px-4 py-3 max-h-64 overflow-y-auto">
            <div
              className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}
              style={{
                lineHeight: '1.6',
                color: isDark ? '#d1d5db' : '#374151',
              }}
              dangerouslySetInnerHTML={{ __html: formattedNotes }}
            />
          </div>
        </div>
      )}

      <OlderReleaseNotes releases={formattedOlderReleases} isDark={isDark} />

      <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
        {isManualMacUpdate
          ? 'macOS updates currently need to be installed manually because this build is unsigned. Download the DMG, quit LyricDisplay, open the DMG, and replace the app in Applications.'
          : 'Would you like to download and install this update now?'}
      </p>
      {isManualMacUpdate && hasMacDmgAsset && (
        <p className={`text-xs font-medium ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
          Download: {assetName}
        </p>
      )}
    </div>
  );
}

export default function UpdaterBridge() {
  const { showToast, removeToast } = useToast();
  const { showModal, closeModalByDedupeKey } = useModal();
  const { liveSafety, ready } = useLiveSafetyBridge();
  const liveSafetyEnabledRef = useRef(Boolean(liveSafety?.enabled));
  const readyToastIdRef = useRef(null);

  useEffect(() => {
    const sessionActive = Boolean(liveSafety?.enabled);
    liveSafetyEnabledRef.current = sessionActive;
    if (sessionActive) {
      closeModalByDedupeKey?.('app-update-available', 'live-safety-deferred');
      closeModalByDedupeKey?.('app-update-install', 'live-safety-deferred');
      if (readyToastIdRef.current != null) {
        removeToast(readyToastIdRef.current);
        readyToastIdRef.current = null;
      }
      window.electronAPI?.hideUpdateProgressWindow?.();
    }

    if (!ready || !window.electronAPI?.setUpdateSessionActive) return;
    window.electronAPI.setUpdateSessionActive(sessionActive).catch((error) => {
      console.warn('[Updater] Failed to synchronize Live Safety state:', error);
    });
  }, [closeModalByDedupeKey, liveSafety?.enabled, ready, removeToast]);

  useEffect(() => {
    if (!window.electronAPI) return;

    const getErrorMessage = (payload) => {
      if (!payload) return '';
      if (typeof payload === 'string') return payload;
      return payload.message || payload.error || '';
    };

    const getErrorPhase = (payload) => {
      if (!payload || typeof payload === 'string') return 'check';
      return payload.phase || 'check';
    };

    const showInstallError = (result) => {
      const message = result?.error || 'The update could not be installed. Please restart LyricDisplay and try again.';
      showToast({
        title: 'Unable to install update',
        message,
        variant: 'error',
        duration: 8000,
        dedupeKey: 'app-update-install-error',
      });
    };

    const requestInstall = async () => {
      if (liveSafetyEnabledRef.current) {
        showToast({
          title: 'Update deferred by Live Safety',
          message: 'Turn off Live Safety when the session ends to install the downloaded update.',
          variant: 'info',
          dedupeKey: 'app-update-live-safety-deferred',
        });
        return;
      }

      const result = await showModal({
        dedupeKey: 'app-update-install',
        title: 'Install Update?',
        description: 'LyricDisplay will restart to finish installing the downloaded update.',
        body: 'Save any unsaved work before continuing. Output and stage windows will close during the restart.',
        variant: 'warn',
        size: 'sm',
        actions: [
          { label: 'Later', value: 'later', variant: 'outline', autoFocus: true },
          { label: 'Install and Restart', value: 'install', variant: 'destructive' },
        ],
      });

      if (result !== 'install' || liveSafetyEnabledRef.current) return;

      const installResult = await window.electronAPI.requestInstallAndRestart?.();
      if (installResult && installResult.success === false) {
        showInstallError(installResult);
      }
    };

    const showUpdateReadyToast = () => {
      if (liveSafetyEnabledRef.current) return;
      readyToastIdRef.current = showToast({
        title: 'Update ready to install',
        message: 'Restart LyricDisplay when you are ready to finish the update.',
        variant: 'success',
        duration: 0,
        dedupeKey: 'app-update-ready',
        actions: [
          { label: 'Install and Restart', onClick: requestInstall },
          { label: 'Later', onClick: () => { } },
        ],
      });
    };

    const offAvail = window.electronAPI.onUpdateAvailable?.((info) => {
      if (liveSafetyEnabledRef.current) return;
      const version = info?.version || '';
      const releaseName = info?.releaseName || '';
      const releaseNotes = info?.releaseNotes || '';
      const releaseDate = info?.releaseDate || '';
      const isManualMacUpdate = Boolean(info?.manualDownload);
      const assetName = info?.assetName || '';
      const hasMacDmgAsset = Boolean(assetName);
      const formattedNotes = formatReleaseNotesHtml(releaseNotes);

      const descriptionParts = [];

      if (version) {
        descriptionParts.push(`LyricDisplay v${normalizeVersionText(version)} is available.`);
      } else {
        descriptionParts.push('A new version is available.');
      }

      if (releaseName && !isDuplicateVersionLabel(releaseName, version)) {
        descriptionParts.push(releaseName);
      }

      if (releaseDate) {
        const formattedDate = formatReleaseDate(releaseDate);
        if (formattedDate) {
          descriptionParts.push(`Released: ${formattedDate}`);
        }
      }

      const description = descriptionParts.join('\n');

      showModal({
        dedupeKey: 'app-update-available',
        title: 'Update Available',
        description: description,
        body: ({ isDark }) => (
          <UpdateAvailableBody info={info} formattedNotes={formattedNotes} isDark={isDark} />
        ),
        variant: 'info',
        dismissible: true,
        size: 'lg',
        actions: [
          {
            label: 'Later',
            variant: 'outline',
            value: 'later'
          },
          {
            label: isManualMacUpdate
              ? (hasMacDmgAsset ? 'Download DMG' : 'Open Release Page')
              : 'Update Now',
            variant: 'default',
            value: 'update',
            onSelect: () => {
              void (async () => {
                try {
                  const result = await window.electronAPI.requestUpdateDownload?.();
                  if (result && result.success === false) {
                    showToast({
                      title: 'Unable to download update',
                      message: result.error || 'The update download could not be started. Please try again.',
                      variant: 'error',
                      duration: 8000,
                      dedupeKey: 'app-update-download-error',
                    });
                  } else if (result?.alreadyDownloaded) {
                    showUpdateReadyToast();
                  } else if (result?.manualDownload) {
                    showToast({
                      title: 'Update download opened',
                      message: 'After the DMG downloads, quit LyricDisplay and replace the app in Applications.',
                      variant: 'info',
                      duration: 8000,
                      dedupeKey: 'app-update-manual-download-opened',
                    });
                  } else if (result?.inProgress) {
                    showToast({
                      title: 'Update download already running',
                      message: 'The download is already in progress.',
                      variant: 'info',
                      duration: 4000,
                      dedupeKey: 'app-update-download-running',
                    });
                  }
                } catch (error) {
                  showToast({
                    title: 'Unable to download update',
                    message: error?.message || 'The update download could not be started. Please try again.',
                    variant: 'error',
                    duration: 8000,
                    dedupeKey: 'app-update-download-error',
                  });
                }
              })();
            }
          },
        ],
      });
    });
    const offDownloaded = window.electronAPI.onUpdateDownloaded?.(() => {
      showUpdateReadyToast();
    });
    const offErr = window.electronAPI.onUpdateError?.((payload) => {
      const phase = getErrorPhase(payload);
      const detail = getErrorMessage(payload);
      try { console.warn(`Update ${phase} failed:`, detail); } catch { }

      const isDownload = phase === 'download' || phase === 'downloading';
      const isInstall = phase === 'install' || phase === 'installing';

      showToast({
        title: isInstall
          ? 'Unable to install update'
          : isDownload
            ? 'Unable to download update'
            : 'Unable to check for updates',
        message: isInstall
          ? 'The update could not be installed. Please restart LyricDisplay and try again.'
          : isDownload
            ? 'The update download failed. You can retry from the update download window.'
            : 'We could not reach the update service. Please check your internet connection and try again later.',
        variant: isInstall || isDownload ? 'error' : 'warning',
        duration: isInstall || isDownload ? 9000 : 7000,
        dedupeKey: `app-update-${phase}-error`,
      });
    });

    window.electronAPI.getUpdaterState?.().then((result) => {
      if (result?.state?.status === 'downloaded') {
        showUpdateReadyToast();
      }
    }).catch(() => { });

    return () => { offAvail?.(); offDownloaded?.(); offErr?.(); };
  }, [showToast, showModal]);
  return null;
}
