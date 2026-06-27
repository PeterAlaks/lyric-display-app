import React from 'react';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tooltip } from '@/components/ui/tooltip';
import { ColorPicker } from "@/components/ui/color-picker";
import { PaintPicker } from "@/components/ui/paint-picker";
import useStageDisplayControls from '../hooks/OutputSettingsPanel/useStageDisplayControls';
import { Type, PaintBucket, Square, ScreenShare, ListMusic, ChevronRight, Languages, Palette, Power, TextAlignJustify, SquareMenu, Timer, GalleryVerticalEnd, ArrowRightLeft, Gauge, Save, BetweenVerticalEnd, ListIndentIncrease, Eye } from 'lucide-react';
import FontSelect from './FontSelect';
import { blurInputOnEnter, AdvancedToggle, FontSettingsRow, EmphasisRow, AlignmentRow, LabelWithIcon } from './OutputSettingsShared';
import { Slider } from '@/components/ui/slider';
import useToast from '../hooks/useToast';
import { sanitizeIntegerInput } from '../utils/numberInput';
import { MAX_STAGE_MESSAGES, MAX_STAGE_MESSAGE_LENGTH } from '../utils/stageMessages';

const formatTimerValue = (remainingMs) => {
  const safeRemaining = Math.max(0, Number(remainingMs) || 0);
  const totalSeconds = Math.ceil(safeRemaining / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

const StageTimerValue = React.memo(({ timerRunning, timerPaused, timerEndTime, pausedRemainingMs, timeRemaining }) => {
  const [now, setNow] = React.useState(Date.now());

  React.useEffect(() => {
    if (!timerRunning || timerPaused || !timerEndTime) return;
    setNow(Date.now());
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [timerEndTime, timerPaused, timerRunning]);

  if (timerRunning && timerPaused && Number.isFinite(pausedRemainingMs)) {
    return formatTimerValue(pausedRemainingMs);
  }

  if (timerRunning && timerEndTime) {
    return formatTimerValue(timerEndTime - now);
  }

  return timeRemaining || '0:00';
});

StageTimerValue.displayName = 'StageTimerValue';

const StageSettingsPanel = ({ settings, applySettings, update, darkMode, showModal, isOutputEnabled, handleToggleOutput }) => {
  const { showToast } = useToast();
  const {
    state,
    setters,
    handlers
  } = useStageDisplayControls({ settings, applySettings, update, showModal });

  const {
    customMessages,
    newMessage,
    timerDuration,
    timerRunning,
    timerPaused,
    timerEndTime,
    timeRemaining,
    pausedRemainingMs,
    customUpcomingSongName,
    upcomingSongAdvancedExpanded,
    hasUnsavedUpcomingSongName,
    timerAdvancedExpanded,
    customMessagesAdvancedExpanded
  } = state;

  const {
    setNewMessage,
    setCustomUpcomingSongName,
    setUpcomingSongAdvancedExpanded,
    setTimerAdvancedExpanded,
    setCustomMessagesAdvancedExpanded
  } = setters;

  const {
    handleCustomUpcomingSongNameChange,
    handleConfirmUpcomingSongName,
    handleFullScreenToggle,
    handleAddMessage,
    handleRemoveMessage,
    handleUpdateMessage,
    handleClearMessages,
    handleStartTimer,
    handlePauseTimer,
    handleResumeTimer,
    handleStopTimer,
    handleTimerDurationChange
  } = handlers;

  const [editingMessageId, setEditingMessageId] = React.useState(null);
  const [editingMessageText, setEditingMessageText] = React.useState('');

  React.useEffect(() => {
    if (!editingMessageId) return;
    const stillExists = customMessages.some((msg) => msg.id === editingMessageId);
    if (!stillExists) {
      setEditingMessageId(null);
      setEditingMessageText('');
    }
  }, [customMessages, editingMessageId]);

  const beginEditMessage = (message) => {
    setEditingMessageId(message.id);
    setEditingMessageText(message.text || '');
  };

  const cancelEditMessage = () => {
    setEditingMessageId(null);
    setEditingMessageText('');
  };

  const saveEditMessage = () => {
    if (!editingMessageId) return;
    const didSave = handleUpdateMessage(editingMessageId, editingMessageText);
    if (didSave) {
      setEditingMessageId(null);
      setEditingMessageText('');
    }
  };

  const switchBaseClasses = `!h-7 !w-14 !border-0 shadow-sm transition-colors ${darkMode
    ? 'data-[state=checked]:bg-green-400 data-[state=unchecked]:bg-gray-600'
    : 'data-[state=checked]:bg-black data-[state=unchecked]:bg-gray-300'
    }`;
  const switchThumbClass = "!h-5 !w-6 data-[state=checked]:!translate-x-7 data-[state=unchecked]:!translate-x-1";
  const customMessagePrimaryButtonClass = darkMode
    ? 'h-9 border border-blue-500/35 bg-blue-500/15 px-3 text-xs font-semibold text-blue-100 shadow-none hover:border-blue-400/60 hover:bg-blue-500/25'
    : 'h-9 border border-gray-900 bg-gray-900 px-3 text-xs font-semibold text-white shadow-none hover:bg-gray-800';
  const customMessageSaveButtonClass = darkMode
    ? 'h-8 border border-emerald-500/35 bg-emerald-500/15 px-2 text-xs font-semibold text-emerald-100 shadow-none hover:border-emerald-400/60 hover:bg-emerald-500/25'
    : 'h-8 border border-gray-900 bg-gray-900 px-2 text-xs font-semibold text-white shadow-none hover:bg-gray-800';
  const customMessageOutlineButtonClass = darkMode
    ? 'h-9 border border-gray-700 bg-gray-800 px-3 text-xs font-semibold text-gray-200 shadow-none hover:border-gray-600 hover:bg-gray-700 hover:text-white'
    : 'h-9 border border-gray-300 bg-white px-3 text-xs font-semibold text-gray-700 shadow-none hover:bg-gray-100 hover:text-gray-900';
  const customMessageSmallOutlineButtonClass = darkMode
    ? 'h-8 border border-gray-600 bg-gray-700 px-2 text-xs font-semibold text-gray-200 shadow-none hover:border-gray-500 hover:bg-gray-600 hover:text-white'
    : 'h-8 border border-gray-300 bg-white px-2 text-xs font-semibold text-gray-700 shadow-none hover:bg-gray-100 hover:text-gray-900';
  const customMessageGhostButtonClass = darkMode
    ? 'h-8 border border-transparent px-2 text-xs font-semibold text-gray-200 hover:bg-gray-500/45 hover:text-white'
    : 'h-8 border border-transparent px-2 text-xs font-semibold text-gray-700 hover:bg-gray-100 hover:text-gray-900';
  const customMessageDangerButtonClass = darkMode
    ? 'h-8 border border-transparent px-2 text-xs font-semibold text-red-200 hover:bg-red-500/15 hover:text-red-100'
    : 'h-8 border border-transparent px-2 text-xs font-semibold text-red-600 hover:bg-red-50 hover:text-red-700';

  const FullScreenToggleRow = ({ label, checked, onChange, disabled, ariaLabel }) => (
    <div className="flex items-center justify-between w-full">
      <label className={`text-[13px] leading-5 whitespace-nowrap ${darkMode ? 'text-gray-200' : 'text-gray-700'} ${disabled ? 'opacity-50' : ''}`}>
        {label}
      </label>
      <div className="flex items-center gap-3">
        <span className={`text-[13px] leading-5 ${darkMode ? 'text-gray-300' : 'text-gray-600'} ${disabled ? 'opacity-50' : ''}`}>
          {checked ? 'Enabled' : 'Disabled'}
        </span>
        <Switch
          checked={checked}
          onCheckedChange={onChange}
          disabled={disabled}
          aria-label={ariaLabel}
          className={`${switchBaseClasses} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          thumbClassName={switchThumbClass}
        />
      </div>
    </div>
  );

  const lineSections = [
    {
      title: 'Live Line (Current)',
      sizeKey: 'liveFontSize',
      colorKey: 'liveColor',
      boldKey: 'liveBold',
      italicKey: 'liveItalic',
      underlineKey: 'liveUnderline',
      allCapsKey: 'liveAllCaps',
      alignKey: 'liveAlign',
      letterSpacingKey: 'liveLetterSpacing',
      lineSpacingKey: 'liveLineSpacing',
      tooltip: 'Font size and color for current lyric line',
      alignTooltip: 'Text alignment for current line',
      extra: () => (
        <div className="flex items-center justify-between gap-4 mt-4">
          <Tooltip content="Color for translation lines in grouped lyrics" side="right">
            <LabelWithIcon icon={Languages} text="Translation Colour" darkMode={darkMode} />
          </Tooltip>
          <ColorPicker
            value={settings.translationLineColor || '#FBBF24'}
            onChange={(val) => update('translationLineColor', val)}
            darkMode={darkMode}
            className={darkMode ? 'bg-gray-700 border-gray-600 text-gray-200' : 'bg-white border-gray-300'}
          />
        </div>
      )
    },
    {
      title: 'Next Line (Upcoming)',
      settingsToggleKey: 'showNextLine',
      sizeKey: 'nextFontSize',
      colorKey: 'nextColor',
      boldKey: 'nextBold',
      italicKey: 'nextItalic',
      underlineKey: 'nextUnderline',
      allCapsKey: 'nextAllCaps',
      alignKey: 'nextAlign',
      letterSpacingKey: 'nextLetterSpacing',
      lineSpacingKey: 'nextLineSpacing',
      tooltip: 'Font size and color for upcoming lyric line',
      alignTooltip: 'Text alignment for upcoming line',
      extra: ({ sectionDisabled }) => (
        <div className="flex items-center justify-between gap-4 mt-4">
          <Tooltip content="Show arrow indicator before upcoming line" side="right">
            <LabelWithIcon icon={ChevronRight} text="Arrow" darkMode={darkMode} />
          </Tooltip>
          <div className="flex items-center gap-2 justify-end w-full">
            <span className={`text-[13px] leading-5 ${darkMode ? 'text-gray-300' : 'text-gray-600'} ${sectionDisabled ? 'opacity-50' : ''}`}>
              {settings.showNextArrow ? 'Enabled' : 'Disabled'}
            </span>
            <Switch
              checked={settings.showNextArrow}
              onCheckedChange={(checked) => update('showNextArrow', checked)}
              disabled={sectionDisabled}
              aria-label="Toggle show arrow"
              className={`${switchBaseClasses} ${sectionDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
              thumbClassName={switchThumbClass}
            />
            <PaintBucket className={`h-3.5 w-3.5 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`} />
            <ColorPicker
              value={settings.nextArrowColor}
              onChange={(val) => update('nextArrowColor', val)}
              disabled={sectionDisabled}
              darkMode={darkMode}
              className={`${darkMode ? 'bg-gray-700 border-gray-600 text-gray-200' : 'bg-white border-gray-300'} ${sectionDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            />
          </div>
        </div>
      )
    },
    {
      title: 'Previous Line',
      settingsToggleKey: 'showPrevLine',
      sizeKey: 'prevFontSize',
      colorKey: 'prevColor',
      boldKey: 'prevBold',
      italicKey: 'prevItalic',
      underlineKey: 'prevUnderline',
      allCapsKey: 'prevAllCaps',
      alignKey: 'prevAlign',
      letterSpacingKey: 'prevLetterSpacing',
      lineSpacingKey: 'prevLineSpacing',
      tooltip: 'Font size and color for previous lyric line',
      alignTooltip: 'Text alignment for previous line'
    }
  ];

  const renderLineSection = (section) => {
    const sectionEnabled = section.settingsToggleKey ? (settings[section.settingsToggleKey] ?? true) : true;
    const sectionDisabled = Boolean(section.settingsToggleKey) && !sectionEnabled;
    const extraContent = typeof section.extra === 'function'
      ? section.extra({ sectionDisabled })
      : section.extra;

    return (
      <div className="space-y-4">
        <h4 className={`text-[13px] font-semibold leading-5 ${darkMode ? 'text-gray-300' : 'text-gray-700'} mt-2`}>{section.title}</h4>

        {section.settingsToggleKey && (
          <div className="flex items-center justify-between gap-4">
            <Tooltip
              content={`Show or hide the ${section.title.toLowerCase()} and its styling on stage output`}
              side="right"
            >
              <div className="flex items-center gap-2 min-w-[170px]">
                <Eye className={`h-3.5 w-3.5 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`} />
                <label className={`text-[13px] leading-5 whitespace-nowrap ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>
                  {section.settingsToggleKey === 'showNextLine' ? 'Show Next Line' : 'Show Previous Line'}
                </label>
              </div>
            </Tooltip>
            <div className="flex items-center gap-3 justify-end w-full">
              <span className={`text-[13px] leading-5 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                {sectionEnabled ? 'Enabled' : 'Disabled'}
              </span>
              <Switch
                checked={sectionEnabled}
                onCheckedChange={(checked) => update(section.settingsToggleKey, checked)}
                aria-label={`Toggle ${section.settingsToggleKey === 'showNextLine' ? 'next line' : 'previous line'} visibility`}
                className={switchBaseClasses}
                thumbClassName={switchThumbClass}
              />
            </div>
          </div>
        )}

        <div className={`space-y-4 ${sectionDisabled ? 'opacity-50' : ''}`} aria-disabled={sectionDisabled}>
          <FontSettingsRow
            darkMode={darkMode}
            sizeValue={settings[section.sizeKey]}
            colorValue={settings[section.colorKey]}
            onSizeChange={(val) => update(section.sizeKey, val)}
            onColorChange={(val) => update(section.colorKey, val)}
            minSize={24}
            maxSize={200}
            tooltip={section.tooltip}
            disabled={sectionDisabled}
          />

          <EmphasisRow
            darkMode={darkMode}
            LabelWithIcon={LabelWithIcon}
            icon={SquareMenu}
            boldValue={settings[section.boldKey]}
            italicValue={settings[section.italicKey]}
            underlineValue={settings[section.underlineKey]}
            allCapsValue={settings[section.allCapsKey]}
            onBoldChange={(val) => update(section.boldKey, val)}
            onItalicChange={(val) => update(section.italicKey, val)}
            onUnderlineChange={(val) => update(section.underlineKey, val)}
            onAllCapsChange={(val) => update(section.allCapsKey, val)}
            disabled={sectionDisabled}
          />

          <AlignmentRow
            darkMode={darkMode}
            LabelWithIcon={LabelWithIcon}
            icon={TextAlignJustify}
            value={settings[section.alignKey]}
            onChange={(val) => update(section.alignKey, val)}
            tooltip={section.alignTooltip || 'Text alignment'}
            disabled={sectionDisabled}
          />

          {/* Letter Spacing */}
          <div className="flex items-center justify-between gap-4">
            <Tooltip content="Adjust letter spacing (-5 to 20 pixels)" side="right">
              <LabelWithIcon icon={BetweenVerticalEnd} text="Letter Spacing" darkMode={darkMode} />
            </Tooltip>
            <div className="flex items-center gap-2">
              <Slider
                min={-5}
                max={20}
                step={0.5}
                value={[settings[section.letterSpacingKey] ?? 0]}
                onValueChange={([val]) => update(section.letterSpacingKey, val)}
                disabled={sectionDisabled}
                className="w-24"
              />
              <Input
                type="number"
                value={settings[section.letterSpacingKey] ?? 0}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  if (!isNaN(val)) {
                    update(section.letterSpacingKey, Math.min(20, Math.max(-5, val)));
                  }
                }}
                onKeyDown={blurInputOnEnter}
                min="-5"
                max="20"
                step="0.5"
                disabled={sectionDisabled}
                className={`w-20 ${darkMode ? 'bg-gray-700 border-gray-600 text-gray-200' : 'bg-white border-gray-300'}`}
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-4">
            <Tooltip content="Adjust line spacing (0.8 to 3.0)" side="right">
              <LabelWithIcon icon={ListIndentIncrease} text="Line Spacing" darkMode={darkMode} />
            </Tooltip>
            <div className="flex items-center gap-2">
              <Slider
                min={0.8}
                max={3}
                step={0.01}
                value={[settings[section.lineSpacingKey] ?? 1]}
                onValueChange={([val]) => update(section.lineSpacingKey, val)}
                disabled={sectionDisabled}
                className="w-24"
              />
              <Input
                type="number"
                value={settings[section.lineSpacingKey] ?? 1}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  if (!isNaN(val)) {
                    update(section.lineSpacingKey, Math.min(3, Math.max(0.8, val)));
                  }
                }}
                onKeyDown={blurInputOnEnter}
                min="0.8"
                max="3"
                step="0.1"
                disabled={sectionDisabled}
                className={`w-20 ${darkMode ? 'bg-gray-700 border-gray-600 text-gray-200' : 'bg-white border-gray-300'}`}
              />
            </div>
          </div>

          {extraContent}
        </div>
      </div>
    );
  };

  return (
    <div className="stage-settings-panel space-y-4" onKeyDown={blurInputOnEnter}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className={`text-[13px] font-medium uppercase leading-5 tracking-wide ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
          Stage Settings
        </h3>

        <div className="flex items-center gap-1.5">
          {/* Toggle Output Button */}
          <Tooltip content={isOutputEnabled ? "Turn off Stage Display" : "Turn on Stage Display"} side="bottom">
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
            >
              <Power className="h-3.5 w-3.5" />
            </button>
          </Tooltip>

          {/* NDI Button */}
          <Tooltip content="NDI Broadcasting" side="bottom">
            <button
              onClick={async () => {
                const status = await window.electronAPI?.ndi?.checkInstalled();
                if (!status?.installed) {
                  showToast({
                    title: 'NDI Unavailable',
                    message: 'Download the NDI companion to enable broadcasting.',
                    variant: 'info',
                    duration: 8000,
                    actions: [{
                      label: 'Download',
                      onClick: () => {
                        showModal({
                          title: 'Preferences',
                          component: 'UserPreferences',
                          variant: 'info',
                          size: 'lg',
                          customLayout: true,
                          initialCategory: 'ndi',
                          actions: []
                        });
                      }
                    }]
                  });
                  return;
                }
                showModal({
                  title: 'NDI Output Settings',
                  headerDescription: 'Configure NDI broadcast for Stage Display',
                  component: 'NdiOutputSettings',
                  variant: 'info',
                  size: 'lg',
                  outputKey: 'stage',
                  customLayout: true,
                  dismissLabel: 'Close',
                });
              }}
              className={`px-1.5 rounded-lg transition-colors text-[12px] leading-none ${darkMode
                ? 'hover:bg-gray-700 text-gray-400 hover:text-gray-200'
                : 'hover:bg-gray-100 text-gray-500 hover:text-gray-700'
                }`}
              style={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, height: 28 }}
            >
              NDI
            </button>
          </Tooltip>

          {/* Save as Template button */}
          <Tooltip content="Save current settings as a reusable template" side="bottom">
            <button
              onClick={() => {
                showModal({
                  title: 'Save as Template',
                  headerDescription: 'Save your current stage display settings as a reusable template',
                  component: 'SaveTemplate',
                  variant: 'info',
                  size: 'sm',
                  actions: [],
                  templateType: 'stage',
                  settings: settings,
                  onSave: (template) => {
                    showToast({
                      title: 'Template Saved',
                      message: `"${template.name}" has been saved successfully`,
                      variant: 'success',
                    });
                  }
                });
              }}
              className={`p-1.5 rounded-lg transition-colors ${darkMode
                ? 'hover:bg-gray-700 text-gray-400 hover:text-gray-200'
                : 'hover:bg-gray-100 text-gray-500 hover:text-gray-700'
                }`}
            >
              <Save className="h-3.5 w-3.5" />
            </button>
          </Tooltip>

          {/* Templates trigger button */}
          <Tooltip content="Choose from professionally designed stage display templates" side="bottom">
            <button
              onClick={() => {
                showModal({
                  title: 'Stage Display Templates',
                  headerDescription: 'Choose from professionally designed stage display presets',
                  component: 'StageTemplates',
                  variant: 'info',
                  size: 'large',
                  scrollBehavior: 'scroll',
                  dismissLabel: 'Close',
                  onApplyTemplate: (template) => {
                    applySettings(template.settings);
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
            >
              <Palette className="h-3.5 w-3.5" />
            </button>
          </Tooltip>

          {/* Help trigger button */}
          <Tooltip content="Stage Settings Help" side="bottom">
            <button
              onClick={() => {
                showModal({
                  title: 'Stage Display Help',
                  headerDescription: 'Configure your stage display for performers and worship leaders',
                  component: 'StageDisplayHelp',
                  variant: 'info',
                  size: 'large',
                  dismissLabel: 'Got it'
                });
              }}
              className={`p-1.5 rounded-lg transition-colors ${darkMode
                ? 'hover:bg-gray-700 text-gray-400 hover:text-gray-200'
                : 'hover:bg-gray-100 text-gray-500 hover:text-gray-700'
                }`}
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>
          </Tooltip>
        </div>
      </div>

      {/* Font Style */}
      <div className="flex items-center justify-between gap-4">
        <Tooltip content="Select font family for stage display" side="right">
          <LabelWithIcon icon={Type} text="Font Style" darkMode={darkMode} />
        </Tooltip>
        <FontSelect
          value={settings.fontStyle}
          onChange={(val) => update('fontStyle', val)}
          darkMode={darkMode}
          triggerClassName="w-full"
          containerClassName="relative w-full"
        />
      </div>

      {/* Background */}
      <div className="flex items-center justify-between gap-4">
        <Tooltip content="Set background color or gradient for stage display" side="right">
          <LabelWithIcon icon={Square} text="Background" darkMode={darkMode} />
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
          darkMode={darkMode}
          className={darkMode ? 'bg-gray-700 border-gray-600 text-gray-200' : 'bg-white border-gray-300'}
        />
      </div>

      {/* Upcoming Song */}
      <div className="flex items-center justify-between gap-4">
        <Tooltip content="Configure upcoming song display mode" side="right">
          <LabelWithIcon icon={ListMusic} text="Upcoming Song" darkMode={darkMode} />
        </Tooltip>
        <div className="flex items-center gap-2 justify-end w-full">
          <Tooltip content={(upcomingSongAdvancedExpanded ? "Hide" : "Show") + " advanced settings"} side="top">
            <AdvancedToggle
              expanded={upcomingSongAdvancedExpanded}
              onToggle={() => setUpcomingSongAdvancedExpanded(!upcomingSongAdvancedExpanded)}
              darkMode={darkMode}
              ariaLabel="Toggle upcoming song advanced settings"
            />
          </Tooltip>
          <Select
            value={settings.upcomingSongMode || 'automatic'}
            onValueChange={(val) => update('upcomingSongMode', val)}
          >
            <SelectTrigger className={`w-[140px] ${darkMode ? 'bg-gray-700 border-gray-600 text-gray-200' : 'bg-white border-gray-300'}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent className={darkMode ? 'bg-gray-700 border-gray-600 text-gray-200' : 'bg-white border-gray-300'}>
              <SelectItem value="automatic">Automatic</SelectItem>
              <SelectItem value="custom">Custom</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Upcoming Song Advanced Settings Row */}
      <div
        className={`overflow-hidden transition-[max-height,opacity,transform] duration-300 ease-out ${upcomingSongAdvancedExpanded
          ? 'max-h-40 opacity-100 translate-y-0 pointer-events-auto mt-1'
          : 'max-h-0 opacity-0 -translate-y-2 pointer-events-none m-0 p-0'
          }`}
        aria-hidden={!upcomingSongAdvancedExpanded}
        style={{ marginTop: upcomingSongAdvancedExpanded ? undefined : 0 }}
      >
        <div className="space-y-3">
          {/* Custom Name Input with OK Button */}
          <div className="flex items-center justify-between w-full gap-2">
            <label className={`text-[13px] leading-5 whitespace-nowrap ${darkMode ? 'text-gray-200' : 'text-gray-700'} ${settings.upcomingSongMode !== 'custom' ? 'opacity-50' : ''}`}>
              Custom Name
            </label>
            <div className="flex items-center gap-2">
              <Input
                type="text"
                value={customUpcomingSongName}
                onChange={(e) => handleCustomUpcomingSongNameChange(e.target.value)}
                placeholder="Enter song name..."
                disabled={settings.upcomingSongMode !== 'custom'}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && hasUnsavedUpcomingSongName && settings.upcomingSongMode === 'custom') {
                    handleConfirmUpcomingSongName();
                  }
                }}
                className={`w-full ${darkMode ? 'bg-gray-700 border-gray-600 text-gray-200' : 'bg-white border-gray-300'} ${settings.upcomingSongMode !== 'custom' ? 'opacity-50 cursor-not-allowed' : ''}`}
              />
              {hasUnsavedUpcomingSongName && settings.upcomingSongMode === 'custom' && (
                <Button
                  size="sm"
                  onClick={handleConfirmUpcomingSongName}
                  className={`${darkMode ? 'bg-green-600 hover:bg-green-700' : 'bg-green-500 hover:bg-green-600'} text-white px-3 py-1 h-9`}
                >
                  OK
                </Button>
              )}
            </div>
          </div>

          <FullScreenToggleRow
            label="Send Full Screen"
            checked={settings.upcomingSongFullScreen || false}
            onChange={(checked) => handleFullScreenToggle('upcomingSong', checked)}
            disabled={settings.timerFullScreen || settings.customMessagesFullScreen}
            ariaLabel="Toggle upcoming song full screen"
          />
        </div>
      </div>

      <div className={`border-t my-4 ${darkMode ? 'border-gray-700' : 'border-gray-100'}`}></div>

      {lineSections.map((section) => (
        <React.Fragment key={section.title}>
          {renderLineSection(section)}
          <div className={`border-t my-4 ${darkMode ? 'border-gray-700' : 'border-gray-100'}`}></div>
        </React.Fragment>
      ))}

      {/* Song Info Settings */}
      <h4 className={`text-[13px] font-semibold leading-5 ${darkMode ? 'text-gray-300' : 'text-gray-700'} mt-2`}>Top Bar</h4>

      <FontSettingsRow
        darkMode={darkMode}
        sizeValue={settings.currentSongSize}
        colorValue={settings.currentSongColor}
        onSizeChange={(val) => update('currentSongSize', val)}
        onColorChange={(val) => update('currentSongColor', val)}
        minSize={12}
        maxSize={48}
        label="Current Song"
        tooltip="Font size and color for current song name"
      />

      <FontSettingsRow
        darkMode={darkMode}
        sizeValue={settings.upcomingSongSize}
        colorValue={settings.upcomingSongColor}
        onSizeChange={(val) => update('upcomingSongSize', val)}
        onColorChange={(val) => update('upcomingSongColor', val)}
        minSize={12}
        maxSize={48}
        label="Upcoming Song"
        tooltip="Font size and color for upcoming song name"
      />

      <div className={`border-t my-4 ${darkMode ? 'border-gray-700' : 'border-gray-100'}`}></div>

      {/* Bottom Bar Settings */}
      <h4 className={`text-[13px] font-semibold leading-5 ${darkMode ? 'text-gray-300' : 'text-gray-700'} mt-2`}>Bottom Bar</h4>

      <div className="flex items-center justify-between gap-4 mt-4">
        <Tooltip content="Display current real-world time" side="right">
          <LabelWithIcon icon={ScreenShare} text="Show Time" darkMode={darkMode} />
        </Tooltip>
        <div className="flex items-center gap-3 justify-end w-full">
          <span className={`text-[13px] leading-5 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
            {settings.showTime ? 'Enabled' : 'Disabled'}
          </span>
          <Switch
            checked={settings.showTime}
            onCheckedChange={(checked) => update('showTime', checked)}
            aria-label="Toggle show time"
            className={switchBaseClasses}
            thumbClassName={switchThumbClass}
          />
        </div>
      </div>

      {/* Timer Controls */}
      <div className="flex items-center justify-between gap-4">
        <Tooltip content="Set countdown timer duration in minutes" side="right">
          <LabelWithIcon icon={Timer} text="Countdown Timer" darkMode={darkMode} />
        </Tooltip>
        <div className="flex items-center gap-2 justify-end">
          <Tooltip content={(timerAdvancedExpanded ? "Hide" : "Show") + " advanced settings"} side="top">
            <AdvancedToggle
              expanded={timerAdvancedExpanded}
              onToggle={() => setTimerAdvancedExpanded(!timerAdvancedExpanded)}
              darkMode={darkMode}
              ariaLabel="Toggle timer advanced settings"
            />
          </Tooltip>
          <Input
            type="number"
            value={timerDuration}
            onChange={(e) => handleTimerDurationChange(e.target.value)}
            min="0"
            max="180"
            placeholder="Minutes"
            disabled={timerRunning}
            className={`w-24 ${darkMode ? 'bg-gray-700 border-gray-600 text-gray-200' : 'bg-white border-gray-300'} ${timerRunning ? 'opacity-60 cursor-not-allowed' : ''}`}
          />
        </div>
      </div>

      {/* Timer Advanced Settings Row */}
      <div
        className={`overflow-hidden transition-[max-height,opacity,transform] duration-300 ease-out ${timerAdvancedExpanded
          ? 'max-h-40 opacity-100 translate-y-0 pointer-events-auto mt-1'
          : 'max-h-0 opacity-0 -translate-y-2 pointer-events-none m-0 p-0'
          }`}
        aria-hidden={!timerAdvancedExpanded}
        style={{ marginTop: timerAdvancedExpanded ? undefined : 0 }}
      >
        <div className="space-y-3">
          <FullScreenToggleRow
            label="Send Full Screen"
            checked={settings.timerFullScreen || false}
            onChange={(checked) => handleFullScreenToggle('timer', checked)}
            disabled={settings.upcomingSongFullScreen || settings.customMessagesFullScreen}
            ariaLabel="Toggle timer full screen"
          />
        </div>
      </div>

      {/* Timer Control Buttons Row */}
      <div className="flex items-center justify-between gap-4">
        {/* Left: Timer Display */}
        <div className={`flex items-center justify-center px-4 py-2 rounded-lg min-w-[120px] ${darkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
          <div className={`text-xl font-mono font-bold ${timerRunning && !timerPaused ? (darkMode ? 'text-green-400' : 'text-green-600') : (darkMode ? 'text-gray-400' : 'text-gray-500')}`}>
            <StageTimerValue
              timerRunning={timerRunning}
              timerPaused={timerPaused}
              timerEndTime={timerEndTime}
              pausedRemainingMs={pausedRemainingMs}
              timeRemaining={timeRemaining}
            />
          </div>
        </div>

        {/* Right: Control Buttons */}
        <div className="flex items-center gap-2">
          {!timerRunning ? (
            <Button
              size="sm"
              onClick={handleStartTimer}
              disabled={timerDuration <= 0}
              className={`${darkMode ? 'bg-green-600 hover:bg-green-700' : 'bg-green-500 hover:bg-green-600'} text-white`}
            >
              Start
            </Button>
          ) : (
            <>
              {timerPaused ? (
                <Button
                  size="sm"
                  onClick={handleResumeTimer}
                  className={`${darkMode ? 'bg-blue-600 hover:bg-blue-700' : 'bg-blue-500 hover:bg-blue-600'} text-white`}
                >
                  Resume
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={handlePauseTimer}
                  className={`${darkMode ? 'bg-yellow-600 hover:bg-yellow-700' : 'bg-yellow-500 hover:bg-yellow-600'} text-white`}
                >
                  Pause
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={handleStopTimer}
                className={darkMode ? 'border-gray-600 text-gray-200 hover:bg-gray-700' : ''}
              >
                Stop
              </Button>
            </>
          )}
        </div>
      </div>

      <FontSettingsRow
        darkMode={darkMode}
        sizeValue={settings.bottomBarSize}
        colorValue={settings.bottomBarColor}
        onSizeChange={(val) => update('bottomBarSize', val)}
        onColorChange={(val) => update('bottomBarColor', val)}
        minSize={12}
        maxSize={36}
        tooltip="Font size and color for bottom bar text"
      />

      <div className={`border-t my-4 ${darkMode ? 'border-gray-700' : 'border-gray-100'}`}></div>

      {/* Custom Messages */}
      <h4 className={`text-[13px] font-semibold leading-5 ${darkMode ? 'text-gray-300' : 'text-gray-700'} mt-2`}>Custom Messages</h4>

      <div className="flex items-center justify-between gap-4 mt-4">
        <Tooltip content="Time between message transitions (1000-10000ms)" side="right">
          <LabelWithIcon icon={GalleryVerticalEnd} text="Scroll Speed (ms)" darkMode={darkMode} />
        </Tooltip>
        <div className="flex items-center gap-2 justify-end">
          <Tooltip content={(customMessagesAdvancedExpanded ? "Hide" : "Show") + " advanced settings"} side="top">
            <AdvancedToggle
              expanded={customMessagesAdvancedExpanded}
              onToggle={() => setCustomMessagesAdvancedExpanded(!customMessagesAdvancedExpanded)}
              darkMode={darkMode}
              ariaLabel="Toggle custom messages advanced settings"
            />
          </Tooltip>
          <Input
            type="number"
            value={settings.messageScrollSpeed}
            onChange={(e) => update(
              'messageScrollSpeed',
              sanitizeIntegerInput(
                e.target.value,
                settings.messageScrollSpeed ?? 3000,
                { min: 1000, max: 10000, clampMin: false }
              )
            )}
            min="1000"
            max="10000"
            step="500"
            className={`w-24 ${darkMode ? 'bg-gray-700 border-gray-600 text-gray-200' : 'bg-white border-gray-300'}`}
          />
        </div>
      </div>

      {/* Custom Messages Advanced Settings Row */}
      <div
        className={`overflow-hidden transition-[max-height,opacity,transform] duration-300 ease-out ${customMessagesAdvancedExpanded
          ? 'max-h-40 opacity-100 translate-y-0 pointer-events-auto mt-1'
          : 'max-h-0 opacity-0 -translate-y-2 pointer-events-none m-0 p-0'
          }`}
        aria-hidden={!customMessagesAdvancedExpanded}
        style={{ marginTop: customMessagesAdvancedExpanded ? undefined : 0 }}
      >
        <div className="space-y-3">
          <FullScreenToggleRow
            label="Send Full Screen"
            checked={settings.customMessagesFullScreen || false}
            onChange={(checked) => handleFullScreenToggle('customMessages', checked)}
            disabled={settings.upcomingSongFullScreen || settings.timerFullScreen}
            ariaLabel="Toggle custom messages full screen"
          />
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex gap-2">
          <Input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddMessage()}
            placeholder="Enter custom message..."
            maxLength={MAX_STAGE_MESSAGE_LENGTH}
            className={`flex-1 ${darkMode ? 'bg-gray-700 border-gray-600 text-gray-200' : 'bg-white border-gray-300'}`}
          />
          <Button onClick={handleAddMessage} className={customMessagePrimaryButtonClass}>
            Add
          </Button>
          <Button
            variant="outline"
            onClick={handleClearMessages}
            disabled={customMessages.length === 0}
            className={customMessageOutlineButtonClass}
          >
            Clear
          </Button>
        </div>
        <div className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
          {customMessages.length}/{MAX_STAGE_MESSAGES} messages | {newMessage.length}/{MAX_STAGE_MESSAGE_LENGTH} characters
        </div>

        {customMessages.length > 0 && (
          <div className={`space-y-2 max-h-40 overflow-y-auto p-2 rounded ${darkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
            {customMessages.map((msg) => (
              <div key={msg.id} className={`flex items-center justify-between p-2 rounded ${darkMode ? 'bg-gray-600' : 'bg-white'}`}>
                {editingMessageId === msg.id ? (
                  <>
                    <Input
                      type="text"
                      value={editingMessageText}
                      onChange={(e) => setEditingMessageText(e.target.value)}
                      maxLength={MAX_STAGE_MESSAGE_LENGTH}
                      className={`flex-1 mr-2 h-8 ${darkMode ? 'bg-gray-700 border-gray-500 text-gray-200' : 'bg-white border-gray-300'}`}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveEditMessage();
                        if (e.key === 'Escape') cancelEditMessage();
                      }}
                    />
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        onClick={saveEditMessage}
                        className={customMessageSaveButtonClass}
                      >
                        Save
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={cancelEditMessage}
                        className={customMessageSmallOutlineButtonClass}
                      >
                        Cancel
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <span className={`text-sm flex-1 truncate pr-2 ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>
                      {msg.text}
                    </span>
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => beginEditMessage(msg)}
                        className={customMessageGhostButtonClass}
                      >
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleRemoveMessage(msg.id)}
                        className={customMessageDangerButtonClass}
                      >
                        Remove
                      </Button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className={`border-t my-4 ${darkMode ? 'border-gray-700' : 'border-gray-100'}`}></div>

      {/* Transition Settings */}
      <h4 className={`text-[13px] font-semibold leading-5 ${darkMode ? 'text-gray-300' : 'text-gray-700'} mt-2`}>Transition Style</h4>

      <div className="flex items-center justify-between gap-4 mt-4">
        <Tooltip content="Choose animation style when lyrics change" side="right">
          <LabelWithIcon icon={ArrowRightLeft} text="Animation" darkMode={darkMode} />
        </Tooltip>
        <Select value={settings.transitionAnimation} onValueChange={(val) => update('transitionAnimation', val)}>
          <SelectTrigger className={`w-[140px] ${darkMode ? 'bg-gray-700 border-gray-600 text-gray-200' : 'bg-white border-gray-300'}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent className={darkMode ? 'bg-gray-700 border-gray-600 text-gray-200' : 'bg-white border-gray-300'}>
            <SelectItem value="none">None</SelectItem>
            <SelectItem value="fade">Fade</SelectItem>
            <SelectItem value="slide">Slide (Wheel)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {settings.transitionAnimation !== 'none' && (
        <div className="flex items-center justify-between gap-4">
          <Tooltip content="Animation duration (100-1000ms)" side="right">
            <LabelWithIcon icon={Gauge} text="Speed (ms)" darkMode={darkMode} />
          </Tooltip>
          <Input
            type="number"
            value={settings.transitionSpeed}
            onChange={(e) => update(
              'transitionSpeed',
              sanitizeIntegerInput(
                e.target.value,
                settings.transitionSpeed ?? 300,
                { min: 100, max: 1000, clampMin: false }
              )
            )}
            min="100"
            max="1000"
            step="50"
            className={`w-24 ${darkMode ? 'bg-gray-700 border-gray-600 text-gray-200' : 'bg-white border-gray-300'}`}
          />
        </div>
      )}
    </div>
  );
};

export default StageSettingsPanel;
