import React, { useEffect, useLayoutEffect, useRef, useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import { useLyricsState, useOutputState, useStageSettings, useSetlistState, useIndividualOutputState, useKeyboardNavigationPreferences } from '../hooks/useStoreSelectors';
import useSocket from '../hooks/useSocket';
import {
  findNavigableLyricLineIndex,
  getLineOutputText,
  isStructureTagLyricLine,
} from '../utils/parseLyrics';
import { logDebug } from '../utils/logger';
import { ChevronRight } from 'lucide-react';
import { normalizeStageMessages } from '../utils/stageMessages';
import { getTimerDisplay, isTimerVisiblyActive } from '../utils/timerUtils';
import { paintToCss } from '../utils/paint';
import { hasSelectedStageLyricLine, shouldClearStageIdleScreen } from '../context/lyricsStore/stageSlice';
import ProjectionExitHint from '../components/ProjectionExitHint';
import useLyricsStore from '../context/LyricsStore';

const useAutoFitText = (text, options = {}) => {
  const {
    minFontSize = 48,
    maxFontSize = null,
    widthRatio = 0.98,
    heightRatio = 0.95,
    allowWrap = true,
    enabled = true,
    fontKey = '',
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
        // Layout dimensions stay accurate while Framer Motion scales an
        // ancestor. getBoundingClientRect() includes that transient transform
        // and can otherwise make the fitted text too large.
        const measuredWidth = textEl.scrollWidth;
        const measuredHeight = textEl.scrollHeight;
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

    let frameId = null;
    let cancelled = false;
    const scheduleFit = () => {
      if (cancelled) return;
      if (frameId) window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(() => {
        frameId = null;
        if (!cancelled) fit();
      });
    };

    // Fit during the layout pass for a correct first frame, then once more on
    // the next animation frame after surrounding layout has settled.
    fit();
    scheduleFit();

    const resizeObserver = typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(scheduleFit);

    resizeObserver?.observe(containerEl);
    window.addEventListener('resize', scheduleFit);

    const fontSet = document.fonts;
    const handleFontsLoaded = () => scheduleFit();
    fontSet?.ready?.then?.(handleFontsLoaded).catch?.(() => {});
    fontSet?.addEventListener?.('loadingdone', handleFontsLoaded);

    return () => {
      cancelled = true;
      if (frameId) window.cancelAnimationFrame(frameId);
      resizeObserver?.disconnect();
      window.removeEventListener('resize', scheduleFit);
      fontSet?.removeEventListener?.('loadingdone', handleFontsLoaded);
    };
  }, [containerEl, textEl, text, minFontSize, maxFontSize, widthRatio, heightRatio, allowWrap, enabled, fontKey]);

  return { containerRef, textRef };
};

