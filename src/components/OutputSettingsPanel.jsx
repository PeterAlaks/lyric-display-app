import React from 'react';
import { useDarkModeState, useOutput1Settings, useOutput2Settings, useOutputSettings as useOutputSettingsSelector, useStageSettings, useIndividualOutputState, useOutputEnabled, useSetOutputEnabledAction } from '../hooks/useStoreSelectors';
import { useControlSocket } from '../context/ControlSocketProvider';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Tooltip } from '@/components/ui/tooltip';
import { ColorPicker } from "@/components/ui/color-picker";
import useToast from '../hooks/useToast';
import useModal from '../hooks/useModal';
import useOutputToggle from '../hooks/OutputSettingsPanel/useOutputToggle';
import useFullscreenBackground from '../hooks/OutputSettingsPanel/useFullscreenBackground';
import useAdvancedSectionPersistence from '../hooks/OutputSettingsPanel/useAdvancedSectionPersistence';
import useTypographyAndBands from '../hooks/OutputSettingsPanel/useTypographyAndBands';
import useFullscreenModeState from '../hooks/OutputSettingsPanel/useFullscreenModeState';
import useFullscreenElementMedia from '../hooks/OutputSettingsPanel/useFullscreenElementMedia';
import useFullscreenAdvancedAutoExpand from '../hooks/OutputSettingsPanel/useFullscreenAdvancedAutoExpand';
import { Type, PaintBucket, Square, Move, AlignVerticalSpaceAround, TextAlignJustify, SquareMenu } from 'lucide-react';
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
      <ColorPicker
        value={settings.backgroundColor}
        onChange={(val) => update('backgroundColor', val)}
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

const OutputSettingsPanel = ({ outputKey, onDeleteOutput }) => {
  const { darkMode } = useDarkModeState();
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
    backgroundDisabledTooltip,
    fullScreenOptionsWrapperClass,
    handleLyricsPositionChange,
    handleFullScreenToggle,
    handleFullScreenBackgroundTypeChange,
    handleFullScreenColorChange
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
        handleFullScreenColorChange={handleFullScreenColorChange}
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
