import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useLyricsState, useOutputState, useStageSettings, useSetlistState, useIndividualOutputState } from '../hooks/useStoreSelectors';
import useSocket from '../hooks/useSocket';
import { getLineOutputText } from '../utils/parseLyrics';
import { logDebug, logError } from '../utils/logger';
import { ChevronRight } from 'lucide-react';

const pulseAnimation = `
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
`;

if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = pulseAnimation;
  document.head.appendChild(style);
}

const Stage = () => {
  const { socket, isConnected, connectionStatus, isAuthenticated } = useSocket('stage');
  const { lyrics, selectedLine, lyricsFileName, setLyrics, selectLine } = useLyricsState();
  const { isOutputOn, setIsOutputOn } = useOutputState();
  const { settings: stageSettings } = useStageSettings();
  const { setlistFiles } = useSetlistState();
  const { stageEnabled } = useIndividualOutputState();

  const stateRequestTimeoutRef = useRef(null);
  const pendingStateRequestRef = useRef(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);
  const [customMessages, setCustomMessages] = useState([]);
  const [timerState, setTimerState] = useState({ running: false, paused: false, endTime: null, remaining: null });
  const [upcomingSongUpdateTrigger, setUpcomingSongUpdateTrigger] = useState(0);
  const [isTimerWarning, setIsTimerWarning] = React.useState(false);

  const requestCurrentStateWithRetry = useCallback((retryCount = 0) => {
    const maxRetries = 3;

    if (retryCount === 0 && pendingStateRequestRef.current) {
      logDebug('Stage: Skipping state request - pending request in progress');
      return;
    }

    if (!socket || !socket.connected || !isAuthenticated) {
      if (retryCount === 0) {
        pendingStateRequestRef.current = false;
      }
      logDebug('Stage: Cannot request state - socket not connected or authenticated');
      return;
    }

    if (retryCount >= maxRetries) {
      pendingStateRequestRef.current = false;
      logError('Stage: Max retries reached for state request');
      return;
    }

    pendingStateRequestRef.current = true;
    logDebug(`Stage: Requesting current state (attempt ${retryCount + 1})`);
    socket.emit('requestCurrentState');

    if (stateRequestTimeoutRef.current) {
      clearTimeout(stateRequestTimeoutRef.current);
    }

    stateRequestTimeoutRef.current = setTimeout(() => {
      pendingStateRequestRef.current = false;
      logDebug(`Stage: State request timeout (attempt ${retryCount + 1}), retrying...`);
      requestCurrentStateWithRetry(retryCount + 1);
    }, 3000);
  }, [socket, isAuthenticated]);

  useEffect(() => {
    if (!socket) return;

    const handleCurrentState = (state) => {
      logDebug('Stage: Received current state:', state);

      if (stateRequestTimeoutRef.current) {
        clearTimeout(stateRequestTimeoutRef.current);
        stateRequestTimeoutRef.current = null;
      }
      pendingStateRequestRef.current = false;

      if (state.lyrics) setLyrics(state.lyrics);
      if (state.selectedLine !== undefined) selectLine(state.selectedLine);
      if (typeof state.isOutputOn === 'boolean') setIsOutputOn(state.isOutputOn);
    };

    const handleLineUpdate = ({ index }) => {
      logDebug('Stage: Received line update:', index);
      selectLine(index);
    };

    const handleLyricsLoad = (newLyrics) => {
      logDebug('Stage: Received lyrics load:', newLyrics?.length, 'lines');
      setLyrics(newLyrics);
      selectLine(null);
    };

    socket.on('currentState', handleCurrentState);
    socket.on('lineUpdate', handleLineUpdate);
    socket.on('lyricsLoad', handleLyricsLoad);

    if (socket.connected) {
      setTimeout(() => requestCurrentStateWithRetry(0), 100);
    }

    return () => {
      if (stateRequestTimeoutRef.current) {
        clearTimeout(stateRequestTimeoutRef.current);
      }
      pendingStateRequestRef.current = false;
      socket.off('currentState', handleCurrentState);
      socket.off('lineUpdate', handleLineUpdate);
      socket.off('lyricsLoad', handleLyricsLoad);
    };

  }, [socket, requestCurrentStateWithRetry, setLyrics, selectLine, setIsOutputOn]);

  useEffect(() => {
    const handleStageTimerUpdate = (event) => {
      const detail = event.detail;
      logDebug('Stage: Received timer update via custom event:', detail);

      if (detail && detail.type === 'upcomingSongUpdate') {
        logDebug('Stage: Processing upcoming song update:', detail);

        if (detail.customName !== undefined) {
          sessionStorage.setItem('stage_custom_upcoming_song_name', detail.customName);
        }

        setUpcomingSongUpdateTrigger(prev => prev + 1);
      } else {
        setTimerState(detail);
      }
    };

    const handleStageMessagesUpdate = (event) => {
      logDebug('Stage: Received messages update via custom event:', event.detail);
      setCustomMessages(event.detail || []);
    };

    const handleUpcomingSongUpdate = (event) => {
      logDebug('Stage: Received upcoming song update via custom event:', event.detail);

      if (event.detail && event.detail.customName !== undefined) {
        sessionStorage.setItem('stage_custom_upcoming_song_name', event.detail.customName);
      }

      setUpcomingSongUpdateTrigger(prev => prev + 1);
    };

    window.addEventListener('stage-timer-update', handleStageTimerUpdate);
    window.addEventListener('stage-messages-update', handleStageMessagesUpdate);
    window.addEventListener('stage-upcoming-song-update', handleUpcomingSongUpdate);

    return () => {
      window.removeEventListener('stage-timer-update', handleStageTimerUpdate);
      window.removeEventListener('stage-messages-update', handleStageMessagesUpdate);
      window.removeEventListener('stage-upcoming-song-update', handleUpcomingSongUpdate);
    };
  }, []);

  useEffect(() => {
    logDebug(`Stage connection status: ${connectionStatus}`);

    if (connectionStatus === 'connected' && socket) {
      setTimeout(() => requestCurrentStateWithRetry(0), 200);
    }
  }, [connectionStatus, socket, requestCurrentStateWithRetry]);

  const {
    fontStyle = 'Bebas Neue',
    backgroundColor = '#000000',

    liveFontSize = 120,
    liveColor = '#FFFFFF',
    liveBold = true,
    liveItalic = false,
    liveUnderline = false,
    liveAllCaps = false,
    liveAlign = 'left',

    nextFontSize = 72,
    nextColor = '#808080',
    nextBold = false,
    nextItalic = false,
    nextUnderline = false,
    nextAllCaps = false,
    nextAlign = 'left',
    showNextArrow = true,
    nextArrowColor = '#FFA500',

    prevFontSize = 28,
    prevColor = '#404040',
    prevBold = false,
    prevItalic = false,
    prevUnderline = false,
    prevAllCaps = false,
    prevAlign = 'left',

    currentSongColor = '#FFFFFF',
    currentSongSize = 24,
    upcomingSongColor = '#808080',
    upcomingSongSize = 18,

    showTime = true,
    messageScrollSpeed = 3000,
    bottomBarColor = '#FFFFFF',
    bottomBarSize = 20,

    translationLineColor = '#FBBF24',

    maxLinesEnabled = false,
    maxLines = 3,
    minFontSize = 24,

    transitionAnimation = 'slide',
    transitionSpeed = 300,

    upcomingSongMode = 'automatic',
    upcomingSongFullScreen = false,
    timerFullScreen = false,
    customMessagesFullScreen = false,
  } = stageSettings;

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (customMessages.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentMessageIndex((prev) => (prev + 1) % customMessages.length);
    }, messageScrollSpeed);

    return () => clearInterval(interval);
  }, [customMessages, messageScrollSpeed]);

  const [timerDisplay, setTimerDisplay] = useState(null);

  useEffect(() => {
    if (!timerState.running || timerState.paused || !timerState.endTime) {
      setTimerDisplay(timerState.remaining || null);
      setIsTimerWarning(false);
      return;
    }

    const updateTimerDisplay = () => {
      const now = Date.now();
      const remaining = timerState.endTime - now;

      if (remaining <= 0) {
        setTimerDisplay('0:00');
        setIsTimerWarning(false);
        return;
      }

      const minutes = Math.floor(remaining / 60000);
      const seconds = Math.floor((remaining % 60000) / 1000);
      setTimerDisplay(`${minutes}:${seconds.toString().padStart(2, '0')}`);

      setIsTimerWarning(remaining < 30000);
    };

    updateTimerDisplay();
    const interval = setInterval(updateTimerDisplay, 1000);

    return () => clearInterval(interval);
  }, [timerState]);

  const getLineText = (index) => {
    if (index < 0 || index >= lyrics.length) return '';
    return getLineOutputText(lyrics[index]) || '';
  };

  const formatTime = (date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  };

  const renderLineContent = (text, color, fontSize, lineType = 'live') => {

    const getEmphasisStyles = () => {
      const styles = {};

      if (lineType === 'live') {
        if (liveItalic) styles.fontStyle = 'italic';
        if (liveUnderline) styles.textDecoration = 'underline';
      } else if (lineType === 'next') {
        if (nextItalic) styles.fontStyle = 'italic';
        if (nextUnderline) styles.textDecoration = 'underline';
      } else if (lineType === 'prev') {
        if (prevItalic) styles.fontStyle = 'italic';
        if (prevUnderline) styles.textDecoration = 'underline';
      }

      return styles;
    };

    const shouldApplyAllCaps = () => {
      if (lineType === 'live') return liveAllCaps;
      if (lineType === 'next') return nextAllCaps;
      if (lineType === 'prev') return prevAllCaps;
      return false;
    };

    const emphasisStyles = getEmphasisStyles();
    const applyAllCaps = shouldApplyAllCaps();

    if (text.includes('\n')) {
      const lines = text.split('\n');

      const lineIndex = lineType === 'live' ? currentLine :
        lineType === 'next' ? currentLine + 1 :
          currentLine - 1;
      const lineObj = (lineIndex >= 0 && lineIndex < lyrics.length) ? lyrics[lineIndex] : null;
      const isTranslationGroup = lineObj?.type === 'group' && lines.length === 2;

      return (
        <div style={{ lineHeight: 1.05 }}>
          {lines.map((lineText, index) => {
            const isTranslationLine = isTranslationGroup && index > 0;
            const lineDisplayText = isTranslationLine
              ? lineText.replace(/^[\[({<]|[\])}>\s]*$/g, '').trim()
              : lineText;

            const displayText = applyAllCaps ? lineDisplayText.toUpperCase() : lineDisplayText;

            const shouldUseTranslationColor = isTranslationLine && lineType === 'live';

            return (
              <div
                key={index}
                style={{
                  color: shouldUseTranslationColor ? (translationLineColor || '#FBBF24') : color,
                  fontSize: isTranslationLine ? `${fontSize * 0.8}px` : `${fontSize}px`,
                  lineHeight: 1.05,
                  ...(index === 0 ? emphasisStyles : {}),
                }}
              >
                {displayText}
              </div>
            );
          })}
        </div>
      );
    }

    const displayText = applyAllCaps ? text.toUpperCase() : text;
    return displayText;
  };

  const [scaleFactor, setScaleFactor] = useState(1);

  useEffect(() => {
    const updateScale = () => {
      const width = window.innerWidth;
      if (width < 640) {

        setScaleFactor(0.5);
      } else if (width < 1024) {

        setScaleFactor(0.7);
      } else {

        setScaleFactor(1);
      }
    };

    updateScale();
    window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
  }, []);

  const responsiveLiveFontSize = liveFontSize * scaleFactor;
  const responsiveNextFontSize = nextFontSize * scaleFactor;
  const responsivePrevFontSize = prevFontSize * scaleFactor;
  const responsiveCurrentSongSize = currentSongSize * scaleFactor;
  const responsiveUpcomingSongSize = upcomingSongSize * scaleFactor;
  const responsiveBottomBarSize = bottomBarSize * scaleFactor;

  const currentLine = selectedLine !== null && selectedLine !== undefined ? selectedLine : null;
  const isVisible = Boolean(isOutputOn && stageEnabled && currentLine !== null && lyrics.length > 0);

  const getUpcomingSongName = useCallback(() => {

    if (upcomingSongMode === 'custom') {
      const customName = sessionStorage.getItem('stage_custom_upcoming_song_name');
      if (customName && customName.trim()) {
        return customName.trim();
      }
    }

    if (!setlistFiles || setlistFiles.length === 0) {
      return 'Not Available';
    }

    if (!lyricsFileName) {
      return 'Not Available';
    }

    const currentIndex = setlistFiles.findIndex(
      (file) => file.displayName === lyricsFileName || file.originalName === lyricsFileName
    );

    if (currentIndex === -1) {
      return 'Not Available';
    }

    const nextIndex = (currentIndex + 1) % setlistFiles.length;
    const nextSong = setlistFiles[nextIndex];

    return nextSong.displayName || nextSong.originalName || 'Not Available';
  }, [setlistFiles, lyricsFileName, upcomingSongMode, upcomingSongUpdateTrigger]);

  const upcomingSong = `Upcoming Song: ${getUpcomingSongName()}`;
  const currentMessage = customMessages.length > 0 ? customMessages[currentMessageIndex] : null;

  const currentLineText = getLineText(currentLine);
  const isCurrentLineLong = currentLineText.length > 65;
  const shouldShowPrevLine = currentLine > 0 && !isCurrentLineLong;

  const getTextAlign = (align) => {
    if (align === 'left') return 'left';
    if (align === 'right') return 'right';
    return 'center';
  };

  const getJustifyContent = (align) => {
    if (align === 'left') return 'flex-start';
    if (align === 'right') return 'flex-end';
    return 'center';
  };

  const prevLineRef = useRef(currentLine);

  useEffect(() => {
    prevLineRef.current = currentLine;
  }, [currentLine]);

  return (
    <div
      className="relative w-screen h-screen overflow-hidden flex flex-col"
      style={{
        backgroundColor,
        fontFamily: fontStyle,
      }}
    >
      {/* Top Bar - Song Names */}
      <div className="flex-shrink-0 px-8 sm:px-12 md:px-16 py-6 sm:py-8 flex justify-between items-center">
        <div
          className="leading-none"
          style={{
            fontSize: `${responsiveCurrentSongSize}px`,
            color: currentSongColor,
            fontWeight: 'bold',
          }}
        >
          {lyricsFileName || 'No song loaded'}
        </div>
        <div
          className="leading-none"
          style={{
            fontSize: `${responsiveUpcomingSongSize}px`,
            color: upcomingSongColor,
          }}
        >
          {upcomingSong}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 relative overflow-hidden">
        {upcomingSongFullScreen ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center px-8 sm:px-12 md:px-16">
            <div className="w-full flex flex-col items-center justify-center gap-8">
              {/* "Upcoming Song" Label */}
              <div
                className="leading-none font-bold"
                style={{
                  fontSize: `${responsiveUpcomingSongSize * 2.5}px`,
                  color: '#FFA500',
                  textAlign: 'center',
                  opacity: 1,
                }}
              >
                Upcoming Song:
              </div>

              {/* Song Name */}
              <div
                className="leading-none font-bold w-full"
                style={{
                  fontSize: `${responsiveLiveFontSize * 1.5}px`,
                  color: '#FFFFFF',
                  textAlign: 'center',
                  wordBreak: 'break-word',
                  hyphens: 'auto',
                  opacity: 1,
                }}
              >
                {getUpcomingSongName()}
              </div>
            </div>
          </div>
        ) : timerFullScreen && timerDisplay ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center px-8 sm:px-12 md:px-16">
            <div className="w-full flex flex-col items-center justify-center gap-8">
              {/* "Time Left" Label */}
              <div
                className="leading-none font-bold"
                style={{
                  fontSize: `${responsiveUpcomingSongSize * 2.5}px`,
                  color: isTimerWarning ? '#EF4444' : '#FFA500',
                  textAlign: 'center',
                  opacity: 1,
                  animation: isTimerWarning ? 'pulse 1s infinite' : 'none',
                }}
              >
                Time Left:
              </div>

              {/* Timer Display */}
              <div
                className="leading-none font-bold font-mono w-full"
                style={{
                  fontSize: `${responsiveLiveFontSize * 2}px`,
                  color: isTimerWarning ? '#EF4444' : '#FFFFFF',
                  textAlign: 'center',
                  opacity: 1,
                  animation: isTimerWarning ? 'pulse 1s infinite' : 'none',
                }}
              >
                {timerDisplay}
              </div>
            </div>
          </div>
        ) : customMessagesFullScreen && currentMessage ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center px-8 sm:px-12 md:px-16">
            <motion.div
              key={`fullscreen-message-${currentMessageIndex}`}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.5 }}
              className="w-full"
            >
              <div
                className="leading-tight font-bold w-full"
                style={{
                  fontSize: `${responsiveLiveFontSize * 1.2}px`,
                  color: '#FFFFFF',
                  textAlign: 'center',
                  wordBreak: 'break-word',
                  hyphens: 'auto',
                  opacity: 1,
                }}
              >
                {currentMessage.text || currentMessage}
              </div>
            </motion.div>
          </div>
        ) : isVisible ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center px-8 sm:px-12 md:px-16">
            <motion.div
              key={currentLine}
              className="w-full flex flex-col items-stretch gap-4 sm:gap-6 md:gap-8"
              initial={
                transitionAnimation === 'slide'
                  ? { y: prevLineRef.current !== null && prevLineRef.current < currentLine ? 100 : -100 }
                  : transitionAnimation === 'fade'
                    ? { opacity: 0 }
                    : {}
              }
              animate={
                transitionAnimation === 'slide'
                  ? { y: 0 }
                  : transitionAnimation === 'fade'
                    ? { opacity: 1 }
                    : {}
              }
              exit={
                transitionAnimation === 'slide'
                  ? { y: prevLineRef.current !== null && prevLineRef.current < currentLine ? -100 : 100 }
                  : transitionAnimation === 'fade'
                    ? { opacity: 0 }
                    : {}
              }
              transition={
                transitionAnimation === 'slide'
                  ? {
                    type: 'spring',
                    stiffness: 200,
                    damping: 25,
                    mass: 0.8,
                  }
                  : transitionAnimation === 'fade'
                    ? {
                      duration: (transitionSpeed || 300) / 1000,
                      ease: 'easeInOut',
                    }
                    : {
                      duration: 0,
                    }
              }
            >
              {/* Previous Line */}
              <div
                className="w-full flex-shrink-0"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: getJustifyContent(prevAlign),
                  minHeight: `${responsivePrevFontSize * 1.5}px`,
                  opacity: shouldShowPrevLine ? 1 : 0,
                }}
              >
                {shouldShowPrevLine && (
                  <motion.div
                    className="leading-none"
                    initial={false}
                    animate={{
                      fontSize: `${responsivePrevFontSize}px`,
                      color: prevColor,
                      opacity: 1,
                    }}
                    transition={{
                      fontSize: {
                        type: 'spring',
                        stiffness: 250,
                        damping: 25,
                      },
                      color: {
                        duration: transitionSpeed / 1000,
                        ease: 'easeInOut',
                      },
                      opacity: {
                        duration: 0.2,
                        ease: 'easeInOut',
                      },
                    }}
                    style={{
                      fontWeight: prevBold ? 'bold' : 'normal',
                      textAlign: getTextAlign(prevAlign),
                    }}
                  >
                    {renderLineContent(getLineText(currentLine - 1), prevColor, responsivePrevFontSize, 'prev')}
                  </motion.div>
                )}
              </div>

              {/* Current/Live Line */}
              <div
                className="w-full flex-shrink-0"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: getJustifyContent(liveAlign),
                  minHeight: `${responsiveLiveFontSize * 1.5}px`,
                }}
              >
                <motion.div
                  className="leading-none"
                  initial={{ scale: 0.95 }}
                  animate={{ scale: 1 }}
                  transition={{
                    type: 'spring',
                    stiffness: 300,
                    damping: 25,
                  }}
                  style={{
                    fontSize: `${responsiveLiveFontSize}px`,
                    color: liveColor,
                    fontWeight: liveBold ? 'bold' : 'normal',
                    textAlign: getTextAlign(liveAlign),
                  }}
                >
                  {renderLineContent(getLineText(currentLine), liveColor, responsiveLiveFontSize, 'live')}
                </motion.div>
              </div>

              {/* Next Line */}
              <div
                className="w-full flex-shrink-0"
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: getJustifyContent(nextAlign),
                  minHeight: `${responsiveNextFontSize * 1.5}px`,
                  opacity: currentLine < lyrics.length - 1 ? 1 : 0,
                }}
              >
                {currentLine < lyrics.length - 1 && (
                  <>
                    {showNextArrow && (
                      <motion.div
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{
                          delay: 0.1,
                          duration: 0.3,
                          ease: 'easeOut',
                        }}
                        style={{
                          paddingTop: '0.15em',
                        }}
                      >
                        <ChevronRight
                          size={responsiveNextFontSize * 0.8}
                          style={{
                            color: nextArrowColor,
                            flexShrink: 0,
                            marginRight: '0.5rem',
                          }}
                        />
                      </motion.div>
                    )}
                    <motion.div
                      className="leading-none"
                      initial={false}
                      animate={{
                        fontSize: `${responsiveNextFontSize}px`,
                        color: nextColor,
                      }}
                      transition={{
                        fontSize: {
                          type: 'spring',
                          stiffness: 250,
                          damping: 25,
                        },
                        color: {
                          duration: transitionSpeed / 1000,
                          ease: 'easeInOut',
                        },
                      }}
                      style={{
                        fontWeight: nextBold ? 'bold' : 'normal',
                        textAlign: getTextAlign(nextAlign),
                      }}
                    >
                      {renderLineContent(getLineText(currentLine + 1), nextColor, responsiveNextFontSize, 'next')}
                    </motion.div>
                  </>
                )}
              </div>
            </motion.div>
          </div>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center px-8">
            <div
              className="text-center opacity-30 leading-none"
              style={{
                fontSize: `${responsiveLiveFontSize}px`,
                color: liveColor,
              }}
            >
              Waiting for lyrics...
            </div>
          </div>
        )}
      </div>

      {/* Bottom Bar - Time and Messages */}
      <div
        className="flex-shrink-0 px-8 sm:px-12 md:px-16 py-6 sm:py-8 flex justify-between items-center leading-none"
        style={{
          fontSize: `${responsiveBottomBarSize}px`,
          color: bottomBarColor,
        }}
      >
        {/* Left: Time and Timer */}
        <div className="flex items-center gap-4 leading-none">
          {showTime && (
            <div className="font-mono leading-none">{formatTime(currentTime)}</div>
          )}
          {timerDisplay && (
            <>
              <div className="opacity-50 leading-none">|</div>
              <div className={`font-mono leading-none ${timerState.running && !timerState.paused ? 'text-green-400' : ''}`}>
                Time Left: {timerDisplay}
              </div>
            </>
          )}
        </div>

        {/* Right: Custom Messages */}
        <div className="flex-1 flex justify-end overflow-hidden">
          {currentMessage && (
            <motion.div
              key={`message-${currentMessageIndex}`}
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -20, opacity: 0 }}
              transition={{ duration: 0.5 }}
              className="text-right leading-none"
            >
              {currentMessage.text || currentMessage}
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Stage;