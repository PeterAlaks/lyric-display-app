import React from 'react';
import { useDarkModeState, useOutput1Settings, useOutput2Settings, useStageSettings } from '../hooks/useStoreSelectors';
import { useControlSocket } from '../context/ControlSocketProvider';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tooltip } from '@/components/ui/tooltip';
import useToast from '../hooks/useToast';
import useModal from '../hooks/useModal';
import useAuth from '../hooks/useAuth';
import { resolveBackendUrl } from '../utils/network';
import { logWarn } from '../utils/logger';
import { Type, Paintbrush, Contrast, TextCursorInput, TextQuote, Square, Frame, Move, Italic, Underline, Bold, CaseUpper, AlignVerticalSpaceAround, ScreenShare, ListStart, ListMusic, ChevronDown, ChevronUp, ChevronRight, ArrowUpDown, Rows3, MoveHorizontal, MoveVertical, Sparkles, Languages, Wand2 } from 'lucide-react';

const fontOptions = [
  'Arial', 'Calibri', 'Bebas Neue', 'Fira Sans', 'GarnetCapitals', 'Inter', 'Lato', 'Montserrat',
  'Noto Sans', 'Open Sans', 'Poppins', 'Roboto', 'Work Sans'
];

const MAX_MEDIA_SIZE_BYTES = 200 * 1024 * 1024;

const detectClientType = () => {
  if (typeof window === 'undefined') return 'web';
  if (window.electronAPI) return 'desktop';
  if (/Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent || '')) {
    return 'mobile';
  }
  return 'web';
};

