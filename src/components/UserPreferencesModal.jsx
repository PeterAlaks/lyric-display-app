/**
 * UserPreferencesModal
 * Two-pane settings modal for user preferences
 * Uses customLayout mode - handles its own scrolling and footer
 */

import React, { useState } from 'react';
import {
  Settings, FolderOpen, FileText, Radio, Play, Sliders,
  AlertTriangle, RotateCcw, Loader2,
  HardDrive, Cast, Palette, Wand2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import useToast from '../hooks/useToast';
import useLyricsStore from '../context/LyricsStore';
import useModal from '../hooks/useModal';
import { useLiveSafetyBridge } from '../hooks/useLiveSafetyBridge';
import {
  DEFAULT_SETLIST_ITEMS,
  MAX_SETLIST_ITEMS,
  MIN_SETLIST_ITEMS,
  SETLIST_PERFORMANCE_WARNING_ITEMS,
} from '../../shared/setlistLimits.js';
import { useMidiPreferences } from '../hooks/UserPreferencesModal/useMidiPreferences';
import { useNdiPreferences } from '../hooks/UserPreferencesModal/useNdiPreferences';
import { useNumberPreferenceDrafts } from '../hooks/UserPreferencesModal/useNumberPreferenceDrafts';
import { useOscPreferences } from '../hooks/UserPreferencesModal/useOscPreferences';
import { usePreferencesPersistence } from '../hooks/UserPreferencesModal/usePreferencesPersistence';
import { useSecurityPreferences } from '../hooks/UserPreferencesModal/useSecurityPreferences';
import AdvancedPreferencesSection from './UserPreferencesModal/AdvancedPreferencesSection';
import ExternalControlPreferencesSection from './UserPreferencesModal/ExternalControlPreferencesSection';
import NdiPreferencesSection from './UserPreferencesModal/NdiPreferencesSection';
import UserPreferencesLayout from './UserPreferencesModal/UserPreferencesLayout';
import { normalizeLineSplittingConfig } from '../../shared/lyricsParsing.js';

// Category definitions
const CATEGORIES = [
  { id: 'general', label: 'General', icon: Settings },
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'fileHandling', label: 'File Handling', icon: HardDrive },
  {
    id: 'parsing',
    label: 'Lyrics Parsing',
    icon: FileText,
    info: 'Controls how imported lyrics are arranged for display. When line splitting is on, it runs first; eligible short lines can then be combined into groups using the limits below.',
  },
  { id: 'formatting', label: 'Lyrics Formatting', icon: Wand2 },
  {
    id: 'lineSplitting',
    label: 'Line Splitting',
    icon: Sliders,
    info: 'Breaks long imported lyrics at natural word boundaries for easier reading. Minimum sets when a break may happen, Target guides the preferred length, and Maximum prevents lines from running too long.',
  },
  { id: 'externalControl', label: 'External Control', icon: Radio },
  { id: 'ndi', label: 'NDI', icon: Cast },
  { id: 'autoplay', label: 'Autoplay', icon: Play },
  { id: 'advanced', label: 'Advanced', icon: AlertTriangle },
];

