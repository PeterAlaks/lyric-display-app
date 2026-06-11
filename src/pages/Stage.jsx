import React, { useEffect, useLayoutEffect, useRef, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import { useLyricsState, useOutputState, useStageSettings, useSetlistState, useIndividualOutputState, useKeyboardNavigationPreferences } from '../hooks/useStoreSelectors';
import useSocket from '../hooks/useSocket';
import { getLineOutputText } from '../utils/parseLyrics';
import { findNavigableLyricLineIndex, isStructureTagLyricLine } from '../utils/lyricLineNavigation';
import { logDebug } from '../utils/logger';
import { ChevronRight } from 'lucide-react';
import { normalizeStageMessages } from '../utils/stageMessages';
import { getTimerDisplay, getTimerIntensity, isTimerVisiblyActive } from '../utils/timerUtils';
import { paintToCss } from '../utils/paint';
import ProjectionExitHint from '../components/ProjectionExitHint';

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

const useAutoFitText = (text, options = {}) => {
  const {
    minFontSize = 48,
    maxFontSize = null,
    widthRatio = 0.98,
    heightRatio = 0.95,
    allowWrap = true,
    enabled = true,
  } = options;

  const [containerEl, setContainerEl] = useState(null);
  const [textEl, setTextEl] = useState(null);
  const containerRef = useCallback((node) => {
    setContainerEl(node);
  }, []);
  const textRef = useCallback((node) => {
    setTextEl(node);
  }, []);

  useLayoutEffect(() => {
    if (!enabled || !containerEl || !textEl) return undefined;

    const fit = () => {
      const availableWidth = containerEl.clientWidth * widthRatio;
      const availableHeight = containerEl.clientHeight * heightRatio;
      if (availableWidth <= 0 || availableHeight <= 0) return;

      textEl.style.display = 'inline-block';
      textEl.style.width = 'auto';
      textEl.style.maxWidth = allowWrap ? `${availableWidth}px` : 'none';
      textEl.style.whiteSpace = allowWrap ? 'normal' : 'nowrap';
      textEl.style.wordBreak = allowWrap ? 'break-word' : 'normal';
      const fitsAt = (fontSize) => {
        textEl.style.fontSize = `${fontSize}px`;
        const measured = textEl.getBoundingClientRect();
        const measuredWidth = allowWrap ? measured.width : textEl.scrollWidth;
        const measuredHeight = measured.height;
        const widthFits = measuredWidth <= availableWidth + 1;
        const heightFits = measuredHeight <= availableHeight + 1;
        return heightFits && widthFits;
      };

      let best = minFontSize;
      if (!fitsAt(minFontSize)) {
        textEl.style.fontSize = `${minFontSize}px`;
        return;
      }

      let high = Number.isFinite(maxFontSize) && maxFontSize > minFontSize
        ? Math.floor(maxFontSize)
        : minFontSize;

      if (!(Number.isFinite(maxFontSize) && maxFontSize > minFontSize)) {
        // Grow until it no longer fits to avoid a fixed upper cap.
        while (fitsAt(high) && high < 32768) {
          best = high;
          high *= 2;
        }
      }

      let low = best;
      while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        if (fitsAt(mid)) {
          best = mid;
          low = mid + 1;
        } else {
          high = mid - 1;
        }
      }

      textEl.style.fontSize = `${best}px`;
    };

    let delayedFitId = null;
    const frameId = window.requestAnimationFrame(() => {
      fit();
      // Re-fit shortly after mount to handle late layout/font metric updates.
      delayedFitId = window.setTimeout(fit, 32);
    });
    const resizeObserver = new ResizeObserver(() => {
      fit();
    });

    resizeObserver.observe(containerEl);
    resizeObserver.observe(textEl);
    window.addEventListener('resize', fit);

    return () => {
      window.cancelAnimationFrame(frameId);
      if (delayedFitId) window.clearTimeout(delayedFitId);
      resizeObserver.disconnect();
      window.removeEventListener('resize', fit);
    };
  }, [containerEl, textEl, text, minFontSize, maxFontSize, widthRatio, heightRatio, allowWrap, enabled]);

  return { containerRef, textRef };
};

