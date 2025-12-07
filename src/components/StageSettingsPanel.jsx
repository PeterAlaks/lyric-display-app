import React from 'react';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tooltip } from '@/components/ui/tooltip';
import useStageDisplayControls from '../hooks/OutputSettingsPanel/useStageDisplayControls';
import { Type, Paintbrush, TextCursorInput, TextQuote, Square, AlignVerticalSpaceAround, ScreenShare, ListMusic, ChevronRight, Languages, Wand2, HardDriveDownload, Power } from 'lucide-react';
import FontSelect from './FontSelect';
import { blurInputOnEnter, AdvancedToggle, FontSettingsRow, EmphasisRow, AlignmentRow, LabelWithIcon } from './OutputSettingsShared';

const StageSettingsPanel = ({ settings, applySettings, update, darkMode, showModal, isOutputEnabled, handleToggleOutput }) => {
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
    handleStartTimer,
    handlePauseTimer,
    handleResumeTimer,
    handleStopTimer,
    handleTimerDurationChange
  } = handlers;

  return (
    <div className="space-y-4" onKeyDown={blurInputOnEnter}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className={`text-sm font-medium uppercase tracking-wide ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
          STAGE DISPLAY SETTINGS
        </h3>

        <div className="flex items-center gap-2">
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
              title={isOutputEnabled ? "Turn off Stage Display" : "Turn on Stage Display"}
            >
              <Power className="w-4 h-4" />
            </button>
          </Tooltip>

          {/* Templates trigger button */}
          <button
            onClick={() => {
              showModal({
                title: 'Stage Display Templates',
                headerDescription: 'Choose from professionally designed stage display presets',
                component: 'StageTemplates',
                variant: 'info',
                size: 'large',
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
            title="Stage Display Templates"
          >
            <HardDriveDownload className="w-4 h-4" />
          </button>

          {/* Help trigger button */}
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
            title="Stage Display Help"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>
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

      {/* Background Color */}
      <div className="flex items-center justify-between gap-4">
        <Tooltip content="Set background color for stage display" side="right">
          <LabelWithIcon icon={Square} text="Background" darkMode={darkMode} />
        </Tooltip>
        <Input
          type="color"
          value={settings.backgroundColor}
          onChange={(e) => update('backgroundColor', e.target.value)}
          className={`h-9 w-12 p-1 ${darkMode ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'}`}
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
            <label className={`text-sm whitespace-nowrap ${darkMode ? 'text-gray-200' : 'text-gray-700'} ${settings.upcomingSongMode !== 'custom' ? 'opacity-50' : ''}`}>
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
                className={`w-[160px] ${darkMode ? 'bg-gray-700 border-gray-600 text-gray-200' : 'bg-white border-gray-300'} ${settings.upcomingSongMode !== 'custom' ? 'opacity-50 cursor-not-allowed' : ''}`}
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

          {/* Full Screen Toggle */}
          <div className="flex items-center justify-between w-full">
            <label className={`text-sm whitespace-nowrap ${darkMode ? 'text-gray-200' : 'text-gray-700'} ${(settings.timerFullScreen || settings.customMessagesFullScreen) ? 'opacity-50' : ''}`}>
              Send Full Screen
            </label>
            <div className="flex items-center gap-3">
              <span className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                {settings.upcomingSongFullScreen ? 'Enabled' : 'Disabled'}
              </span>
              <Switch
                checked={settings.upcomingSongFullScreen || false}
                onCheckedChange={(checked) => handleFullScreenToggle('upcomingSong', checked)}
                disabled={settings.timerFullScreen || settings.customMessagesFullScreen}
                aria-label="Toggle upcoming song full screen"
                className={`!h-8 !w-16 !border-0 shadow-sm transition-colors ${darkMode
                  ? 'data-[state=checked]:bg-green-400 data-[state=unchecked]:bg-gray-600'
                  : 'data-[state=checked]:bg-black data-[state=unchecked]:bg-gray-300'
                  } ${(settings.timerFullScreen || settings.customMessagesFullScreen) ? 'opacity-50 cursor-not-allowed' : ''}`}
                thumbClassName="!h-6 !w-7 data-[state=checked]:!translate-x-8 data-[state=unchecked]:!translate-x-1"
              />
            </div>
          </div>
        </div>
      </div>

      <div className={`border-t my-4 ${darkMode ? 'border-gray-700' : 'border-gray-100'}`}></div>

      {/* Live Line Settings */}
      <h4 className={`text-sm font-semibold ${darkMode ? 'text-gray-300' : 'text-gray-700'} mt-2`}>Live Line (Current)</h4>

      <FontSettingsRow
        darkMode={darkMode}
        sizeValue={settings.liveFontSize}
        colorValue={settings.liveColor}
        onSizeChange={(val) => update('liveFontSize', val)}
        onColorChange={(val) => update('liveColor', val)}
        minSize={24}
        maxSize={200}
        tooltip="Font size and color for current lyric line"
      />

      <EmphasisRow
        darkMode={darkMode}
        LabelWithIcon={LabelWithIcon}
        icon={TextQuote}
        boldValue={settings.liveBold}
        italicValue={settings.liveItalic}
        underlineValue={settings.liveUnderline}
        allCapsValue={settings.liveAllCaps}
        onBoldChange={(val) => update('liveBold', val)}
        onItalicChange={(val) => update('liveItalic', val)}
        onUnderlineChange={(val) => update('liveUnderline', val)}
        onAllCapsChange={(val) => update('liveAllCaps', val)}
      />

      <AlignmentRow
        darkMode={darkMode}
        LabelWithIcon={LabelWithIcon}
        icon={AlignVerticalSpaceAround}
        value={settings.liveAlign}
        onChange={(val) => update('liveAlign', val)}
        tooltip="Text alignment for current line"
      />

      <div className="flex items-center justify-between gap-4 mt-4">
        <Tooltip content="Color for translation lines in grouped lyrics" side="right">
          <LabelWithIcon icon={Languages} text="Translation Colour" darkMode={darkMode} />
        </Tooltip>
        <Input
          type="color"
          value={settings.translationLineColor || '#FBBF24'}
          onChange={(e) => update('translationLineColor', e.target.value)}
          className={`h-9 w-12 p-1 ${darkMode ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'}`}
        />
      </div>

      <div className={`border-t my-4 ${darkMode ? 'border-gray-700' : 'border-gray-100'}`}></div>

      {/* Next Line Settings */}
      <h4 className={`text-sm font-semibold ${darkMode ? 'text-gray-300' : 'text-gray-700'} mt-2`}>Next Line (Upcoming)</h4>

      <FontSettingsRow
        darkMode={darkMode}
        sizeValue={settings.nextFontSize}
        colorValue={settings.nextColor}
        onSizeChange={(val) => update('nextFontSize', val)}
        onColorChange={(val) => update('nextColor', val)}
        minSize={24}
        maxSize={200}
        tooltip="Font size and color for upcoming lyric line"
      />

      <EmphasisRow
        darkMode={darkMode}
        LabelWithIcon={LabelWithIcon}
        icon={TextQuote}
        boldValue={settings.nextBold}
        italicValue={settings.nextItalic}
        underlineValue={settings.nextUnderline}
        allCapsValue={settings.nextAllCaps}
        onBoldChange={(val) => update('nextBold', val)}
        onItalicChange={(val) => update('nextItalic', val)}
        onUnderlineChange={(val) => update('nextUnderline', val)}
        onAllCapsChange={(val) => update('nextAllCaps', val)}
      />

      <AlignmentRow
        darkMode={darkMode}
        LabelWithIcon={LabelWithIcon}
        icon={AlignVerticalSpaceAround}
        value={settings.nextAlign}
        onChange={(val) => update('nextAlign', val)}
        tooltip="Text alignment for upcoming line"
      />

      <div className="flex items-center justify-between gap-4 mt-4">
        <Tooltip content="Show arrow indicator before upcoming line" side="right">
          <LabelWithIcon icon={ChevronRight} text="Arrow" darkMode={darkMode} />
        </Tooltip>
        <div className="flex items-center gap-2 justify-end w-full">
          <span className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
            {settings.showNextArrow ? 'Enabled' : 'Disabled'}
          </span>
          <Switch
            checked={settings.showNextArrow}
            onCheckedChange={(checked) => update('showNextArrow', checked)}
            aria-label="Toggle show arrow"
            className={`!h-8 !w-16 !border-0 shadow-sm transition-colors ${darkMode
              ? 'data-[state=checked]:bg-green-400 data-[state=unchecked]:bg-gray-600'
              : 'data-[state=checked]:bg-black data-[state=unchecked]:bg-gray-300'
              }`}
            thumbClassName="!h-6 !w-7 data-[state=checked]:!translate-x-8 data-[state=unchecked]:!translate-x-1"
          />
          <Paintbrush className={`w-4 h-4 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`} />
          <Input
            type="color"
            value={settings.nextArrowColor}
            onChange={(e) => update('nextArrowColor', e.target.value)}
            className={`h-9 w-12 p-1 ${darkMode ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'}`}
          />
        </div>
      </div>

      <div className={`border-t my-4 ${darkMode ? 'border-gray-700' : 'border-gray-100'}`}></div>

      {/* Previous Line Settings */}
      <h4 className={`text-sm font-semibold ${darkMode ? 'text-gray-300' : 'text-gray-700'} mt-2`}>Previous Line</h4>

      <FontSettingsRow
        darkMode={darkMode}
        sizeValue={settings.prevFontSize}
        colorValue={settings.prevColor}
        onSizeChange={(val) => update('prevFontSize', val)}
        onColorChange={(val) => update('prevColor', val)}
        minSize={24}
        maxSize={200}
        tooltip="Font size and color for previous lyric line"
      />

      <EmphasisRow
        darkMode={darkMode}
        LabelWithIcon={LabelWithIcon}
        icon={TextQuote}
        boldValue={settings.prevBold}
        italicValue={settings.prevItalic}
        underlineValue={settings.prevUnderline}
        allCapsValue={settings.prevAllCaps}
        onBoldChange={(val) => update('prevBold', val)}
        onItalicChange={(val) => update('prevItalic', val)}
        onUnderlineChange={(val) => update('prevUnderline', val)}
        onAllCapsChange={(val) => update('prevAllCaps', val)}
      />

      <AlignmentRow
        darkMode={darkMode}
        LabelWithIcon={LabelWithIcon}
        icon={AlignVerticalSpaceAround}
        value={settings.prevAlign}
        onChange={(val) => update('prevAlign', val)}
        tooltip="Text alignment for previous line"
      />

      <div className={`border-t my-4 ${darkMode ? 'border-gray-700' : 'border-gray-100'}`}></div>

      {/* Song Info Settings */}
      <h4 className={`text-sm font-semibold ${darkMode ? 'text-gray-300' : 'text-gray-700'} mt-2`}>Top Bar</h4>

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
      <h4 className={`text-sm font-semibold ${darkMode ? 'text-gray-300' : 'text-gray-700'} mt-2`}>Bottom Bar</h4>

      <div className="flex items-center justify-between gap-4 mt-4">
        <Tooltip content="Display current real-world time" side="right">
          <LabelWithIcon icon={ScreenShare} text="Show Time" darkMode={darkMode} />
        </Tooltip>
        <div className="flex items-center gap-3 justify-end w-full">
          <span className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
            {settings.showTime ? 'Enabled' : 'Disabled'}
          </span>
          <Switch
            checked={settings.showTime}
            onCheckedChange={(checked) => update('showTime', checked)}
            aria-label="Toggle show time"
            className={`!h-8 !w-16 !border-0 shadow-sm transition-colors ${darkMode
              ? 'data-[state=checked]:bg-green-400 data-[state=unchecked]:bg-gray-600'
              : 'data-[state=checked]:bg-black data-[state=unchecked]:bg-gray-300'
              }`}
            thumbClassName="!h-6 !w-7 data-[state=checked]:!translate-x-8 data-[state=unchecked]:!translate-x-1"
          />
        </div>
      </div>

      {/* Timer Controls */}
      <div className="flex items-center justify-between gap-4">
        <Tooltip content="Set countdown timer duration in minutes" side="right">
          <LabelWithIcon icon={ScreenShare} text="Countdown Timer" darkMode={darkMode} />
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
          {/* Full Screen Toggle */}
          <div className="flex items-center justify-between w-full">
            <label className={`text-sm whitespace-nowrap ${darkMode ? 'text-gray-200' : 'text-gray-700'} ${(settings.upcomingSongFullScreen || settings.customMessagesFullScreen) ? 'opacity-50' : ''}`}>
              Send Full Screen
            </label>
            <div className="flex items-center gap-3">
              <span className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'} ${(settings.upcomingSongFullScreen || settings.customMessagesFullScreen) ? 'opacity-50' : ''}`}>
                {settings.timerFullScreen ? 'Enabled' : 'Disabled'}
              </span>
              <Switch
                checked={settings.timerFullScreen || false}
                onCheckedChange={(checked) => handleFullScreenToggle('timer', checked)}
                disabled={settings.upcomingSongFullScreen || settings.customMessagesFullScreen}
                aria-label="Toggle timer full screen"
                className={`!h-8 !w-16 !border-0 shadow-sm transition-colors ${darkMode
                  ? 'data-[state=checked]:bg-green-400 data-[state=unchecked]:bg-gray-600'
                  : 'data-[state=checked]:bg-black data-[state=unchecked]:bg-gray-300'
                  } ${(settings.upcomingSongFullScreen || settings.customMessagesFullScreen) ? 'opacity-50 cursor-not-allowed' : ''}`}
                thumbClassName="!h-6 !w-7 data-[state=checked]:!translate-x-8 data-[state=unchecked]:!translate-x-1"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Timer Control Buttons Row */}
      <div className="flex items-center justify-between gap-4">
        {/* Left: Timer Display */}
        <div className={`flex items-center justify-center px-4 py-2 rounded-lg min-w-[120px] ${darkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
          <div className={`text-xl font-mono font-bold ${timerRunning && !timerPaused ? (darkMode ? 'text-green-400' : 'text-green-600') : (darkMode ? 'text-gray-400' : 'text-gray-500')}`}>
            {timeRemaining || '0:00'}
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
      <h4 className={`text-sm font-semibold ${darkMode ? 'text-gray-300' : 'text-gray-700'} mt-2`}>Custom Messages</h4>

      <div className="flex items-center justify-between gap-4 mt-4">
        <Tooltip content="Time between message transitions (1000-10000ms)" side="right">
          <LabelWithIcon icon={Wand2} text="Scroll Speed (ms)" darkMode={darkMode} />
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
            onChange={(e) => update('messageScrollSpeed', parseInt(e.target.value))}
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
          {/* Full Screen Toggle */}
          <div className="flex items-center justify-between w-full">
            <label className={`text-sm whitespace-nowrap ${darkMode ? 'text-gray-200' : 'text-gray-700'} ${(settings.upcomingSongFullScreen || settings.timerFullScreen) ? 'opacity-50' : ''}`}>
              Send Full Screen
            </label>
            <div className="flex items-center gap-3">
              <span className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'} ${(settings.upcomingSongFullScreen || settings.timerFullScreen) ? 'opacity-50' : ''}`}>
                {settings.customMessagesFullScreen ? 'Enabled' : 'Disabled'}
              </span>
              <Switch
                checked={settings.customMessagesFullScreen || false}
                onCheckedChange={(checked) => handleFullScreenToggle('customMessages', checked)}
                disabled={settings.upcomingSongFullScreen || settings.timerFullScreen}
                aria-label="Toggle custom messages full screen"
                className={`!h-8 !w-16 !border-0 shadow-sm transition-colors ${darkMode
                  ? 'data-[state=checked]:bg-green-400 data-[state=unchecked]:bg-gray-600'
                  : 'data-[state=checked]:bg-black data-[state=unchecked]:bg-gray-300'
                  } ${(settings.upcomingSongFullScreen || settings.timerFullScreen) ? 'opacity-50 cursor-not-allowed' : ''}`}
                thumbClassName="!h-6 !w-7 data-[state=checked]:!translate-x-8 data-[state=unchecked]:!translate-x-1"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex gap-2">
          <Input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleAddMessage()}
            placeholder="Enter custom message..."
            className={`flex-1 ${darkMode ? 'bg-gray-700 border-gray-600 text-gray-200' : 'bg-white border-gray-300'}`}
          />
          <Button onClick={handleAddMessage} className={darkMode ? 'bg-blue-600 hover:bg-blue-700' : ''}>
            Add
          </Button>
        </div>

        {customMessages.length > 0 && (
          <div className={`space-y-2 max-h-40 overflow-y-auto p-2 rounded ${darkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
            {customMessages.map((msg) => (
              <div key={msg.id} className={`flex items-center justify-between p-2 rounded ${darkMode ? 'bg-gray-600' : 'bg-white'}`}>
                <span className={`text-sm ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>
                  {typeof msg === 'string' ? msg : msg.text}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleRemoveMessage(msg.id)}
                  className={darkMode ? 'hover:bg-gray-500 text-gray-300' : ''}
                >
                  Remove
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className={`border-t my-4 ${darkMode ? 'border-gray-700' : 'border-gray-100'}`}></div>

      {/* Transition Settings */}
      <h4 className={`text-sm font-semibold ${darkMode ? 'text-gray-300' : 'text-gray-700'} mt-2`}>Transition Animation</h4>

      <div className="flex items-center justify-between gap-4 mt-4">
        <Tooltip content="Choose animation style when lyrics change" side="right">
          <LabelWithIcon icon={Wand2} text="Animation Style" darkMode={darkMode} />
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
            <LabelWithIcon icon={Wand2} text="Speed (ms)" darkMode={darkMode} />
          </Tooltip>
          <Input
            type="number"
            value={settings.transitionSpeed}
            onChange={(e) => update('transitionSpeed', parseInt(e.target.value))}
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