import React from 'react';
import { createPortal } from 'react-dom';
import { useDarkModeState, useOutput1Settings, useOutput2Settings, useOutputSettings as useOutputSettingsSelector, useStageSettings, useIndividualOutputState, useOutputEnabled, useSetOutputEnabledAction } from '../hooks/useStoreSelectors';
import { useControlSocket } from '../context/ControlSocketProvider';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Tooltip } from '@/components/ui/tooltip';
import { ColorPicker } from "@/components/ui/color-picker";
import { PaintPicker } from "@/components/ui/paint-picker";
import useToast from '../hooks/useToast';
import useModal from '../hooks/useModal';
import useOutputToggle from '../hooks/OutputSettingsPanel/useOutputToggle';
import useFullscreenBackground from '../hooks/OutputSettingsPanel/useFullscreenBackground';
import useAdvancedSectionPersistence from '../hooks/OutputSettingsPanel/useAdvancedSectionPersistence';
import useTypographyAndBands from '../hooks/OutputSettingsPanel/useTypographyAndBands';
import useFullscreenModeState from '../hooks/OutputSettingsPanel/useFullscreenModeState';
import useFullscreenElementMedia from '../hooks/OutputSettingsPanel/useFullscreenElementMedia';
import useFullscreenAdvancedAutoExpand from '../hooks/OutputSettingsPanel/useFullscreenAdvancedAutoExpand';
import { Clock, Sparkles, Type, PaintBucket, Square, Move, AlignVerticalSpaceAround, TextAlignJustify, SquareMenu, User, X } from 'lucide-react';
import FontSelect from './FontSelect';
import StageSettingsPanel from './StageSettingsPanel';
import BackgroundBandSettingsSection from './OutputSettingsPanel/BackgroundBandSettingsSection';
import DropShadowSettingsSection from './OutputSettingsPanel/DropShadowSettingsSection';
import FontSizeSettingsSection from './OutputSettingsPanel/FontSizeSettingsSection';
import FullscreenSettingsSection from './OutputSettingsPanel/FullscreenSettingsSection';
import PanelHeaderActions from './OutputSettingsPanel/PanelHeaderActions';
import TransitionSettingsSection from './OutputSettingsPanel/TransitionSettingsSection';
import TypographySpacingSection from './OutputSettingsPanel/TypographySpacingSection';
import { blurInputOnEnter, AdvancedToggle, LabelWithIcon, EmphasisRow, AlignmentRow } from './OutputSettingsShared';
import { sanitizeIntegerInput, sanitizeNumberInput } from '../utils/numberInput';
import { outputTemplates } from '../utils/outputTemplates';

