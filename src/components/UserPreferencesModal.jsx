/**
 * UserPreferencesModal
 * Two-pane settings modal for user preferences
 * Uses customLayout mode - handles its own scrolling and footer
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Settings, FolderOpen, FileText, Music, Radio, Play, Sliders, 
  AlertTriangle, RotateCcw, Check, Loader2, ChevronRight,
  Zap, RefreshCw, HardDrive
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';

// Category definitions
const CATEGORIES = [
  { id: 'general', label: 'General', icon: Settings },
  { id: 'parsing', label: 'Lyrics Parsing', icon: FileText },
  { id: 'lineSplitting', label: 'Line Splitting', icon: Sliders },
  { id: 'fileHandling', label: 'File Handling', icon: HardDrive },
  { id: 'externalControls', label: 'External Controls', icon: Radio },
  { id: 'autoplay', label: 'Autoplay', icon: Play },
  { id: 'advanced', label: 'Advanced', icon: AlertTriangle },
];

const UserPreferencesModal = ({ darkMode, onClose }) => {
  const [activeCategory, setActiveCategory] = useState('general');
  const [preferences, setPreferences] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const [midiStatus, setMidiStatus] = useState(null);
  const [oscStatus, setOscStatus] = useState(null);
  const [midiLearnActive, setMidiLearnActive] = useState(false);
  const saveTimeoutRef = useRef(null);
  const confirmationTimeoutRef = useRef(null);

  // Load preferences on mount
  useEffect(() => {
    const loadPreferences = async () => {
      setLoading(true);
      try {
        if (window.electronAPI?.preferences?.getAll) {
          const result = await window.electronAPI.preferences.getAll();
          if (result.success) {
            setPreferences(result.preferences);
          }
        }

        // Load external control status
        if (window.electronAPI?.externalControl?.getStatus) {
          const statusResult = await window.electronAPI.externalControl.getStatus();
          if (statusResult.success) {
            setMidiStatus(statusResult.midi);
            setOscStatus(statusResult.osc);
          }
        }
      } catch (error) {
        console.error('Failed to load preferences:', error);
      } finally {
        setLoading(false);
      }
    };

    loadPreferences();

    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      if (confirmationTimeoutRef.current) clearTimeout(confirmationTimeoutRef.current);
    };
  }, []);

  // Auto-save preferences when they change
  const savePreferences = useCallback(async (newPreferences) => {
    setSaving(true);
    try {
      if (window.electronAPI?.preferences?.saveAll) {
        const result = await window.electronAPI.preferences.saveAll(newPreferences);
        if (result.success) {
          setLastSaved(new Date());
          // Clear the confirmation after 3 seconds
          if (confirmationTimeoutRef.current) clearTimeout(confirmationTimeoutRef.current);
          confirmationTimeoutRef.current = setTimeout(() => {
            setLastSaved(null);
          }, 3000);
        }
      }
    } catch (error) {
      console.error('Failed to save preferences:', error);
    } finally {
      setSaving(false);
    }
  }, []);

  // Update a preference value with debounced save
  const updatePreference = useCallback((category, key, value) => {
    setPreferences(prev => {
      const newPreferences = {
        ...prev,
        [category]: {
          ...prev[category],
          [key]: value
        }
      };
      
      // Debounce the save
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => {
        savePreferences(newPreferences);
      }, 300);
      
      return newPreferences;
    });
  }, [savePreferences]);

  // Update nested preference (for external controls)
  const updateNestedPreference = useCallback((category, subcategory, key, value) => {
    setPreferences(prev => {
      const newPreferences = {
        ...prev,
        [category]: {
          ...prev[category],
          [subcategory]: {
            ...prev[category]?.[subcategory],
            [key]: value
          }
        }
      };
      
      // Debounce the save
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => {
        savePreferences(newPreferences);
      }, 300);
      
      return newPreferences;
    });
  }, [savePreferences]);

  // Browse for default lyrics path
  const handleBrowseDefaultPath = useCallback(async () => {
    try {
      if (window.electronAPI?.preferences?.browseDefaultPath) {
        const result = await window.electronAPI.preferences.browseDefaultPath();
        if (result.success && result.path) {
          updatePreference('general', 'defaultLyricsPath', result.path);
        }
      }
    } catch (error) {
      console.error('Failed to browse for path:', error);
    }
  }, [updatePreference]);

  // Reset category to defaults
  const handleResetCategory = useCallback(async (category) => {
    try {
      if (window.electronAPI?.preferences?.resetCategory) {
        await window.electronAPI.preferences.resetCategory(category);
        // Reload preferences
        const result = await window.electronAPI.preferences.getAll();
        if (result.success) {
          setPreferences(result.preferences);
          setLastSaved(new Date());
          if (confirmationTimeoutRef.current) clearTimeout(confirmationTimeoutRef.current);
          confirmationTimeoutRef.current = setTimeout(() => {
            setLastSaved(null);
          }, 3000);
        }
      }
    } catch (error) {
      console.error('Failed to reset category:', error);
    }
  }, []);

  // MIDI handlers
  const handleMidiRefreshPorts = useCallback(async () => {
    try {
      const result = await window.electronAPI?.midi?.refreshPorts();
      if (result.success) {
        setMidiStatus(prev => ({ ...prev, availablePorts: result.ports }));
      }
    } catch (error) {
      console.error('Failed to refresh MIDI ports:', error);
    }
  }, []);

  const handleMidiSelectPort = useCallback(async (portIndex) => {
    try {
      const result = await window.electronAPI?.midi?.selectPort(parseInt(portIndex));
      if (result.success) {
        setMidiStatus(prev => ({
          ...prev,
          selectedPortIndex: parseInt(portIndex),
          selectedPort: result.port
        }));
      }
    } catch (error) {
      console.error('Failed to select MIDI port:', error);
    }
  }, []);

  const handleMidiToggle = useCallback(async () => {
    try {
      if (midiStatus?.enabled) {
        await window.electronAPI?.midi?.disable();
        setMidiStatus(prev => ({ ...prev, enabled: false }));
        updateNestedPreference('externalControls', 'midi', 'enabled', false);
      } else {
        await window.electronAPI?.midi?.enable();
        setMidiStatus(prev => ({ ...prev, enabled: true }));
        updateNestedPreference('externalControls', 'midi', 'enabled', true);
      }
    } catch (error) {
      console.error('Failed to toggle MIDI:', error);
    }
  }, [midiStatus?.enabled, updateNestedPreference]);

  const handleMidiLearn = useCallback(async () => {
    setMidiLearnActive(true);
    try {
      const result = await window.electronAPI?.midi?.startLearn(10000);
      if (result.success) {
        console.log('Learned MIDI input:', result.learned);
      }
    } catch (error) {
      console.log('MIDI learn cancelled or timed out');
    } finally {
      setMidiLearnActive(false);
    }
  }, []);

  const handleMidiResetMappings = useCallback(async () => {
    try {
      await window.electronAPI?.midi?.resetMappings();
      const result = await window.electronAPI?.midi?.getStatus();
      if (result.success) {
        setMidiStatus(result.status);
      }
    } catch (error) {
      console.error('Failed to reset MIDI mappings:', error);
    }
  }, []);

  // OSC handlers
  const handleOscToggle = useCallback(async () => {
    try {
      if (oscStatus?.enabled) {
        await window.electronAPI?.osc?.disable();
        setOscStatus(prev => ({ ...prev, enabled: false }));
        updateNestedPreference('externalControls', 'osc', 'enabled', false);
      } else {
        await window.electronAPI?.osc?.enable();
        setOscStatus(prev => ({ ...prev, enabled: true }));
        updateNestedPreference('externalControls', 'osc', 'enabled', true);
      }
    } catch (error) {
      console.error('Failed to toggle OSC:', error);
    }
  }, [oscStatus?.enabled, updateNestedPreference]);

  const handleOscPortChange = useCallback(async (port) => {
    try {
      const result = await window.electronAPI?.osc?.setPort(parseInt(port));
      if (result.success) {
        setOscStatus(prev => ({ ...prev, port: parseInt(port) }));
        updateNestedPreference('externalControls', 'osc', 'port', parseInt(port));
      }
    } catch (error) {
      console.error('Failed to set OSC port:', error);
    }
  }, [updateNestedPreference]);

  const handleOscFeedbackPortChange = useCallback(async (port) => {
    try {
      const result = await window.electronAPI?.osc?.setFeedbackPort(parseInt(port));
      if (result.success) {
        setOscStatus(prev => ({ ...prev, feedbackPort: parseInt(port) }));
        updateNestedPreference('externalControls', 'osc', 'feedbackPort', parseInt(port));
      }
    } catch (error) {
      console.error('Failed to set OSC feedback port:', error);
    }
  }, [updateNestedPreference]);

  const handleOscFeedbackToggle = useCallback(async () => {
    try {
      const newValue = !oscStatus?.feedbackEnabled;
      await window.electronAPI?.osc?.setFeedbackEnabled(newValue);
      setOscStatus(prev => ({ ...prev, feedbackEnabled: newValue }));
      updateNestedPreference('externalControls', 'osc', 'feedbackEnabled', newValue);
    } catch (error) {
      console.error('Failed to toggle OSC feedback:', error);
    }
  }, [oscStatus?.feedbackEnabled, updateNestedPreference]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[500px]">
        <Loader2 className={`w-8 h-8 animate-spin ${darkMode ? 'text-gray-400' : 'text-gray-500'}`} />
      </div>
    );
  }

  const inputClass = darkMode
    ? 'bg-gray-700 border-gray-600 text-gray-200'
    : 'bg-white border-gray-300';

  const labelClass = darkMode ? 'text-gray-200' : 'text-gray-700';
  const mutedClass = darkMode ? 'text-gray-400' : 'text-gray-500';
  const panelBg = darkMode ? 'bg-gray-800' : 'bg-gray-50';
  const activeCategoryBg = darkMode ? 'bg-gray-700' : 'bg-white';

  // Render category content
  const renderCategoryContent = () => {
    if (!preferences) return null;

    switch (activeCategory) {
      case 'general':
        return (
          <div className="space-y-6">
            <div className="space-y-2">
              <label className={`text-sm font-medium ${labelClass}`}>Default Lyrics Location</label>
              <div className="flex gap-2">
                <Input
                  value={preferences.general?.defaultLyricsPath || ''}
                  onChange={(e) => updatePreference('general', 'defaultLyricsPath', e.target.value)}
                  placeholder="Select a default folder..."
                  className={`flex-1 ${inputClass}`}
                />
                <Button variant="outline" onClick={handleBrowseDefaultPath}>
                  <FolderOpen className="w-4 h-4" />
                </Button>
              </div>
              <p className={`text-xs ${mutedClass}`}>
                This folder will open by default when loading lyrics files (Ctrl+O)
              </p>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <label className={`text-sm font-medium ${labelClass}`}>Remember Last Opened Path</label>
                <p className={`text-xs ${mutedClass}`}>Use the last opened folder instead of default</p>
              </div>
              <Switch
                checked={preferences.general?.rememberLastOpenedPath ?? true}
                onCheckedChange={(checked) => updatePreference('general', 'rememberLastOpenedPath', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <label className={`text-sm font-medium ${labelClass}`}>Confirm on Close</label>
                <p className={`text-xs ${mutedClass}`}>Show confirmation when closing with unsaved changes</p>
              </div>
              <Switch
                checked={preferences.general?.confirmOnClose ?? true}
                onCheckedChange={(checked) => updatePreference('general', 'confirmOnClose', checked)}
              />
            </div>
          </div>
        );

      case 'parsing':
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <label className={`text-sm font-medium ${labelClass}`}>Auto Line Grouping</label>
                <p className={`text-xs ${mutedClass}`}>Automatically group consecutive short lines together</p>
              </div>
              <Switch
                checked={preferences.parsing?.enableAutoLineGrouping ?? true}
                onCheckedChange={(checked) => updatePreference('parsing', 'enableAutoLineGrouping', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <label className={`text-sm font-medium ${labelClass}`}>Translation Grouping</label>
                <p className={`text-xs ${mutedClass}`}>Group bracketed lines as translations with main lines</p>
              </div>
              <Switch
                checked={preferences.parsing?.enableTranslationGrouping ?? true}
                onCheckedChange={(checked) => updatePreference('parsing', 'enableTranslationGrouping', checked)}
              />
            </div>

            <div className="space-y-2">
              <label className={`text-sm font-medium ${labelClass}`}>Max Line Length for Grouping</label>
              <Input
                type="number"
                min="20"
                max="100"
                value={preferences.parsing?.maxLineLength ?? 45}
                onChange={(e) => updatePreference('parsing', 'maxLineLength', parseInt(e.target.value) || 45)}
                className={inputClass}
              />
              <p className={`text-xs ${mutedClass}`}>
                Lines shorter than this will be considered for auto-grouping
              </p>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <label className={`text-sm font-medium ${labelClass}`}>Cross Blank Line Grouping</label>
                <p className={`text-xs ${mutedClass}`}>Allow grouping lines separated by blank lines</p>
              </div>
              <Switch
                checked={preferences.parsing?.enableCrossBlankLineGrouping ?? true}
                onCheckedChange={(checked) => updatePreference('parsing', 'enableCrossBlankLineGrouping', checked)}
              />
            </div>

            <div className="space-y-2">
              <label className={`text-sm font-medium ${labelClass}`}>Structure Tag Handling</label>
              <Select
                value={preferences.parsing?.structureTagMode ?? 'isolate'}
                onValueChange={(val) => updatePreference('parsing', 'structureTagMode', val)}
              >
                <SelectTrigger className={inputClass}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className={darkMode ? 'bg-gray-700 border-gray-600' : ''}>
                  <SelectItem value="isolate">Isolate (separate line)</SelectItem>
                  <SelectItem value="strip">Strip (remove tags)</SelectItem>
                  <SelectItem value="keep">Keep (leave as-is)</SelectItem>
                </SelectContent>
              </Select>
              <p className={`text-xs ${mutedClass}`}>
                How to handle [Verse], [Chorus], etc. tags
              </p>
            </div>
          </div>
        );

      case 'lineSplitting':
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <label className={`text-sm font-medium ${labelClass}`}>Enable Line Splitting</label>
                <p className={`text-xs ${mutedClass}`}>Automatically split long lines for better display</p>
              </div>
              <Switch
                checked={preferences.lineSplitting?.enabled ?? true}
                onCheckedChange={(checked) => updatePreference('lineSplitting', 'enabled', checked)}
              />
            </div>

            <div className="space-y-2">
              <label className={`text-sm font-medium ${labelClass}`}>Target Line Length</label>
              <Input
                type="number"
                min="30"
                max="120"
                value={preferences.lineSplitting?.targetLength ?? 60}
                onChange={(e) => updatePreference('lineSplitting', 'targetLength', parseInt(e.target.value) || 60)}
                className={inputClass}
                disabled={!preferences.lineSplitting?.enabled}
              />
              <p className={`text-xs ${mutedClass}`}>
                Ideal character count per line
              </p>
            </div>

            <div className="space-y-2">
              <label className={`text-sm font-medium ${labelClass}`}>Minimum Line Length</label>
              <Input
                type="number"
                min="20"
                max="80"
                value={preferences.lineSplitting?.minLength ?? 40}
                onChange={(e) => updatePreference('lineSplitting', 'minLength', parseInt(e.target.value) || 40)}
                className={inputClass}
                disabled={!preferences.lineSplitting?.enabled}
              />
              <p className={`text-xs ${mutedClass}`}>
                Minimum characters before allowing a line break
              </p>
            </div>

            <div className="space-y-2">
              <label className={`text-sm font-medium ${labelClass}`}>Maximum Line Length</label>
              <Input
                type="number"
                min="50"
                max="150"
                value={preferences.lineSplitting?.maxLength ?? 80}
                onChange={(e) => updatePreference('lineSplitting', 'maxLength', parseInt(e.target.value) || 80)}
                className={inputClass}
                disabled={!preferences.lineSplitting?.enabled}
              />
              <p className={`text-xs ${mutedClass}`}>
                Maximum characters before forcing a line break
              </p>
            </div>

            <div className="space-y-2">
              <label className={`text-sm font-medium ${labelClass}`}>Overflow Tolerance</label>
              <Input
                type="number"
                min="5"
                max="30"
                value={preferences.lineSplitting?.overflowTolerance ?? 15}
                onChange={(e) => updatePreference('lineSplitting', 'overflowTolerance', parseInt(e.target.value) || 15)}
                className={inputClass}
                disabled={!preferences.lineSplitting?.enabled}
              />
              <p className={`text-xs ${mutedClass}`}>
                Extra characters allowed when finding a good break point
              </p>
            </div>
          </div>
        );

      case 'fileHandling':
        return (
          <div className="space-y-6">
            <div className="space-y-2">
              <label className={`text-sm font-medium ${labelClass}`}>Max Recent Files</label>
              <Input
                type="number"
                min="5"
                max="50"
                value={preferences.fileHandling?.maxRecentFiles ?? 10}
                onChange={(e) => updatePreference('fileHandling', 'maxRecentFiles', parseInt(e.target.value) || 10)}
                className={inputClass}
              />
              <p className={`text-xs ${mutedClass}`}>
                Maximum number of files to show in the recent files list
              </p>
            </div>

            <div className="space-y-2">
              <label className={`text-sm font-medium ${labelClass}`}>Max Setlist Files</label>
              <Input
                type="number"
                min="10"
                max="100"
                value={preferences.fileHandling?.maxSetlistFiles ?? 50}
                onChange={(e) => updatePreference('fileHandling', 'maxSetlistFiles', parseInt(e.target.value) || 50)}
                className={inputClass}
              />
              <p className={`text-xs ${mutedClass}`}>
                Maximum number of songs allowed in a setlist
              </p>
            </div>

            <div className="space-y-2">
              <label className={`text-sm font-medium ${labelClass}`}>Max File Size (MB)</label>
              <Input
                type="number"
                min="1"
                max="10"
                step="0.5"
                value={preferences.fileHandling?.maxFileSize ?? 2}
                onChange={(e) => updatePreference('fileHandling', 'maxFileSize', parseFloat(e.target.value) || 2)}
                className={inputClass}
              />
              <p className={`text-xs ${mutedClass}`}>
                Maximum size for lyrics files (larger files may slow down parsing)
              </p>
            </div>
          </div>
        );

      case 'externalControls':
        return (
          <div className="space-y-6">
            {/* MIDI Section */}
            <div className={`p-4 rounded-lg ${darkMode ? 'bg-gray-700/50' : 'bg-gray-100'}`}>
              <div className="flex items-center gap-2 mb-4">
                <Music className="w-5 h-5" />
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
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className={`text-sm font-medium ${labelClass}`}>MIDI Input Device</label>
                      <Button variant="ghost" size="sm" onClick={handleMidiRefreshPorts}>
                        <RefreshCw className="w-4 h-4 mr-1" />
                        Refresh
                      </Button>
                    </div>
                    <Select
                      value={String(midiStatus?.selectedPortIndex ?? -1)}
                      onValueChange={handleMidiSelectPort}
                    >
                      <SelectTrigger className={inputClass}>
                        <SelectValue placeholder="Select MIDI device..." />
                      </SelectTrigger>
                      <SelectContent className={darkMode ? 'bg-gray-700 border-gray-600' : ''}>
                        <SelectItem value="-1">None</SelectItem>
                        {midiStatus?.availablePorts?.map((port) => (
                          <SelectItem key={port.index} value={String(port.index)}>
                            {port.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={handleMidiLearn}
                      disabled={!midiStatus?.enabled || midiLearnActive}
                      className="flex-1"
                    >
                      {midiLearnActive ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Waiting...
                        </>
                      ) : (
                        <>
                          <Zap className="w-4 h-4 mr-2" />
                          Learn MIDI
                        </>
                      )}
                    </Button>
                    <Button variant="outline" onClick={handleMidiResetMappings}>
                      Reset Defaults
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* OSC Section */}
            <div className={`p-4 rounded-lg ${darkMode ? 'bg-gray-700/50' : 'bg-gray-100'}`}>
              <div className="flex items-center gap-2 mb-4">
                <Radio className="w-5 h-5" />
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
                    />
                  </div>

                  <div className="space-y-2">
                    <label className={`text-sm font-medium ${labelClass}`}>Listening Port</label>
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
                    />
                  </div>

                  {oscStatus?.feedbackEnabled && (
                    <div className="space-y-2">
                      <label className={`text-sm font-medium ${labelClass}`}>Feedback Port</label>
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

      case 'autoplay':
        return (
          <div className="space-y-6">
            <div className="space-y-2">
              <label className={`text-sm font-medium ${labelClass}`}>Default Interval (seconds)</label>
              <Input
                type="number"
                min="1"
                max="60"
                value={preferences.autoplay?.defaultInterval ?? 5}
                onChange={(e) => updatePreference('autoplay', 'defaultInterval', parseInt(e.target.value) || 5)}
                className={inputClass}
              />
              <p className={`text-xs ${mutedClass}`}>
                Default time between automatic line transitions
              </p>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <label className={`text-sm font-medium ${labelClass}`}>Loop at End</label>
                <p className={`text-xs ${mutedClass}`}>Return to first line after reaching the end</p>
              </div>
              <Switch
                checked={preferences.autoplay?.defaultLoop ?? true}
                onCheckedChange={(checked) => updatePreference('autoplay', 'defaultLoop', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <label className={`text-sm font-medium ${labelClass}`}>Start from First Line</label>
                <p className={`text-xs ${mutedClass}`}>Begin autoplay from the first line</p>
              </div>
              <Switch
                checked={preferences.autoplay?.defaultStartFromFirst ?? true}
                onCheckedChange={(checked) => updatePreference('autoplay', 'defaultStartFromFirst', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <label className={`text-sm font-medium ${labelClass}`}>Skip Blank Lines</label>
                <p className={`text-xs ${mutedClass}`}>Automatically skip empty lines during playback</p>
              </div>
              <Switch
                checked={preferences.autoplay?.defaultSkipBlankLines ?? true}
                onCheckedChange={(checked) => updatePreference('autoplay', 'defaultSkipBlankLines', checked)}
              />
            </div>
          </div>
        );

      case 'advanced':
        return (
          <div className="space-y-6">
            <div className={`p-4 rounded-lg border ${darkMode ? 'border-yellow-600/50 bg-yellow-900/20' : 'border-yellow-400 bg-yellow-50'}`}>
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className={`w-4 h-4 ${darkMode ? 'text-yellow-400' : 'text-yellow-600'}`} />
                <span className={`text-sm font-medium ${darkMode ? 'text-yellow-400' : 'text-yellow-700'}`}>
                  Advanced Settings
                </span>
              </div>
              <p className={`text-xs ${darkMode ? 'text-yellow-300/80' : 'text-yellow-700'}`}>
                These settings are for advanced users. Changing them may affect application stability.
              </p>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <label className={`text-sm font-medium ${labelClass}`}>Debug Logging</label>
                <p className={`text-xs ${mutedClass}`}>Enable verbose logging for troubleshooting</p>
              </div>
              <Switch
                checked={preferences.advanced?.enableDebugLogging ?? false}
                onCheckedChange={(checked) => updatePreference('advanced', 'enableDebugLogging', checked)}
              />
            </div>

            <div className="space-y-2">
              <label className={`text-sm font-medium ${labelClass}`}>Connection Timeout (ms)</label>
              <Input
                type="number"
                min="5000"
                max="60000"
                step="1000"
                value={preferences.advanced?.connectionTimeout ?? 10000}
                onChange={(e) => updatePreference('advanced', 'connectionTimeout', parseInt(e.target.value) || 10000)}
                className={inputClass}
              />
            </div>

            <div className="space-y-2">
              <label className={`text-sm font-medium ${labelClass}`}>Heartbeat Interval (ms)</label>
              <Input
                type="number"
                min="10000"
                max="120000"
                step="5000"
                value={preferences.advanced?.heartbeatInterval ?? 30000}
                onChange={(e) => updatePreference('advanced', 'heartbeatInterval', parseInt(e.target.value) || 30000)}
                className={inputClass}
              />
            </div>

            <div className="space-y-2">
              <label className={`text-sm font-medium ${labelClass}`}>Max Connection Attempts</label>
              <Input
                type="number"
                min="3"
                max="20"
                value={preferences.advanced?.maxConnectionAttempts ?? 10}
                onChange={(e) => updatePreference('advanced', 'maxConnectionAttempts', parseInt(e.target.value) || 10)}
                className={inputClass}
              />
            </div>

            <Button
              variant="outline"
              onClick={() => handleResetCategory('advanced')}
              className="w-full"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Reset Advanced Settings to Defaults
            </Button>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col h-[500px]">
      {/* Main Content - Two Pane Layout */}
      <div className="flex flex-1 min-h-0">
        {/* Left Pane - Categories */}
        <div className={`w-48 flex-shrink-0 border-r ${darkMode ? 'border-gray-700' : 'border-gray-200'} ${panelBg}`}>
          <nav className="p-2 space-y-1">
            {CATEGORIES.map((category) => {
              const Icon = category.icon;
              const isActive = activeCategory === category.id;
              return (
                <button
                  key={category.id}
                  onClick={() => setActiveCategory(category.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                    isActive
                      ? `${activeCategoryBg} ${darkMode ? 'text-white' : 'text-gray-900'} shadow-sm`
                      : `${darkMode ? 'text-gray-400 hover:text-gray-200 hover:bg-gray-700/50' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'}`
                  }`}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  <span className="text-sm font-medium truncate">{category.label}</span>
                  {isActive && <ChevronRight className="w-4 h-4 ml-auto flex-shrink-0" />}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Right Pane - Settings (scrollable) */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="mb-6">
            <h3 className={`text-lg font-semibold ${labelClass}`}>
              {CATEGORIES.find(c => c.id === activeCategory)?.label}
            </h3>
          </div>
          {renderCategoryContent()}
        </div>
      </div>

      {/* Fixed Footer */}
      <div className={`flex items-center justify-center px-6 py-3 border-t flex-shrink-0 rounded-b-2xl ${darkMode ? 'border-gray-700 bg-gray-800/50' : 'border-gray-200 bg-gray-50'}`}>
        <div className={`text-xs ${mutedClass} flex items-center gap-2`}>
          {saving ? (
            <>
              <Loader2 className="w-3 h-3 animate-spin" />
              <span>Saving...</span>
            </>
          ) : lastSaved ? (
            <>
              <Check className={`w-3 h-3 ${darkMode ? 'text-green-400' : 'text-green-600'}`} />
              <span className={darkMode ? 'text-green-400' : 'text-green-600'}>Settings saved</span>
            </>
          ) : (
            <span>Changes are saved automatically</span>
          )}
        </div>
      </div>
    </div>
  );
};

export default UserPreferencesModal;
