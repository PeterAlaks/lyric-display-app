import { useEffect } from 'react';
import useToast from '@/hooks/useToast';
import useModal from '@/hooks/useModal';
import { convertMarkdownToHTML, trimReleaseNotes, formatReleaseNotes } from '../../utils/markdownParser';

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

export default function UpdaterBridge() {
  const { showToast } = useToast();
  const { showModal } = useModal();

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
      const result = await showModal({
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

      if (result !== 'install') return;

      const installResult = await window.electronAPI.requestInstallAndRestart?.();
      if (installResult && installResult.success === false) {
        showInstallError(installResult);
      }
    };

    const showUpdateReadyToast = () => {
      showToast({
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
      const version = info?.version || '';
      const releaseName = info?.releaseName || '';
      const releaseNotes = info?.releaseNotes || '';
      const releaseDate = info?.releaseDate || '';
      const isManualMacUpdate = Boolean(info?.manualDownload);
      const assetName = info?.assetName || '';
      const hasMacDmgAsset = Boolean(assetName);
      let formattedNotes = formatReleaseNotes(releaseNotes);
      formattedNotes = trimReleaseNotes(formattedNotes);
      formattedNotes = convertMarkdownToHTML(formattedNotes);

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
        try {
          const date = new Date(releaseDate);
          const formattedDate = date.toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          });
          descriptionParts.push(`Released: ${formattedDate}`);
        } catch (e) {
        }
      }

      const description = descriptionParts.join('\n');

      showModal({
        title: 'Update Available',
        description: description,
        body: ({ isDark }) => (
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
                  <h4 className={`text-sm font-semibold ${isDark ? 'text-gray-100' : 'text-gray-900'
                    }`}>Release Notes</h4>
                </div>
                <div className="px-4 py-3 max-h-64 overflow-y-auto">
                  <div
                    className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}
                    style={{
                      lineHeight: '1.6',
                      color: isDark ? '#d1d5db' : '#374151'
                    }}
                    dangerouslySetInnerHTML={{ __html: formattedNotes }}
                  />
                </div>
              </div>
            )}
            <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'
              }`}>
              {isManualMacUpdate
                ? 'macOS updates currently need to be installed manually because this build is unsigned. Download the DMG, quit LyricDisplay, open the DMG, and replace the app in Applications.'
                : 'Would you like to download and install this update now?'}
            </p>
            {isManualMacUpdate && hasMacDmgAsset && (
              <p className={`text-xs font-medium ${isDark ? 'text-gray-500' : 'text-gray-500'
                }`}>
                Download: {assetName}
              </p>
            )}
          </div>
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
