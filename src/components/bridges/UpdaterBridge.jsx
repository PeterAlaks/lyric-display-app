import { useEffect } from 'react';
import useToast from '@/hooks/useToast';
import useModal from '@/hooks/useModal';
import { convertMarkdownToHTML, trimReleaseNotes, formatReleaseNotes } from '../../utils/markdownParser';

export default function UpdaterBridge() {
  const { showToast } = useToast();
  const { showModal } = useModal();

  useEffect(() => {
    if (!window.electronAPI) return;

    const offAvail = window.electronAPI.onUpdateAvailable?.((info) => {
      const version = info?.version || '';
      const releaseName = info?.releaseName || '';
      const releaseNotes = info?.releaseNotes || '';
      const releaseDate = info?.releaseDate || '';
      let formattedNotes = formatReleaseNotes(releaseNotes);
      formattedNotes = trimReleaseNotes(formattedNotes);
      formattedNotes = convertMarkdownToHTML(formattedNotes);

      const descriptionParts = [];

      if (version) {
        descriptionParts.push(`Version ${version} is available.`);
      } else {
        descriptionParts.push('A new version is available.');
      }

      if (releaseName && releaseName !== version) {
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
              Would you like to download and install this update now?
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
            value: 'later'
          },
          {
            label: 'Update Now',
            variant: 'default',
            value: 'update',
            onSelect: async () => {
              window.electronAPI.requestUpdateDownload?.();
            }
          },
        ],
      });
    });
    const offDownloaded = window.electronAPI.onUpdateDownloaded?.(() => {
      showToast({
        title: 'Update ready to install',
        message: 'Install and restart now?',
        variant: 'success',
        duration: 0,
        actions: [
          { label: 'Install and Restart', onClick: () => window.electronAPI.requestInstallAndRestart?.() },
          { label: 'Later', onClick: () => { } },
        ],
      });
    });
    const offErr = window.electronAPI.onUpdateError?.((msg) => {
      const detail = msg ? String(msg) : '';
      try { console.warn('Update check failed:', detail); } catch { }
      showToast({
        title: 'Unable to check for updates',
        message: 'We could not reach the update service. Please check your internet connection and try again later.',
        variant: 'warning',
        duration: 7000,
      });
    });
    return () => { offAvail?.(); offDownloaded?.(); offErr?.(); };
  }, [showToast, showModal]);
  return null;
}
