import { Check, ChevronRight, Music, Radio, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const ExternalControlPreferencesSection = ({
  darkMode,
  handleMidiRefreshPorts,
  handleMidiSelectPort,
  handleMidiToggle,
  handleOscFeedbackPortChange,
  handleOscFeedbackToggle,
  handleOscAllowedSourcesChange,
  handleOscPortChange,
  handleOscRateLimitChange,
  handleOscRemoteAccessToggle,
  handleOscToggle,
  getNumberPreferenceInputProps,
  inputClass,
  labelClass,
  midiRefreshing,
  midiStatus,
  mutedClass,
  onOpenMidiMappings,
  oscStatus,
  preferenceFieldLabelClass,
}) => {
  const selectContentClass = darkMode
    ? 'bg-gray-700 border-gray-600 text-gray-200'
    : 'bg-white border-gray-300';
  const midiMappingCount = Object.keys(midiStatus?.mappings?.notes || {}).length
    + Object.keys(midiStatus?.mappings?.controlChanges || {}).length;

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

            <button
              type="button"
              onClick={onOpenMidiMappings}
              className={`-mx-3 flex w-[calc(100%+1.5rem)] items-center gap-4 rounded-lg px-3 py-2.5 text-left transition-colors ${darkMode ? 'hover:bg-gray-700/60' : 'hover:bg-gray-100'}`}
              aria-label={`Manage ${midiMappingCount} MIDI ${midiMappingCount === 1 ? 'mapping' : 'mappings'}`}
            >
              <div className="min-w-0 flex-1">
                <span className={`text-sm font-medium ${labelClass}`}>MIDI Mappings</span>
                <p className={`text-xs ${mutedClass}`}>View mappings and assign actions to MIDI controls</p>
              </div>
              <span className={`shrink-0 text-xs ${mutedClass}`}>{midiMappingCount}</span>
              <ChevronRight className={`h-4 w-4 shrink-0 ${mutedClass}`} />
            </button>
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
                min="1"
                max="65535"
                {...getNumberPreferenceInputProps('externalControl', 'oscPort', {
                  min: 1,
                  max: 65535,
                  fallbackValue: 8000,
                  currentValue: oscStatus?.port,
                  parse: 'int',
                }, handleOscPortChange)}
                className={inputClass}
              />
              <p className={`text-xs ${mutedClass}`}>Requires restart to take effect</p>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <label className={`text-sm font-medium ${labelClass}`}>Allow OSC from LAN</label>
                <p className={`text-xs ${mutedClass}`}>Off binds OSC to this computer only. Interface changes require restart.</p>
              </div>
              <Switch
                checked={oscStatus?.remoteAccessEnabled || false}
                onCheckedChange={handleOscRemoteAccessToggle}
                className={`!h-7 !w-14 !border-0 shadow-sm transition-colors ${darkMode
                  ? 'data-[state=checked]:bg-amber-400 data-[state=unchecked]:bg-gray-600'
                  : 'data-[state=checked]:bg-amber-600 data-[state=unchecked]:bg-gray-300'
                  }`}
                thumbClassName="!h-5 !w-6 data-[state=checked]:!translate-x-7 data-[state=unchecked]:!translate-x-1"
              />
            </div>

            {oscStatus?.remoteAccessEnabled && (
              <div className="space-y-2">
                <label className={preferenceFieldLabelClass}>Allowed Source IPs</label>
                <Input
                  key={(oscStatus?.allowedSources || []).join(',')}
                  type="text"
                  defaultValue={(oscStatus?.allowedSources || []).join(', ')}
                  placeholder="Empty allows any LAN source"
                  onBlur={(event) => handleOscAllowedSourcesChange(event.target.value)}
                  className={inputClass}
                />
                <p className={`text-xs ${mutedClass}`}>Comma-separated IPv4 addresses. Leave empty only on a trusted production network.</p>
              </div>
            )}

            <div className="space-y-2">
              <label className={preferenceFieldLabelClass}>Messages per Second</label>
              <Input
                type="number"
                min="5"
                max="200"
                {...getNumberPreferenceInputProps('externalControl', 'oscRateLimit', {
                  min: 5,
                  max: 200,
                  fallbackValue: 30,
                  currentValue: oscStatus?.rateLimit,
                  parse: 'int',
                }, handleOscRateLimitChange)}
                className={inputClass}
              />
              <p className={`text-xs ${mutedClass}`}>Per-source limit; excess packets are dropped before reaching live controls.</p>
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
                  min="1"
                  max="65535"
                  {...getNumberPreferenceInputProps('externalControl', 'oscFeedbackPort', {
                    min: 1,
                    max: 65535,
                    fallbackValue: 9000,
                    currentValue: oscStatus?.feedbackPort,
                    parse: 'int',
                  }, handleOscFeedbackPortChange)}
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
