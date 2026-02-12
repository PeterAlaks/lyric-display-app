/**
 * UserPreferencesModal
 * Two-pane settings modal for user preferences
 * Uses customLayout mode - handles its own scrolling and footer
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Settings, FolderOpen, FileText, Music, Radio, Play, Sliders,
  AlertTriangle, RotateCcw, Check, Loader2, ChevronRight,
  Zap, RefreshCw, HardDrive, Cast, Download, Trash2, Power
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import useToast from '../hooks/useToast';
import useLyricsStore from '../context/LyricsStore';

// Category definitions
const CATEGORIES = [
  { id: 'general', label: 'General', icon: Settings },
  { id: 'parsing', label: 'Lyrics Parsing', icon: FileText },
  { id: 'lineSplitting', label: 'Line Splitting', icon: Sliders },
  { id: 'fileHandling', label: 'File Handling', icon: HardDrive },
  { id: 'externalControls', label: 'External Controls', icon: Radio },
  { id: 'ndi', label: 'NDI', icon: Cast },
  { id: 'autoplay', label: 'Autoplay', icon: Play },
  { id: 'advanced', label: 'Advanced', icon: AlertTriangle },
];

const UserPreferencesModal = ({ darkMode, onClose, initialCategory }) => {
  const [activeCategory, setActiveCategory] = useState(initialCategory || 'general');
  const [preferences, setPreferences] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const [midiStatus, setMidiStatus] = useState(null);
  const [oscStatus, setOscStatus] = useState(null);
  const [midiLearnActive, setMidiLearnActive] = useState(false);
  const [midiRefreshing, setMidiRefreshing] = useState(false);
  // NDI state
  const [ndiStatus, setNdiStatus] = useState({ installed: false, version: '', installPath: '' });
  const [downloadProgress, setDownloadProgress] = useState(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [companionRunning, setCompanionRunning] = useState(false);
  const [ndiAutoLaunch, setNdiAutoLaunch] = useState(false);
  const [ndiUpdateInfo, setNdiUpdateInfo] = useState(null);
  const [ndiCheckingUpdate, setNdiCheckingUpdate] = useState(false);
  const [ndiUpdating, setNdiUpdating] = useState(false);
  const { showToast } = useToast();
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

        // Load NDI status
        if (window.electronAPI?.ndi?.checkInstalled) {
          const ndiResult = await window.electronAPI.ndi.checkInstalled();
          setNdiStatus(ndiResult);
        }
        if (window.electronAPI?.ndi?.getCompanionStatus) {
          const companionResult = await window.electronAPI.ndi.getCompanionStatus();
          setCompanionRunning(companionResult.running);
          if (typeof companionResult.autoLaunch === 'boolean') {
            setNdiAutoLaunch(companionResult.autoLaunch);
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

          // Reload preferences into store to update maxSetlistFiles
          const { loadPreferencesIntoStore } = await import('../context/LyricsStore');
          const useLyricsStore = (await import('../context/LyricsStore')).default;
          await loadPreferencesIntoStore(useLyricsStore);

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
    setMidiRefreshing(true);
    try {
      const result = await window.electronAPI?.midi?.refreshPorts();
      if (result.success) {
        setMidiStatus(prev => ({ ...prev, availablePorts: result.ports }));
      }
    } catch (error) {
      console.error('Failed to refresh MIDI ports:', error);
    } finally {
      setTimeout(() => setMidiRefreshing(false), 500);
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
                className={`!h-7 !w-14 !border-0 shadow-sm transition-colors ${darkMode
                  ? 'data-[state=checked]:bg-green-400 data-[state=unchecked]:bg-gray-600'
                  : 'data-[state=checked]:bg-black data-[state=unchecked]:bg-gray-300'
                  }`}
                thumbClassName="!h-5 !w-6 data-[state=checked]:!translate-x-7 data-[state=unchecked]:!translate-x-1"
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
                className={`!h-7 !w-14 !border-0 shadow-sm transition-colors ${darkMode
                  ? 'data-[state=checked]:bg-green-400 data-[state=unchecked]:bg-gray-600'
                  : 'data-[state=checked]:bg-black data-[state=unchecked]:bg-gray-300'
                  }`}
                thumbClassName="!h-5 !w-6 data-[state=checked]:!translate-x-7 data-[state=unchecked]:!translate-x-1"
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
                className={`!h-7 !w-14 !border-0 shadow-sm transition-colors ${darkMode
                  ? 'data-[state=checked]:bg-green-400 data-[state=unchecked]:bg-gray-600'
                  : 'data-[state=checked]:bg-black data-[state=unchecked]:bg-gray-300'
                  }`}
                thumbClassName="!h-5 !w-6 data-[state=checked]:!translate-x-7 data-[state=unchecked]:!translate-x-1"
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
                className={`!h-7 !w-14 !border-0 shadow-sm transition-colors ${darkMode
                  ? 'data-[state=checked]:bg-green-400 data-[state=unchecked]:bg-gray-600'
                  : 'data-[state=checked]:bg-black data-[state=unchecked]:bg-gray-300'
                  }`}
                thumbClassName="!h-5 !w-6 data-[state=checked]:!translate-x-7 data-[state=unchecked]:!translate-x-1"
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
                className={`!h-7 !w-14 !border-0 shadow-sm transition-colors ${darkMode
                  ? 'data-[state=checked]:bg-green-400 data-[state=unchecked]:bg-gray-600'
                  : 'data-[state=checked]:bg-black data-[state=unchecked]:bg-gray-300'
                  }`}
                thumbClassName="!h-5 !w-6 data-[state=checked]:!translate-x-7 data-[state=unchecked]:!translate-x-1"
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
                className={`!h-7 !w-14 !border-0 shadow-sm transition-colors ${darkMode
                  ? 'data-[state=checked]:bg-green-400 data-[state=unchecked]:bg-gray-600'
                  : 'data-[state=checked]:bg-black data-[state=unchecked]:bg-gray-300'
                  }`}
                thumbClassName="!h-5 !w-6 data-[state=checked]:!translate-x-7 data-[state=unchecked]:!translate-x-1"
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
                Maximum number of songs allowed in a setlist (10-100)
              </p>
              {(preferences.fileHandling?.maxSetlistFiles ?? 50) > 75 && (
                <div className={`flex items-start gap-2 p-2 rounded ${darkMode ? 'bg-yellow-900/20 border border-yellow-600/30' : 'bg-yellow-50 border border-yellow-200'}`}>
                  <AlertTriangle className={`w-4 h-4 mt-0.5 flex-shrink-0 ${darkMode ? 'text-yellow-400' : 'text-yellow-600'}`} />
                  <p className={`text-xs ${darkMode ? 'text-yellow-300' : 'text-yellow-700'}`}>
                    Large setlists may impact performance when loading or switching between songs
                  </p>
                </div>
              )}
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
                      className={`!h-7 !w-14 !border-0 shadow-sm transition-colors ${darkMode
                        ? 'data-[state=checked]:bg-green-400 data-[state=unchecked]:bg-gray-600'
                        : 'data-[state=checked]:bg-black data-[state=unchecked]:bg-gray-300'
                        }`}
                      thumbClassName="!h-5 !w-6 data-[state=checked]:!translate-x-7 data-[state=unchecked]:!translate-x-1"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className={`text-sm font-medium ${labelClass}`}>MIDI Input Device</label>
                      <Button variant="ghost" size="sm" onClick={handleMidiRefreshPorts} disabled={midiRefreshing}>
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
                      className={`!h-7 !w-14 !border-0 shadow-sm transition-colors ${darkMode
                        ? 'data-[state=checked]:bg-green-400 data-[state=unchecked]:bg-gray-600'
                        : 'data-[state=checked]:bg-black data-[state=unchecked]:bg-gray-300'
                        }`}
                      thumbClassName="!h-5 !w-6 data-[state=checked]:!translate-x-7 data-[state=unchecked]:!translate-x-1"
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
                      className={`!h-7 !w-14 !border-0 shadow-sm transition-colors ${darkMode
                        ? 'data-[state=checked]:bg-green-400 data-[state=unchecked]:bg-gray-600'
                        : 'data-[state=checked]:bg-black data-[state=unchecked]:bg-gray-300'
                        }`}
                      thumbClassName="!h-5 !w-6 data-[state=checked]:!translate-x-7 data-[state=unchecked]:!translate-x-1"
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

      case 'ndi': {
        const handleNdiDownload = async () => {
          setIsDownloading(true);
          setDownloadProgress({ percent: 0, status: 'downloading' });

          const cleanup = window.electronAPI?.ndi?.onDownloadProgress((progress) => {
            setDownloadProgress(progress);
          });

          try {
            const result = await window.electronAPI.ndi.download();
            if (result.success) {
              setNdiStatus({ installed: true, version: result.version, installPath: result.path });
              setNdiUpdateInfo(null);
              showToast({ title: 'NDI Installed', message: 'NDI companion has been downloaded and is ready to use.', variant: 'success' });
            } else {
              showToast({ title: 'Download Failed', message: result.error || 'The NDI companion could not be downloaded.', variant: 'error' });
            }
          } catch (error) {
            console.error('NDI download failed:', error);
            showToast({ title: 'Download Failed', message: error?.message || 'An unexpected error occurred while downloading the NDI companion.', variant: 'error' });
          } finally {
            setIsDownloading(false);
            setDownloadProgress(null);
            if (cleanup) cleanup();
          }
        };

        const handleNdiLaunch = async () => {
          try {
            const result = await window.electronAPI?.ndi?.launchCompanion();
            if (result?.success) {
              setCompanionRunning(true);
              showToast({ title: 'NDI Companion Launched', message: 'The NDI companion is now running.', variant: 'success' });
            } else {
              showToast({ title: 'Launch Failed', message: result?.error || 'Could not start the NDI companion.', variant: 'error' });
            }
          } catch (error) {
            console.error('NDI launch failed:', error);
            showToast({ title: 'Launch Failed', message: error?.message || 'An unexpected error occurred while launching the NDI companion.', variant: 'error' });
          }
        };

        const handleNdiStop = async () => {
          try {
            const result = await window.electronAPI?.ndi?.stopCompanion();
            if (result?.success) {
              setCompanionRunning(false);
              showToast({ title: 'NDI Companion Stopped', message: 'The NDI companion has been stopped.', variant: 'info' });
            } else {
              showToast({ title: 'Stop Failed', message: result?.error || 'Could not stop the NDI companion.', variant: 'error' });
            }
          } catch (error) {
            console.error('NDI stop failed:', error);
            showToast({ title: 'Stop Failed', message: error?.message || 'An unexpected error occurred while stopping the NDI companion.', variant: 'error' });
          }
        };

        const handleNdiUninstall = async () => {
          if (!confirm('Are you sure you want to uninstall the NDI companion?')) return;
          try {
            const result = await window.electronAPI?.ndi?.uninstall();
            if (result?.success) {
              setNdiStatus({ installed: false, version: '', installPath: '' });
              setCompanionRunning(false);
              setNdiUpdateInfo(null);
              showToast({ title: 'NDI Uninstalled', message: 'The NDI companion has been removed.', variant: 'success' });
            } else {
              showToast({ title: 'Uninstall Failed', message: result?.error || 'Could not uninstall the NDI companion.', variant: 'error' });
            }
          } catch (error) {
            console.error('NDI uninstall failed:', error);
            showToast({ title: 'Uninstall Failed', message: error?.message || 'An unexpected error occurred while uninstalling the NDI companion.', variant: 'error' });
          }
        };

        const handleNdiAutoLaunchToggle = async (checked) => {
          try {
            await window.electronAPI?.ndi?.setAutoLaunch(checked);
            setNdiAutoLaunch(checked);
          } catch (error) {
            console.error('NDI auto-launch toggle failed:', error);
            showToast({ title: 'Setting Failed', message: 'Could not update the auto-launch setting.', variant: 'error' });
          }
        };

        const handleNdiCheckForUpdate = async () => {
          setNdiCheckingUpdate(true);
          try {
            const result = await window.electronAPI?.ndi?.checkForUpdate();
            if (result) {
              setNdiUpdateInfo(result);
              if (result.updateAvailable) {
                showToast({ title: 'Update Available', message: `NDI Companion v${result.latestVersion} is available.`, variant: 'info' });
              } else {
                showToast({ title: 'Up to Date', message: 'You are running the latest version of the NDI companion.', variant: 'success' });
              }
            }
          } catch (error) {
            console.error('NDI update check failed:', error);
            showToast({ title: 'Check Failed', message: 'Could not check for updates. Please try again later.', variant: 'warning' });
          } finally {
            setNdiCheckingUpdate(false);
          }
        };

        const handleNdiUpdate = async () => {
          setNdiUpdating(true);
          setDownloadProgress({ percent: 0, status: 'downloading' });

          const cleanup = window.electronAPI?.ndi?.onDownloadProgress((progress) => {
            setDownloadProgress(progress);
          });

          try {
            const result = await window.electronAPI.ndi.updateCompanion();
            if (result?.success) {
              setNdiStatus({ installed: true, version: result.version, installPath: result.path });
              setNdiUpdateInfo(null);
              setCompanionRunning(false);
              showToast({ title: 'NDI Companion Updated', message: `Updated to v${result.version}. You can relaunch it now.`, variant: 'success' });
            } else {
              showToast({ title: 'Update Failed', message: result?.error || 'Could not update the NDI companion.', variant: 'error' });
            }
          } catch (error) {
            console.error('NDI update failed:', error);
            showToast({ title: 'Update Failed', message: error?.message || 'An unexpected error occurred while updating.', variant: 'error' });
          } finally {
            setNdiUpdating(false);
            setDownloadProgress(null);
            if (cleanup) cleanup();
          }
        };

        return (
          <div className="space-y-6">
            <p className={`text-sm ${mutedClass}`}>
              The NDI companion broadcasts your lyric outputs as NDI video sources, allowing integration with OBS, vMix, and other NDI-compatible software.
            </p>

            {/* Status Badge */}
            <div className="flex items-center gap-3 flex-wrap">
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${ndiStatus.installed
                ? darkMode ? 'bg-green-900/40 text-green-400' : 'bg-green-100 text-green-700'
                : darkMode ? 'bg-gray-700 text-gray-400' : 'bg-gray-100 text-gray-500'
                }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${ndiStatus.installed ? 'bg-green-400' : 'bg-gray-400'}`} />
                {ndiStatus.installed ? 'Installed' : 'Not Installed'}
              </span>
              {ndiStatus.installed && ndiStatus.version && (
                <span className={`text-xs ${mutedClass}`}>v{ndiStatus.version}</span>
              )}
              {ndiStatus.installed && (
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${companionRunning
                  ? darkMode ? 'bg-blue-900/40 text-blue-400' : 'bg-blue-100 text-blue-700'
                  : darkMode ? 'bg-gray-700 text-gray-400' : 'bg-gray-100 text-gray-500'
                  }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${companionRunning ? 'bg-blue-400 animate-pulse' : 'bg-gray-400'}`} />
                  {companionRunning ? 'Running' : 'Stopped'}
                </span>
              )}
            </div>

            {/* Update Available Banner */}
            {ndiStatus.installed && ndiUpdateInfo?.updateAvailable && (
              <div className={`flex items-start gap-3 p-3 rounded-lg ${darkMode ? 'bg-blue-900/20 border border-blue-600/30' : 'bg-blue-50 border border-blue-200'}`}>
                <Download className={`w-4 h-4 mt-0.5 flex-shrink-0 ${darkMode ? 'text-blue-400' : 'text-blue-600'}`} />
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${darkMode ? 'text-blue-300' : 'text-blue-800'}`}>
                    Update available: v{ndiUpdateInfo.latestVersion}
                  </p>
                  <p className={`text-xs mt-0.5 ${darkMode ? 'text-blue-400/80' : 'text-blue-600'}`}>
                    You have v{ndiUpdateInfo.currentVersion}
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={handleNdiUpdate}
                  disabled={ndiUpdating || isDownloading}
                  className={`flex-shrink-0 ${darkMode ? 'bg-blue-600 hover:bg-blue-700' : 'bg-blue-500 hover:bg-blue-600'} text-white`}
                >
                  {ndiUpdating ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    'Update'
                  )}
                </Button>
              </div>
            )}

            {/* Download progress for updates */}
            {(ndiUpdating || isDownloading) && downloadProgress && (
              <div className="space-y-2">
                <div className={`w-full h-2 rounded-full overflow-hidden ${darkMode ? 'bg-gray-600' : 'bg-gray-200'}`}>
                  <div
                    className="h-full rounded-full bg-blue-500 transition-all duration-300"
                    style={{ width: `${downloadProgress.percent || 0}%` }}
                  />
                </div>
                <p className={`text-xs ${mutedClass}`}>
                  {downloadProgress.status === 'extracting' ? 'Extracting...' : `Downloading... ${downloadProgress.percent || 0}%`}
                </p>
              </div>
            )}

            {!ndiStatus.installed ? (
              /* Not Installed State */
              <div className={`p-4 rounded-lg ${darkMode ? 'bg-gray-700/50' : 'bg-gray-100'}`}>
                <div className="space-y-4">
                  <p className={`text-sm ${labelClass}`}>
                    Download the NDI companion to enable video broadcasting from your lyric outputs.
                  </p>

                  <Button
                    onClick={handleNdiDownload}
                    disabled={isDownloading}
                    className={`w-full ${darkMode ? 'bg-blue-600 hover:bg-blue-700' : 'bg-blue-500 hover:bg-blue-600'} text-white`}
                  >
                    {isDownloading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Downloading...
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4 mr-2" />
                        Download NDI Companion
                      </>
                    )}
                  </Button>
                </div>
              </div>
            ) : (
              /* Installed State */
              <div className="space-y-4">
                {/* Install Path */}
                <div className="space-y-2">
                  <label className={`text-sm font-medium ${labelClass}`}>Install Location</label>
                  <Input
                    value={ndiStatus.installPath || ''}
                    readOnly
                    className={`${inputClass} opacity-70 cursor-default`}
                  />
                </div>

                {/* Auto-launch Toggle */}
                <div className="flex items-center justify-between">
                  <div>
                    <label className={`text-sm font-medium ${labelClass}`}>Start with LyricDisplay</label>
                    <p className={`text-xs ${mutedClass}`}>Launch NDI companion when LyricDisplay opens</p>
                  </div>
                  <Switch
                    checked={ndiAutoLaunch}
                    onCheckedChange={handleNdiAutoLaunchToggle}
                    className={`!h-7 !w-14 !border-0 shadow-sm transition-colors ${darkMode
                      ? 'data-[state=checked]:bg-green-400 data-[state=unchecked]:bg-gray-600'
                      : 'data-[state=checked]:bg-black data-[state=unchecked]:bg-gray-300'
                      }`}
                    thumbClassName="!h-5 !w-6 data-[state=checked]:!translate-x-7 data-[state=unchecked]:!translate-x-1"
                  />
                </div>

                {/* Launch / Stop Buttons */}
                <div className="flex gap-2">
                  {!companionRunning ? (
                    <Button
                      onClick={handleNdiLaunch}
                      className={`flex-1 ${darkMode ? 'bg-green-600 hover:bg-green-700' : 'bg-green-500 hover:bg-green-600'} text-white`}
                    >
                      <Power className="w-4 h-4 mr-2" />
                      Launch NDI Companion
                    </Button>
                  ) : (
                    <Button
                      onClick={handleNdiStop}
                      className={`flex-1 ${darkMode ? 'bg-red-600 hover:bg-red-700' : 'bg-red-500 hover:bg-red-600'} text-white`}
                    >
                      <Power className="w-4 h-4 mr-2" />
                      Stop NDI Companion
                    </Button>
                  )}
                </div>

                {/* Check for Updates */}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={handleNdiCheckForUpdate}
                    disabled={ndiCheckingUpdate}
                    className="flex-1"
                  >
                    {ndiCheckingUpdate ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Checking...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Check for Updates
                      </>
                    )}
                  </Button>
                </div>

                {/* Uninstall */}
                <div className={`pt-4 border-t ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                  <Button
                    variant="outline"
                    onClick={handleNdiUninstall}
                    className={`w-full ${darkMode ? 'border-red-600/50 text-red-400 hover:bg-red-900/20' : 'border-red-300 text-red-600 hover:bg-red-50'}`}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Uninstall NDI Companion
                  </Button>
                </div>
              </div>
            )}
          </div>
        );
      }

      case 'autoplay':
        // Helper to update both preferences file and store immediately
        const updateAutoplaySetting = (key, value) => {
          updatePreference('autoplay', key, value);
          // Also update the store immediately for runtime sync
          const currentSettings = useLyricsStore.getState().autoplaySettings;
          const storeKeyMap = {
            defaultInterval: 'interval',
            defaultLoop: 'loop',
            defaultStartFromFirst: 'startFromFirst',
            defaultSkipBlankLines: 'skipBlankLines'
          };
          const storeKey = storeKeyMap[key];
          if (storeKey) {
            useLyricsStore.getState().setAutoplaySettings({
              ...currentSettings,
              [storeKey]: value
            });
          }
        };

        return (
          <div className="space-y-6">
            <div className="space-y-2">
              <label className={`text-sm font-medium ${labelClass}`}>Default Interval (seconds)</label>
              <Input
                type="number"
                min="1"
                max="60"
                value={preferences.autoplay?.defaultInterval ?? 5}
                onChange={(e) => updateAutoplaySetting('defaultInterval', parseInt(e.target.value) || 5)}
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
                onCheckedChange={(checked) => updateAutoplaySetting('defaultLoop', checked)}
                className={`!h-7 !w-14 !border-0 shadow-sm transition-colors ${darkMode
                  ? 'data-[state=checked]:bg-green-400 data-[state=unchecked]:bg-gray-600'
                  : 'data-[state=checked]:bg-black data-[state=unchecked]:bg-gray-300'
                  }`}
                thumbClassName="!h-5 !w-6 data-[state=checked]:!translate-x-7 data-[state=unchecked]:!translate-x-1"
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <label className={`text-sm font-medium ${labelClass}`}>Start from First Line</label>
                <p className={`text-xs ${mutedClass}`}>Begin autoplay from the first line</p>
              </div>
              <Switch
                checked={preferences.autoplay?.defaultStartFromFirst ?? true}
                onCheckedChange={(checked) => updateAutoplaySetting('defaultStartFromFirst', checked)}
                className={`!h-7 !w-14 !border-0 shadow-sm transition-colors ${darkMode
                  ? 'data-[state=checked]:bg-green-400 data-[state=unchecked]:bg-gray-600'
                  : 'data-[state=checked]:bg-black data-[state=unchecked]:bg-gray-300'
                  }`}
                thumbClassName="!h-5 !w-6 data-[state=checked]:!translate-x-7 data-[state=unchecked]:!translate-x-1"
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <label className={`text-sm font-medium ${labelClass}`}>Skip Blank Lines</label>
                <p className={`text-xs ${mutedClass}`}>Automatically skip empty lines during playback</p>
              </div>
              <Switch
                checked={preferences.autoplay?.defaultSkipBlankLines ?? true}
                onCheckedChange={(checked) => updateAutoplaySetting('defaultSkipBlankLines', checked)}
                className={`!h-7 !w-14 !border-0 shadow-sm transition-colors ${darkMode
                  ? 'data-[state=checked]:bg-green-400 data-[state=unchecked]:bg-gray-600'
                  : 'data-[state=checked]:bg-black data-[state=unchecked]:bg-gray-300'
                  }`}
                thumbClassName="!h-5 !w-6 data-[state=checked]:!translate-x-7 data-[state=unchecked]:!translate-x-1"
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
                className={`!h-7 !w-14 !border-0 shadow-sm transition-colors ${darkMode
                  ? 'data-[state=checked]:bg-green-400 data-[state=unchecked]:bg-gray-600'
                  : 'data-[state=checked]:bg-black data-[state=unchecked]:bg-gray-300'
                  }`}
                thumbClassName="!h-5 !w-6 data-[state=checked]:!translate-x-7 data-[state=unchecked]:!translate-x-1"
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
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${isActive
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