const Stage = () => {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const isPreviewMode = searchParams.get('preview') === 'true';
  const isProjectionMode = ['1', 'true'].includes((searchParams.get('projection') || '').toLowerCase());
  const showProjectionExitHint = ['1', 'true'].includes((searchParams.get('escapeHint') || '').toLowerCase());

  const { isConnected, isAuthenticated, emitOutputMetrics } = useSocket('stage', {
    preview: isPreviewMode,
    purpose: 'stage-display',
  });
  const { lyrics, selectedLine, lyricsFileName } = useLyricsState();
  const { isOutputOn } = useOutputState();
  const { settings: stageSettings } = useStageSettings();
  const { setlistFiles } = useSetlistState();
  const { stageEnabled } = useIndividualOutputState();
  const { skipSectionTitlesOnKeyboard } = useKeyboardNavigationPreferences();

  const publishStageMetrics = useCallback(() => {
    if (isPreviewMode || !isConnected || !isAuthenticated) return;
    emitOutputMetrics('stage', {
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      timestamp: Date.now(),
    });
  }, [emitOutputMetrics, isAuthenticated, isConnected, isPreviewMode]);

  useEffect(() => {
    publishStageMetrics();
    if (isPreviewMode || !isConnected || !isAuthenticated) return undefined;
    const interval = window.setInterval(publishStageMetrics, 5000);
    return () => window.clearInterval(interval);
  }, [isAuthenticated, isConnected, isPreviewMode, publishStageMetrics]);

  const sectionTagPhrases = useLyricsStore(
    (state) => state.lyricsParsingOptions.groupingConfig.sectionTagPhrases,
  );

  const [currentTime, setCurrentTime] = useState(new Date());
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);
  const [customMessages, setCustomMessages] = useState([]);
  const [timerState, setTimerState] = useState({ running: false, paused: false, endTime: null, remaining: null });
  const [upcomingSongUpdateTrigger, setUpcomingSongUpdateTrigger] = useState(0);

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

  const {
    fontStyle = 'Bebas Neue',
    backgroundColor = '#000000',
    backgroundPaint,
    clearEmptyLyricsScreen = false,

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
      return;
    }

    const updateTimerDisplay = () => {
      const now = Date.now();
      setTimerDisplay(getTimerDisplay(timerState, now));
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

  const renderLineContent = (text, lineType = 'live', sourceLineIndex = null) => {

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
                  color: shouldUseTranslationColor ? (translationLineColor || '#FBBF24') : 'inherit',
                  fontSize: isTranslationLine ? '0.8em' : '1em',
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
    if (!skipSectionTitlesOnKeyboard || !isStructureTagLyricLine(lyrics[currentLine], sectionTagPhrases)) return currentLine;

    return findNavigableLyricLineIndex(lyrics, currentLine + 1, 1, { skipSectionTitles: true, sectionTagPhrases })
      ?? findNavigableLyricLineIndex(lyrics, currentLine - 1, -1, { skipSectionTitles: true, sectionTagPhrases });
  })();
  const previousLine = effectiveCurrentLine !== null
    ? findNavigableLyricLineIndex(lyrics, effectiveCurrentLine - 1, -1, { skipSectionTitles: skipSectionTitlesOnKeyboard, sectionTagPhrases })
    : null;
  const nextLine = effectiveCurrentLine !== null
    ? findNavigableLyricLineIndex(lyrics, effectiveCurrentLine + 1, 1, { skipSectionTitles: skipSectionTitlesOnKeyboard, sectionTagPhrases })
    : null;
  const hasSelectedLyricLine = hasSelectedStageLyricLine(effectiveCurrentLine, lyrics.length);
  const isVisible = Boolean((isPreviewMode || (isOutputOn && stageEnabled)) && hasSelectedLyricLine);
  const shouldClearIdleScreen = shouldClearStageIdleScreen(
    clearEmptyLyricsScreen,
    effectiveCurrentLine,
    lyrics.length
  );

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
  const fullScreenTimerLabelFontSize = 'clamp(1.5rem, 3.2vh, 3.5rem)';
  const hasFullScreenStageContent = Boolean(
    upcomingSongFullScreen
    || shouldShowTimerFullScreen
    || (customMessagesFullScreen && currentMessage)
  );

  const { containerRef: upcomingSongFullScreenContainerRef, textRef: upcomingSongFullScreenTextRef } = useAutoFitText(
    upcomingSongName,
    {
      minFontSize: 72,
      widthRatio: 0.985,
      heightRatio: 0.97,
      allowWrap: true,
      enabled: upcomingSongFullScreen,
      fontKey: fontStyle,
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
      fontKey: 'monospace',
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
      fontKey: fontStyle,
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

  const stageTransitionMs = Math.min(1000, Math.max(100, Number(transitionSpeed) || 300));
  const stageTransitionSeconds = stageTransitionMs / 1000;
  const wheelTravelDistance = Math.max(36, responsiveLiveFontSize * 0.45);
  const previousEffectiveLineRef = useRef(effectiveCurrentLine);
  const lineChangeDirection = previousEffectiveLineRef.current === null
    || effectiveCurrentLine === null
    || previousEffectiveLineRef.current === effectiveCurrentLine
    ? 0
    : (effectiveCurrentLine > previousEffectiveLineRef.current ? 1 : -1);

  const stageLyricRows = [
    ...(shouldShowPrevLine ? [{ index: previousLine, role: 'prev' }] : []),
    ...(effectiveCurrentLine !== null ? [{ index: effectiveCurrentLine, role: 'live' }] : []),
    ...(shouldShowNextLine ? [{ index: nextLine, role: 'next' }] : []),
  ];

  const getStageLyricRowConfig = (role) => {
    if (role === 'prev') {
      return {
        align: prevAlign,
        bold: prevBold,
        color: prevColor,
        fontSize: responsivePrevFontSize,
        italic: prevItalic,
        letterSpacing: prevLetterSpacing,
        lineSpacing: prevLineSpacing,
        minHeight: responsivePrevFontSize * 1.5,
        underline: prevUnderline,
        verticalAlign: 'center',
      };
    }

    if (role === 'next') {
      return {
        align: nextAlign,
        bold: nextBold,
        color: nextColor,
        fontSize: responsiveNextFontSize,
        italic: nextItalic,
        letterSpacing: nextLetterSpacing,
        lineSpacing: nextLineSpacing,
        minHeight: responsiveNextFontSize * 1.5,
        underline: nextUnderline,
        verticalAlign: 'flex-start',
      };
    }

    return {
      align: liveAlign,
      bold: liveBold,
      color: liveColor,
      fontSize: responsiveLiveFontSize,
      italic: liveItalic,
      letterSpacing: liveLetterSpacing,
      lineSpacing: liveLineSpacing,
      minHeight: responsiveLiveFontSize * 1.5,
      underline: liveUnderline,
      verticalAlign: 'center',
    };
  };

  useEffect(() => {
    previousEffectiveLineRef.current = effectiveCurrentLine;
  }, [effectiveCurrentLine]);

  return (
    <div
      className="relative w-screen h-screen overflow-hidden flex flex-col"
      style={{
        background: paintToCss(backgroundPaint, backgroundColor),
        fontFamily: fontStyle,
      }}
    >
      <ProjectionExitHint visible={!shouldClearIdleScreen && isProjectionMode && showProjectionExitHint} />
      {/* Top Bar - Song Names */}
      {!shouldClearIdleScreen && !hasFullScreenStageContent && <div className="shrink-0 px-8 sm:px-12 md:px-16 py-6 sm:py-8 flex justify-between items-center">
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
      </div>}

      {/* Main Content */}
      {!shouldClearIdleScreen && <div className="flex-1 relative overflow-hidden">
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
                  color: '#FFA500',
                  textAlign: 'center',
                  opacity: 1,
                }}
              >
                {fullScreenTimerLabel}
              </div>

              {/* Timer Display */}
              <div
                className="leading-none font-bold font-mono w-full"
                style={{
                  color: '#FFFFFF',
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
                className="leading-tight font-bold w-full h-full"
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
          <div className="absolute inset-0 flex flex-col items-center justify-center overflow-hidden px-8 sm:px-12 md:px-16">
            <AnimatePresence
              initial={false}
              mode={transitionAnimation === 'fade' ? 'wait' : 'sync'}
            >
              <motion.div
                key={transitionAnimation === 'slide' ? 'stage-wheel-stack' : `stage-line-${effectiveCurrentLine}`}
                className={`flex w-full flex-col items-stretch ${shouldExpandCurrentLine ? 'h-full' : 'gap-4 sm:gap-6 md:gap-8'}`}
                initial={transitionAnimation === 'fade' ? { opacity: 0 } : false}
                animate={{ opacity: 1 }}
                exit={transitionAnimation === 'fade' ? { opacity: 0 } : undefined}
                transition={{ duration: transitionAnimation === 'fade' ? stageTransitionSeconds : 0, ease: 'easeInOut' }}
              >
                <AnimatePresence initial={false} custom={lineChangeDirection} mode="popLayout">
                  {stageLyricRows.map((row) => {
                    const config = getStageLyricRowConfig(row.role);
                    const wheelEnabled = transitionAnimation === 'slide';
                    const wheelRowVariants = {
                      enter: (direction) => ({
                        color: config.color,
                        filter: direction === 0 ? 'blur(0px)' : 'blur(3px)',
                        fontSize: `${config.fontSize}px`,
                        opacity: direction === 0 ? 1 : 0,
                        y: direction * wheelTravelDistance,
                      }),
                      center: {
                        color: config.color,
                        filter: 'blur(0px)',
                        fontSize: `${config.fontSize}px`,
                        opacity: 1,
                        y: 0,
                      },
                      exit: (direction) => ({
                        filter: direction === 0 ? 'blur(0px)' : 'blur(3px)',
                        opacity: 0,
                        y: direction * -wheelTravelDistance,
                      }),
                    };
                    const rowTransition = wheelEnabled
                      ? {
                        layout: { duration: stageTransitionSeconds, ease: [0.22, 1, 0.36, 1] },
                        y: { duration: stageTransitionSeconds, ease: [0.22, 1, 0.36, 1] },
                        opacity: { duration: stageTransitionSeconds * 0.75, ease: 'easeOut' },
                        filter: { duration: stageTransitionSeconds * 0.75, ease: 'easeOut' },
                        fontSize: { duration: stageTransitionSeconds, ease: [0.22, 1, 0.36, 1] },
                        color: { duration: stageTransitionSeconds, ease: 'easeInOut' },
                      }
                      : { duration: 0 };

                    return (
                      <motion.div
                        key={`stage-lyric-${row.index}`}
                        layout={wheelEnabled ? 'position' : false}
                        variants={wheelEnabled ? wheelRowVariants : undefined}
                        initial={wheelEnabled ? 'enter' : false}
                        animate={wheelEnabled ? 'center' : {
                          color: config.color,
                          fontSize: `${config.fontSize}px`,
                          opacity: 1,
                        }}
                        exit={wheelEnabled ? 'exit' : { opacity: 0 }}
                        transition={rowTransition}
                        className={`w-full ${row.role === 'live' && shouldExpandCurrentLine ? 'flex-1' : 'shrink-0'}`}
                        style={{
                          alignItems: config.verticalAlign,
                          display: 'flex',
                          justifyContent: getJustifyContent(config.align),
                          minHeight: `${config.minHeight}px`,
                        }}
                      >
                        <motion.div
                          layout={wheelEnabled ? 'position' : false}
                          transition={wheelEnabled
                            ? { layout: { duration: stageTransitionSeconds, ease: [0.22, 1, 0.36, 1] } }
                            : { duration: 0 }}
                          className="flex min-w-0 items-start leading-none"
                          style={{
                            fontStyle: config.italic ? 'italic' : 'normal',
                            fontWeight: config.bold ? 'bold' : 'normal',
                            letterSpacing: config.letterSpacing ? `${config.letterSpacing}px` : undefined,
                            lineHeight: config.lineSpacing ?? 1,
                            textAlign: getTextAlign(config.align),
                            textDecoration: config.underline ? 'underline' : 'none',
                          }}
                        >
                          <AnimatePresence initial={false}>
                            {row.role === 'next' && showNextArrow && (
                              <motion.span
                                key="next-line-arrow"
                                layout={wheelEnabled}
                                initial={wheelEnabled ? { opacity: 0, x: -10 } : false}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -10 }}
                                transition={{ duration: Math.min(0.3, stageTransitionSeconds), ease: 'easeOut' }}
                                className="shrink-0"
                                style={{ paddingTop: '0.15em' }}
                              >
                                <ChevronRight
                                  size={config.fontSize * 0.8}
                                  style={{
                                    color: nextArrowColor,
                                    marginRight: '0.5rem',
                                  }}
                                />
                              </motion.span>
                            )}
                          </AnimatePresence>
                          <div className="min-w-0">
                            {renderLineContent(getLineText(row.index), row.role, row.index)}
                          </div>
                        </motion.div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </motion.div>
            </AnimatePresence>
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
      </div>}

      {/* Bottom Bar - Time and Messages */}
      {!shouldClearIdleScreen && !hasFullScreenStageContent && <div
        className="shrink-0 px-8 sm:px-12 md:px-16 py-6 sm:py-8 flex justify-between items-center leading-none"
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
      </div>}
    </div>
  );
};

export default Stage;
