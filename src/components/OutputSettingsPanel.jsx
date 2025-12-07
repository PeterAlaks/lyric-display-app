import React from 'react';
import { useDarkModeState, useOutput1Settings, useOutput2Settings, useStageSettings, useIndividualOutputState } from '../hooks/useStoreSelectors';
import { useControlSocket } from '../context/ControlSocketProvider';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tooltip } from '@/components/ui/tooltip';
import { ColorPicker } from "@/components/ui/color-picker";
import useToast from '../hooks/useToast';
import useModal from '../hooks/useModal';
import useAuth from '../hooks/useAuth';
import useOutputToggle from '../hooks/OutputSettingsPanel/useOutputToggle';
import useFullscreenBackground from '../hooks/OutputSettingsPanel/useFullscreenBackground';
import useAdvancedSectionPersistence from '../hooks/OutputSettingsPanel/useAdvancedSectionPersistence';
import useTypographyAndBands from '../hooks/OutputSettingsPanel/useTypographyAndBands';
import useFullscreenModeState from '../hooks/OutputSettingsPanel/useFullscreenModeState';
import { Type, Paintbrush, Contrast, TextCursorInput, TextQuote, Square, Frame, Move, Italic, Underline, Bold, CaseUpper, AlignVerticalSpaceAround, ScreenShare, ListStart, ArrowUpDown, Rows3, MoveHorizontal, MoveVertical, Sparkles, Languages, Wand2, HardDriveDownload, Power } from 'lucide-react';
import FontSelect from './FontSelect';
import StageSettingsPanel from './StageSettingsPanel';
import { blurInputOnEnter, AdvancedToggle, LabelWithIcon, EmphasisRow } from './OutputSettingsShared';

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
    icon={Paintbrush}
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

const DropShadowSection = ({
  darkMode,
  settings,
  update,
  dropShadowAdvancedExpanded,
  setDropShadowAdvancedExpanded
}) => (
  <SettingRow
    icon={Contrast}
    label="Drop Shadow"
    tooltip="Add shadow behind text for depth (0-10 opacity)"
    rightClassName="flex items-center gap-2 justify-end w-full"
    darkMode={darkMode}
  >
    <Tooltip content={dropShadowAdvancedExpanded ? "Hide advanced settings" : "Show advanced settings"} side="top">
      <AdvancedToggle
        expanded={dropShadowAdvancedExpanded}
        onToggle={() => setDropShadowAdvancedExpanded(!dropShadowAdvancedExpanded)}
        darkMode={darkMode}
        ariaLabel="Toggle drop shadow advanced settings"
      />
    </Tooltip>
    <ColorPicker
      value={settings.dropShadowColor}
      onChange={(val) => update('dropShadowColor', val)}
      darkMode={darkMode}
      className={darkMode ? 'bg-gray-700 border-gray-600 text-gray-200' : 'bg-white border-gray-300'}
    />
    <Input
      type="number"
      value={settings.dropShadowOpacity}
      onChange={(e) => update('dropShadowOpacity', parseInt(e.target.value))}
      min="0"
      max="10"
      className={`w-20 ${darkMode
        ? 'bg-gray-700 border-gray-600 text-gray-200'
        : 'bg-white border-gray-300'
        }`}
    />
  </SettingRow>
);

const BackgroundSection = ({
  darkMode,
  settings,
  update,
  backgroundAdvancedExpanded,
  setBackgroundAdvancedExpanded,
  fullScreenModeChecked,
  backgroundDisabledTooltip
}) => (
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
    <ColorPicker
      value={settings.backgroundColor}
      onChange={(val) => update('backgroundColor', val)}
      disabled={fullScreenModeChecked}
      darkMode={darkMode}
      className={`${darkMode ? 'bg-gray-700 border-gray-600 text-gray-200' : 'bg-white border-gray-300'} ${fullScreenModeChecked ? 'opacity-60 cursor-not-allowed' : ''}`}
    />
    <Input
      type="number"
      value={settings.backgroundOpacity ?? 0}
      onChange={(e) => update('backgroundOpacity', parseInt(e.target.value))}
      min="0"
      max="10"
      disabled={fullScreenModeChecked}
      className={`w-20 ${darkMode
        ? 'bg-gray-700 border-gray-600 text-gray-200'
        : 'bg-white border-gray-300'
        } ${fullScreenModeChecked ? 'opacity-60 cursor-not-allowed' : ''}`}
      title={fullScreenModeChecked ? backgroundDisabledTooltip : undefined}
    />
  </SettingRow>
);

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
      onChange={(e) => update('xMargin', parseFloat(e.target.value))}
      className={`w-20 ${darkMode
        ? 'bg-gray-700 border-gray-600 text-gray-200'
        : 'bg-white border-gray-300'
        }`}
    />
    <Input
      type="number"
      value={settings.yMargin}
      onChange={(e) => update('yMargin', parseFloat(e.target.value))}
      className={`w-20 ${darkMode
        ? 'bg-gray-700 border-gray-600 text-gray-200'
        : 'bg-white border-gray-300'
        }`}
    />
  </SettingRow>
);