const StageSettingsPanel = ({ settings, applySettings, update, darkMode, LabelWithIcon, showModal }) => {
  const { emitStageTimerUpdate, emitStageMessagesUpdate } = useControlSocket();
  const { showToast } = useToast();
  const [customMessages, setCustomMessages] = React.useState([]);
  const [newMessage, setNewMessage] = React.useState('');
  const [timerDuration, setTimerDuration] = React.useState(0);
  const [timerRunning, setTimerRunning] = React.useState(false);
  const [timerPaused, setTimerPaused] = React.useState(false);
  const [timerEndTime, setTimerEndTime] = React.useState(null);
  const [timeRemaining, setTimeRemaining] = React.useState(null);
  const [customUpcomingSongName, setCustomUpcomingSongName] = React.useState('');
  const [upcomingSongAdvancedExpanded, setUpcomingSongAdvancedExpanded] = React.useState(false);
  const [hasUnsavedUpcomingSongName, setHasUnsavedUpcomingSongName] = React.useState(false);
  const [timerAdvancedExpanded, setTimerAdvancedExpanded] = React.useState(false);
  const [customMessagesAdvancedExpanded, setCustomMessagesAdvancedExpanded] = React.useState(false);

  React.useEffect(() => {
    const stored = sessionStorage.getItem('stage_custom_upcoming_song_name');
    if (stored) {
      setCustomUpcomingSongName(stored);
    }
  }, []);

  React.useEffect(() => {
    if (settings.upcomingSongMode === 'custom') {
      setUpcomingSongAdvancedExpanded(true);
    }
  }, [settings.upcomingSongMode]);

  const handleCustomUpcomingSongNameChange = (value) => {
    setCustomUpcomingSongName(value);
    setHasUnsavedUpcomingSongName(true);
  };

  const handleConfirmUpcomingSongName = () => {
    sessionStorage.setItem('stage_custom_upcoming_song_name', customUpcomingSongName);
    setHasUnsavedUpcomingSongName(false);

    if (emitStageTimerUpdate) {
      const payload = {
        type: 'upcomingSongUpdate',
        customName: customUpcomingSongName,
        mode: settings.upcomingSongMode,
      };

      if (typeof emitStageTimerUpdate === 'function') {
        emitStageTimerUpdate(payload);
      }
    }

    window.dispatchEvent(new CustomEvent('stage-upcoming-song-update', {
      detail: { customName: customUpcomingSongName }
    }));

    showToast({
      title: 'Upcoming Song Updated',
      message: 'Custom upcoming song name has been set',
      variant: 'success',
    });
  };

  const handleFullScreenToggle = (type, checked) => {
    if (checked) {
      const updates = {
        upcomingSongFullScreen: type === 'upcomingSong',
        timerFullScreen: type === 'timer',
        customMessagesFullScreen: type === 'customMessages',
      };
      applySettings(updates);
    } else {

      update(`${type}FullScreen`, false);
    }
  };

  React.useEffect(() => {
    const stored = sessionStorage.getItem('stage_custom_messages');
    if (stored) {
      try {
        const messages = JSON.parse(stored);
        setCustomMessages(messages);
        if (emitStageMessagesUpdate) {
          emitStageMessagesUpdate(messages);
        }
      } catch (e) {
        setCustomMessages([]);
      }
    }
  }, [emitStageMessagesUpdate]);

  React.useEffect(() => {
    const storedDuration = sessionStorage.getItem('stage_timer_duration');
    const storedEndTime = sessionStorage.getItem('stage_timer_end_time');
    const storedRunning = sessionStorage.getItem('stage_timer_running');
    const storedPaused = sessionStorage.getItem('stage_timer_paused');

    if (storedDuration) {
      setTimerDuration(parseInt(storedDuration, 10));
    }

    if (storedRunning === 'true' && storedEndTime) {
      const endTime = parseInt(storedEndTime, 10);
      const now = Date.now();

      if (endTime > now) {
        setTimerEndTime(endTime);
        setTimerRunning(true);
        setTimerPaused(storedPaused === 'true');
      } else {
        sessionStorage.removeItem('stage_timer_end_time');
        sessionStorage.removeItem('stage_timer_running');
        sessionStorage.removeItem('stage_timer_paused');
      }
    }
  }, []);

  const saveMessages = (messages) => {
    setCustomMessages(messages);
    sessionStorage.setItem('stage_custom_messages', JSON.stringify(messages));
    if (emitStageMessagesUpdate) {
      emitStageMessagesUpdate(messages);
    }
  };

  const handleAddMessage = () => {
    if (!newMessage.trim()) return;
    const updatedMessages = [...customMessages, { id: `msg_${Date.now()}`, text: newMessage.trim() }];
    saveMessages(updatedMessages);
    setNewMessage('');

    showToast({
      title: 'Message Added',
      message: 'Custom message has been added to stage display',
      variant: 'success',
    });
  };

  const handleRemoveMessage = (id) => {
    const updatedMessages = customMessages.filter(msg => msg.id !== id);
    saveMessages(updatedMessages);

    showToast({
      title: 'Message Removed',
      message: 'Custom message has been removed from stage display',
      variant: 'success',
    });
  };

  React.useEffect(() => {
    if (!timerRunning || !timerEndTime || timerPaused) {
      return;
    }

    const updateTimer = () => {
      const now = Date.now();
      const remaining = timerEndTime - now;

      if (remaining <= 0) {
        setTimerRunning(false);
        setTimerPaused(false);
        setTimerEndTime(null);
        setTimeRemaining('0:00');
        sessionStorage.removeItem('stage_timer_end_time');
        sessionStorage.removeItem('stage_timer_running');
        sessionStorage.removeItem('stage_timer_paused');
        if (emitStageTimerUpdate) {
          emitStageTimerUpdate({ running: false, paused: false, endTime: null, remaining: null });
        }
        return;
      }

      const minutes = Math.floor(remaining / 60000);
      const seconds = Math.floor((remaining % 60000) / 1000);
      const formattedTime = `${minutes}:${seconds.toString().padStart(2, '0')}`;
      setTimeRemaining(formattedTime);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [timerRunning, timerEndTime, timerPaused, emitStageTimerUpdate]);

  const handleStartTimer = () => {
    if (timerDuration <= 0) return;

    const endTime = Date.now() + (timerDuration * 60000);
    setTimerEndTime(endTime);
    setTimerRunning(true);
    setTimerPaused(false);

    sessionStorage.setItem('stage_timer_end_time', endTime.toString());
    sessionStorage.setItem('stage_timer_running', 'true');
    sessionStorage.setItem('stage_timer_paused', 'false');

    if (emitStageTimerUpdate) {
      emitStageTimerUpdate({ running: true, paused: false, endTime, remaining: null });
    }
  };

  const handlePauseTimer = () => {
    if (!timerRunning) return;

    setTimerPaused(true);
    sessionStorage.setItem('stage_timer_paused', 'true');

    if (emitStageTimerUpdate) {
      emitStageTimerUpdate({ running: true, paused: true, endTime: timerEndTime, remaining: timeRemaining });
    }
  };

  const handleResumeTimer = () => {
    if (!timerRunning) return;

    setTimerPaused(false);
    sessionStorage.setItem('stage_timer_paused', 'false');

    if (emitStageTimerUpdate) {
      emitStageTimerUpdate({ running: true, paused: false, endTime: timerEndTime, remaining: timeRemaining });
    }
  };

  const handleStopTimer = () => {
    setTimerRunning(false);
    setTimerPaused(false);
    setTimerEndTime(null);
    setTimeRemaining(null);

    sessionStorage.removeItem('stage_timer_end_time');
    sessionStorage.removeItem('stage_timer_running');
    sessionStorage.removeItem('stage_timer_paused');

    if (emitStageTimerUpdate) {
      emitStageTimerUpdate({ running: false, paused: false, endTime: null, remaining: null });
    }
  };

  const handleTimerDurationChange = (value) => {
    const duration = parseInt(value, 10);
    setTimerDuration(duration);
    sessionStorage.setItem('stage_timer_duration', duration.toString());
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className={`text-sm font-medium uppercase tracking-wide ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
          STAGE DISPLAY SETTINGS
        </h3>

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

      {/* Font Style */}
      <div className="flex items-center justify-between gap-4">
        <Tooltip content="Select font family for stage display" side="right">
          <LabelWithIcon icon={Type} text="Font Style" />
        </Tooltip>
        <Select value={settings.fontStyle} onValueChange={(val) => update('fontStyle', val)}>
          <SelectTrigger className={`w-full ${darkMode ? 'bg-gray-700 border-gray-600 text-gray-200' : 'bg-white border-gray-300'}`}>
            <SelectValue placeholder="Select font" />
          </SelectTrigger>
          <SelectContent className={darkMode ? 'bg-gray-700 border-gray-600 text-gray-200' : 'bg-white border-gray-300'}>
            {fontOptions.map((font) => (
              <SelectItem key={font} value={font} style={{ fontFamily: font }} className={darkMode ? 'text-gray-200 hover:bg-gray-600' : ''}>
                {font}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Background Color */}
      <div className="flex items-center justify-between gap-4">
        <Tooltip content="Set background color for stage display" side="right">
          <LabelWithIcon icon={Square} text="Background" />
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
          <LabelWithIcon icon={ListMusic} text="Upcoming Song" />
        </Tooltip>
        <div className="flex items-center gap-2 justify-end w-full">
          <Tooltip content={(upcomingSongAdvancedExpanded ? "Hide" : "Show") + " advanced settings"} side="top">
            <button
              onClick={() => setUpcomingSongAdvancedExpanded(!upcomingSongAdvancedExpanded)}
              className={`p-1 rounded transition-colors ${darkMode
                ? 'hover:bg-gray-700 text-gray-400'
                : 'hover:bg-gray-100 text-gray-500'
                }`}
              aria-label="Toggle upcoming song advanced settings"
            >
              {upcomingSongAdvancedExpanded ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>
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

      <div className="flex items-center justify-between gap-4 mt-4">
        <Tooltip content="Font size and color for current lyric line" side="right">
          <label className={`text-sm ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>Font Settings</label>
        </Tooltip>
        <div className="flex items-center gap-2">
          <TextCursorInput className={`w-4 h-4 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`} />
          <Input
            type="number"
            value={settings.liveFontSize}
            onChange={(e) => update('liveFontSize', parseInt(e.target.value))}
            min="24"
            max="200"
            className={`w-20 ${darkMode ? 'bg-gray-700 border-gray-600 text-gray-200' : 'bg-white border-gray-300'}`}
          />
          <Paintbrush className={`w-4 h-4 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`} />
          <Input
            type="color"
            value={settings.liveColor}
            onChange={(e) => update('liveColor', e.target.value)}
            className={`h-9 w-12 p-1 ${darkMode ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'}`}
          />
        </div>
      </div>

      <div className="flex items-center justify-between gap-4">
        <Tooltip content="Apply text styling: bold, italic, underline, or all caps" side="right">
          <LabelWithIcon icon={TextQuote} text="Emphasis" />
        </Tooltip>
        <div className="flex gap-2 flex-wrap">
          <Tooltip content="Make text bold" side="top">
            <Button
              size="icon"
              variant={settings.liveBold ? 'default' : 'outline'}
              onClick={() => update('liveBold', !settings.liveBold)}
              title="Bold"
              className={!settings.liveBold && darkMode ? 'border-gray-600 text-gray-200 hover:bg-gray-700' : ''}
            >
              <Bold className="w-4 h-4" />
            </Button>
          </Tooltip>
          <Tooltip content="Make text italic" side="top">
            <Button
              size="icon"
              variant={settings.liveItalic ? 'default' : 'outline'}
              onClick={() => update('liveItalic', !settings.liveItalic)}
              title="Italic"
              className={!settings.liveItalic && darkMode ? 'border-gray-600 text-gray-200 hover:bg-gray-700' : ''}
            >
              <Italic className="w-4 h-4" />
            </Button>
          </Tooltip>
          <Tooltip content="Underline text" side="top">
            <Button
              size="icon"
              variant={settings.liveUnderline ? 'default' : 'outline'}
              onClick={() => update('liveUnderline', !settings.liveUnderline)}
              title="Underline"
              className={!settings.liveUnderline && darkMode ? 'border-gray-600 text-gray-200 hover:bg-gray-700' : ''}
            >
              <Underline className="w-4 h-4" />
            </Button>
          </Tooltip>
          <Tooltip content="Convert text to uppercase" side="top">
            <Button
              size="icon"
              variant={settings.liveAllCaps ? 'default' : 'outline'}
              onClick={() => update('liveAllCaps', !settings.liveAllCaps)}
              title="All Caps"
              className={!settings.liveAllCaps && darkMode ? 'border-gray-600 text-gray-200 hover:bg-gray-700' : ''}
            >
              <CaseUpper className="w-4 h-4" />
            </Button>
          </Tooltip>
        </div>
      </div>

      <div className="flex items-center justify-between gap-4">
        <Tooltip content="Text alignment for current line" side="right">
          <LabelWithIcon icon={AlignVerticalSpaceAround} text="Alignment" />
        </Tooltip>
        <Select value={settings.liveAlign || 'center'} onValueChange={(val) => update('liveAlign', val)}>
          <SelectTrigger className={`w-[140px] ${darkMode ? 'bg-gray-700 border-gray-600 text-gray-200' : 'bg-white border-gray-300'}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent className={darkMode ? 'bg-gray-700 border-gray-600 text-gray-200' : 'bg-white border-gray-300'}>
            <SelectItem value="left">Left</SelectItem>
            <SelectItem value="center">Centre</SelectItem>
            <SelectItem value="right">Right</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center justify-between gap-4 mt-4">
        <Tooltip content="Color for translation lines in grouped lyrics" side="right">
          <LabelWithIcon icon={Languages} text="Translation Colour" />
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

      <div className="flex items-center justify-between gap-4 mt-4">
        <Tooltip content="Font size and color for upcoming lyric line" side="right">
          <label className={`text-sm ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>Font Settings</label>
        </Tooltip>
        <div className="flex items-center gap-2">
          <TextCursorInput className={`w-4 h-4 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`} />
          <Input
            type="number"
            value={settings.nextFontSize}
            onChange={(e) => update('nextFontSize', parseInt(e.target.value))}
            min="24"
            max="200"
            className={`w-20 ${darkMode ? 'bg-gray-700 border-gray-600 text-gray-200' : 'bg-white border-gray-300'}`}
          />
          <Paintbrush className={`w-4 h-4 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`} />
          <Input
            type="color"
            value={settings.nextColor}
            onChange={(e) => update('nextColor', e.target.value)}
            className={`h-9 w-12 p-1 ${darkMode ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'}`}
          />
        </div>
      </div>

      <div className="flex items-center justify-between gap-4">
        <Tooltip content="Apply text styling: bold, italic, underline, or all caps" side="right">
          <LabelWithIcon icon={TextQuote} text="Emphasis" />
        </Tooltip>
        <div className="flex gap-2 flex-wrap">
          <Tooltip content="Make text bold" side="top">
            <Button
              size="icon"
              variant={settings.nextBold ? 'default' : 'outline'}
              onClick={() => update('nextBold', !settings.nextBold)}
              title="Bold"
              className={!settings.nextBold && darkMode ? 'border-gray-600 text-gray-200 hover:bg-gray-700' : ''}
            >
              <Bold className="w-4 h-4" />
            </Button>
          </Tooltip>
          <Tooltip content="Make text italic" side="top">
            <Button
              size="icon"
              variant={settings.nextItalic ? 'default' : 'outline'}
              onClick={() => update('nextItalic', !settings.nextItalic)}
              title="Italic"
              className={!settings.nextItalic && darkMode ? 'border-gray-600 text-gray-200 hover:bg-gray-700' : ''}
            >
              <Italic className="w-4 h-4" />
            </Button>
          </Tooltip>
          <Tooltip content="Underline text" side="top">
            <Button
              size="icon"
              variant={settings.nextUnderline ? 'default' : 'outline'}
              onClick={() => update('nextUnderline', !settings.nextUnderline)}
              title="Underline"
              className={!settings.nextUnderline && darkMode ? 'border-gray-600 text-gray-200 hover:bg-gray-700' : ''}
            >
              <Underline className="w-4 h-4" />
            </Button>
          </Tooltip>
          <Tooltip content="Convert text to uppercase" side="top">
            <Button
              size="icon"
              variant={settings.nextAllCaps ? 'default' : 'outline'}
              onClick={() => update('nextAllCaps', !settings.nextAllCaps)}
              title="All Caps"
              className={!settings.nextAllCaps && darkMode ? 'border-gray-600 text-gray-200 hover:bg-gray-700' : ''}
            >
              <CaseUpper className="w-4 h-4" />
            </Button>
          </Tooltip>
        </div>
      </div>

      <div className="flex items-center justify-between gap-4">
        <Tooltip content="Text alignment for upcoming line" side="right">
          <LabelWithIcon icon={AlignVerticalSpaceAround} text="Alignment" />
        </Tooltip>
        <Select value={settings.nextAlign || 'center'} onValueChange={(val) => update('nextAlign', val)}>
          <SelectTrigger className={`w-[140px] ${darkMode ? 'bg-gray-700 border-gray-600 text-gray-200' : 'bg-white border-gray-300'}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent className={darkMode ? 'bg-gray-700 border-gray-600 text-gray-200' : 'bg-white border-gray-300'}>
            <SelectItem value="left">Left</SelectItem>
            <SelectItem value="center">Centre</SelectItem>
            <SelectItem value="right">Right</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center justify-between gap-4 mt-4">
        <Tooltip content="Show arrow indicator before upcoming line" side="right">
          <LabelWithIcon icon={ChevronRight} text="Arrow" />
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

      <div className="flex items-center justify-between gap-4 mt-4">
        <Tooltip content="Font size and color for previous lyric line" side="right">
          <label className={`text-sm ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>Font Settings</label>
        </Tooltip>
        <div className="flex items-center gap-2">
          <TextCursorInput className={`w-4 h-4 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`} />
          <Input
            type="number"
            value={settings.prevFontSize}
            onChange={(e) => update('prevFontSize', parseInt(e.target.value))}
            min="24"
            max="200"
            className={`w-20 ${darkMode ? 'bg-gray-700 border-gray-600 text-gray-200' : 'bg-white border-gray-300'}`}
          />
          <Paintbrush className={`w-4 h-4 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`} />
          <Input
            type="color"
            value={settings.prevColor}
            onChange={(e) => update('prevColor', e.target.value)}
            className={`h-9 w-12 p-1 ${darkMode ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'}`}
          />
        </div>
      </div>

      <div className="flex items-center justify-between gap-4">
        <Tooltip content="Apply text styling: bold, italic, underline, or all caps" side="right">
          <LabelWithIcon icon={TextQuote} text="Emphasis" />
        </Tooltip>
        <div className="flex gap-2 flex-wrap">
          <Tooltip content="Make text bold" side="top">
            <Button
              size="icon"
              variant={settings.prevBold ? 'default' : 'outline'}
              onClick={() => update('prevBold', !settings.prevBold)}
              title="Bold"
              className={!settings.prevBold && darkMode ? 'border-gray-600 text-gray-200 hover:bg-gray-700' : ''}
            >
              <Bold className="w-4 h-4" />
            </Button>
          </Tooltip>
          <Tooltip content="Make text italic" side="top">
            <Button
              size="icon"
              variant={settings.prevItalic ? 'default' : 'outline'}
              onClick={() => update('prevItalic', !settings.prevItalic)}
              title="Italic"
              className={!settings.prevItalic && darkMode ? 'border-gray-600 text-gray-200 hover:bg-gray-700' : ''}
            >
              <Italic className="w-4 h-4" />
            </Button>
          </Tooltip>
          <Tooltip content="Underline text" side="top">
            <Button
              size="icon"
              variant={settings.prevUnderline ? 'default' : 'outline'}
              onClick={() => update('prevUnderline', !settings.prevUnderline)}
              title="Underline"
              className={!settings.prevUnderline && darkMode ? 'border-gray-600 text-gray-200 hover:bg-gray-700' : ''}
            >
              <Underline className="w-4 h-4" />
            </Button>
          </Tooltip>
          <Tooltip content="Convert text to uppercase" side="top">
            <Button
              size="icon"
              variant={settings.prevAllCaps ? 'default' : 'outline'}
              onClick={() => update('prevAllCaps', !settings.prevAllCaps)}
              title="All Caps"
              className={!settings.prevAllCaps && darkMode ? 'border-gray-600 text-gray-200 hover:bg-gray-700' : ''}
            >
              <CaseUpper className="w-4 h-4" />
            </Button>
          </Tooltip>
        </div>
      </div>

      <div className="flex items-center justify-between gap-4">
        <Tooltip content="Text alignment for previous line" side="right">
          <LabelWithIcon icon={AlignVerticalSpaceAround} text="Alignment" />
        </Tooltip>
        <Select value={settings.prevAlign || 'center'} onValueChange={(val) => update('prevAlign', val)}>
          <SelectTrigger className={`w-[140px] ${darkMode ? 'bg-gray-700 border-gray-600 text-gray-200' : 'bg-white border-gray-300'}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent className={darkMode ? 'bg-gray-700 border-gray-600 text-gray-200' : 'bg-white border-gray-300'}>
            <SelectItem value="left">Left</SelectItem>
            <SelectItem value="center">Centre</SelectItem>
            <SelectItem value="right">Right</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className={`border-t my-4 ${darkMode ? 'border-gray-700' : 'border-gray-100'}`}></div>

      {/* Song Info Settings */}
      <h4 className={`text-sm font-semibold ${darkMode ? 'text-gray-300' : 'text-gray-700'} mt-2`}>Top Bar</h4>

      <div className="flex items-center justify-between gap-4 mt-4">
        <Tooltip content="Font size and color for current song name" side="right">
          <label className={`text-sm ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>Current Song</label>
        </Tooltip>
        <div className="flex items-center gap-2">
          <TextCursorInput className={`w-4 h-4 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`} />
          <Input
            type="number"
            value={settings.currentSongSize}
            onChange={(e) => update('currentSongSize', parseInt(e.target.value))}
            min="12"
            max="48"
            className={`w-20 ${darkMode ? 'bg-gray-700 border-gray-600 text-gray-200' : 'bg-white border-gray-300'}`}
          />
          <Paintbrush className={`w-4 h-4 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`} />
          <Input
            type="color"
            value={settings.currentSongColor}
            onChange={(e) => update('currentSongColor', e.target.value)}
            className={`h-9 w-12 p-1 ${darkMode ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'}`}
          />
        </div>
      </div>

      <div className="flex items-center justify-between gap-4">
        <Tooltip content="Font size and color for upcoming song name" side="right">
          <label className={`text-sm ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>Upcoming Song</label>
        </Tooltip>
        <div className="flex items-center gap-2">
          <TextCursorInput className={`w-4 h-4 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`} />
          <Input
            type="number"
            value={settings.upcomingSongSize}
            onChange={(e) => update('upcomingSongSize', parseInt(e.target.value))}
            min="12"
            max="48"
            className={`w-20 ${darkMode ? 'bg-gray-700 border-gray-600 text-gray-200' : 'bg-white border-gray-300'}`}
          />
          <Paintbrush className={`w-4 h-4 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`} />
          <Input
            type="color"
            value={settings.upcomingSongColor}
            onChange={(e) => update('upcomingSongColor', e.target.value)}
            className={`h-9 w-12 p-1 ${darkMode ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'}`}
          />
        </div>
      </div>

      <div className={`border-t my-4 ${darkMode ? 'border-gray-700' : 'border-gray-100'}`}></div>

      {/* Bottom Bar Settings */}
      <h4 className={`text-sm font-semibold ${darkMode ? 'text-gray-300' : 'text-gray-700'} mt-2`}>Bottom Bar</h4>

      <div className="flex items-center justify-between gap-4 mt-4">
        <Tooltip content="Display current real-world time" side="right">
          <LabelWithIcon icon={ScreenShare} text="Show Time" />
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
          <LabelWithIcon icon={ScreenShare} text="Countdown Timer" />
        </Tooltip>
        <div className="flex items-center gap-2 justify-end">
          <Tooltip content={(timerAdvancedExpanded ? "Hide" : "Show") + " advanced settings"} side="top">
            <button
              onClick={() => setTimerAdvancedExpanded(!timerAdvancedExpanded)}
              className={`p-1 rounded transition-colors ${darkMode
                ? 'hover:bg-gray-700 text-gray-400'
                : 'hover:bg-gray-100 text-gray-500'
                }`}
              aria-label="Toggle timer advanced settings"
            >
              {timerAdvancedExpanded ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>
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

      <div className="flex items-center justify-between gap-4">
        <Tooltip content="Font size and color for bottom bar text" side="right">
          <label className={`text-sm ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>Font Settings</label>
        </Tooltip>
        <div className="flex items-center gap-2">
          <TextCursorInput className={`w-4 h-4 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`} />
          <Input
            type="number"
            value={settings.bottomBarSize}
            onChange={(e) => update('bottomBarSize', parseInt(e.target.value))}
            min="12"
            max="36"
            className={`w-20 ${darkMode ? 'bg-gray-700 border-gray-600 text-gray-200' : 'bg-white border-gray-300'}`}
          />
          <Paintbrush className={`w-4 h-4 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`} />
          <Input
            type="color"
            value={settings.bottomBarColor}
            onChange={(e) => update('bottomBarColor', e.target.value)}
            className={`h-9 w-12 p-1 ${darkMode ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'}`}
          />
        </div>
      </div>

      <div className={`border-t my-4 ${darkMode ? 'border-gray-700' : 'border-gray-100'}`}></div>

      {/* Custom Messages */}
      <h4 className={`text-sm font-semibold ${darkMode ? 'text-gray-300' : 'text-gray-700'} mt-2`}>Custom Messages</h4>

      <div className="flex items-center justify-between gap-4 mt-4">
        <Tooltip content="Time between message transitions (1000-10000ms)" side="right">
          <LabelWithIcon icon={Wand2} text="Scroll Speed (ms)" />
        </Tooltip>
        <div className="flex items-center gap-2 justify-end">
          <Tooltip content={(customMessagesAdvancedExpanded ? "Hide" : "Show") + " advanced settings"} side="top">
            <button
              onClick={() => setCustomMessagesAdvancedExpanded(!customMessagesAdvancedExpanded)}
              className={`p-1 rounded transition-colors ${darkMode
                ? 'hover:bg-gray-700 text-gray-400'
                : 'hover:bg-gray-100 text-gray-500'
                }`}
              aria-label="Toggle custom messages advanced settings"
            >
              {customMessagesAdvancedExpanded ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>
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
          <LabelWithIcon icon={Wand2} text="Animation Style" />
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
            <LabelWithIcon icon={Wand2} text="Speed (ms)" />
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

const OutputSettingsPanel = ({ outputKey }) => {
  const { darkMode } = useDarkModeState();
  const { emitStyleUpdate } = useControlSocket();
  const { showToast } = useToast();
  const { showModal } = useModal();
  const { ensureValidToken } = useAuth();
  const fileInputRef = React.useRef(null);
  const clientTypeRef = React.useRef(detectClientType());

  const stageSettingsHook = useStageSettings();

  const { settings, updateSettings } =
    outputKey === 'stage'
      ? stageSettingsHook
      : outputKey === 'output1'
        ? useOutput1Settings()
        : useOutput2Settings();

  if (outputKey === 'stage') {
    const applyStageSettings = React.useCallback((partial) => {
      const newSettings = { ...settings, ...partial };
      updateSettings(partial);
      emitStyleUpdate('stage', newSettings);
    }, [settings, updateSettings, emitStyleUpdate]);

    const updateStage = React.useCallback((key, value) => {
      applyStageSettings({ [key]: value });
    }, [applyStageSettings]);

    const LabelWithIcon = ({ icon: Icon, text }) => (
      <div className="flex items-center gap-2 min-w-[140px]">
        <Icon className={`w-4 h-4 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`} />
        <label className={`text-sm ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>{text}</label>
      </div>
    );

    return (
      <StageSettingsPanel
        settings={settings}
        applySettings={applyStageSettings}
        update={updateStage}
        darkMode={darkMode}
        LabelWithIcon={LabelWithIcon}
        showModal={showModal}
      />
    );
  }

  React.useEffect(() => {
    const validateMedia = async () => {
      if (!settings.fullScreenMode || !settings.fullScreenBackgroundMedia?.url) return;

      const mediaUrl = resolveBackendUrl(settings.fullScreenBackgroundMedia.url);
      try {
        const response = await fetch(mediaUrl, { method: 'HEAD' });
        if (!response.ok) {
          logWarn(`${outputKey}: Background media not found, clearing reference`);
          applySettings({
            fullScreenBackgroundMedia: null,
            fullScreenBackgroundMediaName: '',
          });
        }
      } catch (error) {
        logWarn(`${outputKey}: Could not validate background media:`, error.message);
      }
    };

    if (settings.fullScreenMode) {
      validateMedia();
    }
  }, [settings.fullScreenMode, settings.fullScreenBackgroundMedia?.url]);

  const applySettings = React.useCallback((partial) => {
    const newSettings = { ...settings, ...partial };
    updateSettings(partial);
    emitStyleUpdate(outputKey, newSettings);
  }, [settings, updateSettings, emitStyleUpdate, outputKey]);

  const update = React.useCallback((key, value) => {
    applySettings({ [key]: value });
  }, [applySettings]);

  const LabelWithIcon = ({ icon: Icon, text }) => (
    <div className="flex items-center gap-2 min-w-[140px]">
      <Icon className={`w-4 h-4 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`} />
      <label className={`text-sm ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>{text}</label>
    </div>
  );

  const handleLyricsPositionChange = (val) => {
    update('lyricsPosition', val);
  };

  const handleFullScreenToggle = (checked) => {
    if (checked) {
      const restorePosition = fullScreenRestorePosition ?? lyricsPositionValue;
      applySettings({
        fullScreenMode: true,
        lyricsPosition: 'center',
        fullScreenRestorePosition: restorePosition,
      });
    } else {
      const restorePosition = fullScreenRestorePosition ?? lyricsPositionValue ?? 'lower';
      applySettings({
        fullScreenMode: false,
        lyricsPosition: restorePosition || 'lower',
        fullScreenRestorePosition: null,
      });
    }
  };

  const handleFullScreenBackgroundTypeChange = (val) => {
    const updates = {
      fullScreenBackgroundType: val,
      fullScreenBackgroundColor: (val === 'color' && !settings.fullScreenBackgroundColor) ? '#000000' : settings.fullScreenBackgroundColor,
    };
    applySettings(updates);
  };

  const handleFullScreenColorChange = (e) => {
    applySettings({ fullScreenBackgroundColor: e.target.value });
  };

  const resetFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleMediaSelection = async (event) => {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    if (!(file.type.startsWith('image/') || file.type.startsWith('video/'))) {
      showToast({
        title: 'Unsupported file',
        message: 'Please choose an image or video.',
        variant: 'error',
      });
      resetFileInput();
      return;
    }

    if (file.size > MAX_MEDIA_SIZE_BYTES) {
      const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
      showToast({
        title: 'File too large',
        message: `Files must be ${Math.round(MAX_MEDIA_SIZE_BYTES / (1024 * 1024))}MB or smaller. Selected file is ${sizeMB}MB.`,
        variant: 'error',
      });
      resetFileInput();
      return;
    }

    try {
      const token = await ensureValidToken(clientTypeRef.current);
      const uploadUrl = resolveBackendUrl('/api/media/backgrounds');
      const formData = new FormData();
      formData.append('background', file);
      formData.append('outputKey', outputKey);

      const response = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        let errorMessage = 'Upload failed';
        try {
          const errorBody = await response.json();
          if (errorBody?.error) errorMessage = errorBody.error;
        } catch { }
        throw new Error(errorMessage);
      }

      const payload = await response.json();

      applySettings({
        fullScreenBackgroundMedia: {
          url: payload.url,
          mimeType: payload.mimeType ?? file.type,
          name: payload.originalName ?? file.name,
          size: payload.size ?? file.size,
          uploadedAt: payload.uploadedAt ?? Date.now(),
        },
        fullScreenBackgroundMediaName: payload.originalName ?? file.name,
      });

      showToast({
        title: 'Background ready',
        message: `${payload.originalName ?? file.name} uploaded successfully.`,
        variant: 'success',
      });
    } catch (error) {
      showToast({
        title: 'Upload failed',
        message: error?.message || 'Could not upload the media file.',
        variant: 'error',
      });
    } finally {
      resetFileInput();
    }
  };

  const triggerFileDialog = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const fullScreenModeChecked = Boolean(settings.fullScreenMode);
  const selectTriggerDisabledClasses = fullScreenModeChecked ? 'opacity-60 pointer-events-none' : '';
  const lyricsPositionValue = settings.lyricsPosition ?? 'lower';
  const fullScreenBackgroundTypeValue = settings.fullScreenBackgroundType ?? 'color';
  const fullScreenBackgroundColorValue = settings.fullScreenBackgroundColor ?? '#000000';
  const fullScreenRestorePosition = settings.fullScreenRestorePosition ?? null;
  const fullScreenDisabledTooltip = 'Lyrics Position must be centre in full screen mode.';
  const backgroundDisabledTooltip = 'Cannot use background setting in full screen mode.';
  const backgroundMedia = settings.fullScreenBackgroundMedia;
  const hasBackgroundMedia = Boolean(backgroundMedia && (backgroundMedia.url || backgroundMedia.dataUrl));
  const uploadedMediaName = settings.fullScreenBackgroundMediaName || backgroundMedia?.name || '';
  const fullScreenOptionsWrapperClass = fullScreenModeChecked
    ? 'max-h-40 opacity-100 translate-y-0 pointer-events-auto mt-2'
    : 'max-h-0 opacity-0 -translate-y-2 pointer-events-none m-0 p-0';

  const previousFullScreenModeRef = React.useRef(fullScreenModeChecked);
  const previousLyricsPositionRef = React.useRef(lyricsPositionValue);

  const getSessionStorageKey = (key) => `${outputKey}_${key}`;

  const [fontSizeAdvancedExpanded, setFontSizeAdvancedExpanded] = React.useState(() => {
    const stored = sessionStorage.getItem(getSessionStorageKey('fontSizeAdvancedExpanded'));
    return stored === 'true';
  });

  React.useEffect(() => {
    if (settings.maxLinesEnabled && !fontSizeAdvancedExpanded) {
      setFontSizeAdvancedExpanded(true);
    }
  }, [settings.maxLinesEnabled]);

  const [fontColorAdvancedExpanded, setFontColorAdvancedExpanded] = React.useState(() => {
    const stored = sessionStorage.getItem(getSessionStorageKey('fontColorAdvancedExpanded'));
    return stored === 'true';
  });

  const [dropShadowAdvancedExpanded, setDropShadowAdvancedExpanded] = React.useState(() => {
    const stored = sessionStorage.getItem(getSessionStorageKey('dropShadowAdvancedExpanded'));
    return stored === 'true';
  });

  const [backgroundAdvancedExpanded, setBackgroundAdvancedExpanded] = React.useState(() => {
    const stored = sessionStorage.getItem(getSessionStorageKey('backgroundAdvancedExpanded'));
    return stored === 'true';
  });

  const [transitionAdvancedExpanded, setTransitionAdvancedExpanded] = React.useState(() => {
    const stored = sessionStorage.getItem(getSessionStorageKey('transitionAdvancedExpanded'));
    return stored === 'true';
  });

  React.useEffect(() => {
    sessionStorage.setItem(getSessionStorageKey('fontSizeAdvancedExpanded'), fontSizeAdvancedExpanded);
  }, [fontSizeAdvancedExpanded, outputKey]);

  React.useEffect(() => {
    sessionStorage.setItem(getSessionStorageKey('fontColorAdvancedExpanded'), fontColorAdvancedExpanded);
  }, [fontColorAdvancedExpanded, outputKey]);

  React.useEffect(() => {
    sessionStorage.setItem(getSessionStorageKey('dropShadowAdvancedExpanded'), dropShadowAdvancedExpanded);
  }, [dropShadowAdvancedExpanded, outputKey]);

  React.useEffect(() => {
    sessionStorage.setItem(getSessionStorageKey('backgroundAdvancedExpanded'), backgroundAdvancedExpanded);
  }, [backgroundAdvancedExpanded, outputKey]);

  React.useEffect(() => {
    sessionStorage.setItem(getSessionStorageKey('transitionAdvancedExpanded'), transitionAdvancedExpanded);
  }, [transitionAdvancedExpanded, outputKey]);

  const translationFontSizeMode = settings.translationFontSizeMode ?? 'bound';
  const translationFontSize = settings.translationFontSize ?? settings.fontSize ?? 48;
  const currentFontSize = settings.fontSize ?? 48;

  const translationLineColor = settings.translationLineColor ?? '#FBBF24';

  const dropShadowOffsetX = settings.dropShadowOffsetX ?? 0;
  const dropShadowOffsetY = settings.dropShadowOffsetY ?? 8;
  const dropShadowBlur = settings.dropShadowBlur ?? 10;

  const backgroundBandVerticalPadding = settings.backgroundBandVerticalPadding ?? 20;
  const backgroundBandHeightMode = settings.backgroundBandHeightMode ?? 'adaptive';
  const backgroundBandLockedToMaxLines = settings.backgroundBandLockedToMaxLines ?? false;
  const maxLinesValue = settings.maxLines ?? 3;
  const maxLinesEnabled = settings.maxLinesEnabled ?? false;

  const getDefaultCustomHeight = () => {
    if (maxLinesEnabled) {
      return maxLinesValue;
    }
    return 3;
  };

  const backgroundBandCustomLines = backgroundBandLockedToMaxLines && maxLinesEnabled
    ? maxLinesValue
    : (settings.backgroundBandCustomLines ?? getDefaultCustomHeight());

  const handleBackgroundHeightModeChange = (mode) => {
    const updates = {
      backgroundBandHeightMode: mode,
      backgroundBandCustomLines: (mode === 'custom' && !settings.backgroundBandCustomLines) ? getDefaultCustomHeight() : settings.backgroundBandCustomLines,
    };
    applySettings(updates);
  };

  const handleCustomLinesChange = (value) => {
    const numValue = parseInt(value, 10);

    if (maxLinesEnabled && numValue > maxLinesValue) {
      applySettings({ backgroundBandCustomLines: maxLinesValue });
      return;
    }

    applySettings({ backgroundBandCustomLines: numValue });
  };

  const handleTranslationFontSizeModeChange = (mode) => {
    const updates = {
      translationFontSizeMode: mode,
      translationFontSize: (mode === 'custom') ? currentFontSize : settings.translationFontSize,
    };
    applySettings(updates);
  };

  const handleTranslationFontSizeChange = (value) => {
    const numValue = parseInt(value, 10);

    if (numValue > currentFontSize) {
      applySettings({ translationFontSize: currentFontSize });
      return;
    }

    applySettings({ translationFontSize: numValue });
  };

  React.useEffect(() => {
    if (!previousFullScreenModeRef.current && fullScreenModeChecked) {
      if (!settings.fullScreenRestorePosition) {
        const inferredRestore = previousLyricsPositionRef.current ?? lyricsPositionValue ?? 'lower';
        applySettings({ fullScreenRestorePosition: inferredRestore });
      }
    }
    previousFullScreenModeRef.current = fullScreenModeChecked;
    previousLyricsPositionRef.current = lyricsPositionValue;
  }, [fullScreenModeChecked, lyricsPositionValue, settings.fullScreenRestorePosition, applySettings]);

  React.useEffect(() => {
    if (maxLinesEnabled && backgroundBandHeightMode === 'custom' && backgroundBandCustomLines > maxLinesValue) {
      applySettings({ backgroundBandCustomLines: maxLinesValue });
    }
  }, [maxLinesValue, maxLinesEnabled, backgroundBandHeightMode, backgroundBandCustomLines, applySettings]);

  React.useEffect(() => {
    if (translationFontSizeMode === 'custom' && translationFontSize > currentFontSize) {
      applySettings({ translationFontSize: currentFontSize });
    }
  }, [currentFontSize, translationFontSizeMode, translationFontSize, applySettings]);

  React.useEffect(() => {
    if (backgroundBandLockedToMaxLines && maxLinesEnabled && backgroundBandHeightMode === 'custom') {

      if (settings.backgroundBandCustomLines !== maxLinesValue) {
        applySettings({ backgroundBandCustomLines: maxLinesValue });
      }
    }
  }, [maxLinesValue, backgroundBandLockedToMaxLines, maxLinesEnabled, backgroundBandHeightMode]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className={`text-sm font-medium uppercase tracking-wide ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
          {outputKey.toUpperCase()} SETTINGS
        </h3>

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

      {/* Lyrics Position */}
      <div className="flex items-center justify-between gap-4">
        <Tooltip content="Choose where lyrics appear vertically on screen (centre is enforced in full screen mode)" side="right">
          <LabelWithIcon icon={AlignVerticalSpaceAround} text="Lyrics Position" />
        </Tooltip>
        <div className="w-full">
          <Select
            value={lyricsPositionValue}
            onValueChange={handleLyricsPositionChange}
            disabled={fullScreenModeChecked}
          >
            <SelectTrigger
              className={`w-full ${fullScreenModeChecked ? 'cursor-not-allowed' : ''} ${darkMode
                ? 'bg-gray-700 border-gray-600 text-gray-200'
                : 'bg-white border-gray-300'
                } ${selectTriggerDisabledClasses}`}
              title={fullScreenModeChecked ? fullScreenDisabledTooltip : undefined}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent className={darkMode ? 'bg-gray-700 border-gray-600 text-gray-200' : 'bg-white border-gray-300'}>
              <SelectItem value="upper">Upper Third</SelectItem>
              <SelectItem value="center">Centre</SelectItem>
              <SelectItem value="lower">Lower Third</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Font Picker */}
      <div className="flex items-center justify-between gap-4">
        <Tooltip content="Select font family for lyric display" side="right">
          <LabelWithIcon icon={Type} text="Font Style" />
        </Tooltip>
        <Select value={settings.fontStyle} onValueChange={(val) => update('fontStyle', val)}>
          <SelectTrigger className={`w-full ${darkMode
            ? 'bg-gray-700 border-gray-600 text-gray-200'
            : 'bg-white border-gray-300'
            }`}>
            <SelectValue placeholder="Select font" />
          </SelectTrigger>
          <SelectContent className={darkMode ? 'bg-gray-700 border-gray-600 text-gray-200' : 'bg-white border-gray-300'}>
            {fontOptions.map((font) => (
              <SelectItem
                key={font}
                value={font}
                style={{ fontFamily: font }}
                className={darkMode ? 'text-gray-200 hover:bg-gray-600' : ''}
              >
                {font}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Bold / Italic / Underline / All Caps */}
      <div className="flex items-center justify-between gap-4">
        <Tooltip content="Apply text styling: bold, italic, underline, or all caps" side="right">
          <LabelWithIcon icon={TextQuote} text="Emphasis" />
        </Tooltip>
        <div className="flex gap-2 flex-wrap">
          <Tooltip content="Make text bold" side="top">
            <Button
              size="icon"
              variant={settings.bold ? 'default' : 'outline'}
              onClick={() => update('bold', !settings.bold)}
              title="Bold"
              className={!settings.bold && darkMode ? 'border-gray-600 text-gray-200 hover:bg-gray-700' : ''}
            >
              <Bold className="w-4 h-4" />
            </Button>
          </Tooltip>
          <Tooltip content="Make text italic" side="top">
            <Button
              size="icon"
              variant={settings.italic ? 'default' : 'outline'}
              onClick={() => update('italic', !settings.italic)}
              title="Italic"
              className={!settings.italic && darkMode ? 'border-gray-600 text-gray-200 hover:bg-gray-700' : ''}
            >
              <Italic className="w-4 h-4" />
            </Button>
          </Tooltip>
          <Tooltip content="Underline text" side="top">
            <Button
              size="icon"
              variant={settings.underline ? 'default' : 'outline'}
              onClick={() => update('underline', !settings.underline)}
              title="Underline"
              className={!settings.underline && darkMode ? 'border-gray-600 text-gray-200 hover:bg-gray-700' : ''}
            >
              <Underline className="w-4 h-4" />
            </Button>
          </Tooltip>
          <Tooltip content="Convert text to uppercase" side="top">
            <Button
              size="icon"
              variant={settings.allCaps ? 'default' : 'outline'}
              onClick={() => update('allCaps', !settings.allCaps)}
              title="All Caps"
              className={!settings.allCaps && darkMode ? 'border-gray-600 text-gray-200 hover:bg-gray-700' : ''}
            >
              <CaseUpper className="w-4 h-4" />
            </Button>
          </Tooltip>
        </div>
      </div>

      {/* Font Size */}
      <div className="flex items-center justify-between gap-4">
        <Tooltip content="Adjust text size in pixels (24-100)" side="right">
          <LabelWithIcon icon={TextCursorInput} text="Font Size" />
        </Tooltip>
        <div className="flex items-center gap-2 justify-end w-full">
          <Tooltip content={fontSizeAdvancedExpanded ? "Hide advanced settings" : "Show advanced settings"} side="top">
            <button
              onClick={() => setFontSizeAdvancedExpanded(!fontSizeAdvancedExpanded)}
              className={`p-1 rounded transition-colors ${darkMode
                ? 'hover:bg-gray-700 text-gray-400'
                : 'hover:bg-gray-100 text-gray-500'
                }`}
              aria-label="Toggle font size advanced settings"
            >
              {fontSizeAdvancedExpanded ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>
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
              variant={settings.maxLinesEnabled ? 'default' : 'outline'}
              onClick={() => update('maxLinesEnabled', !settings.maxLinesEnabled)}
              title="Max Lines"
              className={!settings.maxLinesEnabled && darkMode ? 'border-gray-600 text-gray-200 hover:bg-gray-700' : ''}
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
      <div className="flex items-center justify-between gap-4">
        <Tooltip content="Choose the color of your lyrics text" side="right">
          <LabelWithIcon icon={Paintbrush} text="Font Colour" />
        </Tooltip>
        <div className="flex items-center gap-2 justify-end w-full">
          <Tooltip content={fontColorAdvancedExpanded ? "Hide advanced settings" : "Show advanced settings"} side="top">
            <button
              onClick={() => setFontColorAdvancedExpanded(!fontColorAdvancedExpanded)}
              className={`p-1 rounded transition-colors ${darkMode
                ? 'hover:bg-gray-700 text-gray-400'
                : 'hover:bg-gray-100 text-gray-500'
                }`}
              aria-label="Toggle font color advanced settings"
            >
              {fontColorAdvancedExpanded ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>
          </Tooltip>
          <Input
            type="color"
            value={settings.fontColor}
            onChange={(e) => update('fontColor', e.target.value)}
            className={`h-9 w-12 p-1 ${darkMode
              ? 'bg-gray-700 border-gray-600 text-gray-200'
              : 'bg-white border-gray-300'
              }`}
          />
        </div>
      </div>

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
          <Input
            type="color"
            value={translationLineColor}
            onChange={(e) => update('translationLineColor', e.target.value)}
            className={`h-9 w-12 p-1 ${darkMode
              ? 'bg-gray-700 border-gray-600 text-gray-200'
              : 'bg-white border-gray-300'
              }`}
          />
        </div>
      </div>

      {/* Text Border */}
      <div className="flex items-center justify-between gap-4">
        <Tooltip content="Add an outline around text for better visibility (0-10px)" side="right">
          <LabelWithIcon icon={Frame} text="Text Border" />
        </Tooltip>
        <div className="flex gap-2 items-center">
          <Input
            type="color"
            value={settings.borderColor ?? '#000000'}
            onChange={(e) => update('borderColor', e.target.value)}
            className={`h-9 w-12 p-1 ${darkMode
              ? 'bg-gray-700 border-gray-600 text-gray-200'
              : 'bg-white border-gray-300'
              }`}
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
      <div className="flex items-center justify-between gap-4">
        <Tooltip content="Add shadow behind text for depth (0-10 opacity)" side="right">
          <LabelWithIcon icon={Contrast} text="Drop Shadow" />
        </Tooltip>
        <div className="flex items-center gap-2 justify-end w-full">
          <Tooltip content={dropShadowAdvancedExpanded ? "Hide advanced settings" : "Show advanced settings"} side="top">
            <button
              onClick={() => setDropShadowAdvancedExpanded(!dropShadowAdvancedExpanded)}
              className={`p-1 rounded transition-colors ${darkMode
                ? 'hover:bg-gray-700 text-gray-400'
                : 'hover:bg-gray-100 text-gray-500'
                }`}
              aria-label="Toggle drop shadow advanced settings"
            >
              {dropShadowAdvancedExpanded ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>
          </Tooltip>
          <Input
            type="color"
            value={settings.dropShadowColor}
            onChange={(e) => update('dropShadowColor', e.target.value)}
            className={`h-9 w-12 p-1 ${darkMode
              ? 'bg-gray-700 border-gray-600 text-gray-200'
              : 'bg-white border-gray-300'
              }`}
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
        </div>
      </div>

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
      <div className="flex items-center justify-between gap-4">
        <Tooltip content="Set background band with custom color and opacity behind lyrics" side="right">
          <LabelWithIcon icon={Square} text="Background" />
        </Tooltip>
        <div className="flex items-center gap-2 justify-end w-full">
          <Tooltip content={backgroundAdvancedExpanded ? "Hide advanced settings" : "Show advanced settings"} side="top">
            <button
              onClick={() => setBackgroundAdvancedExpanded(!backgroundAdvancedExpanded)}
              disabled={fullScreenModeChecked}
              className={`p-1 rounded transition-colors ${darkMode
                ? 'hover:bg-gray-700 text-gray-400'
                : 'hover:bg-gray-100 text-gray-500'
                } ${fullScreenModeChecked ? 'opacity-60 cursor-not-allowed' : ''}`}
              aria-label="Toggle background advanced settings"
            >
              {backgroundAdvancedExpanded ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>
          </Tooltip>
          <Input
            type="color"
            value={settings.backgroundColor}
            onChange={(e) => update('backgroundColor', e.target.value)}
            disabled={fullScreenModeChecked}
            className={`h-9 w-12 p-1 ${darkMode
              ? 'bg-gray-700 border-gray-600 text-gray-200'
              : 'bg-white border-gray-300'
              } ${fullScreenModeChecked ? 'opacity-60 cursor-not-allowed' : ''}`}
            title={fullScreenModeChecked ? backgroundDisabledTooltip : undefined}
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
        </div>
      </div>

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
      <div className="flex items-center justify-between gap-4">
        <Tooltip content="Adjust horizontal and vertical positioning offset" side="right">
          <LabelWithIcon icon={Move} text="X & Y Margins" />
        </Tooltip>
        <div className="flex gap-2 items-center">
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
        </div>
      </div>

      {/* Transition Style */}
      <div className="flex items-center justify-between gap-4">
        <Tooltip content="Choose animation style when lyrics change on display" side="right">
          <LabelWithIcon icon={Wand2} text="Transition Style" />
        </Tooltip>
        <div className="flex items-center gap-2 justify-end w-full">
          <Tooltip content={transitionAdvancedExpanded ? "Hide advanced settings" : "Show advanced settings"} side="top">
            <button
              onClick={() => setTransitionAdvancedExpanded(!transitionAdvancedExpanded)}
              className={`p-1 rounded transition-colors ${darkMode
                ? 'hover:bg-gray-700 text-gray-400'
                : 'hover:bg-gray-100 text-gray-500'
                }`}
              aria-label="Toggle transition advanced settings"
            >
              {transitionAdvancedExpanded ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>
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
        </div>
      </div>

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
          <LabelWithIcon icon={ScreenShare} text="Full Screen Mode" />
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
            <Input
              type="color"
              value={fullScreenBackgroundColorValue}
              onChange={handleFullScreenColorChange}
              className={`ml-auto h-9 w-12 p-1 ${darkMode
                ? 'bg-gray-700 border-gray-600 text-gray-200'
                : 'bg-white border-gray-300'
                }`}
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