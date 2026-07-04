/**
 * UserPreferencesModal
 * Two-pane settings modal for user preferences
 * Uses customLayout mode - handles its own scrolling and footer
 */

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
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
import i18n, { normalizeLanguageCode, SUPPORTED_LANGUAGES } from '../i18n';

// Category definitions
const CATEGORIES = [
  { id: 'general', label: 'General', icon: Settings },
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'fileHandling', label: 'File Handling', icon: HardDrive },
  { id: 'parsing', label: 'Lyrics Parsing', icon: FileText },
  { id: 'formatting', label: 'Lyrics Formatting', icon: Wand2 },
  { id: 'lineSplitting', label: 'Line Splitting', icon: Sliders },
  { id: 'externalControl', label: 'External Control', icon: Radio },
  { id: 'ndi', label: 'NDI', icon: Cast },
  { id: 'autoplay', label: 'Autoplay', icon: Play },
  { id: 'advanced', label: 'Advanced', icon: AlertTriangle },
];

const UserPreferencesModal = ({ darkMode, onClose, initialCategory }) => {
  const { t } = useTranslation();
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
    saving,
    setMidiStatus,
    setOscStatus,
    updateNestedPreference,
    updatePreference,
  } = usePreferencesPersistence({ showToast });

  const {
    commitNumberPreference,
    getNumberInputValue,
    handleNumberInputKeyDown,
    setNumberInputDraft,
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
    handleOscPortChange,
    handleOscToggle,
  } = useOscPreferences({ oscStatus, setOscStatus, updateNestedPreference });

  const {
    companionRunning,
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

  const categories = CATEGORIES.map((category) => ({
    ...category,
    label: t(`preferences.categories.${category.id}`),
  }));

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

  const labelClass = darkMode ? 'text-gray-300' : 'text-gray-700';
  const mutedClass = darkMode ? 'text-gray-400' : 'text-gray-500';
  const panelBg = darkMode ? 'bg-gray-800' : 'bg-[#f8fafc]';
  const activeCategoryBg = darkMode ? 'bg-gray-700' : 'bg-white';
  const preferenceFieldLabelClass = `block mb-1.5 text-sm font-medium ${labelClass}`;
  const preferenceToggleRowClass = "flex items-center justify-between gap-6 [&>button]:shrink-0";
  const preferenceToggleTextClass = "min-w-0 flex-1";

  // Render category content
  const renderCategoryContent = () => {
    if (!preferences) return null;

    switch (activeCategory) {
      case 'general':
        return (
          <div className="space-y-6">
            <div className="space-y-2">
              <label className={preferenceFieldLabelClass}>{t('preferences.general.appLanguage.label')}</label>
              <Select
                value={normalizeLanguageCode(preferences.general?.appLanguage)}
                onValueChange={(language) => {
                  const normalizedLanguage = normalizeLanguageCode(language);
                  updatePreference('general', 'appLanguage', normalizedLanguage);
                  useLyricsStore.getState().setAppLanguage(normalizedLanguage);
                  i18n.changeLanguage(normalizedLanguage);
                }}
              >
                <SelectTrigger className={inputClass}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className={darkMode ? 'bg-gray-700 border-gray-600' : ''}>
                  {SUPPORTED_LANGUAGES.map((language) => (
                    <SelectItem key={language.code} value={language.code}>
                      {language.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className={`text-xs ${mutedClass}`}>
                {t('preferences.general.appLanguage.description')}
              </p>
            </div>

            <div className={preferenceToggleRowClass}>
              <div className={preferenceToggleTextClass}>
                <label className={`text-sm font-medium ${labelClass}`}>{t('preferences.general.liveSafetyMode.label')}</label>
                <p className={`text-xs ${mutedClass}`}>{t('preferences.general.liveSafetyMode.description')}</p>
              </div>
              <Switch
                checked={Boolean(liveSafety?.enabled)}
                disabled={!isAuthenticated || !ready}
                onCheckedChange={(checked) => setLiveSafetyEnabled(checked)}
                className={`!h-7 !w-14 !border-0 shadow-sm transition-colors ${darkMode
                  ? 'data-[state=checked]:bg-green-400 data-[state=unchecked]:bg-gray-600'
                  : 'data-[state=checked]:bg-black data-[state=unchecked]:bg-gray-300'
                  }`}
                thumbClassName="!h-5 !w-6 data-[state=checked]:!translate-x-7 data-[state=unchecked]:!translate-x-1"
              />
            </div>

            <div className={preferenceToggleRowClass}>
              <div className={preferenceToggleTextClass}>
                <label className={`text-sm font-medium ${labelClass}`}>{t('preferences.general.confirmOnClose.label')}</label>
                <p className={`text-xs ${mutedClass}`}>{t('preferences.general.confirmOnClose.description')}</p>
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
                <label className={`text-sm font-medium ${labelClass}`}>{t('preferences.general.autoCheckForUpdates.label')}</label>
                <p className={`text-xs ${mutedClass}`}>{t('preferences.general.autoCheckForUpdates.description')}</p>
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
                <label className={`text-sm font-medium ${labelClass}`}>{t('preferences.general.toastSounds.label')}</label>
                <p className={`text-xs ${mutedClass}`}>{t('preferences.general.toastSounds.description')}</p>
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
                <label className={`text-sm font-medium ${labelClass}`}>{t('preferences.general.skipSectionTitlesOnKeyboard.label')}</label>
                <p className={`text-xs ${mutedClass}`}>{t('preferences.general.skipSectionTitlesOnKeyboard.description')}</p>
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
              <label className={preferenceFieldLabelClass}>{t('preferences.appearance.appTheme.label')}</label>
              <Select
                value={currentThemeMode}
                onValueChange={handleThemeModeChange}
              >
                <SelectTrigger className={inputClass}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className={darkMode ? 'bg-gray-700 border-gray-600' : ''}>
                  <SelectItem value="light">{t('preferences.appearance.themeOptions.light')}</SelectItem>
                  <SelectItem value="dark">{t('preferences.appearance.themeOptions.dark')}</SelectItem>
                  <SelectItem value="system">{t('preferences.appearance.themeOptions.system')}</SelectItem>
                </SelectContent>
              </Select>
              <p className={`text-xs ${mutedClass}`}>
                {t('preferences.appearance.appTheme.description')}
              </p>
              {currentThemeMode === 'system' && (
                <div className={`flex items-start gap-2 p-3 rounded-lg mt-3 ${darkMode ? 'bg-blue-900/20 border border-blue-600/30' : 'bg-blue-50 border border-blue-200'}`}>
                  <p className={`text-xs ${darkMode ? 'text-blue-300' : 'text-blue-700'}`}>
                    {t('preferences.appearance.appTheme.systemNote')}
                  </p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between">
              <div>
                <label className={`text-sm font-medium ${labelClass}`}>{t('preferences.appearance.showTooltips.label')}</label>
                <p className={`text-xs ${mutedClass}`}>{t('preferences.appearance.showTooltips.description')}</p>
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
                <label className={`text-sm font-medium ${labelClass}`}>{t('preferences.appearance.showTutorialPopovers.label')}</label>
                <p className={`text-xs ${mutedClass}`}>{t('preferences.appearance.showTutorialPopovers.description')}</p>
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
                <label className={`text-sm font-medium ${labelClass}`}>{t('preferences.appearance.showCanvasQuickActions.label')}</label>
                <p className={`text-xs ${mutedClass}`}>{t('preferences.appearance.showCanvasQuickActions.description')}</p>
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
                <label className={`text-sm font-medium ${labelClass}`}>{t('preferences.parsing.autoLineGrouping.label')}</label>
                <p className={`text-xs ${mutedClass}`}>{t('preferences.parsing.autoLineGrouping.description')}</p>
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

            {(preferences.parsing?.enableAutoLineGrouping ?? true) && (
              <div className="space-y-2">
                <label className={preferenceFieldLabelClass}>{t('preferences.parsing.maxLinesPerGroup.label')}</label>
                <Input
                  type="number"
                  min="2"
                  max="12"
                  value={getNumberInputValue('parsing', 'maxLinesPerGroup', 2)}
                  onChange={(e) => setNumberInputDraft('parsing', 'maxLinesPerGroup', e.target.value)}
                  onBlur={() => commitNumberPreference('parsing', 'maxLinesPerGroup', {
                    min: 2,
                    max: 12,
                    fallbackValue: 2,
                    parse: 'int',
                  })}
                  onKeyDown={handleNumberInputKeyDown}
                  className={inputClass}
                />
                <p className={`text-xs ${mutedClass}`}>
                  {t('preferences.parsing.maxLinesPerGroup.description')}
                </p>
              </div>
            )}

            <div className="flex items-center justify-between">
              <div>
                <label className={`text-sm font-medium ${labelClass}`}>{t('preferences.parsing.translationGrouping.label')}</label>
                <p className={`text-xs ${mutedClass}`}>{t('preferences.parsing.translationGrouping.description')}</p>
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
              <label className={preferenceFieldLabelClass}>{t('preferences.parsing.maxLineLength.label')}</label>
              <Input
                type="number"
                min="20"
                max="100"
                value={getNumberInputValue('parsing', 'maxLineLength', 45)}
                onChange={(e) => setNumberInputDraft('parsing', 'maxLineLength', e.target.value)}
                onBlur={() => commitNumberPreference('parsing', 'maxLineLength', {
                  min: 20,
                  max: 100,
                  fallbackValue: 45,
                  parse: 'int',
                })}
                onKeyDown={handleNumberInputKeyDown}
                className={inputClass}
              />
              <p className={`text-xs ${mutedClass}`}>
                {t('preferences.parsing.maxLineLength.description')}
              </p>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <label className={`text-sm font-medium ${labelClass}`}>{t('preferences.parsing.crossBlankLineGrouping.label')}</label>
                <p className={`text-xs ${mutedClass}`}>{t('preferences.parsing.crossBlankLineGrouping.description')}</p>
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
              <label className={preferenceFieldLabelClass}>{t('preferences.parsing.structureTagHandling.label')}</label>
              <Select
                value={preferences.parsing?.structureTagMode ?? 'isolate'}
                onValueChange={(val) => updatePreference('parsing', 'structureTagMode', val)}
              >
                <SelectTrigger className={inputClass}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className={darkMode ? 'bg-gray-700 border-gray-600' : ''}>
                  <SelectItem value="isolate">{t('preferences.parsing.structureTagHandling.options.isolate')}</SelectItem>
                  <SelectItem value="strip">{t('preferences.parsing.structureTagHandling.options.strip')}</SelectItem>
                  <SelectItem value="keep">{t('preferences.parsing.structureTagHandling.options.keep')}</SelectItem>
                </SelectContent>
              </Select>
              <p className={`text-xs ${mutedClass}`}>
                {t('preferences.parsing.structureTagHandling.description')}
              </p>
            </div>
          </div>
        );

      case 'formatting':
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <label className={`text-sm font-medium ${labelClass}`}>{t('preferences.formatting.autoCleanupOnPaste.label')}</label>
                <p className={`text-xs ${mutedClass}`}>{t('preferences.formatting.autoCleanupOnPaste.description')}</p>
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
                <label className={`text-sm font-medium ${labelClass}`}>{t('preferences.formatting.capitalizeFirstLetter.label')}</label>
                <p className={`text-xs ${mutedClass}`}>{t('preferences.formatting.capitalizeFirstLetter.description')}</p>
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
                <label className={`text-sm font-medium ${labelClass}`}>{t('preferences.formatting.capitalizeReligiousTerms.label')}</label>
                <p className={`text-xs ${mutedClass}`}>{t('preferences.formatting.capitalizeReligiousTerms.description')}</p>
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
                <label className={`text-sm font-medium ${labelClass}`}>{t('preferences.formatting.normalizeTypographicChars.label')}</label>
                <p className={`text-xs ${mutedClass}`}>{t('preferences.formatting.normalizeTypographicChars.description')}</p>
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
            <div className="flex items-center justify-between">
              <div>
                <label className={`text-sm font-medium ${labelClass}`}>{t('preferences.lineSplitting.enableLineSplitting.label')}</label>
                <p className={`text-xs ${mutedClass}`}>{t('preferences.lineSplitting.enableLineSplitting.description')}</p>
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
              <label className={preferenceFieldLabelClass}>{t('preferences.lineSplitting.targetLength.label')}</label>
              <Input
                type="number"
                min="30"
                max="120"
                value={getNumberInputValue('lineSplitting', 'targetLength', 60)}
                onChange={(e) => setNumberInputDraft('lineSplitting', 'targetLength', e.target.value)}
                onBlur={() => commitNumberPreference('lineSplitting', 'targetLength', {
                  min: 30,
                  max: 120,
                  fallbackValue: 60,
                  parse: 'int',
                })}
                onKeyDown={handleNumberInputKeyDown}
                className={inputClass}
                disabled={!preferences.lineSplitting?.enabled}
              />
              <p className={`text-xs ${mutedClass}`}>
                {t('preferences.lineSplitting.targetLength.description')}
              </p>
            </div>

            <div className="space-y-2">
              <label className={preferenceFieldLabelClass}>{t('preferences.lineSplitting.minLength.label')}</label>
              <Input
                type="number"
                min="20"
                max="80"
                value={getNumberInputValue('lineSplitting', 'minLength', 40)}
                onChange={(e) => setNumberInputDraft('lineSplitting', 'minLength', e.target.value)}
                onBlur={() => commitNumberPreference('lineSplitting', 'minLength', {
                  min: 20,
                  max: 80,
                  fallbackValue: 40,
                  parse: 'int',
                })}
                onKeyDown={handleNumberInputKeyDown}
                className={inputClass}
                disabled={!preferences.lineSplitting?.enabled}
              />
              <p className={`text-xs ${mutedClass}`}>
                {t('preferences.lineSplitting.minLength.description')}
              </p>
            </div>

            <div className="space-y-2">
              <label className={preferenceFieldLabelClass}>{t('preferences.lineSplitting.maxLength.label')}</label>
              <Input
                type="number"
                min="50"
                max="150"
                value={getNumberInputValue('lineSplitting', 'maxLength', 80)}
                onChange={(e) => setNumberInputDraft('lineSplitting', 'maxLength', e.target.value)}
                onBlur={() => commitNumberPreference('lineSplitting', 'maxLength', {
                  min: 50,
                  max: 150,
                  fallbackValue: 80,
                  parse: 'int',
                })}
                onKeyDown={handleNumberInputKeyDown}
                className={inputClass}
                disabled={!preferences.lineSplitting?.enabled}
              />
              <p className={`text-xs ${mutedClass}`}>
                {t('preferences.lineSplitting.maxLength.description')}
              </p>
            </div>

            <div className="space-y-2">
              <label className={preferenceFieldLabelClass}>{t('preferences.lineSplitting.overflowTolerance.label')}</label>
              <Input
                type="number"
                min="5"
                max="30"
                value={getNumberInputValue('lineSplitting', 'overflowTolerance', 15)}
                onChange={(e) => setNumberInputDraft('lineSplitting', 'overflowTolerance', e.target.value)}
                onBlur={() => commitNumberPreference('lineSplitting', 'overflowTolerance', {
                  min: 5,
                  max: 30,
                  fallbackValue: 15,
                  parse: 'int',
                })}
                onKeyDown={handleNumberInputKeyDown}
                className={inputClass}
                disabled={!preferences.lineSplitting?.enabled}
              />
              <p className={`text-xs ${mutedClass}`}>
                {t('preferences.lineSplitting.overflowTolerance.description')}
              </p>
            </div>
          </div>
        );

      case 'fileHandling':
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <label className={`text-sm font-medium ${labelClass}`}>{t('preferences.fileHandling.rememberLastOpenedPath.label')}</label>
                <p className={`text-xs ${mutedClass}`}>{t('preferences.fileHandling.rememberLastOpenedPath.description')}</p>
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
              <label className={preferenceFieldLabelClass}>{t('preferences.fileHandling.defaultLyricsFolder.label')}</label>
              <div className="flex gap-2">
                <Input
                  value={preferences.fileHandling?.defaultLyricsPath || ''}
                  onChange={(e) => updatePreference('fileHandling', 'defaultLyricsPath', e.target.value)}
                  placeholder={t('preferences.fileHandling.defaultLyricsFolder.placeholder')}
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
                {t('preferences.fileHandling.defaultLyricsFolder.description')}
              </p>
            </div>
            <div className="space-y-2">
              <label className={preferenceFieldLabelClass}>{t('preferences.fileHandling.maxRecentFiles.label')}</label>
              <Input
                type="number"
                min="5"
                max="50"
                value={getNumberInputValue('fileHandling', 'maxRecentFiles', 10)}
                onChange={(e) => setNumberInputDraft('fileHandling', 'maxRecentFiles', e.target.value)}
                onBlur={() => commitNumberPreference('fileHandling', 'maxRecentFiles', {
                  min: 5,
                  max: 50,
                  fallbackValue: 10,
                  parse: 'int',
                })}
                onKeyDown={handleNumberInputKeyDown}
                className={inputClass}
              />
              <p className={`text-xs ${mutedClass}`}>
                {t('preferences.fileHandling.maxRecentFiles.description')}
              </p>
            </div>

            <div className="space-y-2">
              <label className={preferenceFieldLabelClass}>{t('preferences.fileHandling.maxSetlistFiles.label')}</label>
              <Input
                type="number"
                min={MIN_SETLIST_ITEMS}
                max={MAX_SETLIST_ITEMS}
                value={getNumberInputValue('fileHandling', 'maxSetlistFiles', DEFAULT_SETLIST_ITEMS)}
                onChange={(e) => setNumberInputDraft('fileHandling', 'maxSetlistFiles', e.target.value)}
                onBlur={() => commitNumberPreference('fileHandling', 'maxSetlistFiles', {
                  min: MIN_SETLIST_ITEMS,
                  max: MAX_SETLIST_ITEMS,
                  fallbackValue: DEFAULT_SETLIST_ITEMS,
                  parse: 'int',
                })}
                onKeyDown={handleNumberInputKeyDown}
                className={inputClass}
              />
              <p className={`text-xs ${mutedClass}`}>
                {t('preferences.fileHandling.maxSetlistFiles.description', { min: MIN_SETLIST_ITEMS, max: MAX_SETLIST_ITEMS })}
              </p>
              {(preferences.fileHandling?.maxSetlistFiles ?? DEFAULT_SETLIST_ITEMS) > SETLIST_PERFORMANCE_WARNING_ITEMS && (
                <div className={`flex items-start gap-2 p-2 rounded ${darkMode ? 'bg-yellow-900/20 border border-yellow-600/30' : 'bg-yellow-50 border border-yellow-200'}`}>
                  <AlertTriangle className={`w-4 h-4 mt-0.5 shrink-0 ${darkMode ? 'text-yellow-400' : 'text-yellow-600'}`} />
                  <p className={`text-xs ${darkMode ? 'text-yellow-300' : 'text-yellow-700'}`}>
                    {t('preferences.fileHandling.maxSetlistFiles.warning')}
                  </p>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <label className={preferenceFieldLabelClass}>{t('preferences.fileHandling.maxFileSize.label')}</label>
              <Input
                type="number"
                min="1"
                max="10"
                step="0.5"
                value={getNumberInputValue('fileHandling', 'maxFileSize', 2)}
                onChange={(e) => setNumberInputDraft('fileHandling', 'maxFileSize', e.target.value)}
                onBlur={() => commitNumberPreference('fileHandling', 'maxFileSize', {
                  min: 1,
                  max: 10,
                  fallbackValue: 2,
                  parse: 'float',
                })}
                onKeyDown={handleNumberInputKeyDown}
                className={inputClass}
              />
              <p className={`text-xs ${mutedClass}`}>
                {t('preferences.fileHandling.maxFileSize.description')}
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
            handleOscPortChange={handleOscPortChange}
            handleOscToggle={handleOscToggle}
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
              <label className={preferenceFieldLabelClass}>{t('preferences.autoplay.defaultInterval.label')}</label>
              <Input
                type="number"
                min="1"
                max="60"
                value={getNumberInputValue('autoplay', 'defaultInterval', 5)}
                onChange={(e) => setNumberInputDraft('autoplay', 'defaultInterval', e.target.value)}
                onBlur={() => commitNumberPreference('autoplay', 'defaultInterval', {
                  min: 1,
                  max: 60,
                  fallbackValue: 5,
                  parse: 'int',
                }, (value) => updateAutoplaySetting('defaultInterval', value))}
                onKeyDown={handleNumberInputKeyDown}
                className={inputClass}
              />
              <p className={`text-xs ${mutedClass}`}>
                {t('preferences.autoplay.defaultInterval.description')}
              </p>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <label className={`text-sm font-medium ${labelClass}`}>{t('preferences.autoplay.loopAtEnd.label')}</label>
                <p className={`text-xs ${mutedClass}`}>{t('preferences.autoplay.loopAtEnd.description')}</p>
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
                <label className={`text-sm font-medium ${labelClass}`}>{t('preferences.autoplay.startFromFirstLine.label')}</label>
                <p className={`text-xs ${mutedClass}`}>{t('preferences.autoplay.startFromFirstLine.description')}</p>
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
                <label className={`text-sm font-medium ${labelClass}`}>{t('preferences.autoplay.skipBlankLines.label')}</label>
                <p className={`text-xs ${mutedClass}`}>{t('preferences.autoplay.skipBlankLines.description')}</p>
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
            commitNumberPreference={commitNumberPreference}
            darkMode={darkMode}
            formatSecurityDate={formatSecurityDate}
            getNumberInputValue={getNumberInputValue}
            handleNumberInputKeyDown={handleNumberInputKeyDown}
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
            setNumberInputDraft={setNumberInputDraft}
            showModal={showModal}
            showToast={showToast}
            updatePreference={updatePreference}
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
      categories={categories}
      companionRunning={companionRunning}
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
      saving={saving}
      setActiveCategory={setActiveCategory}
    >
      {renderCategoryContent()}
    </UserPreferencesLayout>
  );
};

export default UserPreferencesModal;
