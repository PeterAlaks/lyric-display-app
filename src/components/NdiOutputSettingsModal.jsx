/**
 * NdiOutputSettingsModal
 * Per-output NDI broadcast settings: enable/disable, source name, resolution, framerate.
 * Opened from the NDI button in OutputSettingsPanel and StageSettingsPanel.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Cast, Power, Monitor, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import useToast from '../hooks/useToast';

const RESOLUTION_PRESETS = [
  { value: '720p', label: '720p (1280×720)' },
  { value: '1080p', label: '1080p (1920×1080)' },
  { value: '4k', label: '4K (3840×2160)' },
  { value: 'custom', label: 'Custom' },
];

const FRAMERATE_OPTIONS = [
  { value: 15, label: '15 fps' },
  { value: 24, label: '24 fps' },
  { value: 25, label: '25 fps' },
  { value: 30, label: '30 fps' },
  { value: 50, label: '50 fps' },
  { value: 60, label: '60 fps' },
];

const OUTPUT_LABELS = {
  output1: 'Output 1',
  output2: 'Output 2',
  stage: 'Stage',
};

const NdiOutputSettingsModal = ({ darkMode, outputKey, onClose }) => {
  const [settings, setSettings] = useState(null);
  const [companionRunning, setCompanionRunning] = useState(false);
  const [loading, setLoading] = useState(true);
  const { showToast } = useToast();

  const outputLabel = OUTPUT_LABELS[outputKey] || outputKey;

  // Load settings on mount
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const result = await window.electronAPI?.ndi?.getOutputSettings(outputKey);
        if (result?.settings) {
          setSettings(result.settings);
          setCompanionRunning(result.companionConnected || false);
        }
        const status = await window.electronAPI?.ndi?.getCompanionStatus();
        if (status) {
          setCompanionRunning(status.running || false);
        }
      } catch (error) {
        console.error('Failed to load NDI output settings:', error);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [outputKey]);

  // Listen for companion status changes
  useEffect(() => {
    const cleanup = window.electronAPI?.ndi?.onCompanionStatus((status) => {
      setCompanionRunning(status.running || false);
    });
    return () => { if (cleanup) cleanup(); };
  }, []);

  const updateSetting = useCallback(async (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));

    try {
      switch (key) {
        case 'enabled':
          await window.electronAPI?.ndi?.setOutputEnabled(outputKey, value);
          break;
        case 'sourceName':
          await window.electronAPI?.ndi?.setSourceName(outputKey, value);
          break;
        case 'resolution':
          await window.electronAPI?.ndi?.setResolution(outputKey, value);
          break;
        case 'framerate':
          await window.electronAPI?.ndi?.setFramerate(outputKey, value);
          break;
      }
    } catch (error) {
      console.error(`Failed to update NDI setting ${key}:`, error);
      showToast({ title: 'Setting Failed', message: `Could not update ${key}.`, variant: 'error' });
    }
  }, [outputKey, showToast]);

  const updateCustomResolution = useCallback(async (width, height) => {
    setSettings(prev => ({
      ...prev,
      resolution: 'custom',
      customWidth: width,
      customHeight: height
    }));

    try {
      await window.electronAPI?.ndi?.setCustomResolution(outputKey, width, height);
    } catch (error) {
      console.error('Failed to update custom resolution:', error);
      showToast({ title: 'Setting Failed', message: 'Could not update custom resolution.', variant: 'error' });
    }
  }, [outputKey, showToast]);

  if (loading || !settings) {
    return (
      <div className="flex items-center justify-center h-[200px]">
        <div className={`w-6 h-6 border-2 border-t-transparent rounded-full animate-spin ${darkMode ? 'border-gray-400' : 'border-gray-500'}`} />
      </div>
    );
  }

  const inputClass = darkMode
    ? 'bg-gray-700 border-gray-600 text-gray-200'
    : 'bg-white border-gray-300';
  const labelClass = darkMode ? 'text-gray-200' : 'text-gray-700';
  const mutedClass = darkMode ? 'text-gray-400' : 'text-gray-500';

  const isBroadcasting = settings.enabled && companionRunning;

  return (
    <div className="overflow-y-auto px-6 py-5" style={{ maxHeight: 'calc(100vh - 260px)' }}>
      <div className="space-y-5">
        {/* Status */}
        <div className="flex items-center gap-3">
          <Cast className={`w-5 h-5 ${isBroadcasting ? (darkMode ? 'text-green-400' : 'text-green-600') : (darkMode ? 'text-gray-500' : 'text-gray-400')}`} />
          <div>
            <p className={`text-sm font-medium ${labelClass}`}>
              NDI Broadcast — {outputLabel}
            </p>
            <p className={`text-xs ${mutedClass}`}>
              {isBroadcasting
                ? `Broadcasting as "${settings.sourceName}"`
                : settings.enabled && !companionRunning
                  ? 'Enabled but companion is not running'
                  : 'Not broadcasting'
              }
            </p>
          </div>
          <span className={`ml-auto inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${isBroadcasting
            ? darkMode ? 'bg-green-900/40 text-green-400' : 'bg-green-100 text-green-700'
            : darkMode ? 'bg-gray-700 text-gray-400' : 'bg-gray-100 text-gray-500'
            }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${isBroadcasting ? 'bg-green-400 animate-pulse' : 'bg-gray-400'}`} />
            {isBroadcasting ? 'Live' : 'Off'}
          </span>
        </div>

        {/* Enable Toggle */}
        <div className="flex items-center justify-between">
          <div>
            <label className={`text-sm font-medium ${labelClass}`}>Enable NDI Output</label>
            <p className={`text-xs ${mutedClass}`}>Broadcast this output as an NDI source</p>
          </div>
          <Switch
            checked={settings.enabled || false}
            onCheckedChange={(checked) => updateSetting('enabled', checked)}
            className={`!h-7 !w-14 !border-0 shadow-sm transition-colors ${darkMode
              ? 'data-[state=checked]:bg-green-400 data-[state=unchecked]:bg-gray-600'
              : 'data-[state=checked]:bg-black data-[state=unchecked]:bg-gray-300'
              }`}
            thumbClassName="!h-5 !w-6 data-[state=checked]:!translate-x-7 data-[state=unchecked]:!translate-x-1"
          />
        </div>

        {/* Source Name */}
        <div className="space-y-2">
          <label className={`text-sm font-medium ${labelClass}`}>Source Name</label>
          <Input
            value={settings.sourceName || ''}
            onChange={(e) => updateSetting('sourceName', e.target.value)}
            placeholder={`LyricDisplay ${outputLabel}`}
            className={inputClass}
          />
          <p className={`text-xs ${mutedClass}`}>
            This name appears in NDI receivers (OBS, vMix, etc.)
          </p>
        </div>

        {/* Resolution */}
        <div className="space-y-2">
          <label className={`text-sm font-medium ${labelClass}`}>Resolution</label>
          <Select
            value={settings.resolution || '1080p'}
            onValueChange={(val) => updateSetting('resolution', val)}
          >
            <SelectTrigger className={inputClass}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent className={darkMode ? 'bg-gray-700 border-gray-600' : ''}>
              {RESOLUTION_PRESETS.map(preset => (
                <SelectItem key={preset.value} value={preset.value}>
                  {preset.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Custom Resolution Inputs */}
          {settings.resolution === 'custom' && (
            <div className="flex gap-3 items-center mt-2">
              <div className="flex-1">
                <label className={`text-xs ${mutedClass} mb-1 block`}>Width</label>
                <Input
                  type="number"
                  min="320"
                  max="7680"
                  value={settings.customWidth || 1920}
                  onChange={(e) => {
                    const w = Math.max(320, Math.min(7680, parseInt(e.target.value) || 1920));
                    updateCustomResolution(w, settings.customHeight || 1080);
                  }}
                  className={inputClass}
                />
              </div>
              <span className={`text-sm ${mutedClass} mt-5`}>×</span>
              <div className="flex-1">
                <label className={`text-xs ${mutedClass} mb-1 block`}>Height</label>
                <Input
                  type="number"
                  min="240"
                  max="4320"
                  value={settings.customHeight || 1080}
                  onChange={(e) => {
                    const h = Math.max(240, Math.min(4320, parseInt(e.target.value) || 1080));
                    updateCustomResolution(settings.customWidth || 1920, h);
                  }}
                  className={inputClass}
                />
              </div>
            </div>
          )}
        </div>

        {/* Framerate */}
        <div className="space-y-2">
          <label className={`text-sm font-medium ${labelClass}`}>Framerate</label>
          <Select
            value={String(settings.framerate || 30)}
            onValueChange={(val) => updateSetting('framerate', parseInt(val, 10))}
          >
            <SelectTrigger className={inputClass}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent className={darkMode ? 'bg-gray-700 border-gray-600' : ''}>
              {FRAMERATE_OPTIONS.map(opt => (
                <SelectItem key={opt.value} value={String(opt.value)}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className={`text-xs ${mutedClass}`}>
            Higher framerates use more CPU. 30fps is recommended for lyrics.
          </p>
        </div>

        {/* Companion Status Note */}
        {settings.enabled && !companionRunning && (
          <div className={`flex items-start gap-2 p-3 rounded-lg ${darkMode ? 'bg-yellow-900/20 border border-yellow-600/30' : 'bg-yellow-50 border border-yellow-200'}`}>
            <Zap className={`w-4 h-4 mt-0.5 flex-shrink-0 ${darkMode ? 'text-yellow-400' : 'text-yellow-600'}`} />
            <p className={`text-xs ${darkMode ? 'text-yellow-300' : 'text-yellow-700'}`}>
              The NDI companion is not running. Launch it from Preferences → NDI to start broadcasting.
            </p>
          </div>
        )}

        {/* Bottom spacer so content isn't hidden behind the modal footer */}
        <div className="h-4" />
      </div>
    </div>
  );
};

export default NdiOutputSettingsModal;
