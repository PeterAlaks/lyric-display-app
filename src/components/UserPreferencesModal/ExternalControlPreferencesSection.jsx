import React from 'react';
import { Check, Loader2, Music, Radio, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const ExternalControlPreferencesSection = ({
  darkMode,
  handleMidiAssignAction,
  handleMidiLearn,
  handleMidiRefreshPorts,
  handleMidiResetMappings,
  handleMidiSelectPort,
  handleMidiToggle,
  handleOscFeedbackPortChange,
  handleOscFeedbackToggle,
  handleOscPortChange,
  handleOscToggle,
  inputClass,
  labelClass,
  lastLearnedMidi,
  midiAssigningAction,
  midiLearnActive,
  midiMappingsExpanded,
  midiRefreshing,
  midiStatus,
  mutedClass,
  oscStatus,
  preferenceFieldLabelClass,
  setMidiMappingsExpanded,
}) => {
  const selectContentClass = darkMode
    ? 'bg-gray-700 border-gray-600 text-gray-200'
    : 'bg-white border-gray-300';
  const noteEntries = Object.entries(midiStatus?.mappings?.notes || {})
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([note, mapping]) => ({
      type: 'NOTE',
      key: note,
      mapping
    }));

  const ccEntries = Object.entries(midiStatus?.mappings?.controlChanges || {})
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([cc, mapping]) => ({
      type: 'CC',
      key: cc,
      mapping
    }));

  const allEntries = [...noteEntries, ...ccEntries];
  const visibleEntries = midiMappingsExpanded ? allEntries : allEntries.slice(0, 5);
  const hiddenCount = Math.max(0, allEntries.length - visibleEntries.length);

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Music className={`w-4 h-4 ${mutedClass}`} />
          <h4 className={`text-sm font-semibold ${labelClass}`}>MIDI Control</h4>
        </div>

        {!midiStatus?.initialized ? (
          <div className={`text-center py-4 ${mutedClass}`}>
            <p className="text-sm">MIDI support requires the @julusian/midi package.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <label className={`text-sm font-medium ${labelClass}`}>Enable MIDI</label>
                <p className={`text-xs ${mutedClass}`}>Process incoming MIDI messages</p>
              </div>
              <Switch
                checked={midiStatus?.enabled || false}
                onCheckedChange={handleMidiToggle}
                disabled={midiStatus?.selectedPortIndex < 0}
                className={`!h-7 !w-14 !border-0 shadow-sm transition-colors ${darkMode
                  ? 'data-[state=checked]:bg-green-400 data-[state=unchecked]:bg-gray-600'
                  : 'data-[state=checked]:bg-black data-[state=unchecked]:bg-gray-300'
                  }`}
                thumbClassName="!h-5 !w-6 data-[state=checked]:!translate-x-7 data-[state=unchecked]:!translate-x-1"
              />
            </div>

            <div className="space-y-2">
              <div className="mb-1.5 flex items-center justify-between">
                <label className={`text-sm font-medium ${labelClass}`}>MIDI Input Device</label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleMidiRefreshPorts}
                  disabled={midiRefreshing}
                  className={darkMode ? 'text-gray-300 hover:bg-gray-700/60 hover:text-gray-100' : ''}
                >
                  <RefreshCw className={`w-4 h-4 mr-1 ${midiRefreshing ? 'animate-spin' : ''}`} />
                  {midiRefreshing ? 'Refreshing...' : 'Refresh'}
                </Button>
              </div>
              <Select
                value={String(midiStatus?.selectedPortIndex ?? -1)}
                onValueChange={handleMidiSelectPort}
              >
                <SelectTrigger className={inputClass}>
                  <SelectValue placeholder="Select MIDI device..." />
                </SelectTrigger>
                <SelectContent className={selectContentClass}>
                  <SelectItem value="-1">None</SelectItem>
                  {midiStatus?.availablePorts?.map((port) => (
                    <SelectItem key={port.index} value={String(port.index)}>
                      {port.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className={`rounded-lg border overflow-hidden ${darkMode ? 'border-gray-700 bg-gray-800/40' : 'border-gray-200 bg-white'}`}>
              <div className={`px-3 py-2 flex items-center justify-between gap-3 ${darkMode ? 'bg-gray-800/60 border-b border-gray-700' : 'bg-gray-50 border-b border-gray-200'}`}>
                <p className={`text-xs font-semibold tracking-wide ${labelClass}`}>MIDI Mappings</p>
                <div className="flex items-center gap-2 shrink-0">
                  {lastLearnedMidi && (
                    <span className={`text-[11px] ${mutedClass}`}>
                      Last learned: {lastLearnedMidi.type === 'note'
                        ? `Note ${lastLearnedMidi.note} (vel ${lastLearnedMidi.velocity ?? '--'}) ch ${((lastLearnedMidi.channel ?? 0) + 1)}`
                        : `CC ${lastLearnedMidi.controller} (val ${lastLearnedMidi.value ?? '--'}) ch ${((lastLearnedMidi.channel ?? 0) + 1)}`}
                    </span>
                  )}

                  {hiddenCount > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setMidiMappingsExpanded(true)}
                      className={darkMode ? 'text-gray-300 hover:bg-gray-700/60 hover:text-gray-100' : ''}
                    >
                      Expand ({hiddenCount} more)
                    </Button>
                  )}

                  {midiMappingsExpanded && allEntries.length > 5 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setMidiMappingsExpanded(false)}
                      className={darkMode ? 'text-gray-300 hover:bg-gray-700/60 hover:text-gray-100' : ''}
                    >
                      Collapse
                    </Button>
                  )}
                </div>
              </div>

              <div className={`grid grid-cols-12 gap-0 text-[11px] ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                <div className={`col-span-2 px-3 py-2 font-medium ${darkMode ? 'bg-gray-800/30' : 'bg-gray-50'}`}>Type</div>
                <div className={`col-span-2 px-3 py-2 font-medium ${darkMode ? 'bg-gray-800/30' : 'bg-gray-50'}`}>Key</div>
                <div className={`col-span-8 px-3 py-2 font-medium ${darkMode ? 'bg-gray-800/30' : 'bg-gray-50'}`}>Action</div>

                {visibleEntries.length === 0 ? (
                  <div className={`col-span-12 px-3 py-3 border-t ${darkMode ? 'border-gray-700 text-gray-400' : 'border-gray-200 text-gray-500'}`}>
                    No mappings found.
                  </div>
                ) : (
                  visibleEntries.map((entry) => (
                    <React.Fragment key={`${entry.type}-${entry.key}`}>
                      <div className={`col-span-2 px-3 py-2 border-t ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                        {entry.type === 'NOTE' ? (
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] ${darkMode ? 'bg-blue-900/30 text-blue-300' : 'bg-blue-50 text-blue-700'}`}>
                            NOTE
                          </span>
                        ) : (
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] ${darkMode ? 'bg-emerald-900/30 text-emerald-300' : 'bg-emerald-50 text-emerald-700'}`}>
                            CC
                          </span>
                        )}
                      </div>
                      <div className={`col-span-2 px-3 py-2 border-t tabular-nums ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>{entry.key}</div>
                      <div className={`col-span-8 px-3 py-2 border-t ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                        <p className="font-medium truncate">{entry.mapping?.description || entry.mapping?.action || '--'}</p>
                        {entry.mapping?.action && (
                          <p className={`text-[10px] mt-0.5 ${mutedClass} truncate`}>
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

            <div className="space-y-3">
              <div className={`rounded-lg border p-3 ${darkMode ? 'border-gray-700 bg-gray-800/30' : 'border-gray-200 bg-gray-50'}`}>
                <p className={`text-xs font-medium ${labelClass}`}>Quick assign</p>
                <p className={`text-[11px] mt-0.5 ${mutedClass}`}>
                  Choose an action, then press a button/pedal/knob on your MIDI device. (Listens for an unmapped control.)
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
                      variant="outline"
                      onClick={() => handleMidiAssignAction({ key, label })}
                      disabled={!midiStatus?.enabled || midiLearnActive}
                      className={darkMode ? 'bg-gray-800 border-gray-600 hover:bg-gray-700 text-gray-300' : ''}
                    >
                      {midiAssigningAction?.key === key && midiLearnActive ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Waiting...
                        </>
                      ) : (
                        label
                      )}
                    </Button>
                  ))}
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    onClick={handleMidiLearn}
                    disabled={!midiStatus?.enabled || midiLearnActive}
                    className={darkMode ? 'bg-gray-800 border-gray-600 hover:bg-gray-700 text-gray-300' : ''}
                  >
                    {midiLearnActive ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Waiting...
                      </>
                    ) : (
                      'Learn MIDI (show last input)'
                    )}
                  </Button>

                  <Button
                    variant="outline"
                    onClick={handleMidiResetMappings}
                    className={darkMode ? 'bg-gray-800 border-gray-600 hover:bg-gray-700 text-gray-300' : ''}
                  >
                    Reset Defaults
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className={`border-t ${darkMode ? 'border-gray-700' : 'border-gray-200'}`} />

      <div>
        <div className="flex items-center gap-2 mb-4">
          <Radio className={`w-4 h-4 ${mutedClass}`} />
          <h4 className={`text-sm font-semibold ${labelClass}`}>OSC Control</h4>
        </div>

        {!oscStatus?.initialized ? (
          <div className={`text-center py-4 ${mutedClass}`}>
            <p className="text-sm">OSC server failed to start. Check if port is in use.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <label className={`text-sm font-medium ${labelClass}`}>Enable OSC</label>
                <p className={`text-xs ${mutedClass}`}>Process incoming OSC messages</p>
              </div>
              <Switch
                checked={oscStatus?.enabled || false}
                onCheckedChange={handleOscToggle}
                className={`!h-7 !w-14 !border-0 shadow-sm transition-colors ${darkMode
                  ? 'data-[state=checked]:bg-green-400 data-[state=unchecked]:bg-gray-600'
                  : 'data-[state=checked]:bg-black data-[state=unchecked]:bg-gray-300'
                  }`}
                thumbClassName="!h-5 !w-6 data-[state=checked]:!translate-x-7 data-[state=unchecked]:!translate-x-1"
              />
            </div>

            <div className="space-y-2">
              <label className={preferenceFieldLabelClass}>Listening Port</label>
              <Input
                type="number"
                value={oscStatus?.port || 8000}
                onChange={(e) => handleOscPortChange(e.target.value)}
                min="1"
                max="65535"
                className={inputClass}
              />
              <p className={`text-xs ${mutedClass}`}>Requires restart to take effect</p>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <label className={`text-sm font-medium ${labelClass}`}>Send Feedback</label>
                <p className={`text-xs ${mutedClass}`}>Send state updates to OSC clients</p>
              </div>
              <Switch
                checked={oscStatus?.feedbackEnabled || false}
                onCheckedChange={handleOscFeedbackToggle}
                className={`!h-7 !w-14 !border-0 shadow-sm transition-colors ${darkMode
                  ? 'data-[state=checked]:bg-green-400 data-[state=unchecked]:bg-gray-600'
                  : 'data-[state=checked]:bg-black data-[state=unchecked]:bg-gray-300'
                  }`}
                thumbClassName="!h-5 !w-6 data-[state=checked]:!translate-x-7 data-[state=unchecked]:!translate-x-1"
              />
            </div>

            {oscStatus?.feedbackEnabled && (
              <div className="space-y-2">
                <label className={preferenceFieldLabelClass}>Feedback Port</label>
                <Input
                  type="number"
                  value={oscStatus?.feedbackPort || 9000}
                  onChange={(e) => handleOscFeedbackPortChange(e.target.value)}
                  min="1"
                  max="65535"
                  className={inputClass}
                />
              </div>
            )}

            {oscStatus?.connectedClients > 0 && (
              <div className={`flex items-center gap-2 text-sm ${darkMode ? 'text-green-400' : 'text-green-600'}`}>
                <Check className="w-4 h-4" />
                {oscStatus.connectedClients} client{oscStatus.connectedClients !== 1 ? 's' : ''} connected
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ExternalControlPreferencesSection;
