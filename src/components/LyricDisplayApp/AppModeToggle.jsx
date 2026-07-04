import React from 'react';
import { BookOpen, Music } from 'lucide-react';
import { Tooltip } from '@/components/ui/tooltip';

const MODES = [
  { id: 'song', label: 'Song mode', Icon: Music },
  { id: 'scripture', label: 'Scripture mode', Icon: BookOpen },
];

export default function AppModeToggle({ appMode, setAppMode, darkMode }) {
  return (
    <div
      role="group"
      aria-label="Control panel mode"
      className={`inline-flex items-center gap-1 p-1 mb-3 rounded-xl ${darkMode ? 'bg-gray-700' : 'bg-gray-100'}`}
    >
      {MODES.map(({ id, label, Icon }) => {
        const active = appMode === id;
        return (
          <Tooltip key={id} content={label} side="bottom">
            <button
              type="button"
              aria-pressed={active}
              aria-label={label}
              onClick={() => setAppMode(id)}
              className={`h-7 w-10 rounded-lg flex items-center justify-center transition-all duration-150 ${active
                ? darkMode
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'bg-black text-white shadow-sm'
                : darkMode
                  ? 'text-gray-400 hover:bg-gray-600 hover:text-gray-200'
                  : 'text-gray-500 hover:bg-gray-200 hover:text-gray-700'
                }`}
            >
              <Icon className="h-4 w-4" />
            </button>
          </Tooltip>
        );
      })}
    </div>
  );
}
