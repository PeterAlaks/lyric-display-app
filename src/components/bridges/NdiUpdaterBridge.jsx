import { useEffect } from 'react';
import useToast from '@/hooks/useToast';
import useModal from '@/hooks/useModal';
import useNdiStore from '../../context/NdiStore';
import { convertMarkdownToHTML, trimReleaseNotes, formatReleaseNotes } from '../../utils/markdownParser';

export default function NdiUpdaterBridge() {
  const { showToast } = useToast();
  const { showModal } = useModal();
  const ndiSetUpdating = useNdiStore((s) => s.setUpdating);
  const ndiSetUpdateInfo = useNdiStore((s) => s.setUpdateInfo);
  const ndiRefreshInstallStatus = useNdiStore((s) => s.refreshInstallStatus);

  useEffect(() => {
    if (!window.electronAPI?.ndi?.onUpdateAvailable) return;

    const offNdiUpdate = window.electronAPI.ndi.onUpdateAvailable((info) => {
      if (!info?.updateAvailable) return;

      const currentVersion = info.currentVersion || '';
      const latestVersion = info.latestVersion || '';
      const releaseNotes = info.releaseNotes || '';
      const releaseName = info.releaseName || '';
      const releaseDate = info.releaseDate || '';

      let formattedNotes = '';
      if (releaseNotes) {
        formattedNotes = formatReleaseNotes(releaseNotes);
        formattedNotes = trimReleaseNotes(formattedNotes);
        formattedNotes = convertMarkdownToHTML(formattedNotes);
      }

      const descriptionParts = [];
      if (latestVersion) {
        descriptionParts.push(`Version ${latestVersion} is available (you have v${currentVersion}).`);
      } else {
        descriptionParts.push('A new version of the NDI companion is available.');
      }
      if (releaseName && releaseName !== `v${latestVersion}`) {
        descriptionParts.push(releaseName);
      }
      if (releaseDate) {
        try {
          const date = new Date(releaseDate);
          const formattedDate = date.toLocaleDateString(undefined, {
            year: 'numeric', month: 'long', day: 'numeric'
          });
          descriptionParts.push(`Released: ${formattedDate}`);
        } catch { }
      }

      showModal({
        title: 'NDI Companion Update Available',
        description: descriptionParts.join('\n'),
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
                  <h4 className={`text-sm font-semibold ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>
                    Release Notes
                  </h4>
                </div>
                <div className="px-4 py-3 max-h-64 overflow-y-auto">
                  <div
                    className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}
                    style={{ lineHeight: '1.6', color: isDark ? '#d1d5db' : '#374151' }}
                    dangerouslySetInnerHTML={{ __html: formattedNotes }}
                  />
                </div>
              </div>
            )}
            <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              Would you like to download and install this update now? The NDI companion will be stopped during the update.
            </p>
          </div>
        ),
        variant: 'info',
        dismissible: true,
        size: 'lg',
        actions: [
          {
            label: 'Later',
            variant: 'outline',
            value: 'later',
          },
          {
            label: 'Update Now',
            variant: 'default',
            value: 'update',
            onSelect: () => {
              showToast({
                title: 'Updating NDI Companion',
                message: 'Downloading the latest version...',
                variant: 'info',
                duration: 5000,
              });

              ndiSetUpdating(true);
              (async () => {
                try {
                  const result = await window.electronAPI.ndi.updateCompanion();
                  if (result?.success) {
                    if (window.electronAPI?.ndi?.clearPendingUpdateInfo) {
                      await window.electronAPI.ndi.clearPendingUpdateInfo();
                    }
                    ndiSetUpdateInfo(null);
                    ndiRefreshInstallStatus();
                    showToast({
                      title: 'NDI Companion Updated',
                      message: `Updated to v${result.version}. You can relaunch it from Preferences → NDI.`,
                      variant: 'success',
                      duration: 8000,
                    });
                  } else {
                    showToast({
                      title: 'Update Failed',
                      message: result?.error || 'Could not update the NDI companion.',
                      variant: 'error',
                      duration: 7000,
                    });
                  }
                } catch (error) {
                  showToast({
                    title: 'Update Failed',
                    message: error?.message || 'An unexpected error occurred.',
                    variant: 'error',
                    duration: 7000,
                  });
                } finally {
                  ndiSetUpdating(false);
                }
              })();
            }
          },
        ],
      });
    });

    return () => { offNdiUpdate?.(); };
  }, [showToast, showModal, ndiSetUpdating, ndiSetUpdateInfo, ndiRefreshInstallStatus]);

  return null;
}