const UserPreferencesModal = ({ darkMode, onClose, initialCategory }) => {
  const [activeCategory, setActiveCategory] = useState(initialCategory || 'general');
  const { showToast } = useToast();
  const { showModal } = useModal();
  const { liveSafety, setLiveSafetyEnabled, isAuthenticated, ready } = useLiveSafetyBridge();
  const {
    handleBrowseDefaultPath,
    handleResetCategory,
    lastSaved,
    loading,
    midiStatus,
    oscStatus,
    preferences,
    saveError,
    saving,
    setMidiStatus,
    setOscStatus,
    updateNestedPreference,
    updatePreference,
    updatePreferenceGroup,
  } = usePreferencesPersistence({ showToast });

  const {
    getNumberPreferenceInputProps,
  } = useNumberPreferenceDrafts({ preferences, updatePreference });

  const {
    formatSecurityDate,
    handleRotateSecurityTokenKey,
    loadSecurityStatus,
    securityLoading,
    securityRotating,
    securityStatus,
  } = useSecurityPreferences({ activeCategory, showModal, showToast });

  const {
    handleMidiAssignAction,
    handleMidiLearn,
    handleMidiRefreshPorts,
    handleMidiResetMappings,
    handleMidiSelectPort,
    handleMidiToggle,
    lastLearnedMidi,
    midiAssigningAction,
    midiLearnActive,
    midiMappingsExpanded,
    midiRefreshing,
    setMidiMappingsExpanded,
  } = useMidiPreferences({ midiStatus, setMidiStatus, showToast, updateNestedPreference });

  const {
    handleOscFeedbackPortChange,
    handleOscFeedbackToggle,
    handleOscAllowedSourcesChange,
    handleOscPortChange,
    handleOscRateLimitChange,
    handleOscRemoteAccessToggle,
    handleOscToggle,
  } = useOscPreferences({ oscStatus, setOscStatus, updateNestedPreference, showToast });

  const {
    companionRunning,
    companionStarting,
    companionReady,
    companionBootstrapError,
    downloadProgress,
    handleNdiAutoLaunchToggle,
    handleNdiCancelDownload,
    handleNdiCheckForUpdate,
    handleNdiDownload,
    handleNdiLaunch,
    handleNdiStop,
    handleNdiUninstall,
    handleNdiUpdate,
    isDownloading,
    ndiAutoLaunch,
    ndiCheckingUpdate,
    ndiStatus,
    ndiTelemetry,
    ndiUpdateInfo,
    ndiUpdating,
  } = useNdiPreferences({ showModal, showToast });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[500px]">
        <Loader2 className={`w-8 h-8 animate-spin ${darkMode ? 'text-gray-400' : 'text-gray-500'}`} />
      </div>
    );
  }

  const inputClass = darkMode
    ? 'bg-gray-700 border-gray-600 text-gray-300'
    : 'bg-white border-gray-300';
  const selectContentClass = darkMode
    ? 'bg-gray-700 border-gray-600 text-gray-200'
    : 'bg-white border-gray-300';

  const labelClass = darkMode ? 'text-gray-300' : 'text-gray-700';
  const mutedClass = darkMode ? 'text-gray-400' : 'text-gray-500';
  const panelBg = darkMode ? 'bg-gray-800' : 'bg-[#f8fafc]';
  const activeCategoryBg = darkMode ? 'bg-gray-700' : 'bg-white';
  const preferenceFieldLabelClass = `block mb-1.5 text-sm font-medium ${labelClass}`;
  const preferenceToggleRowClass = "flex items-center justify-between gap-6 [&>button]:shrink-0";
  const preferenceToggleTextClass = "min-w-0 flex-1";
  const previewLinesLocked = Boolean(liveSafety?.enabled);
  const splitMinimum = Number(preferences?.lineSplitting?.minLength ?? 40);
  const splitTarget = Number(preferences?.lineSplitting?.targetLength ?? 60);
  const splitMaximum = Number(preferences?.lineSplitting?.maxLength ?? 80);
  const hasInvalidSplitRelationship = splitMinimum > splitTarget || splitTarget > splitMaximum;
  const commitLineSplittingPreference = (key, value) => {
    const normalized = normalizeLineSplittingConfig({
      ...(preferences?.lineSplitting || {}),
      [key]: value,
    });
    updatePreferenceGroup('lineSplitting', {
      targetLength: normalized.TARGET_LENGTH,
      minLength: normalized.MIN_LENGTH,
      maxLength: normalized.MAX_LENGTH,
      overflowTolerance: normalized.OVERFLOW_TOLERANCE,
    });
  };

  // Render category content
  const renderCategoryContent = () => {
    if (!preferences) return null;

    switch (activeCategory) {
      case 'general':
        return (
          <div className="space-y-6">
            <div className={preferenceToggleRowClass}>
              <div className={preferenceToggleTextClass}>
                <label className={`text-sm font-medium ${labelClass}`}>Live Safety Mode</label>
                <p className={`text-xs ${mutedClass}`}>Limit secondary controllers to line navigation during service</p>
              </div>
              <Switch
                checked={Boolean(liveSafety?.enabled)}
                disabled={!isAuthenticated || !ready}
                onCheckedChange={(checked) => {
                  updatePreference('general', 'liveSafetyMode', checked);
                  setLiveSafetyEnabled(checked, { persistPreference: false });
                }}
                className={`!h-7 !w-14 !border-0 shadow-sm transition-colors ${darkMode
                  ? 'data-[state=checked]:bg-green-400 data-[state=unchecked]:bg-gray-600'
                  : 'data-[state=checked]:bg-black data-[state=unchecked]:bg-gray-300'
                  }`}
                thumbClassName="!h-5 !w-6 data-[state=checked]:!translate-x-7 data-[state=unchecked]:!translate-x-1"
              />
            </div>

            <div
              className={`${preferenceToggleRowClass} ${previewLinesLocked ? 'cursor-not-allowed' : ''}`}
              aria-disabled={previewLinesLocked}
            >
              <div className={`${preferenceToggleTextClass} ${previewLinesLocked ? 'opacity-50' : ''}`}>
                <label className={`text-sm font-medium ${labelClass}`}>Preview Lyric Lines</label>
                <p className={`text-xs ${mutedClass}`}>
                  First click previews a lyric line; double-click or Enter sends it live.
                  {previewLinesLocked ? ' Live Safety requires this setting.' : ''}
                </p>
              </div>
              <Switch
                checked={previewLinesLocked || (preferences.general?.previewLines ?? false)}
                disabled={previewLinesLocked}
                onCheckedChange={(checked) => {
                  updatePreference('general', 'previewLines', checked);
                  useLyricsStore.getState().setPreviewLinesEnabled(checked);
                }}
                className={`!h-7 !w-14 !border-0 shadow-sm transition-colors ${darkMode
                  ? 'data-[state=checked]:bg-green-400 data-[state=unchecked]:bg-gray-600'
                  : 'data-[state=checked]:bg-black data-[state=unchecked]:bg-gray-300'
                  }`}
                thumbClassName="!h-5 !w-6 data-[state=checked]:!translate-x-7 data-[state=unchecked]:!translate-x-1"
              />
            </div>

            <div className={preferenceToggleRowClass}>
              <div className={preferenceToggleTextClass}>
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

            <div className={preferenceToggleRowClass}>
              <div className={preferenceToggleTextClass}>
                <label className={`text-sm font-medium ${labelClass}`}>Auto-check for updates on startup</label>
                <p className={`text-xs ${mutedClass}`}>Automatically check for all available updates</p>
              </div>
              <Switch
                checked={preferences.general?.autoCheckForUpdates ?? true}
                onCheckedChange={(checked) => updatePreference('general', 'autoCheckForUpdates', checked)}
                className={`!h-7 !w-14 !border-0 shadow-sm transition-colors ${darkMode
                  ? 'data-[state=checked]:bg-green-400 data-[state=unchecked]:bg-gray-600'
                  : 'data-[state=checked]:bg-black data-[state=unchecked]:bg-gray-300'
                  }`}
                thumbClassName="!h-5 !w-6 data-[state=checked]:!translate-x-7 data-[state=unchecked]:!translate-x-1"
              />
            </div>

            <div className={preferenceToggleRowClass}>
              <div className={preferenceToggleTextClass}>
                <label className={`text-sm font-medium ${labelClass}`}>Toast Sounds</label>
                <p className={`text-xs ${mutedClass}`}>Play notification sounds when toast messages appear</p>
              </div>
              <Switch
                checked={!(preferences.general?.toastSoundsMuted ?? false)}
                onCheckedChange={(checked) => {
                  const muted = !checked;
                  updatePreference('general', 'toastSoundsMuted', muted);

                  useLyricsStore.getState().setToastSoundsMuted(muted);
                }}
                className={`!h-7 !w-14 !border-0 shadow-sm transition-colors ${darkMode
                  ? 'data-[state=checked]:bg-green-400 data-[state=unchecked]:bg-gray-600'
                  : 'data-[state=checked]:bg-black data-[state=unchecked]:bg-gray-300'
                  }`}
                thumbClassName="!h-5 !w-6 data-[state=checked]:!translate-x-7 data-[state=unchecked]:!translate-x-1"
              />
            </div>

            <div className={preferenceToggleRowClass}>
              <div className={preferenceToggleTextClass}>
                <label className={`text-sm font-medium ${labelClass}`}>Skip Section Titles with Arrow Keys</label>
                <p className={`text-xs ${mutedClass}`}>Move between lyric lines while keeping section headers available in the editor</p>
              </div>
              <Switch
                checked={preferences.general?.skipSectionTitlesOnKeyboard ?? true}
                onCheckedChange={(checked) => {
                  updatePreference('general', 'skipSectionTitlesOnKeyboard', checked);
                  useLyricsStore.getState().setSkipSectionTitlesOnKeyboard(checked);
                }}
                className={`!h-7 !w-14 !border-0 shadow-sm transition-colors ${darkMode
                  ? 'data-[state=checked]:bg-green-400 data-[state=unchecked]:bg-gray-600'
                  : 'data-[state=checked]:bg-black data-[state=unchecked]:bg-gray-300'
                  }`}
                thumbClassName="!h-5 !w-6 data-[state=checked]:!translate-x-7 data-[state=unchecked]:!translate-x-1"
              />
            </div>
          </div>
        );

      case 'appearance': {
        const currentThemeMode = useLyricsStore.getState().themeMode || 'light';

        const handleThemeModeChange = async (newMode) => {

          useLyricsStore.getState().setThemeMode(newMode);

          let effectiveDark;
          if (window.electronAPI?.syncNativeThemeSource) {
            const result = await window.electronAPI.syncNativeThemeSource(newMode);
            if (result?.success) {
              effectiveDark = result.shouldUseDarkColors;
            } else {
              effectiveDark = newMode === 'dark';
            }
          } else {
            effectiveDark = newMode === 'system'
              ? (window.matchMedia?.('(prefers-color-scheme: dark)')?.matches ?? false)
              : newMode === 'dark';
          }

          useLyricsStore.getState().setDarkMode(effectiveDark);

          if (window.electronAPI?.setDarkMode) {
            window.electronAPI.setDarkMode(effectiveDark);
          }

          updatePreference('appearance', 'themeMode', newMode);
        };

        return (
          <div className="space-y-6">
            <div className="space-y-2">
              <label className={preferenceFieldLabelClass}>App Theme</label>
              <Select
                value={currentThemeMode}
                onValueChange={handleThemeModeChange}
              >
                <SelectTrigger className={inputClass}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className={selectContentClass}>
                  <SelectItem value="light">Light Mode</SelectItem>
                  <SelectItem value="dark">Dark Mode</SelectItem>
                  <SelectItem value="system">System Default</SelectItem>
                </SelectContent>
              </Select>
              <p className={`text-xs ${mutedClass}`}>
                Choose the application color theme. "System Default" follows your operating system's theme setting.
              </p>
              {currentThemeMode === 'system' && (
                <div className={`flex items-start gap-2 p-3 rounded-lg mt-3 ${darkMode ? 'bg-blue-900/20 border border-blue-600/30' : 'bg-blue-50 border border-blue-200'}`}>
                  <p className={`text-xs ${darkMode ? 'text-blue-300' : 'text-blue-700'}`}>
                    When using System Default, the dark mode toggle in the control panel and the View menu will be disabled. The app will automatically switch between light and dark mode based on your system preferences.
                  </p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between">
              <div>
                <label className={`text-sm font-medium ${labelClass}`}>Show Tooltips</label>
                <p className={`text-xs ${mutedClass}`}>Display helpful tooltips when hovering over controls</p>
              </div>
              <Switch
                checked={preferences.appearance?.showTooltips ?? true}
                onCheckedChange={(checked) => {
                  updatePreference('appearance', 'showTooltips', checked);
                  // Update the store immediately for runtime sync
                  useLyricsStore.getState().setShowTooltips(checked);
                }}
                className={`!h-7 !w-14 !border-0 shadow-sm transition-colors ${darkMode
                  ? 'data-[state=checked]:bg-green-400 data-[state=unchecked]:bg-gray-600'
                  : 'data-[state=checked]:bg-black data-[state=unchecked]:bg-gray-300'
                  }`}
                thumbClassName="!h-5 !w-6 data-[state=checked]:!translate-x-7 data-[state=unchecked]:!translate-x-1"
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <label className={`text-sm font-medium ${labelClass}`}>Show Tutorial Popovers</label>
                <p className={`text-xs ${mutedClass}`}>Show short guidance popovers for helpful app markers and features</p>
              </div>
              <Switch
                checked={preferences.appearance?.showTutorialPopovers ?? true}
                onCheckedChange={(checked) => {
                  updatePreference('appearance', 'showTutorialPopovers', checked);
                  useLyricsStore.getState().setShowTutorialPopovers(checked);
                  window.dispatchEvent(new CustomEvent('tutorial-popovers-preference-updated', {
                    detail: { showTutorialPopovers: checked }
                  }));
                }}
                className={`!h-7 !w-14 !border-0 shadow-sm transition-colors ${darkMode
                  ? 'data-[state=checked]:bg-green-400 data-[state=unchecked]:bg-gray-600'
                  : 'data-[state=checked]:bg-black data-[state=unchecked]:bg-gray-300'
                  }`}
                thumbClassName="!h-5 !w-6 data-[state=checked]:!translate-x-7 data-[state=unchecked]:!translate-x-1"
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <label className={`text-sm font-medium ${labelClass}`}>Show Canvas Quick Actions</label>
                <p className={`text-xs ${mutedClass}`}>Show Add Translation and Add Timestamp buttons near the cursor in the song editor</p>
              </div>
              <Switch
                checked={preferences.appearance?.showCanvasFloatingToolbar ?? true}
                onCheckedChange={(checked) => {
                  updatePreference('appearance', 'showCanvasFloatingToolbar', checked);
                  useLyricsStore.getState().setShowCanvasFloatingToolbar(checked);
                }}
                className={`!h-7 !w-14 !border-0 shadow-sm transition-colors ${darkMode
                  ? 'data-[state=checked]:bg-green-400 data-[state=unchecked]:bg-gray-600'
                  : 'data-[state=checked]:bg-black data-[state=unchecked]:bg-gray-300'
                  }`}
                thumbClassName="!h-5 !w-6 data-[state=checked]:!translate-x-7 data-[state=unchecked]:!translate-x-1"
              />
            </div>
          </div>
        );
      }

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

            <div className="space-y-2">
              <label className={preferenceFieldLabelClass}>Maximum Number of Lines per Group</label>
              <Input
                type="number"
                min="2"
                max="12"
                {...getNumberPreferenceInputProps('parsing', 'maxLinesPerGroup', {
                  min: 2,
                  max: 12,
                  fallbackValue: 2,
                  parse: 'int',
                })}
                className={inputClass}
              />
              <p className={`text-xs ${mutedClass}`}>
                Used by automatic parsing and manual grouping in the lyrics list
              </p>
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
              <label className={preferenceFieldLabelClass}>Max Line Length for Grouping</label>
              <Input
                type="number"
                min="20"
                max="100"
                {...getNumberPreferenceInputProps('parsing', 'maxLineLength', {
                  min: 20,
                  max: 100,
                  fallbackValue: 45,
                  parse: 'int',
                })}
                className={inputClass}
              />
              <p className={`text-xs ${mutedClass}`}>
                Eligibility limit for automatic parsing and manual grouping in the lyrics list
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
                disabled={!(preferences.parsing?.enableAutoLineGrouping ?? true)}
                className={`!h-7 !w-14 !border-0 shadow-sm transition-colors ${darkMode
                  ? 'data-[state=checked]:bg-green-400 data-[state=unchecked]:bg-gray-600'
                  : 'data-[state=checked]:bg-black data-[state=unchecked]:bg-gray-300'
                  }`}
                thumbClassName="!h-5 !w-6 data-[state=checked]:!translate-x-7 data-[state=unchecked]:!translate-x-1"
              />
            </div>

            <div className="space-y-2">
              <label className={preferenceFieldLabelClass}>Structure Tag Handling</label>
              <Select
                value={preferences.parsing?.structureTagMode ?? 'isolate'}
                onValueChange={(val) => updatePreference('parsing', 'structureTagMode', val)}
              >
                <SelectTrigger className={inputClass}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className={selectContentClass}>
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

      case 'formatting':
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <label className={`text-sm font-medium ${labelClass}`}>Auto Cleanup on Paste</label>
                <p className={`text-xs ${mutedClass}`}>Automatically format and clean up lyrics when pasting into the song canvas</p>
              </div>
              <Switch
                checked={preferences.formatting?.enableCleanupOnPaste ?? true}
                onCheckedChange={(checked) => {
                  updatePreference('formatting', 'enableCleanupOnPaste', checked);
                  useLyricsStore.getState().setCanvasCleanupOnPaste(checked);
                }}
                className={`!h-7 !w-14 !border-0 shadow-sm transition-colors ${darkMode
                  ? 'data-[state=checked]:bg-green-400 data-[state=unchecked]:bg-gray-600'
                  : 'data-[state=checked]:bg-black data-[state=unchecked]:bg-gray-300'
                  }`}
                thumbClassName="!h-5 !w-6 data-[state=checked]:!translate-x-7 data-[state=unchecked]:!translate-x-1"
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <label className={`text-sm font-medium ${labelClass}`}>Capitalize First Letter</label>
                <p className={`text-xs ${mutedClass}`}>Automatically capitalize the first letter of each lyric line during cleanup</p>
              </div>
              <Switch
                checked={preferences.formatting?.capitalizeFirstLetter ?? true}
                onCheckedChange={(checked) => {
                  updatePreference('formatting', 'capitalizeFirstLetter', checked);
                  useLyricsStore.getState().setFormattingCapitalizeFirstLetter(checked);
                }}
                className={`!h-7 !w-14 !border-0 shadow-sm transition-colors ${darkMode
                  ? 'data-[state=checked]:bg-green-400 data-[state=unchecked]:bg-gray-600'
                  : 'data-[state=checked]:bg-black data-[state=unchecked]:bg-gray-300'
                  }`}
                thumbClassName="!h-5 !w-6 data-[state=checked]:!translate-x-7 data-[state=unchecked]:!translate-x-1"
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <label className={`text-sm font-medium ${labelClass}`}>Capitalize Religious Terms</label>
                <p className={`text-xs ${mutedClass}`}>Auto-capitalize words like Jesus, God, Holy Spirit, Hallelujah, etc.</p>
              </div>
              <Switch
                checked={preferences.formatting?.capitalizeReligiousTerms ?? true}
                onCheckedChange={(checked) => {
                  updatePreference('formatting', 'capitalizeReligiousTerms', checked);
                  useLyricsStore.getState().setFormattingCapitalizeReligiousTerms(checked);
                }}
                className={`!h-7 !w-14 !border-0 shadow-sm transition-colors ${darkMode
                  ? 'data-[state=checked]:bg-green-400 data-[state=unchecked]:bg-gray-600'
                  : 'data-[state=checked]:bg-black data-[state=unchecked]:bg-gray-300'
                  }`}
                thumbClassName="!h-5 !w-6 data-[state=checked]:!translate-x-7 data-[state=unchecked]:!translate-x-1"
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <label className={`text-sm font-medium ${labelClass}`}>Normalize Typographic Characters</label>
                <p className={`text-xs ${mutedClass}`}>Convert smart quotes, em dashes, and other typographic characters to plain equivalents</p>
              </div>
              <Switch
                checked={preferences.formatting?.normalizeTypographicChars ?? true}
                onCheckedChange={(checked) => {
                  updatePreference('formatting', 'normalizeTypographicChars', checked);
                  useLyricsStore.getState().setFormattingNormalizeTypographicChars(checked);
                }}
                className={`!h-7 !w-14 !border-0 shadow-sm transition-colors ${darkMode
                  ? 'data-[state=checked]:bg-green-400 data-[state=unchecked]:bg-gray-600'
                  : 'data-[state=checked]:bg-black data-[state=unchecked]:bg-gray-300'
                  }`}
                thumbClassName="!h-5 !w-6 data-[state=checked]:!translate-x-7 data-[state=unchecked]:!translate-x-1"
              />
            </div>
          </div>
        );

      case 'lineSplitting':
        return (
          <div className="space-y-6">
            {hasInvalidSplitRelationship && (
              <div className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-xs ${darkMode ? 'border-amber-700 bg-amber-950/30 text-amber-200' : 'border-amber-300 bg-amber-50 text-amber-800'}`}>
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>The current values overlap. Parsing will safely constrain the target between the configured minimum and maximum.</span>
              </div>
            )}

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
              <label className={preferenceFieldLabelClass}>Target Line Length</label>
              <Input
                type="number"
                min="30"
                max="120"
                {...getNumberPreferenceInputProps('lineSplitting', 'targetLength', {
                  min: 30,
                  max: 120,
                  fallbackValue: 60,
                  parse: 'int',
                }, (value) => commitLineSplittingPreference('targetLength', value))}
                className={inputClass}
                disabled={!preferences.lineSplitting?.enabled}
              />
              <p className={`text-xs ${mutedClass}`}>
                Ideal character count per line; related limits are reconciled when changed
              </p>
            </div>

            <div className="space-y-2">
              <label className={preferenceFieldLabelClass}>Minimum Line Length</label>
              <Input
                type="number"
                min="20"
                max="80"
                {...getNumberPreferenceInputProps('lineSplitting', 'minLength', {
                  min: 20,
                  max: 80,
                  fallbackValue: 40,
                  parse: 'int',
                }, (value) => commitLineSplittingPreference('minLength', value))}
                className={inputClass}
                disabled={!preferences.lineSplitting?.enabled}
              />
              <p className={`text-xs ${mutedClass}`}>
                Minimum characters before allowing a line break
              </p>
            </div>

            <div className="space-y-2">
              <label className={preferenceFieldLabelClass}>Maximum Line Length</label>
              <Input
                type="number"
                min="50"
                max="150"
                {...getNumberPreferenceInputProps('lineSplitting', 'maxLength', {
                  min: 50,
                  max: 150,
                  fallbackValue: 80,
                  parse: 'int',
                }, (value) => commitLineSplittingPreference('maxLength', value))}
                className={inputClass}
                disabled={!preferences.lineSplitting?.enabled}
              />
              <p className={`text-xs ${mutedClass}`}>
                Maximum characters before forcing a line break
              </p>
            </div>

            <div className="space-y-2">
              <label className={preferenceFieldLabelClass}>Overflow Tolerance</label>
              <Input
                type="number"
                min="5"
                max="30"
                {...getNumberPreferenceInputProps('lineSplitting', 'overflowTolerance', {
                  min: 5,
                  max: 30,
                  fallbackValue: 15,
                  parse: 'int',
                }, (value) => commitLineSplittingPreference('overflowTolerance', value))}
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
            <div className="flex items-center justify-between">
              <div>
                <label className={`text-sm font-medium ${labelClass}`}>Remember Last Opened Path</label>
                <p className={`text-xs ${mutedClass}`}>Use the last opened folder instead of default</p>
              </div>
              <Switch
                checked={preferences.fileHandling?.rememberLastOpenedPath ?? true}
                onCheckedChange={(checked) => updatePreference('fileHandling', 'rememberLastOpenedPath', checked)}
                className={`!h-7 !w-14 !border-0 shadow-sm transition-colors ${darkMode
                  ? 'data-[state=checked]:bg-green-400 data-[state=unchecked]:bg-gray-600'
                  : 'data-[state=checked]:bg-black data-[state=unchecked]:bg-gray-300'
                  }`}
                thumbClassName="!h-5 !w-6 data-[state=checked]:!translate-x-7 data-[state=unchecked]:!translate-x-1"
              />
            </div>

            <div className="space-y-2">
              <label className={preferenceFieldLabelClass}>Default Lyrics Folder</label>
              <div className="flex gap-2">
                <Input
                  value={preferences.fileHandling?.defaultLyricsPath || ''}
                  onChange={(e) => updatePreference('fileHandling', 'defaultLyricsPath', e.target.value)}
                  placeholder="Select a default folder..."
                  className={`flex-1 ${inputClass}`}
                  disabled={preferences.fileHandling?.rememberLastOpenedPath ?? true}
                />
                <Button
                  variant="outline"
                  onClick={handleBrowseDefaultPath}
                  className={darkMode ? 'bg-gray-800 border-gray-600 hover:bg-gray-700 text-gray-300' : ''}
                  disabled={preferences.fileHandling?.rememberLastOpenedPath ?? true}
                >
                  <FolderOpen className="w-4 h-4" />
                </Button>
              </div>
              <p className={`text-xs ${mutedClass}`}>
                This folder will open by default when loading lyrics files (Ctrl+O). Disabled when "Remember Last Opened Path" is enabled.
              </p>
            </div>
            <div className="space-y-2">
              <label className={preferenceFieldLabelClass}>Max Recent Files</label>
              <Input
                type="number"
                min="5"
                max="50"
                {...getNumberPreferenceInputProps('fileHandling', 'maxRecentFiles', {
                  min: 5,
                  max: 50,
                  fallbackValue: 10,
                  parse: 'int',
                })}
                className={inputClass}
              />
              <p className={`text-xs ${mutedClass}`}>
                Maximum number of files to show in the recent files list
              </p>
            </div>

            <div className="space-y-2">
              <label className={preferenceFieldLabelClass}>Max Setlist Files</label>
              <Input
                type="number"
                min={MIN_SETLIST_ITEMS}
                max={MAX_SETLIST_ITEMS}
                {...getNumberPreferenceInputProps('fileHandling', 'maxSetlistFiles', {
                  min: MIN_SETLIST_ITEMS,
                  max: MAX_SETLIST_ITEMS,
                  fallbackValue: DEFAULT_SETLIST_ITEMS,
                  parse: 'int',
                })}
                className={inputClass}
              />
              <p className={`text-xs ${mutedClass}`}>
                Maximum number of songs allowed in a setlist ({MIN_SETLIST_ITEMS}-{MAX_SETLIST_ITEMS})
              </p>
              {(preferences.fileHandling?.maxSetlistFiles ?? DEFAULT_SETLIST_ITEMS) > SETLIST_PERFORMANCE_WARNING_ITEMS && (
                <div className={`flex items-start gap-2 p-2 rounded ${darkMode ? 'bg-yellow-900/20 border border-yellow-600/30' : 'bg-yellow-50 border border-yellow-200'}`}>
                  <AlertTriangle className={`w-4 h-4 mt-0.5 shrink-0 ${darkMode ? 'text-yellow-400' : 'text-yellow-600'}`} />
                  <p className={`text-xs ${darkMode ? 'text-yellow-300' : 'text-yellow-700'}`}>
                    Large setlists may impact performance when loading or switching between songs
                  </p>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <label className={preferenceFieldLabelClass}>Max File Size (MB)</label>
              <Input
                type="number"
                min="1"
                max="10"
                step="0.5"
                {...getNumberPreferenceInputProps('fileHandling', 'maxFileSize', {
                  min: 1,
                  max: 10,
                  fallbackValue: 2,
                  parse: 'float',
                })}
                className={inputClass}
              />
              <p className={`text-xs ${mutedClass}`}>
                Maximum size for lyrics files (larger files may slow down parsing)
              </p>
            </div>
          </div>
        );

      case 'externalControl':
        return (
          <ExternalControlPreferencesSection
            darkMode={darkMode}
            handleMidiAssignAction={handleMidiAssignAction}
            handleMidiLearn={handleMidiLearn}
            handleMidiRefreshPorts={handleMidiRefreshPorts}
            handleMidiResetMappings={handleMidiResetMappings}
            handleMidiSelectPort={handleMidiSelectPort}
            handleMidiToggle={handleMidiToggle}
            handleOscFeedbackPortChange={handleOscFeedbackPortChange}
            handleOscFeedbackToggle={handleOscFeedbackToggle}
            handleOscAllowedSourcesChange={handleOscAllowedSourcesChange}
            handleOscPortChange={handleOscPortChange}
            handleOscRateLimitChange={handleOscRateLimitChange}
            handleOscRemoteAccessToggle={handleOscRemoteAccessToggle}
            handleOscToggle={handleOscToggle}
            getNumberPreferenceInputProps={getNumberPreferenceInputProps}
            inputClass={inputClass}
            labelClass={labelClass}
            lastLearnedMidi={lastLearnedMidi}
            midiAssigningAction={midiAssigningAction}
            midiLearnActive={midiLearnActive}
            midiMappingsExpanded={midiMappingsExpanded}
            midiRefreshing={midiRefreshing}
            midiStatus={midiStatus}
            mutedClass={mutedClass}
            oscStatus={oscStatus}
            preferenceFieldLabelClass={preferenceFieldLabelClass}
            setMidiMappingsExpanded={setMidiMappingsExpanded}
          />
        );
      case 'ndi':
        return (
          <NdiPreferencesSection
            companionRunning={companionRunning}
            companionStarting={companionStarting}
            companionReady={companionReady}
            companionBootstrapError={companionBootstrapError}
            darkMode={darkMode}
            downloadProgress={downloadProgress}
            handleNdiAutoLaunchToggle={handleNdiAutoLaunchToggle}
            handleNdiCancelDownload={handleNdiCancelDownload}
            handleNdiDownload={handleNdiDownload}
            handleNdiUpdate={handleNdiUpdate}
            inputClass={inputClass}
            isDownloading={isDownloading}
            labelClass={labelClass}
            mutedClass={mutedClass}
            ndiAutoLaunch={ndiAutoLaunch}
            ndiStatus={ndiStatus}
            ndiTelemetry={ndiTelemetry}
            ndiUpdateInfo={ndiUpdateInfo}
            ndiUpdating={ndiUpdating}
            preferenceFieldLabelClass={preferenceFieldLabelClass}
          />
        );
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
              <label className={preferenceFieldLabelClass}>Default Interval (seconds)</label>
              <Input
                type="number"
                min="1"
                max="60"
                {...getNumberPreferenceInputProps('autoplay', 'defaultInterval', {
                  min: 1,
                  max: 60,
                  fallbackValue: 5,
                  parse: 'int',
                }, (value) => updateAutoplaySetting('defaultInterval', value))}
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
          <AdvancedPreferencesSection
            darkMode={darkMode}
            formatSecurityDate={formatSecurityDate}
            getNumberPreferenceInputProps={getNumberPreferenceInputProps}
            handleResetCategory={handleResetCategory}
            handleRotateSecurityTokenKey={handleRotateSecurityTokenKey}
            inputClass={inputClass}
            labelClass={labelClass}
            loadSecurityStatus={loadSecurityStatus}
            mutedClass={mutedClass}
            preferenceFieldLabelClass={preferenceFieldLabelClass}
            preferences={preferences}
            securityLoading={securityLoading}
            securityRotating={securityRotating}
            securityStatus={securityStatus}
            showModal={showModal}
            showToast={showToast}
            updatePreference={updatePreference}
            updatePreferenceGroup={updatePreferenceGroup}
          />
        );

      default:
        return null;
    }
  };

  return (
    <UserPreferencesLayout
      activeCategory={activeCategory}
      activeCategoryBg={activeCategoryBg}
      categories={CATEGORIES}
      companionRunning={companionRunning}
      companionStarting={companionStarting}
      darkMode={darkMode}
      handleNdiCheckForUpdate={handleNdiCheckForUpdate}
      handleNdiLaunch={handleNdiLaunch}
      handleNdiStop={handleNdiStop}
      handleNdiUninstall={handleNdiUninstall}
      labelClass={labelClass}
      lastSaved={lastSaved}
      mutedClass={mutedClass}
      ndiCheckingUpdate={ndiCheckingUpdate}
      ndiStatus={ndiStatus}
      panelBg={panelBg}
      saveError={saveError}
      saving={saving}
      setActiveCategory={setActiveCategory}
    >
      {renderCategoryContent()}
    </UserPreferencesLayout>
  );
};

export default UserPreferencesModal;
