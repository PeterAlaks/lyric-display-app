/**
 * UserPreferencesModal
 * Two-pane settings modal for user preferences
 * Uses customLayout mode - handles its own scrolling and footer
 */

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Settings, FileText, Radio, Play, Sliders,
  AlertTriangle, RotateCcw, Loader2,
  ChevronRight, HardDrive, Cast, Palette, Wand2
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
import CapitalizedWordsPreferencesPage from './UserPreferencesModal/CapitalizedWordsPreferencesPage';
import DisplayTransitionsPreferencesPage from './UserPreferencesModal/DisplayTransitionsPreferencesPage';
import ExternalControlPreferencesSection from './UserPreferencesModal/ExternalControlPreferencesSection';
import IndexedLyricsFoldersPreferencesPage from './UserPreferencesModal/IndexedLyricsFoldersPreferencesPage';
import MidiMappingsPreferencesPage from './UserPreferencesModal/MidiMappingsPreferencesPage';
import PreviewPreferencesPage from './UserPreferencesModal/PreviewPreferencesPage';
import NdiPreferencesSection from './UserPreferencesModal/NdiPreferencesSection';
import NdiTelemetryPreferencesPage from './UserPreferencesModal/NdiTelemetryPreferencesPage';
import SectionTagPhrasesPreferencesPage from './UserPreferencesModal/SectionTagPhrasesPreferencesPage';
import UserPreferencesLayout from './UserPreferencesModal/UserPreferencesLayout';
import i18n, { normalizeLanguageCode, SUPPORTED_LANGUAGES } from '../i18n';
import { normalizeLineSplittingConfig } from '../../shared/lyricsParsing/preferenceOptions.js';
import {
  DEFAULT_CAPITALIZED_WORDS,
  normalizeCapitalizedWords,
} from '../../shared/capitalizedWords.js';
import {
  DEFAULT_SECTION_TAG_PHRASES,
  normalizeSectionTagPhrases,
} from '../../shared/sectionTagPhrases.js';

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
  const { t } = useTranslation();
  const [activeCategory, setActiveCategory] = useState(initialCategory || 'general');
  const [appearancePage, setAppearancePage] = useState('main');
  const [parsingPage, setParsingPage] = useState('main');
  const [formattingPage, setFormattingPage] = useState('main');
  const [fileHandlingPage, setFileHandlingPage] = useState('main');
  const [externalControlPage, setExternalControlPage] = useState('main');
  const [ndiPage, setNdiPage] = useState('main');
  const [contentDirection, setContentDirection] = useState(0);
  const [restoringAllDefaults, setRestoringAllDefaults] = useState(false);
  const [indexedFolderPersistence, setIndexedFolderPersistence] = useState({
    saving: false,
    saveError: false,
    lastSaved: null,
  });
  const { showToast } = useToast();
  const { showModal } = useModal();
  const { liveSafety, setLiveSafetyEnabled, isAuthenticated, ready } = useLiveSafetyBridge();
  const {
    handleResetAll,
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
    midiRefreshing,
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
    handleNdiInstallFromZip,
    handleNdiLaunch,
    handleNdiStop,
    handleNdiUninstall,
    handleNdiUpdate,
    isDownloading,
    ndiAutoLaunch,
    ndiCheckingUpdate,
    ndiStatus,
    ndiLastError,
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
  const capitalizedWords = normalizeCapitalizedWords(
    preferences?.formatting?.capitalizedWords,
    DEFAULT_CAPITALIZED_WORDS,
  );
  const sectionTagPhrases = normalizeSectionTagPhrases(
    preferences?.parsing?.sectionTagPhrases,
    DEFAULT_SECTION_TAG_PHRASES,
  );
  const isDisplayTransitionsPage = activeCategory === 'appearance' && appearancePage === 'displayTransitions';
  const isPreviewPage = activeCategory === 'appearance' && appearancePage === 'preview';
  const isSectionTagPhrasesPage = activeCategory === 'parsing' && parsingPage === 'sectionTagPhrases';
  const isCapitalizedWordsPage = activeCategory === 'formatting' && formattingPage === 'capitalizedWords';
  const isIndexedLyricsFoldersPage = activeCategory === 'fileHandling' && fileHandlingPage === 'indexedFolders';
  const isMidiMappingsPage = activeCategory === 'externalControl' && externalControlPage === 'midiMappings';
  const isNdiTelemetryPage = activeCategory === 'ndi' && ndiPage === 'telemetry';
  const handleCategoryChange = (category) => {
    const isReturningFromNestedPage = (
      (category === 'appearance' && (isDisplayTransitionsPage || isPreviewPage))
      || (category === 'parsing' && isSectionTagPhrasesPage)
      || (category === 'formatting' && isCapitalizedWordsPage)
      || (category === 'fileHandling' && isIndexedLyricsFoldersPage)
      || (category === 'externalControl' && isMidiMappingsPage)
      || (category === 'ndi' && isNdiTelemetryPage)
    );
    setContentDirection(isReturningFromNestedPage ? -1 : 0);
    setAppearancePage('main');
    setParsingPage('main');
    setFormattingPage('main');
    setFileHandlingPage('main');
    setExternalControlPage('main');
    setNdiPage('main');
    setActiveCategory(category);
  };
  const openDisplayTransitionsPage = () => {
    setContentDirection(1);
    setAppearancePage('displayTransitions');
  };
  const closeDisplayTransitionsPage = () => {
    setContentDirection(-1);
    setAppearancePage('main');
  };
  const openPreviewPage = () => {
    setContentDirection(1);
    setAppearancePage('preview');
  };
  const closePreviewPage = () => {
    setContentDirection(-1);
    setAppearancePage('main');
  };
  const openSectionTagPhrasesPage = () => {
    setContentDirection(1);
    setParsingPage('sectionTagPhrases');
  };
  const closeSectionTagPhrasesPage = () => {
    setContentDirection(-1);
    setParsingPage('main');
  };
  const openCapitalizedWordsPage = () => {
    setContentDirection(1);
    setFormattingPage('capitalizedWords');
  };
  const closeCapitalizedWordsPage = () => {
    setContentDirection(-1);
    setFormattingPage('main');
  };
  const openIndexedLyricsFoldersPage = () => {
    setContentDirection(1);
    setFileHandlingPage('indexedFolders');
  };
  const closeIndexedLyricsFoldersPage = () => {
    setContentDirection(-1);
    setFileHandlingPage('main');
  };
  const handleIndexedFolderPersistenceChange = (phase) => {
    setIndexedFolderPersistence((current) => {
      if (phase === 'start') {
        return { saving: true, saveError: false, lastSaved: null };
      }
      if (phase === 'success') {
        return { saving: false, saveError: false, lastSaved: Date.now() };
      }
      if (phase === 'error') {
        return { saving: false, saveError: true, lastSaved: null };
      }
      return { ...current, saving: false };
    });
  };
  const openMidiMappingsPage = () => {
    setContentDirection(1);
    setExternalControlPage('midiMappings');
  };
  const closeMidiMappingsPage = () => {
    setContentDirection(-1);
    setExternalControlPage('main');
  };
  const openNdiTelemetryPage = () => {
    setContentDirection(1);
    setNdiPage('telemetry');
  };
  const closeNdiTelemetryPage = () => {
    setContentDirection(-1);
    setNdiPage('main');
  };
  const handleCapitalizedWordsChange = (words) => {
    const normalizedWords = normalizeCapitalizedWords(words);
    updatePreference('formatting', 'capitalizedWords', normalizedWords);
    useLyricsStore.getState().setFormattingCapitalizedWords(normalizedWords);
  };
  const handleSectionTagPhrasesChange = (phrases) => {
    updatePreference('parsing', 'sectionTagPhrases', normalizeSectionTagPhrases(phrases));
  };
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
  const handleRestoreAllDefaults = async () => {
    const confirmation = await showModal({
      title: 'Restore All Default Settings?',
      description: 'Every category in User Preferences will be restored to its original defaults.',
      body: 'Your lyric files, indexed folders, setlists, and system logs will not be removed. Settings marked as requiring a restart will take full effect after restarting LyricDisplay.',
      variant: 'warning',
      size: 'sm',
      actions: [
        { label: 'Cancel', value: 'cancel', variant: 'outline' },
        { label: 'Restore Defaults', value: 'restore', variant: 'destructive' },
      ],
    });
    if (confirmation !== 'restore') return;

    setRestoringAllDefaults(true);
    try {
      const restored = await handleResetAll();
      if (!restored) return;

      setLiveSafetyEnabled(false, { persistPreference: false });
      showToast({
        title: 'Default Settings Restored',
        message: 'All user preference categories have been restored to their defaults.',
        variant: 'success',
      });
    } finally {
      setRestoringAllDefaults(false);
    }
  };

  // Render category content
  const renderCategoryContent = () => {
    if (!preferences) return null;

    if (isDisplayTransitionsPage) {
      return (
        <DisplayTransitionsPreferencesPage
          getNumberPreferenceInputProps={getNumberPreferenceInputProps}
          inputClass={inputClass}
          labelClass={labelClass}
          mutedClass={mutedClass}
          onBack={closeDisplayTransitionsPage}
          preferences={preferences}
          selectContentClass={selectContentClass}
          updatePreference={updatePreference}
        />
      );
    }

    if (isPreviewPage) {
      return (
        <PreviewPreferencesPage
          darkMode={darkMode}
          inputClass={inputClass}
          labelClass={labelClass}
          mutedClass={mutedClass}
          onBack={closePreviewPage}
          preferences={preferences}
          selectContentClass={selectContentClass}
          updatePreference={updatePreference}
        />
      );
    }

    if (isSectionTagPhrasesPage) {
      return (
        <SectionTagPhrasesPreferencesPage
          darkMode={darkMode}
          labelClass={labelClass}
          mutedClass={mutedClass}
          onBack={closeSectionTagPhrasesPage}
          onPhrasesChange={handleSectionTagPhrasesChange}
          phrases={sectionTagPhrases}
          showModal={showModal}
        />
      );
    }

    if (isCapitalizedWordsPage) {
      return (
        <CapitalizedWordsPreferencesPage
          darkMode={darkMode}
          labelClass={labelClass}
          mutedClass={mutedClass}
          onBack={closeCapitalizedWordsPage}
          onWordsChange={handleCapitalizedWordsChange}
          showModal={showModal}
          words={capitalizedWords}
        />
      );
    }

    if (isIndexedLyricsFoldersPage) {
      return (
        <IndexedLyricsFoldersPreferencesPage
          darkMode={darkMode}
          labelClass={labelClass}
          mutedClass={mutedClass}
          onBack={closeIndexedLyricsFoldersPage}
          onPersistenceChange={handleIndexedFolderPersistenceChange}
          showModal={showModal}
          showToast={showToast}
        />
      );
    }

    if (isMidiMappingsPage) {
      return (
        <MidiMappingsPreferencesPage
          darkMode={darkMode}
          handleMidiAssignAction={handleMidiAssignAction}
          handleMidiLearn={handleMidiLearn}
          handleMidiResetMappings={handleMidiResetMappings}
          labelClass={labelClass}
          lastLearnedMidi={lastLearnedMidi}
          midiAssigningAction={midiAssigningAction}
          midiLearnActive={midiLearnActive}
          midiStatus={midiStatus}
          mutedClass={mutedClass}
          onBack={closeMidiMappingsPage}
        />
      );
    }

    if (isNdiTelemetryPage) {
      return (
        <NdiTelemetryPreferencesPage
          companionRunning={companionRunning}
          darkMode={darkMode}
          labelClass={labelClass}
          mutedClass={mutedClass}
          ndiTelemetry={ndiTelemetry}
          onBack={closeNdiTelemetryPage}
        />
      );
    }

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
                <SelectContent className={selectContentClass}>
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

            <button
              type="button"
              onClick={openDisplayTransitionsPage}
              className={`-mx-3 flex w-[calc(100%+1.5rem)] items-center gap-4 rounded-lg px-3 py-2.5 text-left transition-colors ${darkMode ? 'hover:bg-gray-700/60' : 'hover:bg-gray-100'}`}
              aria-label="Configure display transitions"
            >
              <div className="min-w-0 flex-1">
                <span className={`text-sm font-medium ${labelClass}`}>Display Transitions</span>
                <p className={`text-xs ${mutedClass}`}>Configure timer, background media, and output visibility animations</p>
              </div>
              <span className={`shrink-0 text-xs ${mutedClass}`}>Manage</span>
              <ChevronRight className={`h-4 w-4 shrink-0 ${mutedClass}`} />
            </button>

            <button
              type="button"
              onClick={openPreviewPage}
              className={`-mx-3 flex w-[calc(100%+1.5rem)] items-center gap-4 rounded-lg px-3 py-2.5 text-left transition-colors ${darkMode ? 'hover:bg-gray-700/60' : 'hover:bg-gray-100'}`}
              aria-label="Configure Preview"
            >
              <div className="min-w-0 flex-1">
                <span className={`text-sm font-medium ${labelClass}`}>Preview</span>
                <p className={`text-xs ${mutedClass}`}>Arrange preview feeds and configure the operator grid</p>
              </div>
              <span className={`shrink-0 text-xs ${mutedClass}`}>Manage</span>
              <ChevronRight className={`h-4 w-4 shrink-0 ${mutedClass}`} />
            </button>

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

            <div className="space-y-2">
              <label className={preferenceFieldLabelClass}>{t('preferences.parsing.maxLinesPerGroup.label')}</label>
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
                {t('preferences.parsing.maxLinesPerGroup.description')}
              </p>
            </div>

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
                {...getNumberPreferenceInputProps('parsing', 'maxLineLength', {
                  min: 20,
                  max: 100,
                  fallbackValue: 45,
                  parse: 'int',
                })}
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
                disabled={!(preferences.parsing?.enableAutoLineGrouping ?? true)}
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
                <SelectContent className={selectContentClass}>
                  <SelectItem value="isolate">{t('preferences.parsing.structureTagHandling.options.isolate')}</SelectItem>
                  <SelectItem value="strip">{t('preferences.parsing.structureTagHandling.options.strip')}</SelectItem>
                  <SelectItem value="keep">{t('preferences.parsing.structureTagHandling.options.keep')}</SelectItem>
                </SelectContent>
              </Select>
              <p className={`text-xs ${mutedClass}`}>
                {t('preferences.parsing.structureTagHandling.description')}
              </p>
            </div>

            <button
              type="button"
              onClick={openSectionTagPhrasesPage}
              className={`-mx-3 flex w-[calc(100%+1.5rem)] items-center gap-4 rounded-lg px-3 py-2.5 text-left transition-colors ${darkMode ? 'hover:bg-gray-700/60' : 'hover:bg-gray-100'}`}
              aria-label={`Manage ${sectionTagPhrases.length} recognized section tag phrases`}
            >
              <div className="min-w-0 flex-1">
                <span className={`text-sm font-medium ${labelClass}`}>Recognized Section Tags</span>
                <p className={`text-xs ${mutedClass}`}>Choose phrases treated as Verse, Chorus, Bridge, and other headings</p>
              </div>
              <span className={`shrink-0 text-xs ${mutedClass}`}>{sectionTagPhrases.length}</span>
              <ChevronRight className={`h-4 w-4 shrink-0 ${mutedClass}`} />
            </button>
          </div>
        );

      case 'formatting':
        return (
          <div className="space-y-6">
            <div className={preferenceToggleRowClass}>
              <div className={preferenceToggleTextClass}>
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

            <div className={preferenceToggleRowClass}>
              <div className={preferenceToggleTextClass}>
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

            <div className={preferenceToggleRowClass}>
              <div className={preferenceToggleTextClass}>
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

            <button
              type="button"
              onClick={openCapitalizedWordsPage}
              className={`-mx-3 flex w-[calc(100%+1.5rem)] items-center gap-4 rounded-lg px-3 py-2.5 text-left transition-colors ${darkMode ? 'hover:bg-gray-700/60' : 'hover:bg-gray-100'}`}
              aria-label={`Manage ${capitalizedWords.length} capitalized ${capitalizedWords.length === 1 ? 'word' : 'words'}`}
            >
              <div className="min-w-0 flex-1">
                <span className={`text-sm font-medium ${labelClass}`}>Capitalized Words</span>
                <p className={`text-xs ${mutedClass}`}>Choose the words and phrases this formatting rule applies to</p>
              </div>
              <span className={`shrink-0 text-xs ${mutedClass}`}>{capitalizedWords.length}</span>
              <ChevronRight className={`h-4 w-4 shrink-0 ${mutedClass}`} />
            </button>

            <div className={preferenceToggleRowClass}>
              <div className={preferenceToggleTextClass}>
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
            {hasInvalidSplitRelationship && (
              <div className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-xs ${darkMode ? 'border-amber-700 bg-amber-950/30 text-amber-200' : 'border-amber-300 bg-amber-50 text-amber-800'}`}>
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>The current values overlap. Parsing will safely constrain the target between the configured minimum and maximum.</span>
              </div>
            )}

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
                {t('preferences.lineSplitting.targetLength.description')}
              </p>
            </div>

            <div className="space-y-2">
              <label className={preferenceFieldLabelClass}>{t('preferences.lineSplitting.minLength.label')}</label>
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
                {t('preferences.lineSplitting.minLength.description')}
              </p>
            </div>

            <div className="space-y-2">
              <label className={preferenceFieldLabelClass}>{t('preferences.lineSplitting.maxLength.label')}</label>
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
                {t('preferences.lineSplitting.maxLength.description')}
              </p>
            </div>

            <div className="space-y-2">
              <label className={preferenceFieldLabelClass}>{t('preferences.lineSplitting.overflowTolerance.label')}</label>
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
                {t('preferences.lineSplitting.overflowTolerance.description')}
              </p>
            </div>
          </div>
        );

      case 'fileHandling':
        return (
          <div className="space-y-6">
            <button
              type="button"
              onClick={openIndexedLyricsFoldersPage}
              className={`-mx-3 flex w-[calc(100%+1.5rem)] items-center gap-4 rounded-lg px-3 py-2.5 text-left transition-colors ${darkMode ? 'hover:bg-gray-700/60' : 'hover:bg-gray-100'}`}
              aria-label="Manage indexed lyrics folders"
            >
              <div className="min-w-0 flex-1">
                <span className={`text-sm font-medium ${labelClass}`}>Indexed Lyrics Folders</span>
                <p className={`text-xs ${mutedClass}`}>Choose the folders searched by the Load Lyrics navigator</p>
              </div>
              <span className={`shrink-0 text-xs ${mutedClass}`}>Manage</span>
              <ChevronRight className={`h-4 w-4 shrink-0 ${mutedClass}`} />
            </button>
            <div className="space-y-2">
              <label className={preferenceFieldLabelClass}>{t('preferences.fileHandling.maxRecentFiles.label')}</label>
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
                {t('preferences.fileHandling.maxRecentFiles.description')}
              </p>
            </div>

            <div className="space-y-2">
              <label className={preferenceFieldLabelClass}>{t('preferences.fileHandling.maxSetlistFiles.label')}</label>
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
                {...getNumberPreferenceInputProps('fileHandling', 'maxFileSize', {
                  min: 1,
                  max: 10,
                  fallbackValue: 2,
                  parse: 'float',
                })}
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
            handleMidiRefreshPorts={handleMidiRefreshPorts}
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
            midiRefreshing={midiRefreshing}
            midiStatus={midiStatus}
            mutedClass={mutedClass}
            onOpenMidiMappings={openMidiMappingsPage}
            oscStatus={oscStatus}
            preferenceFieldLabelClass={preferenceFieldLabelClass}
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
            handleNdiInstallFromZip={handleNdiInstallFromZip}
            handleNdiUpdate={handleNdiUpdate}
            inputClass={inputClass}
            isDownloading={isDownloading}
            labelClass={labelClass}
            mutedClass={mutedClass}
            ndiAutoLaunch={ndiAutoLaunch}
            ndiStatus={ndiStatus}
            ndiLastError={ndiLastError}
            ndiTelemetry={ndiTelemetry}
            ndiUpdateInfo={ndiUpdateInfo}
            ndiUpdating={ndiUpdating}
            onOpenTelemetry={openNdiTelemetryPage}
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
                {...getNumberPreferenceInputProps('autoplay', 'defaultInterval', {
                  min: 1,
                  max: 60,
                  fallbackValue: 5,
                  parse: 'int',
                }, (value) => updateAutoplaySetting('defaultInterval', value))}
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
            darkMode={darkMode}
            formatSecurityDate={formatSecurityDate}
            getNumberPreferenceInputProps={getNumberPreferenceInputProps}
            handleResetCategory={handleResetCategory}
            handleRestoreAllDefaults={handleRestoreAllDefaults}
            handleRotateSecurityTokenKey={handleRotateSecurityTokenKey}
            inputClass={inputClass}
            labelClass={labelClass}
            loadSecurityStatus={loadSecurityStatus}
            mutedClass={mutedClass}
            preferenceFieldLabelClass={preferenceFieldLabelClass}
            preferences={preferences}
            restoringAllDefaults={restoringAllDefaults}
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
      categories={categories}
      companionRunning={companionRunning}
      companionStarting={companionStarting}
      contentDirection={contentDirection}
      contentKey={isDisplayTransitionsPage
        ? 'appearance-display-transitions'
        : (isPreviewPage
          ? 'appearance-preview'
          : (isSectionTagPhrasesPage
            ? 'parsing-section-tag-phrases'
            : (isCapitalizedWordsPage
              ? 'formatting-capitalized-words'
              : (isIndexedLyricsFoldersPage
                ? 'file-handling-indexed-folders'
                : (isMidiMappingsPage
                  ? 'external-control-midi-mappings'
                  : (isNdiTelemetryPage ? 'ndi-runtime-telemetry' : activeCategory))))))}
      darkMode={darkMode}
      handleNdiCheckForUpdate={handleNdiCheckForUpdate}
      handleNdiLaunch={handleNdiLaunch}
      handleNdiStop={handleNdiStop}
      handleNdiUninstall={handleNdiUninstall}
      labelClass={labelClass}
      lastSaved={indexedFolderPersistence.lastSaved || lastSaved}
      mutedClass={mutedClass}
      ndiCheckingUpdate={ndiCheckingUpdate}
      ndiStatus={ndiStatus}
      panelBg={panelBg}
      saveError={saveError || indexedFolderPersistence.saveError}
      saving={saving || indexedFolderPersistence.saving}
      setActiveCategory={handleCategoryChange}
      hideContentHeader={isDisplayTransitionsPage || isPreviewPage || isSectionTagPhrasesPage || isCapitalizedWordsPage || isIndexedLyricsFoldersPage || isMidiMappingsPage || isNdiTelemetryPage}
    >
      {renderCategoryContent()}
    </UserPreferencesLayout>
  );
};

export default UserPreferencesModal;
