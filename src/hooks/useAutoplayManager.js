import { useRef, useEffect, useState, useCallback } from 'react';
import { getLineDisplayText } from '../utils/parseLyrics';
import { calculateTimestampDelay } from '../utils/timestampHelpers';

export const useAutoplayManager = ({
  lyrics,
  lyricsTimestamps,
  selectedLine,
  autoplaySettings,
  selectLine,
  emitLineUpdate,
  showToast,
  showModal,
  hasLyrics,
  lyricsFileName,
  hasSeenIntelligentAutoplayInfo,
  setHasSeenIntelligentAutoplayInfo,
  emitAutoplayStateUpdate,
  isConnected,
  isAuthenticated,
  ready,
  clientType = 'desktop'
}) => {
  const [autoplayActive, setAutoplayActive] = useState(false);
  const [intelligentAutoplayActive, setIntelligentAutoplayActive] = useState(false);
  const [remoteAutoplayActive, setRemoteAutoplayActive] = useState(false);

  const autoplayIntervalRef = useRef(null);
  const intelligentAutoplayTimeoutRef = useRef(null);

  const lyricsRef = useRef(lyrics);
  const lyricsTimestampsRef = useRef(lyricsTimestamps);
  const selectedLineRef = useRef(selectedLine);
  const autoplaySettingsRef = useRef(autoplaySettings);
  const selectLineRef = useRef(selectLine);
  const emitLineUpdateRef = useRef(emitLineUpdate);
  const showToastRef = useRef(showToast);

  useEffect(() => { lyricsRef.current = lyrics; }, [lyrics]);
  useEffect(() => { lyricsTimestampsRef.current = lyricsTimestamps; }, [lyricsTimestamps]);
  useEffect(() => { selectedLineRef.current = selectedLine; }, [selectedLine]);
  useEffect(() => { autoplaySettingsRef.current = autoplaySettings; }, [autoplaySettings]);
  useEffect(() => { selectLineRef.current = selectLine; }, [selectLine]);
  useEffect(() => { emitLineUpdateRef.current = emitLineUpdate; }, [emitLineUpdate]);
  useEffect(() => { showToastRef.current = showToast; }, [showToast]);

  const isLineBlank = useCallback((line) => {
    if (!line) return true;
    const displayText = getLineDisplayText(line);
    return !displayText || displayText.trim() === '';
  }, []);

  useEffect(() => {
    if (autoplayIntervalRef.current) {
      clearInterval(autoplayIntervalRef.current);
      autoplayIntervalRef.current = null;
    }

    if (!autoplayActive || !hasLyrics) return;

    autoplayIntervalRef.current = setInterval(() => {
      const currentLyrics = lyricsRef.current;
      const currentSelectedLine = selectedLineRef.current;
      const currentSettings = autoplaySettingsRef.current;
      const currentSelectLine = selectLineRef.current;
      const currentEmitLineUpdate = emitLineUpdateRef.current;
      const currentShowToast = showToastRef.current;

      if (!currentLyrics || currentLyrics.length === 0) {
        setAutoplayActive(false);
        return;
      }

      const currentIndex = currentSelectedLine ?? -1;
      let nextIndex = currentIndex + 1;

      if (currentSettings.skipBlankLines) {
        while (nextIndex < currentLyrics.length && isLineBlank(currentLyrics[nextIndex])) {
          nextIndex++;
        }
      }

      if (nextIndex >= currentLyrics.length) {
        if (currentSettings.loop) {
          nextIndex = 0;
          if (currentSettings.skipBlankLines) {
            while (nextIndex < currentLyrics.length && isLineBlank(currentLyrics[nextIndex])) {
              nextIndex++;
            }
          }
          if (nextIndex >= currentLyrics.length) {
            setAutoplayActive(false);
            currentShowToast({
              title: 'Autoplay Stopped',
              message: 'No non-blank lines found.',
              variant: 'info'
            });
            return;
          }
        } else {
          setAutoplayActive(false);
          currentShowToast({
            title: 'Autoplay Complete',
            message: 'Reached the end of lyrics.',
            variant: 'success'
          });
          return;
        }
      }

      currentSelectLine(nextIndex);
      currentEmitLineUpdate(nextIndex);
      window.dispatchEvent(new CustomEvent('scroll-to-lyric-line', {
        detail: { lineIndex: nextIndex }
      }));
    }, autoplaySettings.interval * 1000);

    return () => {
      if (autoplayIntervalRef.current) {
        clearInterval(autoplayIntervalRef.current);
        autoplayIntervalRef.current = null;
      }
    };
  }, [autoplayActive, hasLyrics, autoplaySettings.interval, isLineBlank]);

  useEffect(() => {
    if (intelligentAutoplayTimeoutRef.current) {
      clearTimeout(intelligentAutoplayTimeoutRef.current);
      intelligentAutoplayTimeoutRef.current = null;
    }

    if (!intelligentAutoplayActive || !hasLyrics) return;

    const scheduleNextLine = () => {
      const currentLyrics = lyricsRef.current;
      const currentTimestamps = lyricsTimestampsRef.current;
      const currentSelectedLine = selectedLineRef.current;
      const currentSettings = autoplaySettingsRef.current;
      const currentSelectLine = selectLineRef.current;
      const currentEmitLineUpdate = emitLineUpdateRef.current;
      const currentShowToast = showToastRef.current;

      if (!currentLyrics || currentLyrics.length === 0) {
        setIntelligentAutoplayActive(false);
        return;
      }

      const currentIndex = currentSelectedLine ?? -1;
      let nextIndex = currentIndex + 1;

      if (currentSettings.skipBlankLines) {
        while (nextIndex < currentLyrics.length && isLineBlank(currentLyrics[nextIndex])) {
          nextIndex++;
        }
      }

      if (nextIndex >= currentLyrics.length) {
        setIntelligentAutoplayActive(false);
        currentShowToast({
          title: 'Intelligent Autoplay Complete',
          message: 'Reached the end of lyrics.',
          variant: 'success'
        });
        return;
      }

      const delay = calculateTimestampDelay(currentTimestamps, currentIndex, nextIndex);
      const finalDelay = delay !== null ? delay : (currentSettings.interval * 1000);

      intelligentAutoplayTimeoutRef.current = setTimeout(() => {
        currentSelectLine(nextIndex);
        currentEmitLineUpdate(nextIndex);
        window.dispatchEvent(new CustomEvent('scroll-to-lyric-line', {
          detail: { lineIndex: nextIndex }
        }));
        scheduleNextLine();
      }, finalDelay);
    };

    scheduleNextLine();

    return () => {
      if (intelligentAutoplayTimeoutRef.current) {
        clearTimeout(intelligentAutoplayTimeoutRef.current);
        intelligentAutoplayTimeoutRef.current = null;
      }
    };
  }, [intelligentAutoplayActive, hasLyrics, isLineBlank]);

  useEffect(() => {
    setAutoplayActive(false);
    setIntelligentAutoplayActive(false);
  }, [lyricsFileName]);

  useEffect(() => {
    if (isConnected && isAuthenticated && ready) {
      const isAnyAutoplayActive = autoplayActive || intelligentAutoplayActive;
      emitAutoplayStateUpdate({ isActive: isAnyAutoplayActive, clientType });
    }
  }, [autoplayActive, intelligentAutoplayActive, isConnected, isAuthenticated, ready, clientType, emitAutoplayStateUpdate]);

  useEffect(() => {
    const handleAutoplayStateUpdate = (event) => {
      const { isActive, clientType: remoteClientType } = event.detail;
      if (remoteClientType !== clientType) {
        setRemoteAutoplayActive(isActive);
      }
    };

    window.addEventListener('autoplay-state-update', handleAutoplayStateUpdate);
    return () => window.removeEventListener('autoplay-state-update', handleAutoplayStateUpdate);
  }, [clientType]);

  const startIntelligentAutoplay = useCallback(() => {
    let startIndex = 0;
    if (autoplaySettings.skipBlankLines) {
      while (startIndex < lyrics.length && isLineBlank(lyrics[startIndex])) {
        startIndex++;
      }
    }
    if (startIndex >= lyrics.length) {
      showToast({
        title: 'Cannot Start Intelligent Autoplay',
        message: 'No non-blank lines found.',
        variant: 'warning'
      });
      return;
    }
    selectLine(startIndex);
    emitLineUpdate(startIndex);
    window.dispatchEvent(new CustomEvent('scroll-to-lyric-line', {
      detail: { lineIndex: startIndex }
    }));
    setIntelligentAutoplayActive(true);
    showToast({
      title: 'Intelligent Autoplay Started',
      message: 'Advancing based on lyric timestamps.',
      variant: 'success'
    });
  }, [autoplaySettings, lyrics, isLineBlank, selectLine, emitLineUpdate, showToast]);

  const handleAutoplayToggle = useCallback(() => {
    if (autoplayActive) {
      setAutoplayActive(false);
      showToast({
        title: 'Autoplay Stopped',
        message: 'Automatic lyric progression paused.',
        variant: 'info'
      });
    } else {
      if (autoplaySettings.startFromFirst) {
        let startIndex = 0;
        if (autoplaySettings.skipBlankLines) {
          while (startIndex < lyrics.length && isLineBlank(lyrics[startIndex])) {
            startIndex++;
          }
        }
        if (startIndex >= lyrics.length) {
          showToast({
            title: 'Cannot Start Autoplay',
            message: 'No non-blank lines found.',
            variant: 'warning'
          });
          return;
        }
        selectLine(startIndex);
        emitLineUpdate(startIndex);
        window.dispatchEvent(new CustomEvent('scroll-to-lyric-line', {
          detail: { lineIndex: startIndex }
        }));
      }

      setAutoplayActive(true);
      showToast({
        title: 'Autoplay Started',
        message: `Advancing every ${autoplaySettings.interval} second${autoplaySettings.interval !== 1 ? 's' : ''}.`,
        variant: 'success'
      });
    }
  }, [autoplayActive, autoplaySettings, lyrics, isLineBlank, selectLine, emitLineUpdate, showToast]);

  const handleIntelligentAutoplayToggle = useCallback(() => {
    if (intelligentAutoplayActive) {
      setIntelligentAutoplayActive(false);
      showToast({
        title: 'Intelligent Autoplay Stopped',
        message: 'Timestamp-based progression paused.',
        variant: 'info'
      });
    } else {
      if (!hasSeenIntelligentAutoplayInfo) {
        showModal({
          title: 'Intelligent Autoplay',
          component: 'IntelligentAutoplayInfo',
          variant: 'info',
          size: 'auto',
          dismissible: true,
          setDontShowAgain: (value) => {
            if (value) {
              setHasSeenIntelligentAutoplayInfo(true);
            }
          },
          onStart: startIntelligentAutoplay,
          actions: []
        });
      } else {
        startIntelligentAutoplay();
      }
    }
  }, [intelligentAutoplayActive, hasSeenIntelligentAutoplayInfo, setHasSeenIntelligentAutoplayInfo, showToast, showModal, startIntelligentAutoplay]);

  const handleOpenAutoplaySettings = useCallback(() => {
    showModal({
      title: 'Autoplay Settings',
      headerDescription: 'Configure automatic lyric progression',
      component: 'AutoplaySettings',
      variant: 'info',
      size: 'sm',
      settings: autoplaySettings,
      onSave: (newSettings) => {
        autoplaySettings.setSettings?.(newSettings);
        showToast({
          title: 'Settings Saved',
          message: 'Autoplay settings updated successfully.',
          variant: 'success'
        });
      },
      actions: []
    });
  }, [showModal, autoplaySettings, showToast]);

  return {
    autoplayActive,
    intelligentAutoplayActive,
    remoteAutoplayActive,
    handleAutoplayToggle,
    handleIntelligentAutoplayToggle,
    handleOpenAutoplaySettings,
    isLineBlank
  };
};