import React from 'react';
import { FileText, ListMusic } from 'lucide-react';

export default function LyricsDragOverlay({
  darkMode,
  dragFileCount,
  hasLyrics,
  setlistFileCount,
}) {
  return (
    <div
      className={`absolute inset-0 flex items-center justify-center z-50 pointer-events-none ${darkMode ? 'bg-gray-900/90' : 'bg-gray-900/80'
        }`}
    >
      <div className="text-center px-8 py-10 rounded-2xl border-2 border-dashed max-w-md mx-auto"
        style={{
          borderColor: darkMode ? '#60a5fa' : '#3b82f6',
          backgroundColor: darkMode ? 'rgba(31, 41, 55, 0.95)' : 'rgba(255, 255, 255, 0.95)'
        }}
      >
        <div className={`w-20 h-20 mx-auto mb-5 rounded-full flex items-center justify-center ${darkMode ? 'bg-blue-500/20' : 'bg-blue-100'
          }`}>
          {dragFileCount === 1 ? (
            <FileText className={`w-10 h-10 ${darkMode ? 'text-blue-400' : 'text-blue-600'}`} />
          ) : (
            <ListMusic className={`w-10 h-10 ${darkMode ? 'text-blue-400' : 'text-blue-600'}`} />
          )}
        </div>
        <h3 className={`text-lg font-bold mb-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
          {dragFileCount === 1 ? 'Drop to load file' : `Drop ${dragFileCount} files`}
        </h3>
        <p className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
          {dragFileCount === 1
            ? 'This file will be loaded into the app'
            : hasLyrics
              ? `These files will be added to your ${setlistFileCount > 0 ? 'current' : ''} setlist`
              : 'These files will be added to your setlist'}
        </p>
      </div>
    </div>
  );
}
