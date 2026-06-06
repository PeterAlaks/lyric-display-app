import React from 'react';
import { useSetlistState } from '@/hooks/useStoreSelectors';

const EasyWorshipImportModal = React.lazy(() => import('../EasyWorshipImportModal'));
const OnlineLyricsSearchModal = React.lazy(() => import('../OnlineLyricsSearchModal'));
const PresentationImportModal = React.lazy(() => import('../PresentationImportModal'));
const SetlistModal = React.lazy(() => import('../SetlistModal'));

export default function ControlPanelModals({
  darkMode,
  easyWorshipModalOpen,
  handleCloseOnlineLyricsSearch,
  handleImportFromLibrary,
  onlineLyricsModalOpen,
  presentationModalOpen,
  setEasyWorshipModalOpen,
  setPresentationModalOpen,
}) {
  const { setlistModalOpen } = useSetlistState();

  return (
    <React.Suspense fallback={null}>
      {setlistModalOpen && <SetlistModal />}

      {onlineLyricsModalOpen && (
        <OnlineLyricsSearchModal
          isOpen={onlineLyricsModalOpen}
          onClose={handleCloseOnlineLyricsSearch}
          darkMode={darkMode}
          onImportLyrics={handleImportFromLibrary}
        />
      )}

      {easyWorshipModalOpen && (
        <EasyWorshipImportModal
          isOpen={easyWorshipModalOpen}
          onClose={() => setEasyWorshipModalOpen(false)}
          darkMode={darkMode}
        />
      )}

      {presentationModalOpen && (
        <PresentationImportModal
          isOpen={presentationModalOpen}
          onClose={() => setPresentationModalOpen(false)}
          darkMode={darkMode}
        />
      )}
    </React.Suspense>
  );
}