const Stage = () => {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const isPreviewMode = searchParams.get('preview') === 'true';
  const isProjectionMode = ['1', 'true'].includes((searchParams.get('projection') || '').toLowerCase());
  const showProjectionExitHint = ['1', 'true'].includes((searchParams.get('escapeHint') || '').toLowerCase());

  useSocket('stage');
  const { lyrics, selectedLine, lyricsFileName } = useLyricsState();
  const { isOutputOn } = useOutputState();
  const { settings: stageSettings } = useStageSettings();
  const { setlistFiles } = useSetlistState();
  const { stageEnabled } = useIndividualOutputState();
  const { skipSectionTitlesOnKeyboard } = useKeyboardNavigationPreferences();

  const [currentTime, setCurrentTime] = useState(new Date());
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);
  const [customMessages, setCustomMessages] = useState([]);
  const [timerState, setTimerState] = useState({ running: false, paused: false, endTime: null, remaining: null });
  const [upcomingSongUpdateTrigger, setUpcomingSongUpdateTrigger] = useState(0);
  const [isTimerWarning, setIsTimerWarning] = React.useState(false);

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
      setCustomMessages(normalizeStageMessages(event.detail));
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
    if (!isProjectionMode) return undefined;

    const modeStyle = 'background: #000000 !important';
    const html = document.documentElement;
    const body = document.body;
    const root = document.getElementById('root');

    if (html) html.setAttribute('style', modeStyle);
    if (body) body.setAttribute('style', modeStyle);
    if (root) root.setAttribute('style', modeStyle);

    return () => {
      if (html) html.removeAttribute('style');
      if (body) body.removeAttribute('style');
      if (root) root.removeAttribute('style');
    };
  }, [isProjectionMode]);

  const {
    fontStyle = 'Bebas Neue',
    backgroundColor = '#000000',
    backgroundPaint,

    liveFontSize = 120,
    liveColor = '#FFFFFF',
    liveBold = true,
    liveItalic = false,
    liveUnderline = false,
    liveAllCaps = false,
    liveAlign = 'left',
    liveLetterSpacing = 0,
    liveLineSpacing = 1,

    nextFontSize = 72,
    nextColor = '#808080',
    nextBold = false,
    nextItalic = false,
    nextUnderline = false,
    nextAllCaps = false,
    nextAlign = 'left',
    nextLetterSpacing = 0,
    nextLineSpacing = 1,
    showNextLine = true,
    showNextArrow = true,
    nextArrowColor = '#FFA500',

    prevFontSize = 28,
    prevColor = '#404040',
    prevBold = false,
    prevItalic = false,
    prevUnderline = false,
    prevAllCaps = false,
    prevAlign = 'left',
    prevLetterSpacing = 0,
    prevLineSpacing = 1,
    showPrevLine = true,

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
    setCurrentMessageIndex((prev) => {
      if (customMessages.length === 0) return 0;
      if (prev < customMessages.length) return prev;
      return prev % customMessages.length;
    });
  }, [customMessages]);

  useEffect(() => {
    if (customMessages.length <= 1) return;

    const intervalMs = Number.isFinite(Number(messageScrollSpeed))
      ? Math.min(10000, Math.max(1000, Number(messageScrollSpeed)))
      : 3000;

    const interval = setInterval(() => {
      setCurrentMessageIndex((prev) => (prev + 1) % customMessages.length);
    }, intervalMs);

    return () => clearInterval(interval);
  }, [customMessages, messageScrollSpeed]);

  const [timerDisplay, setTimerDisplay] = useState(null);

  useEffect(() => {
    if (!timerState.running && !timerState.paused && !timerState.finished) {
      setTimerDisplay(timerState.remaining || null);
      setIsTimerWarning(false);
      return;
    }

    const updateTimerDisplay = () => {
      const now = Date.now();
      setTimerDisplay(getTimerDisplay(timerState, now));
      setIsTimerWarning(['warning', 'critical'].includes(getTimerIntensity(timerState, now)));
    };

    updateTimerDisplay();
    const interval = setInterval(updateTimerDisplay, 1000);

    return () => clearInterval(interval);
  }, [timerState]);

  const getLineText = (index) => {
    if (index < 0 || index >= lyrics.length) return '';
    return getLineOutputText(lyrics[index], 'stage') || '';
  };

  const formatTime = (date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  };

  const renderLineContent = (text, color, fontSize, lineType = 'live', sourceLineIndex = null) => {

    const getEmphasisStyles = () => {
      const styles = {};

      const boldValue = lineType === 'live'
        ? liveBold
        : lineType === 'next'
          ? nextBold
          : prevBold;
      styles.fontWeight = boldValue ? 'bold' : 'normal';

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

      const lineIndex = sourceLineIndex !== null ? sourceLineIndex : lineType === 'live' ? effectiveCurrentLine :
        lineType === 'next' ? currentLine + 1 :
          currentLine - 1;
      const lineObj = (lineIndex >= 0 && lineIndex < lyrics.length) ? lyrics[lineIndex] : null;
      const isTranslationGroup = lineObj?.type === 'group' && lines.length === 2;

      const currentLineSpacing = lineType === 'live'
        ? liveLineSpacing
        : lineType === 'next'
          ? nextLineSpacing
          : prevLineSpacing;

      return (
        <div style={{ lineHeight: currentLineSpacing ?? 1 }}>
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
                  lineHeight: currentLineSpacing ?? 1,
                  ...(index === 0 ? emphasisStyles : { fontWeight: emphasisStyles.fontWeight }),
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
  const effectiveCurrentLine = (() => {
    if (currentLine === null || currentLine === undefined) return null;
    if (!skipSectionTitlesOnKeyboard || !isStructureTagLyricLine(lyrics[currentLine])) return currentLine;

    return findNavigableLyricLineIndex(lyrics, currentLine + 1, 1, { skipSectionTitles: true })
      ?? findNavigableLyricLineIndex(lyrics, currentLine - 1, -1, { skipSectionTitles: true });
  })();
  const previousLine = effectiveCurrentLine !== null
    ? findNavigableLyricLineIndex(lyrics, effectiveCurrentLine - 1, -1, { skipSectionTitles: skipSectionTitlesOnKeyboard })
    : null;
  const nextLine = effectiveCurrentLine !== null
    ? findNavigableLyricLineIndex(lyrics, effectiveCurrentLine + 1, 1, { skipSectionTitles: skipSectionTitlesOnKeyboard })
    : null;
  const isVisible = Boolean((isPreviewMode || (isOutputOn && stageEnabled)) && effectiveCurrentLine !== null && lyrics.length > 0);

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

  const upcomingSongName = getUpcomingSongName();
  const upcomingSong = `Upcoming Song: ${upcomingSongName}`;
  const currentMessage = customMessages.length > 0 ? customMessages[currentMessageIndex] : null;
  const currentMessageText = currentMessage?.text || currentMessage || '';
  const hasTimerCountdown = Boolean(timerDisplay) && isTimerVisiblyActive(timerState, currentTime.getTime());
  const shouldShowTimerFallbackTime = !hasTimerCountdown && Boolean(showTime);
  const shouldShowTimerFullScreen = Boolean(timerFullScreen) && (hasTimerCountdown || shouldShowTimerFallbackTime);
  const fullScreenTimerLabel = hasTimerCountdown ? (timerState.label || timerState.display?.label || 'Time Left:') : 'Current Time';
  const fullScreenTimerValue = hasTimerCountdown ? timerDisplay : formatTime(currentTime);
  const fullScreenTimerAlert = hasTimerCountdown && isTimerWarning;
  const fullScreenTimerLabelFontSize = 'clamp(1.5rem, 3.2vh, 3.5rem)';

  const { containerRef: upcomingSongFullScreenContainerRef, textRef: upcomingSongFullScreenTextRef } = useAutoFitText(
    upcomingSongName,
    {
      minFontSize: 72,
      widthRatio: 0.985,
      heightRatio: 0.97,
      allowWrap: true,
      enabled: upcomingSongFullScreen,
    }
  );

  const { containerRef: timerFullScreenContainerRef, textRef: timerFullScreenTextRef } = useAutoFitText(
    fullScreenTimerValue,
    {
      minFontSize: 140,
      widthRatio: 0.985,
      heightRatio: 0.992,
      allowWrap: false,
      enabled: shouldShowTimerFullScreen,
    }
  );

  const { containerRef: messageFullScreenContainerRef, textRef: messageFullScreenTextRef } = useAutoFitText(
    currentMessageText,
    {
      minFontSize: 64,
      widthRatio: 0.985,
      heightRatio: 0.97,
      allowWrap: true,
      enabled: customMessagesFullScreen && Boolean(currentMessageText),
    }
  );

  const currentLineText = getLineText(effectiveCurrentLine);
  const isCurrentLineLong = currentLineText.length > 65;
  const nextLineEnabled = showNextLine ?? true;
  const prevLineEnabled = showPrevLine ?? true;
  const shouldShowPrevLine = prevLineEnabled && previousLine !== null && !isCurrentLineLong;
  const shouldShowNextLine = nextLineEnabled && nextLine !== null;
  const shouldExpandCurrentLine = !nextLineEnabled || !prevLineEnabled;

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
    prevLineRef.current = effectiveCurrentLine;
  }, [effectiveCurrentLine]);

  return (
    <div
      className="relative w-screen h-screen overflow-hidden flex flex-col"
      style={{
        background: isProjectionMode ? '#000000' : paintToCss(backgroundPaint, backgroundColor),
        fontFamily: fontStyle,
      }}
    >
      <ProjectionExitHint visible={isProjectionMode && showProjectionExitHint} />
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
          <div className="absolute inset-0 flex flex-col items-center justify-center px-6 sm:px-10 md:px-16 lg:px-24">
            <div className="w-full h-full relative">
              {/* "Upcoming Song" Label */}
              <div
                className="leading-none font-bold absolute top-4 sm:top-6 md:top-8 left-1/2 -translate-x-1/2"
                style={{
                  fontSize: fullScreenTimerLabelFontSize,
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
                  color: '#FFFFFF',
                  textAlign: 'center',
                }}
              >
                <div
                  ref={upcomingSongFullScreenContainerRef}
                  className="absolute inset-x-0 top-0 bottom-0 pt-14 sm:pt-20 md:pt-24 lg:pt-28 flex items-center justify-center overflow-hidden"
                >
                  <div
                    ref={upcomingSongFullScreenTextRef}
                    className="font-bold max-w-full leading-[0.95]"
                    style={{
                      textAlign: 'center',
                      wordBreak: 'break-word',
                      hyphens: 'auto',
                      opacity: 1,
                    }}
                  >
                    {upcomingSongName}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : shouldShowTimerFullScreen ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center px-6 sm:px-10 md:px-16 lg:px-24">
            <div className="w-full h-full relative">
              {/* "Time Left" Label */}
              <div
                className="leading-none font-bold absolute top-4 sm:top-6 md:top-8 left-1/2 -translate-x-1/2"
                style={{
                  fontSize: fullScreenTimerLabelFontSize,
                  color: fullScreenTimerAlert ? '#EF4444' : '#FFA500',
                  textAlign: 'center',
                  opacity: 1,
                  animation: fullScreenTimerAlert ? 'pulse 1s infinite' : 'none',
                }}
              >
                {fullScreenTimerLabel}
              </div>

              {/* Timer Display */}
              <div
                className="leading-none font-bold font-mono w-full"
                style={{
                  color: fullScreenTimerAlert ? '#EF4444' : '#FFFFFF',
                  textAlign: 'center',
                }}
              >
                  <div
                    ref={timerFullScreenContainerRef}
                    className="absolute inset-x-0 top-0 bottom-0 pt-14 sm:pt-20 md:pt-24 lg:pt-28 px-2 sm:px-3 md:px-4 flex items-center justify-center overflow-hidden"
                  >
                    <div
                      ref={timerFullScreenTextRef}
                      className="font-bold font-mono leading-[0.82] whitespace-nowrap"
                      style={{
                        textAlign: 'center',
                        paddingInline: '0.04em',
                        opacity: 1,
                        animation: fullScreenTimerAlert ? 'pulse 1s infinite' : 'none',
                      }}
                  >
                    {fullScreenTimerValue}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : customMessagesFullScreen && currentMessage ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center px-6 sm:px-10 md:px-16 lg:px-24">
            <motion.div
              key={`fullscreen-message-${currentMessageIndex}`}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.5 }}
              className="w-full h-full flex items-center justify-center"
            >
              <div
                className="leading-tight font-bold w-full"
                style={{
                  color: '#FFFFFF',
                  textAlign: 'center',
                }}
              >
                <div
                  ref={messageFullScreenContainerRef}
                  className="w-full h-full flex items-center justify-center overflow-hidden"
                >
                  <div
                    ref={messageFullScreenTextRef}
                    className="font-bold max-w-full leading-[0.95]"
                    style={{
                      textAlign: 'center',
                      wordBreak: 'break-word',
                      hyphens: 'auto',
                      opacity: 1,
                    }}
                  >
                    {currentMessageText}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        ) : isVisible ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center px-8 sm:px-12 md:px-16">
            <motion.div
              key={effectiveCurrentLine}
              className={`w-full flex flex-col items-stretch ${shouldExpandCurrentLine ? 'h-full' : 'gap-4 sm:gap-6 md:gap-8'}`}
              initial={
                transitionAnimation === 'slide'
                  ? { y: prevLineRef.current !== null && prevLineRef.current < effectiveCurrentLine ? 100 : -100 }
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
                  ? { y: prevLineRef.current !== null && prevLineRef.current < effectiveCurrentLine ? -100 : 100 }
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
              {prevLineEnabled && (
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
                        letterSpacing: prevLetterSpacing ? `${prevLetterSpacing}px` : undefined,
                        lineHeight: prevLineSpacing ?? 1,
                      }}
                    >
                      {renderLineContent(getLineText(previousLine), prevColor, responsivePrevFontSize, 'prev', previousLine)}
                    </motion.div>
                  )}
                </div>
              )}

              {/* Current/Live Line */}
              <div
                className={`w-full ${shouldExpandCurrentLine ? 'flex-1' : 'flex-shrink-0'}`}
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
                    letterSpacing: liveLetterSpacing ? `${liveLetterSpacing}px` : undefined,
                    lineHeight: liveLineSpacing ?? 1,
                  }}
                >
                  {renderLineContent(getLineText(effectiveCurrentLine), liveColor, responsiveLiveFontSize, 'live', effectiveCurrentLine)}
                </motion.div>
              </div>

              {nextLineEnabled && (
                <div
                  className="w-full flex-shrink-0"
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: getJustifyContent(nextAlign),
                    minHeight: `${responsiveNextFontSize * 1.5}px`,
                    opacity: shouldShowNextLine ? 1 : 0,
                  }}
                >
                  {shouldShowNextLine && (
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
                          letterSpacing: nextLetterSpacing ? `${nextLetterSpacing}px` : undefined,
                          lineHeight: nextLineSpacing ?? 1,
                        }}
                      >
                        {renderLineContent(getLineText(nextLine), nextColor, responsiveNextFontSize, 'next', nextLine)}
                      </motion.div>
                    </>
                  )}
                </div>
              )}
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