const TransitionSection = ({
  darkMode,
  settings,
  update,
  transitionAdvancedExpanded,
  setTransitionAdvancedExpanded
}) => (
  <SettingRow
    icon={Wand2}
    label="Transition Style"
    tooltip="Choose animation style when lyrics change on display"
    rightClassName="flex items-center gap-2 justify-end w-full"
    darkMode={darkMode}
  >
    <Tooltip content={transitionAdvancedExpanded ? "Hide advanced settings" : "Show advanced settings"} side="top">
      <AdvancedToggle
        expanded={transitionAdvancedExpanded}
        onToggle={() => setTransitionAdvancedExpanded(!transitionAdvancedExpanded)}
        darkMode={darkMode}
        ariaLabel="Toggle transition advanced settings"
      />
    </Tooltip>
    <Select
      value={settings.transitionAnimation ?? 'none'}
      onValueChange={(val) => update('transitionAnimation', val)}
    >
      <SelectTrigger
        className={`w-[140px] ${darkMode
          ? 'bg-gray-700 border-gray-600 text-gray-200'
          : 'bg-white border-gray-300'
          }`}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent className={darkMode ? 'bg-gray-700 border-gray-600 text-gray-200' : 'bg-white border-gray-300'}>
        <SelectItem value="none">None</SelectItem>
        <SelectItem value="fade">Fade</SelectItem>
        <SelectItem value="scale">Scale</SelectItem>
        <SelectItem value="slide">Slide</SelectItem>
        <SelectItem value="blur">Blur</SelectItem>
      </SelectContent>
    </Select>
  </SettingRow>
);

