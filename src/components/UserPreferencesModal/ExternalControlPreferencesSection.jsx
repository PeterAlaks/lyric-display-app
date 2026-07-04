import React from 'react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
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
  const quickAssignActions = [
    ['prev-line', t('preferences.externalControl.midi.quickAssign.actions.previousLine')],
    ['next-line', t('preferences.externalControl.midi.quickAssign.actions.nextLine')],
    ['toggle-output', t('preferences.externalControl.midi.quickAssign.actions.toggleOutput')],
    ['clear-output', t('preferences.externalControl.midi.quickAssign.actions.clearOutput')],
  ];

  const formatLastLearnedMidi = () => {
    if (!lastLearnedMidi) return '';
    const channel = ((lastLearnedMidi.channel ?? 0) + 1);
    if (lastLearnedMidi.type === 'note') {
      return t('preferences.externalControl.midi.noteLastLearned', {
        note: lastLearnedMidi.note,
        velocity: lastLearnedMidi.velocity ?? '--',
        channel,
      });
    }
    return t('preferences.externalControl.midi.ccLastLearned', {
      controller: lastLearnedMidi.controller,
      value: lastLearnedMidi.value ?? '--',
      channel,
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Music className={`w-4 h-4 ${mutedClass}`} />
          <h4 className={`text-sm font-semibold ${labelClass}`}>{t('preferences.externalControl.midi.title')}</h4>
        </div>

        {!midiStatus?.initialized ? (
          <div className={`text-center py-4 ${mutedClass}`}>
            <p className="text-sm">{t('preferences.externalControl.midi.supportMissing')}</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <label className={`text-sm font-medium ${labelClass}`}>{t('preferences.externalControl.midi.enable.label')}</label>
                <p className={`text-xs ${mutedClass}`}>{t('preferences.externalControl.midi.enable.description')}</p>
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
                <label className={`text-sm font-medium ${labelClass}`}>{t('preferences.externalControl.midi.inputDevice')}</label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleMidiRefreshPorts}
                  disabled={midiRefreshing}
                  className={darkMode ? 'text-gray-300 hover:bg-gray-700/60 hover:text-gray-100' : ''}
                >
                  <RefreshCw className={`w-4 h-4 mr-1 ${midiRefreshing ? 'animate-spin' : ''}`} />
                  {midiRefreshing ? t('preferences.externalControl.midi.refreshing') : t('preferences.externalControl.midi.refresh')}
                </Button>
              </div>
              <Select
                value={String(midiStatus?.selectedPortIndex ?? -1)}
                onValueChange={handleMidiSelectPort}
              >
                <SelectTrigger className={inputClass}>
                  <SelectValue placeholder={t('preferences.externalControl.midi.selectDevicePlaceholder')} />
                </SelectTrigger>
                <SelectContent className={darkMode ? 'bg-gray-700 border-gray-600' : ''}>
                  <SelectItem value="-1">{t('preferences.externalControl.midi.none')}</SelectItem>
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
                <p className={`text-xs font-semibold tracking-wide ${labelClass}`}>{t('preferences.externalControl.midi.mappings')}</p>
                <div className="flex items-center gap-2 shrink-0">
                  {lastLearnedMidi && (
                    <span className={`text-[11px] ${mutedClass}`}>
                      {t('preferences.externalControl.midi.lastLearned', { value: formatLastLearnedMidi() })}
                    </span>
                  )}

                  {hiddenCount > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setMidiMappingsExpanded(true)}
                      className={darkMode ? 'text-gray-300 hover:bg-gray-700/60 hover:text-gray-100' : ''}
                    >
                      {t('preferences.externalControl.midi.expand', { count: hiddenCount })}
                    </Button>
                  )}

                  {midiMappingsExpanded && allEntries.length > 5 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setMidiMappingsExpanded(false)}
                      className={darkMode ? 'text-gray-300 hover:bg-gray-700/60 hover:text-gray-100' : ''}
                    >
                      {t('preferences.externalControl.midi.collapse')}
                    </Button>
                  )}
                </div>
              </div>

              <div className={`grid grid-cols-12 gap-0 text-[11px] ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                <div className={`col-span-2 px-3 py-2 font-medium ${darkMode ? 'bg-gray-800/30' : 'bg-gray-50'}`}>{t('preferences.externalControl.table.type')}</div>
                <div className={`col-span-2 px-3 py-2 font-medium ${darkMode ? 'bg-gray-800/30' : 'bg-gray-50'}`}>{t('preferences.externalControl.table.key')}</div>
                <div className={`col-span-8 px-3 py-2 font-medium ${darkMode ? 'bg-gray-800/30' : 'bg-gray-50'}`}>{t('preferences.externalControl.table.action')}</div>

                {visibleEntries.length === 0 ? (
                  <div className={`col-span-12 px-3 py-3 border-t ${darkMode ? 'border-gray-700 text-gray-400' : 'border-gray-200 text-gray-500'}`}>
                    {t('preferences.externalControl.midi.noMappings')}
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
                            {t('preferences.externalControl.midi.actionKey', { action: entry.mapping.action })}
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
                <p className={`text-xs font-medium ${labelClass}`}>{t('preferences.externalControl.midi.quickAssign.label')}</p>
                <p className={`text-[11px] mt-0.5 ${mutedClass}`}>
                  {t('preferences.externalControl.midi.quickAssign.description')}
                </p>

                <div className="mt-2 grid grid-cols-2 gap-2">
                  {quickAssignActions.map(([key, label]) => (
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
                          {t('preferences.externalControl.midi.waiting')}
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
                        {t('preferences.externalControl.midi.waiting')}
                      </>
                    ) : (
                      t('preferences.externalControl.midi.learn')
                    )}
                  </Button>

                  <Button
                    variant="outline"
                    onClick={handleMidiResetMappings}
                    className={darkMode ? 'bg-gray-800 border-gray-600 hover:bg-gray-700 text-gray-300' : ''}
                  >
                    {t('preferences.externalControl.midi.resetDefaults')}
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
          <h4 className={`text-sm font-semibold ${labelClass}`}>{t('preferences.externalControl.osc.title')}</h4>
        </div>

        {!oscStatus?.initialized ? (
          <div className={`text-center py-4 ${mutedClass}`}>
            <p className="text-sm">{t('preferences.externalControl.osc.serverFailed')}</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <label className={`text-sm font-medium ${labelClass}`}>{t('preferences.externalControl.osc.enable.label')}</label>
                <p className={`text-xs ${mutedClass}`}>{t('preferences.externalControl.osc.enable.description')}</p>
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
              <label className={preferenceFieldLabelClass}>{t('preferences.externalControl.osc.listeningPort')}</label>
              <Input
                type="number"
                value={oscStatus?.port || 8000}
                onChange={(e) => handleOscPortChange(e.target.value)}
                min="1"
                max="65535"
                className={inputClass}
              />
              <p className={`text-xs ${mutedClass}`}>{t('preferences.externalControl.osc.requiresRestart')}</p>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <label className={`text-sm font-medium ${labelClass}`}>{t('preferences.externalControl.osc.sendFeedback.label')}</label>
                <p className={`text-xs ${mutedClass}`}>{t('preferences.externalControl.osc.sendFeedback.description')}</p>
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
                <label className={preferenceFieldLabelClass}>{t('preferences.externalControl.osc.feedbackPort')}</label>
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
                {t('preferences.externalControl.osc.connectedClients', { count: oscStatus.connectedClients })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ExternalControlPreferencesSection;