const SettingRow = ({ icon, label, tooltip, children, rightClassName = 'flex items-center gap-2 justify-end', justifyEnd = true, darkMode }) => (
  <div className="flex items-center justify-between gap-4">
    <Tooltip content={tooltip} side="right">
      <div className="flex items-center gap-2 min-w-[140px]">
        {icon ? React.createElement(icon, { className: `w-4 h-4 ${darkMode ? 'text-gray-400' : 'text-gray-500'}` }) : null}
        <label className={`text-sm ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>{label}</label>
      </div>
    </Tooltip>
    <div className={`${rightClassName} ${justifyEnd ? '' : ''}`}>
      {children}
    </div>
  </div>
);

const LyricsPositionSection = ({
  darkMode,
  lyricsPositionValue,
  handleLyricsPositionChange,
  fullScreenModeChecked
}) => (
  <SettingRow
    icon={AlignVerticalSpaceAround}
    label="Lyrics Position"
    tooltip="Choose where lyrics appear vertically on screen"
    rightClassName="w-full"
    darkMode={darkMode}
  >
    <Select
      value={lyricsPositionValue}
      onValueChange={handleLyricsPositionChange}
    >
      <SelectTrigger
        className={`w-full ${darkMode
          ? 'bg-gray-700 border-gray-600 text-gray-200'
          : 'bg-white border-gray-300'
          }`}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent className={darkMode ? 'bg-gray-700 border-gray-600 text-gray-200' : 'bg-white border-gray-300'}>
        <SelectItem value="upper">Upper Third</SelectItem>
        <SelectItem value="center">Centre</SelectItem>
        <SelectItem value="lower">Lower Third</SelectItem>
      </SelectContent>
    </Select>
  </SettingRow>
);

const FontStyleSection = ({ darkMode, fontStyle, onChange }) => (
  <SettingRow
    icon={Type}
    label="Font Style"
    tooltip="Select font family for lyric display"
    rightClassName="w-full"
    darkMode={darkMode}
  >
    <FontSelect
      value={fontStyle}
      onChange={onChange}
      darkMode={darkMode}
      triggerClassName="w-full"
      containerClassName="relative w-full"
    />
  </SettingRow>
);

const FontColorSection = ({
  darkMode,
  fontColor,
  onChange,
  fontColorAdvancedExpanded,
  setFontColorAdvancedExpanded
}) => (
  <SettingRow
    icon={PaintBucket}
    label="Font Colour"
    tooltip="Choose the color of your lyrics text"
    rightClassName="flex items-center gap-2 justify-end w-full"
    darkMode={darkMode}
  >
    <Tooltip content={fontColorAdvancedExpanded ? "Hide advanced settings" : "Show advanced settings"} side="top">
      <AdvancedToggle
        expanded={fontColorAdvancedExpanded}
        onToggle={() => setFontColorAdvancedExpanded(!fontColorAdvancedExpanded)}
        darkMode={darkMode}
        ariaLabel="Toggle font color advanced settings"
      />
    </Tooltip>
    <ColorPicker
      value={fontColor}
      onChange={onChange}
      darkMode={darkMode}
      className={darkMode ? 'bg-gray-700 border-gray-600 text-gray-200' : 'bg-white border-gray-300'}
    />
  </SettingRow>
);

const BackgroundSection = ({
  applySettings,
  darkMode,
  settings,
  update,
  backgroundAdvancedExpanded,
  setBackgroundAdvancedExpanded,
  fullScreenModeChecked,
  backgroundDisabledTooltip
}) => {
  const [opacityInput, setOpacityInput] = React.useState(() => String(settings.backgroundOpacity ?? 0));

  React.useEffect(() => {
    const normalized = settings.backgroundOpacity ?? 0;
    const currentNumeric = parseFloat(opacityInput);
    if (!Number.isNaN(currentNumeric) && currentNumeric === normalized) {
      return;
    }
    setOpacityInput(String(normalized));
  }, [opacityInput, settings.backgroundOpacity]);

  const handleOpacityChange = (value) => {
    setOpacityInput(value);
    const parsed = sanitizeNumberInput(
      value,
      settings.backgroundOpacity ?? 0,
      { min: 0, max: 10, clampMin: false }
    );
    if (Number.isFinite(parsed) && parsed !== settings.backgroundOpacity) {
      update('backgroundOpacity', parsed);
    }
  };

  const handleOpacityBlur = () => {
    const parsed = sanitizeNumberInput(opacityInput, settings.backgroundOpacity ?? 0, { min: 0, max: 10 });
    setOpacityInput(String(parsed));
    update('backgroundOpacity', parsed);
  };

  return (
    <SettingRow
      icon={Square}
      label="Background"
      tooltip="Set background band with custom color and opacity behind lyrics"
      rightClassName="flex items-center gap-2 justify-end w-full"
      darkMode={darkMode}
    >
      <Tooltip content={backgroundAdvancedExpanded ? "Hide advanced settings" : "Show advanced settings"} side="top">
        <AdvancedToggle
          expanded={backgroundAdvancedExpanded}
          onToggle={() => setBackgroundAdvancedExpanded(!backgroundAdvancedExpanded)}
          disabled={fullScreenModeChecked}
          darkMode={darkMode}
          ariaLabel="Toggle background advanced settings"
        />
      </Tooltip>
      <PaintPicker
        value={settings.backgroundPaint}
        fallbackColor={settings.backgroundColor ?? '#000000'}
        onChange={(val) => {
          applySettings({
            backgroundPaint: val,
            ...(val?.type === 'solid' ? { backgroundColor: val.color } : {}),
          });
        }}
        disabled={fullScreenModeChecked}
        darkMode={darkMode}
        className={`${darkMode ? 'bg-gray-700 border-gray-600 text-gray-200' : 'bg-white border-gray-300'} ${fullScreenModeChecked ? 'opacity-60 cursor-not-allowed' : ''}`}
      />
      <Input
        type="number"
        value={opacityInput}
        onChange={(e) => handleOpacityChange(e.target.value)}
        onBlur={handleOpacityBlur}
        min="0"
        max="10"
        step="0.1"
        inputMode="decimal"
        disabled={fullScreenModeChecked}
        className={`w-20 ${darkMode
          ? 'bg-gray-700 border-gray-600 text-gray-200'
          : 'bg-white border-gray-300'
          } ${fullScreenModeChecked ? 'opacity-60 cursor-not-allowed' : ''}`}
        title={fullScreenModeChecked ? backgroundDisabledTooltip : undefined}
      />
    </SettingRow>
  );
};

const MarginsSection = ({ darkMode, settings, update }) => (
  <SettingRow
    icon={Move}
    label="X & Y Margins"
    tooltip="Adjust horizontal and vertical positioning offset"
    rightClassName="flex gap-2 items-center"
    darkMode={darkMode}
  >
    <Input
      type="number"
      value={settings.xMargin}
      onChange={(e) => update(
        'xMargin',
        sanitizeNumberInput(e.target.value, settings.xMargin ?? 0)
      )}
      className={`w-20 ${darkMode
        ? 'bg-gray-700 border-gray-600 text-gray-200'
        : 'bg-white border-gray-300'
        }`}
    />
    <Input
      type="number"
      value={settings.yMargin}
      onChange={(e) => update(
        'yMargin',
        sanitizeNumberInput(e.target.value, settings.yMargin ?? 0)
      )}
      className={`w-20 ${darkMode
        ? 'bg-gray-700 border-gray-600 text-gray-200'
        : 'bg-white border-gray-300'
        }`}
    />
  </SettingRow>
);

const DOCK_TEMPLATE_OMIT_KEYS = new Set([
  'fullScreenBackgroundMedia',
  'fullScreenBackgroundMediaName',
  'fullScreenElementMedia',
  'fullScreenElementMediaName',
]);

const sanitizeDockTemplateSettings = (rawSettings) => {
  const source = rawSettings?.settings && typeof rawSettings.settings === 'object'
    ? rawSettings.settings
    : rawSettings;

  if (!source || typeof source !== 'object' || Array.isArray(source)) {
    return null;
  }

  return Object.fromEntries(
    Object.entries(source).filter(([key]) => (
      !key.startsWith('fullScreen') && !DOCK_TEMPLATE_OMIT_KEYS.has(key)
    ))
  );
};

const OutputSettingsPanel = ({ outputKey, onDeleteOutput, compact = false }) => {
  const { darkMode: storedDarkMode } = useDarkModeState();
  const darkMode = compact ? true : storedDarkMode;
  const [templatePopoverOpen, setTemplatePopoverOpen] = React.useState(false);
  const [templateTab, setTemplateTab] = React.useState('presets');
  const [userTemplates, setUserTemplates] = React.useState([]);
  const [userTemplatesLoading, setUserTemplatesLoading] = React.useState(false);
  const globalSetOutputEnabled = useSetOutputEnabledAction();
  const { emitStyleUpdate, emitIndividualOutputToggle } = useControlSocket();
  const { showToast } = useToast();
  const { showModal } = useModal();

  const { output1Enabled, output2Enabled, stageEnabled, setOutput1Enabled, setOutput2Enabled, setStageEnabled } = useIndividualOutputState();

  const stageSettingsHook = useStageSettings();
  const genericOutputHook = useOutputSettingsSelector(outputKey);

  const { settings, updateSettings } =
    outputKey === 'stage'
      ? stageSettingsHook
      : genericOutputHook;

  const outputEnabledFromStore = useOutputEnabled(outputKey);

  const isOutputEnabled = outputKey === 'stage' ? stageEnabled : (outputEnabledFromStore ?? true);

  const setOutputEnabled = outputKey === 'output1' ? setOutput1Enabled
    : outputKey === 'output2' ? setOutput2Enabled
      : outputKey === 'stage' ? setStageEnabled
        : (enabled) => globalSetOutputEnabled(outputKey, enabled);

  const { handleToggleOutput } = useOutputToggle({
    outputKey,
    isOutputEnabled,
    setOutputEnabled,
    emitIndividualOutputToggle,
    showToast
  });

  const getPresetSettings = React.useCallback((template) => (
    template?.getSettings ? template.getSettings(outputKey) : template?.settings
  ), [outputKey]);

  const loadUserTemplates = React.useCallback(async () => {
    if (!compact || outputKey === 'stage') return;

    setUserTemplatesLoading(true);
    try {
      if (window.electronAPI?.templates?.load) {
        const result = await window.electronAPI.templates.load('output');
        if (result?.success) {
          setUserTemplates(result.templates || []);
          return;
        }
      }

      const response = await fetch('http://127.0.0.1:4000/api/templates/output', {
        cache: 'no-store',
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const result = await response.json();
      setUserTemplates(result?.templates || []);
    } catch (error) {
      console.warn('Failed to load output templates:', error);
      setUserTemplates([]);
    } finally {
      setUserTemplatesLoading(false);
    }
  }, [compact, outputKey]);

  React.useEffect(() => {
    if (!templatePopoverOpen) return;
    loadUserTemplates();
  }, [loadUserTemplates, templatePopoverOpen]);

  if (outputKey === 'stage') {
    const applyStageSettings = React.useCallback((partial) => {
      const newSettings = { ...settings, ...partial };
      updateSettings(partial);
      emitStyleUpdate('stage', newSettings);
    }, [settings, updateSettings, emitStyleUpdate]);

    const updateStage = React.useCallback((key, value) => {
      applyStageSettings({ [key]: value });
    }, [applyStageSettings]);

    if (compact) {
      const compactInputClass = `h-8 text-xs ${darkMode
        ? 'bg-gray-800 border-gray-700 text-gray-100'
        : 'bg-white border-gray-300 text-gray-900'
        }`;
      const compactLabelClass = `text-[11px] font-medium uppercase tracking-wide ${darkMode ? 'text-gray-400' : 'text-gray-500'}`;
      const CompactField = ({ label, children }) => (
        <div className="space-y-1">
          <div className={compactLabelClass}>{label}</div>
          {children}
        </div>
      );

      return (
        <div className="space-y-3" onKeyDown={blurInputOnEnter}>
          <div className={`flex items-center justify-between rounded-md border px-3 py-2 ${darkMode ? 'border-gray-800 bg-gray-900' : 'border-gray-200 bg-white'}`}>
            <div>
              <div className={`text-sm font-semibold ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>Stage</div>
              <div className={`text-[11px] ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>{isOutputEnabled ? 'Enabled' : 'Disabled'}</div>
            </div>
            <button
              type="button"
              onClick={handleToggleOutput}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold ${isOutputEnabled
                ? 'bg-green-600 text-white hover:bg-green-700'
                : darkMode ? 'bg-gray-800 text-gray-300 hover:bg-gray-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
            >
              {isOutputEnabled ? 'On' : 'Off'}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <CompactField label="Font Size">
              <Input
                type="number"
                min="12"
                max="300"
                value={settings.fontSize ?? 48}
                onChange={(e) => updateStage('fontSize', sanitizeIntegerInput(e.target.value, settings.fontSize ?? 48, { min: 12, max: 200, clampMin: false }))}
                className={compactInputClass}
              />
            </CompactField>
            <CompactField label="Text">
              <ColorPicker
                value={settings.fontColor}
                onChange={(val) => updateStage('fontColor', val)}
                darkMode={darkMode}
                presentation="sheet"
                className={compactInputClass}
              />
            </CompactField>
          </div>

          <p className={`text-[11px] ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>
            Full stage template controls are available in the desktop settings panel.
          </p>
        </div>
      );
    }

    return (
      <StageSettingsPanel
        settings={settings}
        applySettings={applyStageSettings}
        update={updateStage}
        darkMode={darkMode}
        showModal={showModal}
        isOutputEnabled={isOutputEnabled}
        handleToggleOutput={handleToggleOutput}
      />
    );
  }

  const applySettings = React.useCallback((partial) => {
    const newSettings = { ...settings, ...partial };
    updateSettings(partial);
    emitStyleUpdate(outputKey, newSettings);
  }, [settings, updateSettings, emitStyleUpdate, outputKey]);

  const update = React.useCallback((key, value) => {
    applySettings({ [key]: value });
  }, [applySettings]);

  const {
    openMediaLibrary,
    hasBackgroundMedia,
    uploadedMediaName,
    validateExistingMedia
  } = useFullscreenBackground({
    outputKey,
    settings,
    applySettings,
    showModal,
    showToast
  });

  React.useEffect(() => {
    if (settings.fullScreenMode) {
      validateExistingMedia();
    }
  }, [settings.fullScreenMode, settings.fullScreenBackgroundMedia?.url, validateExistingMedia]);

  const {
    fontSizeAdvancedExpanded,
    setFontSizeAdvancedExpanded,
    fontColorAdvancedExpanded,
    setFontColorAdvancedExpanded,
    dropShadowAdvancedExpanded,
    setDropShadowAdvancedExpanded,
    backgroundAdvancedExpanded,
    setBackgroundAdvancedExpanded,
    transitionAdvancedExpanded,
    setTransitionAdvancedExpanded,
    fullScreenAdvancedExpanded,
    setFullScreenAdvancedExpanded
  } = useAdvancedSectionPersistence(outputKey, {
    autoOpenTriggers: {
      fontSizeAdvancedExpanded: settings.maxLinesEnabled,
      fullScreenAdvancedExpanded: settings.fullScreenMode,
    }
  });

  const {
    fullScreenModeChecked,
    lyricsPositionValue,
    fullScreenBackgroundTypeValue,
    fullScreenBackgroundColorValue,
    fullScreenBackgroundPaintValue,
    backgroundDisabledTooltip,
    fullScreenOptionsWrapperClass,
    handleLyricsPositionChange,
    handleFullScreenToggle,
    handleFullScreenBackgroundTypeChange,
    handleFullScreenPaintChange
  } = useFullscreenModeState({ settings, applySettings, expand: fullScreenAdvancedExpanded });

  const {
    translationFontSizeMode,
    translationFontSize,
    currentFontSize,
    translationLineColor,
    dropShadowOffsetX,
    dropShadowOffsetY,
    dropShadowBlur,
    backgroundBandVerticalPadding,
    backgroundBandHeightMode,
    backgroundBandLockedToMaxLines,
    maxLinesValue,
    maxLinesEnabled,
    backgroundBandCustomLines,
    handleBackgroundHeightModeChange,
    handleCustomLinesChange,
    handleTranslationFontSizeModeChange,
    handleTranslationFontSizeChange
  } = useTypographyAndBands({ settings, applySettings });

  const {
    fullScreenElementMediaName,
    handleFullScreenElementToggle,
    hasFullScreenElementMedia,
    openFullScreenElementMediaLibrary,
  } = useFullscreenElementMedia({
    applySettings,
    outputKey,
    settings,
    showModal,
    showToast,
  });

  const {
    fullScreenAdvancedRef,
    fullScreenAdvancedVisible,
    fullScreenControlsDisabled,
    handleFullScreenToggleWithExpand,
  } = useFullscreenAdvancedAutoExpand({
    fullScreenAdvancedExpanded,
    fullScreenModeChecked,
    handleFullScreenToggle,
    setFullScreenAdvancedExpanded,
  });

  const applyDockTemplateSettings = React.useCallback((templateSettings, sourceLabel = 'Template') => {
    const sanitized = sanitizeDockTemplateSettings(templateSettings);
    if (!sanitized || Object.keys(sanitized).length === 0) {
      showToast({
        type: 'error',
        message: 'Template could not be applied',
        description: 'This file does not contain output settings LyricDisplay Dock can use.'
      });
      return;
    }

    applySettings(sanitized);
    showToast({
      type: 'success',
      message: `${sourceLabel} applied`,
      description: 'Output settings were updated.'
    });
  }, [applySettings, showToast]);

  const handlePresetTemplateApply = React.useCallback((template) => {
    if (!template) return;
    applyDockTemplateSettings(getPresetSettings(template), template.title || 'Template');
    setTemplatePopoverOpen(false);
  }, [applyDockTemplateSettings, getPresetSettings]);

  const handleUserTemplateApply = React.useCallback((template) => {
    if (!template) return;
    applyDockTemplateSettings(template.settings, template.name || template.title || 'Template');
    setTemplatePopoverOpen(false);
  }, [applyDockTemplateSettings]);

  if (compact) {
    const compactInputClass = `h-8 text-xs ${darkMode
      ? 'bg-gray-800 border-gray-700 text-gray-100'
      : 'bg-white border-gray-300 text-gray-900'
      }`;
    const compactSelectClass = `h-8 text-xs ${darkMode
      ? 'bg-gray-800 border-gray-700 text-gray-100'
      : 'bg-white border-gray-300 text-gray-900'
      }`;
    const compactLabelClass = `text-[11px] font-medium uppercase tracking-wide ${darkMode ? 'text-gray-400' : 'text-gray-500'}`;

    const CompactField = ({ label, children }) => (
      <div className="space-y-1">
        <div className={compactLabelClass}>{label}</div>
        {children}
      </div>
    );
    const CompactSection = ({ title, children }) => (
      <section className={`rounded-md border p-2.5 ${darkMode ? 'border-gray-800 bg-gray-950/35' : 'border-gray-200 bg-gray-50/70'}`}>
        <div className={`mb-2 text-[11px] font-semibold uppercase tracking-wide ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>{title}</div>
        {children}
      </section>
    );
    const CompactGrid = ({ children }) => (
      <div
        className="grid gap-2"
        style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(128px, 1fr))' }}
      >
        {children}
      </div>
    );
    const ToggleButton = ({ active, disabled = false, onClick, children }) => (
      <button
        type="button"
        disabled={disabled}
        onClick={onClick}
        className={`h-8 rounded-md border px-2 text-xs font-semibold transition-colors ${active
          ? darkMode ? 'border-blue-500 bg-blue-500/15 text-blue-100' : 'border-blue-500 bg-blue-50 text-blue-900'
          : darkMode ? 'border-gray-800 bg-gray-900 text-gray-300 hover:bg-gray-800' : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-100'
          } ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
      >
        {children}
      </button>
    );
    const compactContentClass = darkMode ? 'bg-gray-900 border-gray-700 text-gray-100' : 'bg-white border-gray-300 text-gray-900';
    const compactItemClass = 'text-xs py-2';
    const compactSelectContentProps = {
      className: compactContentClass
    };
    const formatTemplateDate = (timestamp) => {
      if (!timestamp) return '';
      try {
        return new Date(timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      } catch {
        return '';
      }
    };
    const TemplateCard = ({ template, saved = false }) => {
      const settingsPreview = saved ? template.settings : getPresetSettings(template);
      const title = saved ? template.name : template.title;
      const meta = saved
        ? formatTemplateDate(template.createdAt)
        : template.description;
      const Icon = saved ? User : Sparkles;

      return (
        <button
          type="button"
          onClick={() => (saved ? handleUserTemplateApply(template) : handlePresetTemplateApply(template))}
          className="w-full rounded-md border border-gray-800 bg-gray-950 px-3 py-2 text-left transition-colors hover:border-blue-500/60 hover:bg-gray-900"
        >
          <div className="flex min-w-0 items-start gap-2">
            <Icon className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${saved ? 'text-purple-300' : 'text-blue-300'}`} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-semibold text-gray-100">{title || 'Template'}</div>
              {meta && (
                <div className="mt-0.5 truncate text-[10px] text-gray-500">{saved ? `Saved ${meta}` : meta}</div>
              )}
              <div className="mt-1.5 flex flex-wrap gap-1">
                {settingsPreview?.fontStyle && (
                  <span className="rounded bg-gray-800 px-1.5 py-0.5 text-[10px] text-gray-300">{settingsPreview.fontStyle}</span>
                )}
                {settingsPreview?.fontSize && (
                  <span className="rounded bg-gray-800 px-1.5 py-0.5 text-[10px] text-gray-300">{settingsPreview.fontSize}px</span>
                )}
                {settingsPreview?.lyricsPosition && (
                  <span className="rounded bg-gray-800 px-1.5 py-0.5 text-[10px] text-gray-300">{settingsPreview.lyricsPosition}</span>
                )}
                {settingsPreview?.maxLinesEnabled && (
                  <span className="rounded bg-gray-800 px-1.5 py-0.5 text-[10px] text-gray-300">{settingsPreview.maxLines} lines</span>
                )}
              </div>
            </div>
          </div>
        </button>
      );
    };
    const templateSheet = templatePopoverOpen && typeof document !== 'undefined' ? createPortal(
      <div
        className="fixed inset-0 z-[2350] bg-black/45 p-2"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) setTemplatePopoverOpen(false);
        }}
      >
        <div className="flex h-full flex-col overflow-hidden rounded-lg border border-gray-800 bg-gray-950 text-gray-100 shadow-2xl">
          <div className="flex items-center justify-between border-b border-gray-800 px-4 py-3">
            <div className="min-w-0">
              <div className="text-sm font-semibold">Output Templates</div>
              <div className="text-[11px] text-gray-500">Apply saved or preset output settings.</div>
            </div>
            <button
              type="button"
              onClick={() => setTemplatePopoverOpen(false)}
              className="ml-3 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-gray-800 text-gray-300 hover:bg-gray-900"
              aria-label="Close templates"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="border-b border-gray-800 p-3">
            <div className="grid grid-cols-2 gap-1 rounded-md bg-gray-900 p-1">
              <button
                type="button"
                onClick={() => setTemplateTab('presets')}
                className={`flex items-center justify-center gap-1.5 rounded px-2 py-2 text-xs font-semibold ${templateTab === 'presets' ? 'bg-gray-800 text-white' : 'text-gray-400 hover:text-gray-200'}`}
              >
                <Sparkles className="h-3.5 w-3.5" />
                Presets
              </button>
              <button
                type="button"
                onClick={() => setTemplateTab('saved')}
                className={`flex items-center justify-center gap-1.5 rounded px-2 py-2 text-xs font-semibold ${templateTab === 'saved' ? 'bg-gray-800 text-white' : 'text-gray-400 hover:text-gray-200'}`}
              >
                <User className="h-3.5 w-3.5" />
                My Templates
                {userTemplates.length > 0 && (
                  <span className="rounded-full bg-purple-500/25 px-1.5 text-[10px] text-purple-200">{userTemplates.length}</span>
                )}
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3">
            {templateTab === 'presets' ? (
              <div className="space-y-1.5">
                {outputTemplates.map((template) => (
                  <TemplateCard key={template.id} template={template} />
                ))}
              </div>
            ) : userTemplatesLoading ? (
              <div className="flex items-center justify-center gap-2 py-10 text-xs text-gray-400">
                <Clock className="h-3.5 w-3.5 animate-pulse" />
                Loading templates...
              </div>
            ) : userTemplates.length === 0 ? (
              <div className="rounded-md border border-dashed border-gray-800 px-3 py-10 text-center text-xs text-gray-500">
                Saved output templates will appear here.
              </div>
            ) : (
              <div className="space-y-1.5">
                {userTemplates.map((template) => (
                  <TemplateCard key={template.id} template={template} saved />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>,
      document.body
    ) : null;

    return (
      <div className="space-y-3" onKeyDown={blurInputOnEnter}>
        <div className={`flex items-center justify-between rounded-md border px-3 py-2 ${darkMode ? 'border-gray-800 bg-gray-900' : 'border-gray-200 bg-white'}`}>
          <div>
            <div className={`text-sm font-semibold ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>{outputKey.replace('output', 'Output ')}</div>
            <div className={`text-[11px] ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>{isOutputEnabled ? 'Enabled' : 'Disabled'}</div>
          </div>
          <button
            type="button"
            onClick={handleToggleOutput}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold ${isOutputEnabled
              ? 'bg-green-600 text-white hover:bg-green-700'
              : darkMode ? 'bg-gray-800 text-gray-300 hover:bg-gray-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
          >
            {isOutputEnabled ? 'On' : 'Off'}
          </button>
        </div>

        <CompactSection title="Templates">
          <button
            type="button"
            onClick={() => setTemplatePopoverOpen(true)}
            className="flex h-9 w-full items-center justify-center gap-2 rounded-md border border-gray-800 bg-gray-900 px-3 text-xs font-semibold text-gray-100 transition-colors hover:bg-gray-800"
          >
            <Sparkles className="h-3.5 w-3.5 text-blue-300" />
            Load Template
          </button>
          {templateSheet}
        </CompactSection>

        <CompactSection title="Typography">
          <CompactGrid>
            <CompactField label="Font">
              <FontSelect
                value={settings.fontStyle}
                onChange={(val) => update('fontStyle', val)}
                darkMode={darkMode}
                triggerClassName={compactSelectClass}
                containerClassName="relative w-full"
              />
            </CompactField>
            <CompactField label="Position">
              <Select value={lyricsPositionValue} onValueChange={handleLyricsPositionChange}>
                <SelectTrigger className={compactSelectClass}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent {...compactSelectContentProps}>
                  <SelectItem value="upper" className={compactItemClass}>Upper</SelectItem>
                  <SelectItem value="center" className={compactItemClass}>Centre</SelectItem>
                  <SelectItem value="lower" className={compactItemClass}>Lower</SelectItem>
                </SelectContent>
              </Select>
            </CompactField>
            <CompactField label="Font Size">
              <Input
                type="number"
                min="12"
                max="200"
                value={currentFontSize}
                onChange={(e) => update('fontSize', sanitizeIntegerInput(e.target.value, currentFontSize ?? 48, { min: 12, max: 300, clampMin: false }))}
                className={compactInputClass}
              />
            </CompactField>
            <CompactField label="Min Size">
              <Input
                type="number"
                min="12"
                max="100"
                disabled={!maxLinesEnabled}
                value={settings.minFontSize ?? 24}
                onChange={(e) => update('minFontSize', sanitizeIntegerInput(e.target.value, settings.minFontSize ?? 24, { min: 12, max: 100, clampMin: false }))}
                className={`${compactInputClass} ${!maxLinesEnabled ? 'opacity-50 cursor-not-allowed' : ''}`}
              />
            </CompactField>
            <CompactField label="Max Lines">
              <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-2">
                <ToggleButton active={maxLinesEnabled} onClick={() => update('maxLinesEnabled', !maxLinesEnabled)}>
                  {maxLinesEnabled ? 'On' : 'Off'}
                </ToggleButton>
                <Input
                  type="number"
                  min="1"
                  max="10"
                  disabled={!maxLinesEnabled}
                  value={maxLinesValue}
                  onChange={(e) => update('maxLines', sanitizeIntegerInput(e.target.value, maxLinesValue ?? 3, { min: 1, max: 10 }))}
                  className={`${compactInputClass} ${!maxLinesEnabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                />
              </div>
            </CompactField>
            <CompactField label="Translation">
              <div className="grid grid-cols-[minmax(0,1fr)_4rem] gap-2">
                <Select value={translationFontSizeMode} onValueChange={handleTranslationFontSizeModeChange}>
                  <SelectTrigger className={compactSelectClass}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent {...compactSelectContentProps}>
                    <SelectItem value="bound" className={compactItemClass}>Bound</SelectItem>
                    <SelectItem value="custom" className={compactItemClass}>Custom</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  min="12"
                  max={currentFontSize}
                  disabled={translationFontSizeMode !== 'custom'}
                  value={translationFontSize}
                  onChange={(e) => handleTranslationFontSizeChange(e.target.value)}
                  className={`${compactInputClass} ${translationFontSizeMode !== 'custom' ? 'opacity-50 cursor-not-allowed' : ''}`}
                />
              </div>
            </CompactField>
          </CompactGrid>
        </CompactSection>

        <CompactSection title="Colour & Style">
          <CompactGrid>
            <CompactField label="Text">
              <ColorPicker
                value={settings.fontColor}
                onChange={(val) => update('fontColor', val)}
                darkMode={darkMode}
                showHex
                presentation="sheet"
                className={compactSelectClass}
              />
            </CompactField>
            <CompactField label="Translation">
              <ColorPicker
                value={translationLineColor}
                onChange={(val) => update('translationLineColor', val)}
                darkMode={darkMode}
                showHex
                presentation="sheet"
                className={compactSelectClass}
              />
            </CompactField>
            <CompactField label="Border">
              <ColorPicker
                value={settings.borderColor}
                onChange={(val) => update('borderColor', val)}
                darkMode={darkMode}
                showHex
                presentation="sheet"
                className={compactSelectClass}
              />
            </CompactField>
            <CompactField label="Border Size">
              <Input
                type="number"
                min="0"
                max="12"
                value={settings.borderSize ?? 0}
                onChange={(e) => update('borderSize', sanitizeIntegerInput(e.target.value, settings.borderSize ?? 0, { min: 0, max: 12 }))}
                className={compactInputClass}
              />
            </CompactField>
            <CompactField label="Align">
              <Select value={settings.textAlign || 'center'} onValueChange={(val) => update('textAlign', val)}>
                <SelectTrigger className={compactSelectClass}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent {...compactSelectContentProps}>
                  <SelectItem value="left" className={compactItemClass}>Left</SelectItem>
                  <SelectItem value="center" className={compactItemClass}>Centre</SelectItem>
                  <SelectItem value="right" className={compactItemClass}>Right</SelectItem>
                </SelectContent>
              </Select>
            </CompactField>
            <CompactField label="Emphasis">
              <div className="grid grid-cols-4 gap-1">
                <ToggleButton active={settings.bold} onClick={() => update('bold', !settings.bold)}>B</ToggleButton>
                <ToggleButton active={settings.italic} onClick={() => update('italic', !settings.italic)}>I</ToggleButton>
                <ToggleButton active={settings.underline} onClick={() => update('underline', !settings.underline)}>U</ToggleButton>
                <ToggleButton active={settings.allCaps} onClick={() => update('allCaps', !settings.allCaps)}>AA</ToggleButton>
              </div>
            </CompactField>
          </CompactGrid>
        </CompactSection>

        <CompactSection title="Background Band">
          <CompactGrid>
            <CompactField label="Paint">
              <PaintPicker
                value={settings.backgroundPaint}
                fallbackColor={settings.backgroundColor ?? '#000000'}
                onChange={(val) => {
                  applySettings({
                    backgroundPaint: val,
                    ...(val?.type === 'solid' ? { backgroundColor: val.color } : {}),
                  });
                }}
                darkMode={darkMode}
                showValue
                presentation="sheet"
                className={compactSelectClass}
              />
            </CompactField>
            <CompactField label="Opacity">
              <Input
                type="number"
                min="0"
                max="10"
                step="0.1"
                value={settings.backgroundOpacity ?? 0}
                onChange={(e) => update('backgroundOpacity', sanitizeNumberInput(e.target.value, settings.backgroundOpacity ?? 0, { min: 0, max: 10, clampMin: false }))}
                className={compactInputClass}
              />
            </CompactField>
            <CompactField label="Height">
              <Select value={backgroundBandHeightMode} onValueChange={handleBackgroundHeightModeChange}>
                <SelectTrigger className={compactSelectClass}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent {...compactSelectContentProps}>
                  <SelectItem value="adaptive" className={compactItemClass}>Adaptive</SelectItem>
                  <SelectItem value="custom" className={compactItemClass}>Custom</SelectItem>
                </SelectContent>
              </Select>
            </CompactField>
            <CompactField label="Padding">
              <Input
                type="number"
                min="0"
                max="100"
                value={backgroundBandVerticalPadding}
                onChange={(e) => update('backgroundBandVerticalPadding', sanitizeIntegerInput(e.target.value, settings.backgroundBandVerticalPadding ?? 20, { min: 0, max: 100 }))}
                className={compactInputClass}
              />
            </CompactField>
            {backgroundBandHeightMode === 'custom' && (
              <>
                <CompactField label="Band Lines">
                  <Input
                    type="number"
                    min="1"
                    max={maxLinesEnabled ? maxLinesValue : 10}
                    disabled={backgroundBandLockedToMaxLines && maxLinesEnabled}
                    value={backgroundBandCustomLines}
                    onChange={(e) => handleCustomLinesChange(e.target.value)}
                    className={`${compactInputClass} ${backgroundBandLockedToMaxLines && maxLinesEnabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                  />
                </CompactField>
                <CompactField label="Lock Lines">
                  <ToggleButton
                    active={backgroundBandLockedToMaxLines && maxLinesEnabled}
                    disabled={!maxLinesEnabled}
                    onClick={() => applySettings({
                      backgroundBandLockedToMaxLines: !backgroundBandLockedToMaxLines,
                      backgroundBandCustomLines: !backgroundBandLockedToMaxLines ? maxLinesValue : backgroundBandCustomLines
                    })}
                  >
                    {backgroundBandLockedToMaxLines && maxLinesEnabled ? 'Locked' : 'Free'}
                  </ToggleButton>
                </CompactField>
              </>
            )}
          </CompactGrid>
        </CompactSection>

        <CompactSection title="Shadow">
          <CompactGrid>
            <CompactField label="Colour">
              <ColorPicker
                value={settings.dropShadowColor}
                onChange={(val) => update('dropShadowColor', val)}
                darkMode={darkMode}
                showHex
                presentation="sheet"
                className={compactSelectClass}
              />
            </CompactField>
            <CompactField label="Opacity">
              <Input
                type="number"
                min="0"
                max="10"
                value={settings.dropShadowOpacity ?? 0}
                onChange={(e) => update('dropShadowOpacity', sanitizeIntegerInput(e.target.value, settings.dropShadowOpacity ?? 0, { min: 0, max: 10 }))}
                className={compactInputClass}
              />
            </CompactField>
            <CompactField label="Offset X">
              <Input
                type="number"
                min="-50"
                max="50"
                value={dropShadowOffsetX}
                onChange={(e) => update('dropShadowOffsetX', sanitizeIntegerInput(e.target.value, dropShadowOffsetX ?? 0, { min: -50, max: 50 }))}
                className={compactInputClass}
              />
            </CompactField>
            <CompactField label="Offset Y">
              <Input
                type="number"
                min="-50"
                max="50"
                value={dropShadowOffsetY}
                onChange={(e) => update('dropShadowOffsetY', sanitizeIntegerInput(e.target.value, dropShadowOffsetY ?? 0, { min: -50, max: 50 }))}
                className={compactInputClass}
              />
            </CompactField>
            <CompactField label="Blur">
              <Input
                type="number"
                min="0"
                max="60"
                value={dropShadowBlur}
                onChange={(e) => update('dropShadowBlur', sanitizeIntegerInput(e.target.value, dropShadowBlur ?? 0, { min: 0, max: 60 }))}
                className={compactInputClass}
              />
            </CompactField>
          </CompactGrid>
        </CompactSection>

        <CompactSection title="Layout & Motion">
          <CompactGrid>
            <CompactField label="Line Spacing">
              <Input
                type="number"
                min="0.8"
                max="3"
                step="0.05"
                value={settings.lineSpacing ?? 1}
                onChange={(e) => update('lineSpacing', sanitizeNumberInput(e.target.value, settings.lineSpacing ?? 1, { min: 0.8, max: 3 }))}
                className={compactInputClass}
              />
            </CompactField>
            <CompactField label="Letter Space">
              <Input
                type="number"
                min="-5"
                max="20"
                step="0.5"
                value={settings.letterSpacing ?? 0}
                onChange={(e) => update('letterSpacing', sanitizeNumberInput(e.target.value, settings.letterSpacing ?? 0, { min: -5, max: 20 }))}
                className={compactInputClass}
              />
            </CompactField>
            <CompactField label="X Margin">
              <Input
                type="number"
                value={settings.xMargin ?? 0}
                onChange={(e) => update('xMargin', sanitizeNumberInput(e.target.value, settings.xMargin ?? 0))}
                className={compactInputClass}
              />
            </CompactField>
            <CompactField label="Y Margin">
              <Input
                type="number"
                value={settings.yMargin ?? 0}
                onChange={(e) => update('yMargin', sanitizeNumberInput(e.target.value, settings.yMargin ?? 0))}
                className={compactInputClass}
              />
            </CompactField>
            <CompactField label="Transition">
              <Select value={settings.transitionAnimation ?? 'none'} onValueChange={(val) => update('transitionAnimation', val)}>
                <SelectTrigger className={compactSelectClass}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent {...compactSelectContentProps}>
                  <SelectItem value="none" className={compactItemClass}>None</SelectItem>
                  <SelectItem value="fade" className={compactItemClass}>Fade</SelectItem>
                  <SelectItem value="scale" className={compactItemClass}>Scale</SelectItem>
                  <SelectItem value="slide" className={compactItemClass}>Slide</SelectItem>
                  <SelectItem value="blur" className={compactItemClass}>Blur</SelectItem>
                </SelectContent>
              </Select>
            </CompactField>
            <CompactField label="Speed">
              <Input
                type="number"
                min="100"
                max="2000"
                step="50"
                disabled={(settings.transitionAnimation ?? 'none') === 'none'}
                value={settings.transitionSpeed ?? 150}
                onChange={(e) => update('transitionSpeed', sanitizeIntegerInput(e.target.value, settings.transitionSpeed ?? 150, { min: 100, max: 2000, clampMin: false }))}
                className={`${compactInputClass} ${(settings.transitionAnimation ?? 'none') === 'none' ? 'opacity-50 cursor-not-allowed' : ''}`}
              />
            </CompactField>
          </CompactGrid>
        </CompactSection>

        <p className={`text-[11px] ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>
          Fullscreen media and background controls are available in the desktop app.
        </p>
      </div>
    );
  }

  const SettingRow = ({ icon, label, tooltip, children, rightClassName = 'flex items-center gap-2 justify-end', justifyEnd = true }) => (
    <div className="flex items-center justify-between gap-4">
      <Tooltip content={tooltip} side="right">
        <LabelWithIcon icon={icon} text={label} darkMode={darkMode} />
      </Tooltip>
      <div className={`${rightClassName} ${justifyEnd ? '' : ''}`}>
        {children}
      </div>
    </div>
  );

  return (
    <div className="space-y-4" onKeyDown={blurInputOnEnter}>
      <PanelHeaderActions
        applySettings={applySettings}
        darkMode={darkMode}
        handleToggleOutput={handleToggleOutput}
        isOutputEnabled={isOutputEnabled}
        onDeleteOutput={onDeleteOutput}
        outputKey={outputKey}
        settings={settings}
        showModal={showModal}
        showToast={showToast}
      />
      {/* Lyrics Position */}
      <LyricsPositionSection
        darkMode={darkMode}
        lyricsPositionValue={lyricsPositionValue}
        handleLyricsPositionChange={handleLyricsPositionChange}
        fullScreenModeChecked={fullScreenModeChecked}
      />

      {/* Font Picker */}
      <FontStyleSection
        darkMode={darkMode}
        fontStyle={settings.fontStyle}
        onChange={(val) => update('fontStyle', val)}
      />

      <FontSizeSettingsSection
        currentFontSize={currentFontSize}
        darkMode={darkMode}
        fontSizeAdvancedExpanded={fontSizeAdvancedExpanded}
        handleTranslationFontSizeChange={handleTranslationFontSizeChange}
        handleTranslationFontSizeModeChange={handleTranslationFontSizeModeChange}
        maxLinesEnabled={maxLinesEnabled}
        setFontSizeAdvancedExpanded={setFontSizeAdvancedExpanded}
        settings={settings}
        translationFontSize={translationFontSize}
        translationFontSizeMode={translationFontSizeMode}
        update={update}
      />
      {/* Font Color */}
      <FontColorSection
        darkMode={darkMode}
        fontColor={settings.fontColor}
        onChange={(val) => update('fontColor', val)}
        fontColorAdvancedExpanded={fontColorAdvancedExpanded}
        setFontColorAdvancedExpanded={setFontColorAdvancedExpanded}
      />

      {/* Font Color Advanced Settings Row */}
      <div
        className={`overflow-hidden transition-[max-height,opacity,transform] duration-300 ease-out ${fontColorAdvancedExpanded
          ? 'max-h-20 opacity-100 translate-y-0 pointer-events-auto mt-1'
          : 'max-h-0 opacity-0 -translate-y-2 pointer-events-none m-0 p-0'
          }`}
        aria-hidden={!fontColorAdvancedExpanded}
        style={{ marginTop: fontColorAdvancedExpanded ? undefined : 0 }}
      >
        <div className="flex items-center justify-between w-full">
          <label className={`text-sm whitespace-nowrap ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>
            Translation Colour
          </label>
          <ColorPicker
            value={translationLineColor}
            onChange={(val) => update('translationLineColor', val)}
            darkMode={darkMode}
            className={darkMode ? 'bg-gray-700 border-gray-600 text-gray-200' : 'bg-white border-gray-300'}
          />
        </div>
      </div>

      {/* Bold / Italic / Underline / All Caps */}
      <EmphasisRow
        darkMode={darkMode}
        icon={SquareMenu}
        boldValue={settings.bold}
        italicValue={settings.italic}
        underlineValue={settings.underline}
        allCapsValue={settings.allCaps}
        onBoldChange={(val) => update('bold', val)}
        onItalicChange={(val) => update('italic', val)}
        onUnderlineChange={(val) => update('underline', val)}
        onAllCapsChange={(val) => update('allCaps', val)}
      />

      {/* Text Alignment */}
      <AlignmentRow
        darkMode={darkMode}
        icon={TextAlignJustify}
        value={settings.textAlign}
        onChange={(val) => update('textAlign', val)}
        tooltip="Text alignment for lyrics display"
      />

      <TypographySpacingSection
        darkMode={darkMode}
        settings={settings}
        update={update}
      />
      <DropShadowSettingsSection
        darkMode={darkMode}
        dropShadowAdvancedExpanded={dropShadowAdvancedExpanded}
        dropShadowBlur={dropShadowBlur}
        dropShadowOffsetX={dropShadowOffsetX}
        dropShadowOffsetY={dropShadowOffsetY}
        setDropShadowAdvancedExpanded={setDropShadowAdvancedExpanded}
        settings={settings}
        update={update}
      />
      {/* Background */}
      <BackgroundSection
        applySettings={applySettings}
        darkMode={darkMode}
        settings={settings}
        update={update}
        backgroundAdvancedExpanded={backgroundAdvancedExpanded}
        setBackgroundAdvancedExpanded={setBackgroundAdvancedExpanded}
        fullScreenModeChecked={fullScreenModeChecked}
        backgroundDisabledTooltip={backgroundDisabledTooltip}
      />

      <BackgroundBandSettingsSection
        applySettings={applySettings}
        backgroundAdvancedExpanded={backgroundAdvancedExpanded}
        backgroundBandCustomLines={backgroundBandCustomLines}
        backgroundBandHeightMode={backgroundBandHeightMode}
        backgroundBandLockedToMaxLines={backgroundBandLockedToMaxLines}
        backgroundBandVerticalPadding={backgroundBandVerticalPadding}
        darkMode={darkMode}
        fullScreenModeChecked={fullScreenModeChecked}
        handleBackgroundHeightModeChange={handleBackgroundHeightModeChange}
        handleCustomLinesChange={handleCustomLinesChange}
        maxLinesEnabled={maxLinesEnabled}
        maxLinesValue={maxLinesValue}
        settings={settings}
        update={update}
      />
      {/* X and Y Margins */}
      <MarginsSection
        darkMode={darkMode}
        settings={settings}
        update={update}
      />

      <TransitionSettingsSection
        darkMode={darkMode}
        setTransitionAdvancedExpanded={setTransitionAdvancedExpanded}
        settings={settings}
        transitionAdvancedExpanded={transitionAdvancedExpanded}
        update={update}
      />
      <FullscreenSettingsSection
        darkMode={darkMode}
        fullScreenAdvancedExpanded={fullScreenAdvancedExpanded}
        setFullScreenAdvancedExpanded={setFullScreenAdvancedExpanded}
        fullScreenModeChecked={fullScreenModeChecked}
        handleFullScreenToggleWithExpand={handleFullScreenToggleWithExpand}
        fullScreenAdvancedRef={fullScreenAdvancedRef}
        fullScreenOptionsWrapperClass={fullScreenOptionsWrapperClass}
        fullScreenAdvancedVisible={fullScreenAdvancedVisible}
        fullScreenControlsDisabled={fullScreenControlsDisabled}
        fullScreenBackgroundTypeValue={fullScreenBackgroundTypeValue}
        handleFullScreenBackgroundTypeChange={handleFullScreenBackgroundTypeChange}
        fullScreenBackgroundColorValue={fullScreenBackgroundColorValue}
        fullScreenBackgroundPaintValue={fullScreenBackgroundPaintValue}
        handleFullScreenPaintChange={handleFullScreenPaintChange}
        openMediaLibrary={openMediaLibrary}
        hasBackgroundMedia={hasBackgroundMedia}
        uploadedMediaName={uploadedMediaName}
        settings={settings}
        update={update}
        openFullScreenElementMediaLibrary={openFullScreenElementMediaLibrary}
        hasFullScreenElementMedia={hasFullScreenElementMedia}
        fullScreenElementMediaName={fullScreenElementMediaName}
        handleFullScreenElementToggle={handleFullScreenElementToggle}
      />

    </div>
  );
};

export default OutputSettingsPanel;