const OutputSettingsPanel = ({ outputKey }) => {
  const { darkMode } = useDarkModeState();
  const { emitStyleUpdate, emitIndividualOutputToggle } = useControlSocket();
  const { showToast } = useToast();
  const { showModal } = useModal();
  const { ensureValidToken } = useAuth();

  const { output1Enabled, output2Enabled, stageEnabled, setOutput1Enabled, setOutput2Enabled, setStageEnabled } = useIndividualOutputState();

  const stageSettingsHook = useStageSettings();

  const { settings, updateSettings } =
    outputKey === 'stage'
      ? stageSettingsHook
      : outputKey === 'output1'
        ? useOutput1Settings()
        : useOutput2Settings();

  const isOutputEnabled = outputKey === 'output1' ? output1Enabled
    : outputKey === 'output2' ? output2Enabled
      : stageEnabled;

  const setOutputEnabled = outputKey === 'output1' ? setOutput1Enabled
    : outputKey === 'output2' ? setOutput2Enabled
      : setStageEnabled;

  const { handleToggleOutput } = useOutputToggle({
    outputKey,
    isOutputEnabled,
    setOutputEnabled,
    emitIndividualOutputToggle,
    showToast
  });

  if (outputKey === 'stage') {
    const applyStageSettings = React.useCallback((partial) => {
      const newSettings = { ...settings, ...partial };
      updateSettings(partial);
      emitStyleUpdate('stage', newSettings);
    }, [settings, updateSettings, emitStyleUpdate]);

    const updateStage = React.useCallback((key, value) => {
      applyStageSettings({ [key]: value });
    }, [applyStageSettings]);

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
    fileInputRef,
    handleMediaSelection,
    triggerFileDialog,
    hasBackgroundMedia,
    uploadedMediaName,
    validateExistingMedia
  } = useFullscreenBackground({
    outputKey,
    settings,
    applySettings,
    ensureValidToken,
    showToast
  });

  React.useEffect(() => {
    if (settings.fullScreenMode) {
      validateExistingMedia();
    }
  }, [settings.fullScreenMode, settings.fullScreenBackgroundMedia?.url, validateExistingMedia]);

  const {
    fullScreenModeChecked,
    lyricsPositionValue,
    fullScreenBackgroundTypeValue,
    fullScreenBackgroundColorValue,
    backgroundDisabledTooltip,
    fullScreenOptionsWrapperClass,
    handleLyricsPositionChange,
    handleFullScreenToggle,
    handleFullScreenBackgroundTypeChange,
    handleFullScreenColorChange
  } = useFullscreenModeState({ settings, applySettings });

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
    setTransitionAdvancedExpanded
  } = useAdvancedSectionPersistence(outputKey);

  React.useEffect(() => {
    if (settings.maxLinesEnabled && !fontSizeAdvancedExpanded) {
      setFontSizeAdvancedExpanded(true);
    }
  }, [settings.maxLinesEnabled, fontSizeAdvancedExpanded, setFontSizeAdvancedExpanded]);

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
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className={`text-sm font-medium uppercase tracking-wide ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
          {outputKey.toUpperCase()} SETTINGS
        </h3>

        <div className="flex items-center gap-2">
          {/* Toggle Output Button */}
          <Tooltip content={isOutputEnabled
            ? `Turn off ${outputKey === 'output1' ? 'Output 1' : 'Output 2'}`
            : `Turn on ${outputKey === 'output1' ? 'Output 1' : 'Output 2'}`}
            side="bottom">
            <button
              onClick={handleToggleOutput}
              className={`p-1.5 rounded-lg transition-colors ${!isOutputEnabled
                ? darkMode
                  ? 'bg-red-600/80 text-white hover:bg-red-600'
                  : 'bg-red-500 text-white hover:bg-red-600'
                : darkMode
                  ? 'hover:bg-gray-700 text-gray-400 hover:text-gray-200'
                  : 'hover:bg-gray-100 text-gray-500 hover:text-gray-700'
                }`}
              title={isOutputEnabled
                ? `Turn off ${outputKey === 'output1' ? 'Output 1' : 'Output 2'}`
                : `Turn on ${outputKey === 'output1' ? 'Output 1' : 'Output 2'}`}
            >
              <Power className="w-4 h-4" />
            </button>
          </Tooltip>

          {/* Templates trigger button */}
          <button
            onClick={() => {
              showModal({
                title: 'Output Templates',
                headerDescription: 'Choose from professionally designed output presets',
                component: 'OutputTemplates',
                variant: 'info',
                size: 'large',
                dismissLabel: 'Close',
                outputKey: outputKey,
                onApplyTemplate: (template) => {
                  const templateSettings = template.getSettings
                    ? template.getSettings(outputKey)
                    : template.settings;
                  applySettings(templateSettings);
                  showToast({
                    title: 'Template Applied',
                    message: `${template.title} template has been applied successfully`,
                    variant: 'success',
                  });
                }
              });
            }}
            className={`p-1.5 rounded-lg transition-colors ${darkMode
              ? 'hover:bg-gray-700 text-gray-400 hover:text-gray-200'
              : 'hover:bg-gray-100 text-gray-500 hover:text-gray-700'
              }`}
            title="Output Templates"
          >
            <HardDriveDownload className="w-4 h-4" />
          </button>

          {/* Help trigger button */}
          <button
            onClick={() => {
              showModal({
                title: 'Output Settings Help',
                headerDescription: 'Customize every aspect of your lyric display appearance',
                component: 'OutputSettingsHelp',
                variant: 'info',
                size: 'large',
                dismissLabel: 'Got it'
              });
            }}
            className={`p-1.5 rounded-lg transition-colors ${darkMode
              ? 'hover:bg-gray-700 text-gray-400 hover:text-gray-200'
              : 'hover:bg-gray-100 text-gray-500 hover:text-gray-700'
              }`}
            title="Output Settings Help"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>
        </div>
      </div>

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

      {/* Bold / Italic / Underline / All Caps */}
      <EmphasisRow
        darkMode={darkMode}
        icon={TextQuote}
        boldValue={settings.bold}
        italicValue={settings.italic}
        underlineValue={settings.underline}
        allCapsValue={settings.allCaps}
        onBoldChange={(val) => update('bold', val)}
        onItalicChange={(val) => update('italic', val)}
        onUnderlineChange={(val) => update('underline', val)}
        onAllCapsChange={(val) => update('allCaps', val)}
      />

      {/* Font Size */}
      <div className="flex items-center justify-between gap-4">
        <Tooltip content="Adjust text size in pixels (24-100)" side="right">
          <LabelWithIcon icon={TextCursorInput} text="Font Size" darkMode={darkMode} />
        </Tooltip>
        <div className="flex items-center gap-2 justify-end w-full">
          <Tooltip content={fontSizeAdvancedExpanded ? "Hide advanced settings" : "Show advanced settings"} side="top">
            <AdvancedToggle
              expanded={fontSizeAdvancedExpanded}
              onToggle={() => setFontSizeAdvancedExpanded(!fontSizeAdvancedExpanded)}
              darkMode={darkMode}
              ariaLabel="Toggle font size advanced settings"
            />
          </Tooltip>
          {(() => {
            const baseFont = Number.isFinite(settings.fontSize) ? settings.fontSize : 24;
            const instanceCount = settings.instanceCount || 0;
            const hasMultipleInstances = instanceCount > 1;
            const allInstances = settings.allInstances || [];

            let anyInstanceResizing = false;
            let primaryAdjustedSize = null;

            if (settings.maxLinesEnabled && instanceCount > 0) {
              if (hasMultipleInstances && allInstances.length > 0) {
                anyInstanceResizing = allInstances.some(inst => inst.autosizerActive === true);
                const primaryInstance = allInstances.reduce((largest, current) => {
                  if (!largest) return current;
                  const largestArea = (largest.viewportWidth || 0) * (largest.viewportHeight || 0);
                  const currentArea = (current.viewportWidth || 0) * (current.viewportHeight || 0);
                  return currentArea > largestArea ? current : largest;
                }, null);
                primaryAdjustedSize = primaryInstance?.adjustedFontSize ?? null;
              } else if (allInstances.length > 0) {
                const singleInstance = allInstances[0];
                anyInstanceResizing = Boolean(singleInstance?.autosizerActive);
                primaryAdjustedSize = singleInstance?.adjustedFontSize ?? null;
              } else if (settings.autosizerActive) {
                anyInstanceResizing = true;
                primaryAdjustedSize = null;
              }
            }

            const primaryInstanceResizing = anyInstanceResizing && primaryAdjustedSize !== null && primaryAdjustedSize !== baseFont;
            const displayFontSize = primaryInstanceResizing ? primaryAdjustedSize : baseFont;

            const primaryViewport = settings.primaryViewportWidth && settings.primaryViewportHeight
              ? `${settings.primaryViewportWidth}×${settings.primaryViewportHeight}`
              : null;

            let inputDisplayValue = displayFontSize;
            if (hasMultipleInstances && anyInstanceResizing && allInstances.length > 0) {
              const primaryValue = displayFontSize;
              const otherResizingInstance = allInstances.find(inst =>
                inst.autosizerActive === true &&
                inst.adjustedFontSize !== primaryValue
              );

              if (otherResizingInstance) {
                const otherValue = otherResizingInstance.adjustedFontSize ?? baseFont;
                inputDisplayValue = allInstances.length > 2
                  ? `${primaryValue}, ${otherValue}…`
                  : `${primaryValue}, ${otherValue}`;
              } else if (allInstances.length > 1) {
                inputDisplayValue = `${primaryValue}…`;
              }
            }

            let tooltipText = '';
            if (anyInstanceResizing) {
              if (hasMultipleInstances) {
                tooltipText = `Auto-resizing active on ${instanceCount} displays\n\nPrimary (${primaryViewport}): ${displayFontSize}px`;
                if (allInstances.length > 0) {
                  allInstances.forEach((inst, idx) => {
                    const viewport = `${inst.viewportWidth}×${inst.viewportHeight}`;
                    const size = inst.adjustedFontSize ?? baseFont;
                    tooltipText += `\nDisplay ${idx + 1} (${viewport}): ${size}px`;
                  });
                }
                tooltipText += `\n\nPreferred size: ${settings.fontSize}px`;
              } else {
                tooltipText = `Auto-resizing active: ${displayFontSize}px (preferred: ${settings.fontSize}px)`;
              }
            } else {
              tooltipText = 'Set the preferred font size in pixels';
            }

            const innerClassBase = `${darkMode ? 'bg-gray-700 border-gray-600 text-gray-200' : 'bg-white border-gray-300'}`;

            return (
              <div className={`flex items-center ${anyInstanceResizing ? 'gap-2' : ''}`} aria-live={anyInstanceResizing ? 'polite' : undefined}>
                {anyInstanceResizing && (
                  <span
                    className="inline-flex items-center justify-center"
                    title={tooltipText}
                    aria-hidden="true"
                  >
                    {/* Sparkles icon */}
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="shrink-0">
                      <defs>
                        <linearGradient id="spark-grad" x1="0" y1="0" x2="1" y2="1">
                          <stop offset="0%" stopColor="#60A5FA" />
                          <stop offset="100%" stopColor="#8B5CF6" />
                        </linearGradient>
                      </defs>
                      <path d="M12 2l2.2 4.8L19 9l-4.8 2.2L12 16l-2.2-4.8L5 9l4.8-2.2L12 2zm7 11l1.1 2.4L23 16l-2.4 1.1L19 19l-1.1-2.4L15 16l2.4-1.1L19 13zM3 13l1.1 2.4L6 16l-2.4 1.1L3 19l-1.1-2.4L0 16l2.4-1.1L3 13z" fill="url(#spark-grad)" />
                    </svg>
                  </span>
                )}
                <div className="relative flex-1">
                  {hasMultipleInstances && anyInstanceResizing && primaryInstanceResizing ? (
                    <div
                      className={`w-24 h-9 px-3 flex items-center justify-start text-sm rounded-md border cursor-not-allowed ${darkMode
                        ? 'bg-gray-700 border-gray-600 text-gray-500'
                        : 'bg-gray-50 border-gray-300 text-gray-500'
                        }`}
                      style={{ fontWeight: 400 }}
                      title={tooltipText}
                    >
                      {inputDisplayValue}
                    </div>
                  ) : (
                    <Input
                      type="number"
                      value={Number.isFinite(displayFontSize) ? displayFontSize : 24}
                      onChange={(e) => {
                        const next = parseInt(e.target.value, 10);
                        if (!Number.isNaN(next)) update('fontSize', next);
                      }}
                      min="24"
                      max="100"
                      disabled={primaryInstanceResizing}
                      className={`w-24 ${innerClassBase} ${primaryInstanceResizing ? 'opacity-80 cursor-not-allowed' : ''}`}
                      title={tooltipText}
                    />
                  )}
                </div>
              </div>
            );
          })()}
          <Tooltip content="Enable adaptive text fitting with max lines limit" side="top">
            <Button
              size="icon"
              variant="outline"
              onClick={() => update('maxLinesEnabled', !settings.maxLinesEnabled)}
              title="Max Lines"
              className={
                settings.maxLinesEnabled
                  ? darkMode
                    ? '!bg-white !text-gray-900 hover:!bg-white !border-gray-300'
                    : '!bg-black !text-white hover:!bg-black !border-gray-300'
                  : darkMode
                    ? '!bg-transparent !border-gray-600 !text-gray-200 hover:!bg-gray-700'
                    : '!bg-transparent !border-gray-300 !text-gray-700 hover:!bg-gray-100'
              }
            >
              <ListStart className="w-4 h-4" />
            </Button>
          </Tooltip>
        </div>
      </div>

      {/* Font Size Advanced Settings Row */}
      <div
        className={`overflow-hidden transition-[max-height,opacity,transform] duration-300 ease-out ${fontSizeAdvancedExpanded
          ? 'max-h-48 opacity-100 translate-y-0 pointer-events-auto mt-1'
          : 'max-h-0 opacity-0 -translate-y-2 pointer-events-none m-0 p-0'
          }`}
        aria-hidden={!fontSizeAdvancedExpanded}
        style={{ marginTop: fontSizeAdvancedExpanded ? undefined : 0 }}
      >
        {/* Max Lines Settings Row */}
        <div className="flex items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-2">
            <label className={`text-sm ${darkMode ? 'text-gray-200' : 'text-gray-700'} ${!maxLinesEnabled ? 'opacity-50' : ''}`}>
              Max Lines
            </label>
            <Input
              type="number"
              value={settings.maxLines ?? 3}
              onChange={(e) => update('maxLines', parseInt(e.target.value))}
              min="1"
              max="10"
              disabled={!maxLinesEnabled}
              className={`w-16 ${darkMode
                ? 'bg-gray-700 border-gray-600 text-gray-200'
                : 'bg-white border-gray-300'
                } ${!maxLinesEnabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            />
          </div>
          <div className="flex items-center gap-2">
            <label className={`text-sm ${darkMode ? 'text-gray-200' : 'text-gray-700'} ${!maxLinesEnabled ? 'opacity-50' : ''}`}>
              Min Font Size
            </label>
            <Input
              type="number"
              value={settings.minFontSize ?? 24}
              onChange={(e) => update('minFontSize', parseInt(e.target.value))}
              min="12"
              max="100"
              disabled={!maxLinesEnabled}
              className={`w-16 ${darkMode
                ? 'bg-gray-700 border-gray-600 text-gray-200'
                : 'bg-white border-gray-300'
                } ${!maxLinesEnabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            />
          </div>
        </div>

        {/* Translation Font Size Row */}
        <div className="flex items-center justify-between w-full">
          {/* Translation Label */}
          <label className={`text-sm whitespace-nowrap ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>
            Translation Size
          </label>

          {/* Translation Mode and Custom Size */}
          <div className="flex items-center gap-2">
            <Select
              value={translationFontSizeMode}
              onValueChange={handleTranslationFontSizeModeChange}
            >
              <SelectTrigger
                className={`w-[120px] ${darkMode
                  ? 'bg-gray-700 border-gray-600 text-gray-200'
                  : 'bg-white border-gray-300'
                  }`}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent className={darkMode ? 'bg-gray-700 border-gray-600 text-gray-200' : 'bg-white border-gray-300'}>
                <SelectItem value="bound">Bound</SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>

            {/* Translation Custom Size */}
            {translationFontSizeMode === 'custom' && (
              <Tooltip content={`Translation font size (max: ${currentFontSize}px)`} side="top">
                <div className="flex items-center gap-2">
                  <Languages className={`w-4 h-4 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`} />
                  <Input
                    type="number"
                    value={translationFontSize}
                    onChange={(e) => handleTranslationFontSizeChange(e.target.value)}
                    min="12"
                    max={currentFontSize}
                    className={`w-16 ${darkMode
                      ? 'bg-gray-700 border-gray-600 text-gray-200'
                      : 'bg-white border-gray-300'
                      }`}
                  />
                </div>
              </Tooltip>
            )}
          </div>
        </div>
      </div>

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

      {/* Text Border */}
      <div className="flex items-center justify-between gap-4">
        <Tooltip content="Add an outline around text for better visibility (0-10px)" side="right">
          <LabelWithIcon icon={Frame} text="Text Border" darkMode={darkMode} />
        </Tooltip>
        <div className="flex gap-2 items-center">
          <ColorPicker
            value={settings.borderColor ?? '#000000'}
            onChange={(val) => update('borderColor', val)}
            darkMode={darkMode}
            className={darkMode ? 'bg-gray-700 border-gray-600 text-gray-200' : 'bg-white border-gray-300'}
          />
          <Input
            type="number"
            value={settings.borderSize ?? 0}
            onChange={(e) => update('borderSize', parseInt(e.target.value, 10))}
            min="0"
            max="10"
            className={`w-20 ${darkMode
              ? 'bg-gray-700 border-gray-600 text-gray-200'
              : 'bg-white border-gray-300'
              }`}
          />
        </div>
      </div>

      {/* Drop Shadow */}
      <DropShadowSection
        darkMode={darkMode}
        settings={settings}
        update={update}
        dropShadowAdvancedExpanded={dropShadowAdvancedExpanded}
        setDropShadowAdvancedExpanded={setDropShadowAdvancedExpanded}
      />

      {/* Drop Shadow Advanced Settings Row */}
      <div
        className={`overflow-hidden transition-[max-height,opacity,transform] duration-300 ease-out ${dropShadowAdvancedExpanded
          ? 'max-h-32 opacity-100 translate-y-0 pointer-events-auto mt-1'
          : 'max-h-0 opacity-0 -translate-y-2 pointer-events-none m-0 p-0'
          }`}
        aria-hidden={!dropShadowAdvancedExpanded}
        style={{ marginTop: dropShadowAdvancedExpanded ? undefined : 0 }}
      >
        <div className="flex items-center justify-between w-full">
          {/* Horizontal Offset (X) */}
          <Tooltip content="Horizontal shadow offset in pixels (negative = left, positive = right)" side="top">
            <div className="flex items-center gap-2">
              <MoveHorizontal className={`w-4 h-4 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`} />
              <Input
                type="number"
                value={dropShadowOffsetX}
                onChange={(e) => update('dropShadowOffsetX', parseInt(e.target.value, 10))}
                min="-50"
                max="50"
                className={`w-16 ${darkMode
                  ? 'bg-gray-700 border-gray-600 text-gray-200'
                  : 'bg-white border-gray-300'
                  }`}
              />
            </div>
          </Tooltip>

          {/* Vertical Offset (Y) */}
          <Tooltip content="Vertical shadow offset in pixels (negative = up, positive = down)" side="top">
            <div className="flex items-center gap-2">
              <MoveVertical className={`w-4 h-4 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`} />
              <Input
                type="number"
                value={dropShadowOffsetY}
                onChange={(e) => update('dropShadowOffsetY', parseInt(e.target.value, 10))}
                min="-50"
                max="50"
                className={`w-16 ${darkMode
                  ? 'bg-gray-700 border-gray-600 text-gray-200'
                  : 'bg-white border-gray-300'
                  }`}
              />
            </div>
          </Tooltip>

          {/* Blur Radius */}
          <Tooltip content="Shadow blur radius in pixels (0 = sharp, higher = softer)" side="top">
            <div className="flex items-center gap-2">
              <Sparkles className={`w-4 h-4 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`} />
              <Input
                type="number"
                value={dropShadowBlur}
                onChange={(e) => update('dropShadowBlur', parseInt(e.target.value, 10))}
                min="0"
                max="50"
                className={`w-16 ${darkMode
                  ? 'bg-gray-700 border-gray-600 text-gray-200'
                  : 'bg-white border-gray-300'
                  }`}
              />
            </div>
          </Tooltip>
        </div>
      </div>

      {/* Background */}
      <BackgroundSection
        darkMode={darkMode}
        settings={settings}
        update={update}
        backgroundAdvancedExpanded={backgroundAdvancedExpanded}
        setBackgroundAdvancedExpanded={setBackgroundAdvancedExpanded}
        fullScreenModeChecked={fullScreenModeChecked}
        backgroundDisabledTooltip={backgroundDisabledTooltip}
      />

      {/* Background Advanced Settings Row */}
      <div
        className={`overflow-hidden transition-[max-height,opacity,transform] duration-300 ease-out ${backgroundAdvancedExpanded && !fullScreenModeChecked
          ? 'max-h-32 opacity-100 translate-y-0 pointer-events-auto mt-1'
          : 'max-h-0 opacity-0 -translate-y-2 pointer-events-none m-0 p-0'
          }`}
        aria-hidden={!backgroundAdvancedExpanded || fullScreenModeChecked}
        style={{ marginTop: (backgroundAdvancedExpanded && !fullScreenModeChecked) ? undefined : 0 }}
      >
        <div className="flex items-center justify-between w-full">
          {/* Height Mode */}
          <div className="flex items-center gap-2">
            <label className={`text-sm whitespace-nowrap ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>
              Mode
            </label>
            <Select
              value={backgroundBandHeightMode}
              onValueChange={handleBackgroundHeightModeChange}
            >
              <SelectTrigger
                className={`w-[110px] ${darkMode
                  ? 'bg-gray-700 border-gray-600 text-gray-200'
                  : 'bg-white border-gray-300'
                  }`}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent className={darkMode ? 'bg-gray-700 border-gray-600 text-gray-200' : 'bg-white border-gray-300'}>
                <SelectItem value="adaptive">Adaptive</SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Custom Lines */}
          {backgroundBandHeightMode === 'custom' && (
            <Tooltip content={
              !maxLinesEnabled
                ? "Number of lines for band height"
                : backgroundBandLockedToMaxLines
                  ? `Locked to Max Lines (${maxLinesValue}). Click to unlock`
                  : `Click to lock to Max Lines (${maxLinesValue})`
            } side="top">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    if (maxLinesEnabled) {
                      applySettings({
                        backgroundBandLockedToMaxLines: !backgroundBandLockedToMaxLines,
                        backgroundBandCustomLines: !backgroundBandLockedToMaxLines ? maxLinesValue : backgroundBandCustomLines
                      });
                    }
                  }}
                  disabled={!maxLinesEnabled}
                  className={`p-1 rounded transition-all ${maxLinesEnabled
                    ? `cursor-pointer ${backgroundBandLockedToMaxLines
                      ? darkMode
                        ? 'bg-blue-600 hover:bg-blue-700'
                        : 'bg-blue-500 hover:bg-blue-600'
                      : darkMode
                        ? 'hover:bg-gray-700'
                        : 'hover:bg-gray-200'
                    }`
                    : 'cursor-default opacity-50'
                    }`}
                  aria-label={maxLinesEnabled ? (backgroundBandLockedToMaxLines ? "Unlock from max lines" : "Lock to max lines") : undefined}
                >
                  <Rows3 className={`w-4 h-4 ${backgroundBandLockedToMaxLines && maxLinesEnabled
                    ? 'text-white'
                    : darkMode ? 'text-gray-400' : 'text-gray-500'
                    }`} />
                </button>
                <Input
                  type="number"
                  value={backgroundBandCustomLines}
                  onChange={(e) => handleCustomLinesChange(e.target.value)}
                  min="1"
                  max={maxLinesEnabled ? maxLinesValue : 10}
                  disabled={backgroundBandLockedToMaxLines && maxLinesEnabled}
                  className={`w-16 ${darkMode
                    ? 'bg-gray-700 border-gray-600 text-gray-200'
                    : 'bg-white border-gray-300'
                    } ${backgroundBandLockedToMaxLines && maxLinesEnabled ? 'opacity-60 cursor-not-allowed' : ''}`}
                />
              </div>
            </Tooltip>
          )}

          {/* Vertical Padding */}
          <Tooltip content="Vertical padding for background band (in pixels)" side="top">
            <div className="flex items-center gap-2">
              <ArrowUpDown className={`w-4 h-4 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`} />
              <Input
                type="number"
                value={backgroundBandVerticalPadding}
                onChange={(e) => update('backgroundBandVerticalPadding', parseInt(e.target.value, 10))}
                min="0"
                max="100"
                className={`w-16 ${darkMode
                  ? 'bg-gray-700 border-gray-600 text-gray-200'
                  : 'bg-white border-gray-300'
                  }`}
              />
            </div>
          </Tooltip>
        </div>
      </div>

      {/* X and Y Margins */}
      <MarginsSection
        darkMode={darkMode}
        settings={settings}
        update={update}
      />

      {/* Transition Style */}
      <TransitionSection
        darkMode={darkMode}
        settings={settings}
        update={update}
        transitionAdvancedExpanded={transitionAdvancedExpanded}
        setTransitionAdvancedExpanded={setTransitionAdvancedExpanded}
      />

      {/* Transition Style Advanced Settings Row */}
      <div
        className={`overflow-hidden transition-[max-height,opacity,transform] duration-300 ease-out ${transitionAdvancedExpanded
          ? 'max-h-20 opacity-100 translate-y-0 pointer-events-auto mt-1'
          : 'max-h-0 opacity-0 -translate-y-2 pointer-events-none m-0 p-0'
          }`}
        aria-hidden={!transitionAdvancedExpanded}
        style={{ marginTop: transitionAdvancedExpanded ? undefined : 0 }}
      >
        <div className="flex items-center justify-between w-full">
          <label className={`text-sm whitespace-nowrap ${darkMode ? 'text-gray-200' : 'text-gray-700'} ${(settings.transitionAnimation ?? 'none') === 'none' ? 'opacity-50' : ''}`}>
            Transition Speed (ms)
          </label>
          <Input
            type="number"
            value={settings.transitionSpeed ?? 150}
            onChange={(e) => update('transitionSpeed', parseInt(e.target.value, 10))}
            min="100"
            max="2000"
            step="50"
            disabled={(settings.transitionAnimation ?? 'none') === 'none'}
            className={`w-24 ${darkMode
              ? 'bg-gray-700 border-gray-600 text-gray-200'
              : 'bg-white border-gray-300'
              } ${(settings.transitionAnimation ?? 'none') === 'none' ? 'opacity-50 cursor-not-allowed' : ''}`}
          />
        </div>
      </div>

      {/* Full Screen Mode */}
      <div className="flex items-center justify-between gap-4">
        <Tooltip content="Enable full screen display with custom background settings" side="right">
          <LabelWithIcon icon={ScreenShare} text="Full Screen Mode" darkMode={darkMode} />
        </Tooltip>
        <div className="flex items-center gap-3 justify-end w-full">
          <span className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
            {fullScreenModeChecked ? 'Enabled' : 'Disabled'}
          </span>
          <Switch
            checked={fullScreenModeChecked}
            onCheckedChange={handleFullScreenToggle}
            aria-label="Toggle full screen mode"
            className={`!h-8 !w-16 !border-0 shadow-sm transition-colors ${darkMode
              ? 'data-[state=checked]:bg-green-400 data-[state=unchecked]:bg-gray-600'
              : 'data-[state=checked]:bg-black data-[state=unchecked]:bg-gray-300'
              }`}
            thumbClassName="!h-6 !w-7 data-[state=checked]:!translate-x-8 data-[state=unchecked]:!translate-x-1"
          />
        </div>
      </div>

      {/* Fullscreen Mode Settings Row */}
      <div
        className={`overflow-hidden transition-[max-height,opacity,transform] duration-300 ease-out ${fullScreenOptionsWrapperClass}`}
        aria-hidden={!fullScreenModeChecked}
        style={{ marginTop: fullScreenModeChecked ? undefined : 0 }}
      >
        <div className="flex items-center gap-3 justify-between w-full pt-2">
          <Select
            value={fullScreenBackgroundTypeValue}
            onValueChange={handleFullScreenBackgroundTypeChange}
          >
            <SelectTrigger
              className={`w-[200px] ${darkMode
                ? 'bg-gray-700 border-gray-600 text-gray-200'
                : 'bg-white border-gray-300'
                }`}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent className={darkMode ? 'bg-gray-700 border-gray-600 text-gray-200' : 'bg-white border-gray-300'}>
              <SelectItem value="color">Colour</SelectItem>
              <SelectItem value="media">Image / Video</SelectItem>
            </SelectContent>
          </Select>

          {fullScreenBackgroundTypeValue === 'color' ? (
            <ColorPicker
              value={fullScreenBackgroundColorValue}
              onChange={handleFullScreenColorChange}
              darkMode={darkMode}
              className={`ml-auto ${darkMode ? 'bg-gray-700 border-gray-600 text-gray-200' : 'bg-white border-gray-300'}`}
            />
          ) : (
            <div className="flex items-center gap-2 ml-auto min-w-0 max-w-full">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*"
                className="hidden"
                onChange={handleMediaSelection}
              />
              <Button
                variant="outline"
                onClick={triggerFileDialog}
                className={`h-9 px-4 flex-shrink-0 ${darkMode ? 'border-gray-600 text-gray-200 hover:bg-gray-700' : ''}`}
              >
                {hasBackgroundMedia ? 'File Added' : 'Add File'}
              </Button>
              {hasBackgroundMedia && (
                <span
                  className={`text-sm max-w-[220px] min-w-0 truncate ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}
                  title={uploadedMediaName}
                >
                  {uploadedMediaName}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

    </div>
  );
};

export default OutputSettingsPanel;