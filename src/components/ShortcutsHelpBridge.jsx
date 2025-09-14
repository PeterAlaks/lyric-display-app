import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import useLyricsStore from '../context/LyricsStore';

// Keyboard shortcuts modal bridge
export default function ShortcutsHelpBridge() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!window.electronAPI) return;
    const off = window.electronAPI.onOpenShortcutsHelp?.(() => setOpen(true));
    return () => off?.();
  }, []);
  return open ? <ShortcutsHelpModal onClose={() => setOpen(false)} /> : null;
}

function ShortcutsHelpModal({ onClose }) {
  const { darkMode } = useLyricsStore();
  const [exiting, setExiting] = useState(false);
  const [entering, setEntering] = useState(true);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setEntering(false));
    return () => cancelAnimationFrame(raf);
  }, []);
  const handleClose = () => { setExiting(true); setTimeout(onClose, 300); };
  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center" onClick={handleClose}>
      <div className={`absolute inset-0 bg-black/50 transition-opacity duration-300 ${exiting || entering ? 'opacity-0' : 'opacity-100'}`} />
      <div
        onClick={(e) => e.stopPropagation()}
        className={`relative w-full max-w-md mx-4 rounded-xl shadow-2xl p-6 transition-all duration-300 ease-out ${
          darkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-900'
        } ${exiting || entering ? 'opacity-0 translate-y-1 scale-95' : 'opacity-100 translate-y-0 scale-100'}`}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Keyboard Shortcuts</h3>
          <button
            onClick={handleClose}
            className={`${darkMode ? 'text-gray-300 hover:text-white' : 'text-gray-600 hover:text-gray-900'} transition-colors`}
            aria-label="Close"
            type="button"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className={darkMode ? 'text-gray-300' : 'text-gray-700'}>Open Lyrics File</span>
            <span className="opacity-90">Ctrl/Cmd + O</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className={darkMode ? 'text-gray-300' : 'text-gray-700'}>New Lyrics</span>
            <span className="opacity-90">Ctrl/Cmd + N</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className={darkMode ? 'text-gray-300' : 'text-gray-700'}>Preview Output 1</span>
            <span className="opacity-90">Ctrl/Cmd + 1</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className={darkMode ? 'text-gray-300' : 'text-gray-700'}>Preview Output 2</span>
            <span className="opacity-90">Ctrl/Cmd + 2</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className={darkMode ? 'text-gray-300' : 'text-gray-700'}>Navigate Previous Search Results</span>
            <span className="opacity-90">Shift + Up Arrow</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className={darkMode ? 'text-gray-300' : 'text-gray-700'}>Navigate Next Search Results</span>
            <span className="opacity-90">Shift + Down Arrow</span>
          </div>
        </div>
      </div>
    </div>
  );
}

