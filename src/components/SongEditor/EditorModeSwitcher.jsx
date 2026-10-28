import { LayoutList, TextCursorInput } from 'lucide-react';
import { Tooltip } from '@/components/ui/tooltip';

const OPTIONS = [
  {
    value: 'structured',
    label: 'Structured',
    icon: LayoutList,
    hint: 'Sections, slides, and line roles, saved as a LyricDisplay Song (.ldsong)',
  },
  {
    value: 'classic',
    label: 'Classic',
    icon: TextCursorInput,
    hint: 'The free-form text canvas, saved as .txt or .lrc',
  },
];

// Shared by the structured editor and the classic canvas so either can hand off to the other.
export default function EditorModeSwitcher({ value, onChange, darkMode }) {
  return (
    <div
      role="tablist"
      aria-label="Song editor"
      className={`inline-flex shrink-0 items-center gap-0.5 p-0.5 ${darkMode ? 'bg-gray-800' : 'bg-gray-100'}`}
    >
      {OPTIONS.map(({ value: optionValue, label, icon: Icon, hint }) => {
        const active = value === optionValue;
        return (
          <Tooltip key={optionValue} content={hint} side="bottom">
            <button
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => { if (!active) onChange(optionValue); }}
              className={`inline-flex h-7 items-center gap-1.5 px-2.5 text-xs font-semibold transition-colors ${active
                ? darkMode ? 'bg-gray-600 text-white shadow-sm' : 'bg-white text-gray-900 shadow-sm'
                : darkMode ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-800'
                }`}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden="true" />
              {label}
            </button>
          </Tooltip>
        );
      })}
    </div>
  );
}
