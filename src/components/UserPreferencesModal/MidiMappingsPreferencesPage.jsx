import React from 'react';
import { ArrowLeft, Loader2, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

const MidiMappingsPreferencesPage = ({
  darkMode,
  handleMidiAssignAction,
  handleMidiLearn,
  handleMidiResetMappings,
  labelClass,
  lastLearnedMidi,
  midiAssigningAction,
  midiLearnActive,
  midiStatus,
  mutedClass,
  onBack,
}) => {
  const noteEntries = Object.entries(midiStatus?.mappings?.notes || {})
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([note, mapping]) => ({
      type: 'NOTE',
      key: note,
      mapping,
    }));

  const ccEntries = Object.entries(midiStatus?.mappings?.controlChanges || {})
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([cc, mapping]) => ({
      type: 'CC',
      key: cc,
      mapping,
    }));

  const allEntries = [...noteEntries, ...ccEntries];

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={onBack}
            aria-label="Back to External Control"
            className="h-7 w-7 shrink-0"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
          </Button>
          <div className="min-w-0">
            <h3 className={`truncate text-base font-semibold ${labelClass}`}>MIDI Mappings</h3>
            <p className={`text-[11px] ${mutedClass}`}>
              {allEntries.length} configured {allEntries.length === 1 ? 'mapping' : 'mappings'}
            </p>
          </div>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={handleMidiResetMappings}
          className={`shrink-0 gap-1.5 ${darkMode ? 'border-gray-600 bg-gray-800 text-gray-300 hover:bg-gray-700' : ''}`}
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Reset defaults
        </Button>
      </div>

      <div className="mb-3 flex min-h-4 items-center justify-between gap-3">
        <p className={`text-[11px] ${mutedClass}`}>Assign lyric controls to notes, buttons, pedals, or knobs.</p>
        {lastLearnedMidi && (
          <span className={`shrink-0 text-[10px] ${mutedClass}`}>
            Last learned: {lastLearnedMidi.type === 'note'
              ? `Note ${lastLearnedMidi.note} (vel ${lastLearnedMidi.velocity ?? '--'}) ch ${((lastLearnedMidi.channel ?? 0) + 1)}`
              : `CC ${lastLearnedMidi.controller} (val ${lastLearnedMidi.value ?? '--'}) ch ${((lastLearnedMidi.channel ?? 0) + 1)}`}
          </span>
        )}
      </div>

      <div className={`overflow-hidden rounded-lg border ${darkMode ? 'border-gray-700 bg-gray-800/40' : 'border-gray-200 bg-white'}`}>
        <div className={`grid grid-cols-12 text-[11px] ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
          <div className={`col-span-2 px-3 py-2 font-medium ${darkMode ? 'bg-gray-800/60' : 'bg-gray-50'}`}>Type</div>
          <div className={`col-span-2 px-3 py-2 font-medium ${darkMode ? 'bg-gray-800/60' : 'bg-gray-50'}`}>Key</div>
          <div className={`col-span-8 px-3 py-2 font-medium ${darkMode ? 'bg-gray-800/60' : 'bg-gray-50'}`}>Action</div>

          {allEntries.length === 0 ? (
            <div className={`col-span-12 border-t px-3 py-4 text-center ${darkMode ? 'border-gray-700 text-gray-400' : 'border-gray-200 text-gray-500'}`}>
              No mappings found.
            </div>
          ) : (
            allEntries.map((entry) => (
              <React.Fragment key={`${entry.type}-${entry.key}`}>
                <div className={`col-span-2 border-t px-3 py-2 ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] ${entry.type === 'NOTE'
                    ? (darkMode ? 'bg-blue-900/30 text-blue-300' : 'bg-blue-50 text-blue-700')
                    : (darkMode ? 'bg-emerald-900/30 text-emerald-300' : 'bg-emerald-50 text-emerald-700')
                    }`}>
                    {entry.type}
                  </span>
                </div>
                <div className={`col-span-2 border-t px-3 py-2 tabular-nums ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                  {entry.key}
                </div>
                <div className={`col-span-8 border-t px-3 py-2 ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                  <p className="truncate font-medium">{entry.mapping?.description || entry.mapping?.action || '--'}</p>
                  {entry.mapping?.action && (
                    <p className={`mt-0.5 truncate text-[10px] ${mutedClass}`}>
                      Action key: {entry.mapping.action}
                      {entry.type === 'NOTE' && typeof entry.mapping?.line === 'number' ? ` (line ${entry.mapping.line + 1})` : ''}
                    </p>
                  )}
                </div>
              </React.Fragment>
            ))
          )}
        </div>
      </div>

      <div className={`mt-4 rounded-lg border p-3 ${darkMode ? 'border-gray-700 bg-gray-800/30' : 'border-gray-200 bg-gray-50'}`}>
        <p className={`text-xs font-medium ${labelClass}`}>Quick assign</p>
        <p className={`mt-0.5 text-[11px] ${mutedClass}`}>
          Choose an action, then use an unmapped control on your MIDI device.
        </p>

        <div className="mt-2 grid grid-cols-2 gap-2">
          {[
            ['prev-line', 'Previous Line'],
            ['next-line', 'Next Line'],
            ['toggle-output', 'Toggle Output'],
            ['clear-output', 'Clear Output'],
          ].map(([key, label]) => (
            <Button
              key={key}
              size="sm"
              variant="outline"
              onClick={() => handleMidiAssignAction({ key, label })}
              disabled={!midiStatus?.enabled || midiLearnActive}
              className={darkMode ? 'border-gray-600 bg-gray-800 text-gray-300 hover:bg-gray-700' : ''}
            >
              {midiAssigningAction?.key === key && midiLearnActive ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  Waiting...
                </>
              ) : label}
            </Button>
          ))}
        </div>

        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={handleMidiLearn}
          disabled={!midiStatus?.enabled || midiLearnActive}
          className={`mt-2 w-full ${darkMode ? 'border-gray-600 bg-gray-800 text-gray-300 hover:bg-gray-700' : ''}`}
        >
          {midiLearnActive ? (
            <>
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              Waiting for MIDI input...
            </>
          ) : 'Learn MIDI and show last input'}
        </Button>
      </div>
    </div>
  );
};

export default MidiMappingsPreferencesPage;
