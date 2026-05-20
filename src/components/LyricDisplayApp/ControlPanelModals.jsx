import React from 'react';
import EasyWorshipImportModal from '../EasyWorshipImportModal';
import OnlineLyricsSearchModal from '../OnlineLyricsSearchModal';
import PresentationImportModal from '../PresentationImportModal';
import SetlistModal from '../SetlistModal';

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
  return (
    <>
      <SetlistModal />

      <OnlineLyricsSearchModal
        isOpen={onlineLyricsModalOpen}
        onClose={handleCloseOnlineLyricsSearch}
        darkMode={darkMode}
        onImportLyrics={handleImportFromLibrary}
      />

      <EasyWorshipImportModal
        isOpen={easyWorshipModalOpen}
        onClose={() => setEasyWorshipModalOpen(false)}
        darkMode={darkMode}
      />

      <PresentationImportModal
        isOpen={presentationModalOpen}
        onClose={() => setPresentationModalOpen(false)}
        darkMode={darkMode}
      />
    </>
  );
}
