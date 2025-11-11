import React, { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { RefreshCw, FolderOpen, FileText, Edit, ListMusic, Globe, Plus, Info, FileMusic, Play, ChevronDown, Square } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useLyricsState, useOutputState, useOutput1Settings, useOutput2Settings, useStageSettings, useDarkModeState, useSetlistState, useIsDesktopApp, useAutoplaySettings } from '../hooks/useStoreSelectors';
import { useControlSocket } from '../context/ControlSocketProvider';
import useFileUpload from '../hooks/useFileUpload';
import AuthStatusIndicator from './AuthStatusIndicator';
import ConnectionBackoffBanner from './ConnectionBackoffBanner';
import LyricsList from './LyricsList';
import MobileLayout from './MobileLayout';
import SetlistModal from './SetlistModal';
import OnlineLyricsSearchModal from './OnlineLyricsSearchModal';
import EasyWorshipImportModal from './EasyWorshipImportModal';
import DraftApprovalModal from './DraftApprovalModal';
import OutputSettingsPanel from './OutputSettingsPanel';
import { Switch } from "@/components/ui/switch";
import useDarkModeSync from '../hooks/useDarkModeSync';
import useMenuShortcuts from '../hooks/useMenuShortcuts';
import useSearch from '../hooks/useSearch';
import useOutputSettings from '../hooks/useOutputSettings';
import useSetlistActions from '../hooks/useSetlistActions';
import SearchBar from './SearchBar';
import useToast from '../hooks/useToast';
import useModal from '../hooks/useModal';
import { Tooltip } from '@/components/ui/tooltip';
import { parseLyricsFileAsync } from '../utils/asyncLyricsParser';
import { useSyncTimer } from '../hooks/useSyncTimer';
import { detectArtistFromFilename } from '../utils/artistDetection';
import { getLineDisplayText } from '../utils/parseLyrics';

const LyricDisplayApp = () => {
  const navigate = useNavigate();

  // Global state management
  const { isOutputOn, setIsOutputOn } = useOutputState();
  const { lyrics, lyricsFileName, rawLyricsContent, selectedLine, selectLine, setLyrics, setRawLyricsContent, setLyricsFileName, setSongMetadata } = useLyricsState();
  const { settings: output1Settings, updateSettings: updateOutput1Settings } = useOutput1Settings();
  const { settings: output2Settings, updateSettings: updateOutput2Settings } = useOutput2Settings();
  const { settings: stageSettings, updateSettings: updateStageSettings } = useStageSettings();
  const { darkMode, setDarkMode } = useDarkModeState();
  const { setlistModalOpen, setSetlistModalOpen, setlistFiles, isSetlistFull } = useSetlistState();
  const isDesktopApp = useIsDesktopApp();
  const { settings: autoplaySettings, setSettings: setAutoplaySettings } = useAutoplaySettings();

  useDarkModeSync(darkMode, setDarkMode);

  const fileInputRef = useRef(null);
  const scrollableSettingsRef = useRef(null);
  useMenuShortcuts(navigate, fileInputRef);

  const { socket, emitOutputToggle, emitLineUpdate, emitLyricsLoad, emitStyleUpdate, emitRequestSetlist, emitSetlistAdd, emitAutoplayStateUpdate, connectionStatus, authStatus, forceReconnect, refreshAuthToken, isConnected, isAuthenticated, ready, lastSyncTime } = useControlSocket();

  const secondsAgo = useSyncTimer(lastSyncTime);

  const handleFileUpload = useFileUpload();

  const { activeTab, setActiveTab, getCurrentSettings, updateSettings } = useOutputSettings({
    output1Settings,
    output2Settings,
    stageSettings,
    updateOutputSettings: (output, settings) => {
      if (output === 'output1') {
        updateOutput1Settings(settings);
      } else if (output === 'output2') {
        updateOutput2Settings(settings);
      } else if (output === 'stage') {
        updateStageSettings(settings);
      }
      emitStyleUpdate(output, settings);
    },
    emitStyleUpdate,
  });

  const [hasInteractedWithTabs, setHasInteractedWithTabs] = React.useState(false);

  const [onlineLyricsModalOpen, setOnlineLyricsModalOpen] = React.useState(false);

  const [easyWorshipModalOpen, setEasyWorshipModalOpen] = React.useState(false);
  const [autoplayActive, setAutoplayActive] = React.useState(false);
  const [remoteAutoplayActive, setRemoteAutoplayActive] = React.useState(false);
  const [availableWidth, setAvailableWidth] = React.useState(1000);
  const headerContainerRef = useRef(null);

  const { containerRef: lyricsContainerRef, searchQuery, highlightedLineIndex, currentMatchIndex, totalMatches, handleSearch, clearSearch, navigateToNextMatch, navigateToPreviousMatch } = useSearch(lyrics);

  const hasLyrics = lyrics && lyrics.length > 0;
  const { showToast } = useToast();
  const { showModal } = useModal();

  const autoplayIntervalRef = useRef(null);
  const lyricsRef = useRef(lyrics);
  const selectedLineRef = useRef(selectedLine);
  const autoplaySettingsRef = useRef(autoplaySettings);
  const selectLineRef = useRef(selectLine);
  const emitLineUpdateRef = useRef(emitLineUpdate);
  const showToastRef = useRef(showToast);
  const isAutoplaySelectionRef = useRef(false);

  React.useEffect(() => {
    lyricsRef.current = lyrics;
  }, [lyrics]);

  React.useEffect(() => {
    selectedLineRef.current = selectedLine;
  }, [selectedLine]);

  React.useEffect(() => {
    autoplaySettingsRef.current = autoplaySettings;
  }, [autoplaySettings]);

  React.useEffect(() => {
    selectLineRef.current = selectLine;
  }, [selectLine]);

  React.useEffect(() => {
    emitLineUpdateRef.current = emitLineUpdate;
  }, [emitLineUpdate]);

  React.useEffect(() => {
    showToastRef.current = showToast;
  }, [showToast]);

  const processLoadedLyrics = React.useCallback(async ({ content, fileName, filePath, fileType }, context = {}) => {
    const sanitize = (value) => (value || '')
      .replace(/[<>:"/\\|?*]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    try {
      const requestedType = (fileType || '').toLowerCase() === 'lrc' ? 'lrc' : ((fileType || '').toLowerCase() === 'txt' ? 'txt' : null);
      const providedName = sanitize(fileName);
      const fallbackName = sanitize(context.fallbackFileName);
      const baseName = providedName || fallbackName || 'Imported Lyrics';
      const hasExtension = /\.[a-z0-9]{2,5}$/i.test(providedName);
      const inferredType = (!requestedType && providedName && providedName.toLowerCase().endsWith('.lrc')) ? 'lrc' : 'txt';
      const finalType = requestedType || inferredType;
      const extension = finalType === 'lrc' ? '.lrc' : '.txt';
      const finalFileName = hasExtension ? providedName : `${baseName}${extension}`;

      const enableSplitting = Boolean(context.enableOnlineLyricsSplitting || context.enableIntelligentSplitting);

      const parsed = await parseLyricsFileAsync(null, {
        rawText: content || '',
        fileType: finalType,
        name: finalFileName,
        path: filePath,
        enableSplitting,
      });

      if (!parsed || !Array.isArray(parsed.processedLines)) {
        throw new Error('Invalid lyrics response');
      }

      const processedLines = parsed.processedLines;
      const rawText = parsed.rawText ?? (content || '');
      const finalBaseName = (finalFileName || '').replace(/\.(txt|lrc)$/i, '');

      setLyrics(processedLines);
      setRawLyricsContent(rawText);
      selectLine(null);
      setLyricsFileName(finalBaseName);

      if (!context.providerId) {
        const detected = detectArtistFromFilename(finalBaseName);
        const metadata = {
          title: detected.title || finalBaseName,
          artists: detected.artist ? [detected.artist] : [],
          album: null,
          year: null,
          lyricLines: processedLines.length,
          origin: finalType === 'lrc' ? 'Local (.lrc)' : 'Local (.txt)',
          filePath: filePath || null
        };
        setSongMetadata(metadata);
      }

      emitLyricsLoad(processedLines);
      if (socket && socket.connected && finalBaseName) {
        socket.emit('fileNameUpdate', finalBaseName);
      }

      try {
        if (filePath && window?.electronAPI?.addRecentFile) {
          await window.electronAPI.addRecentFile(filePath);
        }
      } catch { }

      showToast({
        title: context.toastTitle || 'Lyrics loaded',
        message: context.toastMessage || `${finalType === 'lrc' ? 'LRC' : 'Text'}: ${finalBaseName}`,
        variant: context.toastVariant || 'success',
      });

      return true;
    } catch (err) {
      console.error('Failed to load lyrics content:', err);
      showToast({
        title: context.errorTitle || 'Failed to load lyrics',
        message: context.errorMessage || 'The lyrics could not be processed.',
        variant: 'error',
      });
      return false;
    }
  }, [emitLyricsLoad, selectLine, setLyrics, setRawLyricsContent, setLyricsFileName, showToast, socket]);

  const handleImportFromLibrary = React.useCallback(async ({ providerId, providerName, lyric }) => {
    if (!lyric || typeof lyric.content !== 'string' || !lyric.content.trim()) {
      showToast({
        title: 'Import failed',
        message: 'The selected provider did not return lyric content.',
        variant: 'error',
      });
      return false;
    }

    const baseNamePieces = [lyric.title || 'Untitled Song', lyric.artist || providerName || providerId];
    const fallbackFileName = baseNamePieces.filter(Boolean).join(' - ');

    const success = await processLoadedLyrics(
      {
        content: lyric.content,
        fileName: lyric.title || fallbackFileName,
        fileType: 'txt',
        enableOnlineLyricsSplitting: true,
      },
      {
        fallbackFileName,
        toastTitle: 'Lyrics imported',
        toastMessage: `Loaded from ${providerName || providerId}.`,
        providerId,
      }
    );

    if (success) {
      const album = lyric.album || lyric.albumName || null;

      const metadata = {
        title: lyric.title || 'Untitled Song',
        artists: lyric.artist ? [lyric.artist] : [],
        album: album,
        year: lyric.year || null,
        lyricLines: lyrics.length,
        origin: providerName || providerId,
        filePath: null
      };
      setSongMetadata(metadata);
    }

    return success;
  }, [processLoadedLyrics, showToast, lyrics, setSongMetadata]);

  React.useEffect(() => {
    if (!window?.electronAPI?.onOpenLyricsFromPath) return;
    const off = window.electronAPI.onOpenLyricsFromPath(async (payload) => {
      await processLoadedLyrics(payload || {});
    });
    return () => { try { off?.(); } catch { } };
  }, [processLoadedLyrics]);

  React.useEffect(() => {
    if (!window?.electronAPI?.onOpenLyricsFromPathError) return;
    const off = window.electronAPI.onOpenLyricsFromPathError(({ filePath }) => {
      showToast({
        title: 'File not found',
        message: `The file could not be opened. It may have been moved or deleted.\n${filePath || ''}`,
        variant: 'error'
      });
    });
    return () => { try { off?.(); } catch { } };
  }, [showToast]);

  React.useEffect(() => {
    const listener = (e) => {
      const payload = e?.detail || {};
      processLoadedLyrics(payload);
    };
    window.addEventListener('lyrics-opened', listener);
    return () => window.removeEventListener('lyrics-opened', listener);
  }, [processLoadedLyrics]);

  React.useEffect(() => {
    if (!window?.electronAPI?.onOpenEasyWorshipImport) return;

    const off = window.electronAPI.onOpenEasyWorshipImport(() => {
      setEasyWorshipModalOpen(true);
    });

    return () => {
      try {
        if (typeof off === 'function') off();
      } catch { }
    };
  }, []);

  const fontOptions = ['Arial', 'Calibri', 'Bebas Neue', 'Fira Sans', 'GarnetCapitals', 'Inter', 'Lato', 'Montserrat', 'Noto Sans', 'Open Sans', 'Poppins', 'Roboto', 'Work Sans'];

  const openFileDialog = async () => {
    if (!isAuthenticated) {
      showToast({
        title: 'Authentication Required',
        message: 'Please wait for authentication to complete before loading files.',
        variant: 'warning'
      });
      return;
    }

    try {
      if (window?.electronAPI?.loadLyricsFile) {
        const result = await window.electronAPI.loadLyricsFile();
        if (result && result.success && result.content) {
          const payload = { content: result.content, fileName: result.fileName, filePath: result.filePath };
          window.dispatchEvent(new CustomEvent('lyrics-opened', { detail: payload }));
          return;
        }
        if (result && result.canceled) return;
      }
    } catch { }
    fileInputRef.current?.click();
  };

  const handleCreateNewSong = () => {
    navigate('/new-song?mode=new');
  };

  const handleEditLyrics = () => {
    navigate('/new-song?mode=edit');
  };

  const handleOpenSetlist = () => {
    setSetlistModalOpen(true);
  };

  const handleOpenOnlineLyricsSearch = () => {
    setOnlineLyricsModalOpen(true);
  };

  const handleCloseOnlineLyricsSearch = () => {
    setOnlineLyricsModalOpen(false);
  };

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const success = await handleFileUpload(file);
    if (success) {
      clearSearch();
    }
  };

  const handleLineSelect = (index) => {
    selectLine(index);
    emitLineUpdate(index);
  };

  const handleToggle = () => {
    if (!isConnected || !isAuthenticated || !ready) {
      showToast({
        title: 'Connection Required',
        message: 'Cannot control output - not connected or authenticated.',
        variant: 'warning'
      });
      return;
    }

    setIsOutputOn(!isOutputOn);
    emitOutputToggle(!isOutputOn);
  };

  const isLineBlank = React.useCallback((line) => {
    if (!line) return true;
    const displayText = getLineDisplayText(line);
    return !displayText || displayText.trim() === '';
  }, []);

  const handleAutoplayToggle = React.useCallback(() => {
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

  React.useEffect(() => {
    if (!hasLyrics) return;

    const handleKeyDown = (event) => {
      const activeElement = document.activeElement;
      const isTyping = activeElement && (
        activeElement.tagName === 'INPUT' ||
        activeElement.tagName === 'TEXTAREA' ||
        activeElement.isContentEditable
      );

      if ((event.ctrlKey || event.metaKey) && event.key === 'f') {
        event.preventDefault();
        const searchInput = document.querySelector('[data-search-input]');
        if (searchInput) {
          searchInput.focus();
          searchInput.select();
        }
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.key === 'p') {
        event.preventDefault();
        handleAutoplayToggle();
        return;
      }

      if (event.key === 'Escape') {
        if (searchQuery) {
          event.preventDefault();
          clearSearch();
          if (activeElement && activeElement.hasAttribute('data-search-input')) {
            activeElement.blur();
          }
        }
        return;
      }

      if (event.key === 'Enter' && activeElement && activeElement.hasAttribute('data-search-input')) {
        event.preventDefault();
        if (totalMatches > 0 && highlightedLineIndex !== null) {
          handleLineSelect(highlightedLineIndex);
          window.dispatchEvent(new CustomEvent('scroll-to-lyric-line', {
            detail: { lineIndex: highlightedLineIndex }
          }));
        }
        return;
      }

      if (isTyping) return;

      if (event.key === ' ' || event.code === 'Space') {
        event.preventDefault();
        handleToggle();
        return;
      }

      const isUpArrow = event.key === 'ArrowUp' || event.keyCode === 38;
      const isDownArrow = event.key === 'ArrowDown' || event.keyCode === 40;
      const isHome = event.key === 'Home';
      const isEnd = event.key === 'End';

      if (isUpArrow || isDownArrow || isHome || isEnd) {
        event.preventDefault();

        const currentIndex = selectedLine ?? -1;
        let newIndex;

        if (isHome) {
          newIndex = 0;
        } else if (isEnd) {
          newIndex = lyrics.length - 1;
        } else if (isUpArrow) {
          newIndex = currentIndex > 0 ? currentIndex - 1 : 0;
        } else {
          newIndex = currentIndex < lyrics.length - 1 ? currentIndex + 1 : lyrics.length - 1;
        }

        if (newIndex !== currentIndex) {
          handleLineSelect(newIndex);

          window.dispatchEvent(new CustomEvent('scroll-to-lyric-line', {
            detail: { lineIndex: newIndex }
          }));
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hasLyrics, lyrics, selectedLine, handleLineSelect, handleToggle, handleAutoplayToggle, searchQuery, clearSearch, totalMatches, highlightedLineIndex, isConnected, isAuthenticated, ready, showToast, setIsOutputOn, emitOutputToggle]);

  const { isFileAlreadyInSetlist, handleAddToSetlist, disabled: addDisabled, title: addTitle } = useSetlistActions(emitSetlistAdd);

  React.useEffect(() => {
    if (autoplayIntervalRef.current) {
      clearInterval(autoplayIntervalRef.current);
      autoplayIntervalRef.current = null;
    }

    if (!autoplayActive || !hasLyrics) {
      return;
    }

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

      isAutoplaySelectionRef.current = true;
      currentSelectLine(nextIndex);
      currentEmitLineUpdate(nextIndex);
      window.dispatchEvent(new CustomEvent('scroll-to-lyric-line', {
        detail: { lineIndex: nextIndex }
      }));

      setTimeout(() => {
        isAutoplaySelectionRef.current = false;
      }, 50);
    }, autoplaySettings.interval * 1000);

    return () => {
      if (autoplayIntervalRef.current) {
        clearInterval(autoplayIntervalRef.current);
        autoplayIntervalRef.current = null;
      }
    };
  }, [autoplayActive, hasLyrics, autoplaySettings.interval, isLineBlank]);

  const handleOpenAutoplaySettings = () => {
    showModal({
      title: 'Autoplay Settings',
      headerDescription: 'Configure automatic lyric progression',
      component: 'AutoplaySettings',
      variant: 'info',
      size: 'sm',
      settings: autoplaySettings,
      onSave: (newSettings) => {
        setAutoplaySettings(newSettings);
        showToast({
          title: 'Settings Saved',
          message: 'Autoplay settings updated successfully.',
          variant: 'success'
        });
      },
      actions: []
    });
  };

  React.useEffect(() => {
    setAutoplayActive(false);
  }, [lyricsFileName]);

  React.useEffect(() => {
    if (isConnected && isAuthenticated && ready) {
      const clientType = isDesktopApp ? 'desktop' : 'mobile';
      emitAutoplayStateUpdate({ isActive: autoplayActive, clientType });
    }
  }, [autoplayActive, isConnected, isAuthenticated, ready, isDesktopApp, emitAutoplayStateUpdate]);

  React.useEffect(() => {
    const handleAutoplayStateUpdate = (event) => {
      const { isActive, clientType } = event.detail;
      const currentClientType = isDesktopApp ? 'desktop' : 'mobile';

      if (clientType !== currentClientType) {
        setRemoteAutoplayActive(isActive);
      }
    };

    window.addEventListener('autoplay-state-update', handleAutoplayStateUpdate);
    return () => window.removeEventListener('autoplay-state-update', handleAutoplayStateUpdate);
  }, [isDesktopApp]);

  React.useEffect(() => {
    if (!headerContainerRef.current || !hasLyrics) return;

    const updateWidth = () => {
      if (headerContainerRef.current) {
        setAvailableWidth(headerContainerRef.current.offsetWidth);
      }
    };

    const observer = new ResizeObserver(updateWidth);
    observer.observe(headerContainerRef.current);

    updateWidth();

    return () => observer.disconnect();
  }, [hasLyrics]);

  const useIconOnlyButtons = availableWidth < 700;

  if (!isDesktopApp) {
    return <MobileLayout />;
  }

  return (
    <>
      <ConnectionBackoffBanner darkMode={darkMode} />
      {isDesktopApp && <DraftApprovalModal darkMode={darkMode} />}
      <div className={`flex h-screen font-sans ${darkMode ? 'dark bg-gray-900' : 'bg-gray-50'}`}>
        {/* Left Sidebar - Control Panel */}
        <div className={`w-[420px] flex-shrink-0 shadow-lg flex flex-col h-screen ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
          {/* Fixed Header Section */}
          <div className={`flex-shrink-0 p-6 pb-0 ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <img
                src="/LyricDisplay-icon.png"
                alt="LyricDisplay"
                className="h-8 w-8"
              />
              <div className="flex items-center gap-2">
                {/* Online Lyrics Search Button */}
                <Tooltip content="Search and import lyrics from online providers" side="bottom">
                  <button
                    className={`p-2 rounded-lg font-medium transition-colors ${darkMode
                      ? 'bg-gray-700 hover:bg-gray-600 text-gray-200'
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                      }`}
                    title="Search online for lyrics"
                    onClick={handleOpenOnlineLyricsSearch}
                  >
                    <Globe className="w-5 h-5" />
                  </button>
                </Tooltip>

                {/* Setlist Button */}
                <Tooltip content="View and manage your song setlist (up to 25 songs)" side="bottom">
                  <button
                    className={`p-2 rounded-lg font-medium transition-colors ${darkMode
                      ? 'bg-gray-700 hover:bg-gray-600 text-gray-200'
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                      }`}
                    title="Open setlist"
                    onClick={handleOpenSetlist}
                  >
                    <ListMusic className="w-5 h-5" />
                  </button>
                </Tooltip>

                {/* Sync Outputs Button - Icon Only */}
                <Tooltip content="Force refresh all output displays with current state" side="bottom">
                  <button
                    disabled={!isConnected || !isAuthenticated || !ready}
                    className={`p-2 rounded-lg font-medium transition-colors ${(!isConnected || !isAuthenticated || !ready)
                      ? (darkMode ? 'bg-gray-700 text-gray-500 cursor-not-allowed opacity-50' : 'bg-gray-100 text-gray-400 cursor-not-allowed opacity-50')
                      : (darkMode ? 'bg-gray-700 hover:bg-gray-600 text-gray-200' : 'bg-gray-100 hover:bg-gray-200 text-gray-700')
                      }`}
                    title={(!isConnected || !isAuthenticated || !ready) ? "Cannot sync - not connected or authenticated" : "Sync current state to outputs"}
                    onClick={() => {
                      if (!isConnected || !isAuthenticated) {
                        showToast({
                          title: 'Cannot Sync',
                          message: 'Not connected or authenticated.',
                          variant: 'warning'
                        });
                        return;
                      }

                      try {
                        let syncSuccess = true;

                        if (lyrics && lyrics.length > 0) {
                          if (!emitLyricsLoad(lyrics)) {
                            syncSuccess = false;
                          }
                          if (selectedLine !== null && selectedLine !== undefined) {
                            if (!emitLineUpdate(selectedLine)) {
                              syncSuccess = false;
                            }
                          }
                          if (output1Settings && !emitStyleUpdate('output1', output1Settings)) {
                            syncSuccess = false;
                          }
                          if (output2Settings && !emitStyleUpdate('output2', output2Settings)) {
                            syncSuccess = false;
                          }
                        }

                        if (!emitOutputToggle(isOutputOn)) {
                          syncSuccess = false;
                        }

                        if (syncSuccess) {
                          window.dispatchEvent(new CustomEvent('sync-completed', { detail: { source: 'manual' } }));
                          showToast({
                            title: 'Outputs Synced',
                            message: 'Output displays updated successfully.',
                            variant: 'success'
                          });
                        } else {
                          showToast({
                            title: 'Sync Failed',
                            message: 'Outputs were not updated. Check the connection and try again.',
                            variant: 'error'
                          });
                        }
                      } catch (error) {
                        console.error('Manual sync failed:', error);
                        showToast({
                          title: 'Sync Failed',
                          message: 'An unexpected error occurred while syncing outputs.',
                          variant: 'error'
                        });
                      }
                    }}
                  >
                    <RefreshCw className="w-5 h-5" />
                  </button>
                </Tooltip>

                {/* Authentication Status Indicator */}
                <AuthStatusIndicator
                  authStatus={authStatus}
                  connectionStatus={connectionStatus}
                  onRetry={forceReconnect}
                  onRefreshToken={refreshAuthToken}
                  darkMode={darkMode}
                />
              </div>
            </div>

            {/* Load and Create Buttons */}
            <div className="flex gap-3 mb-3">
              <Tooltip content="Load a .txt or .lrc lyrics file from your computer" side="right">
                <button
                  className="flex-1 py-3 px-4 bg-gradient-to-r from-blue-400 to-purple-600 text-white rounded-xl font-medium hover:from-blue-500 hover:to-purple-700 transition-all duration-200 flex items-center justify-center gap-2"
                  onClick={openFileDialog}
                >
                  <FolderOpen className="w-5 h-5" />
                  Load lyrics file (.txt, .lrc)
                </button>
              </Tooltip>
              <Tooltip content="Open the song canvas to create new lyrics from scratch" side="left">
                <button
                  className={`h-[52px] w-[52px] rounded-xl font-medium transition-all duration-200 flex items-center justify-center ${darkMode
                    ? 'bg-gray-700 hover:bg-gray-600 text-gray-200'
                    : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                    }`}
                  onClick={handleCreateNewSong}
                  title="Create new lyrics"
                >
                  <FileText className="w-5 h-5" />
                </button>
              </Tooltip>
            </div>
            <input
              type="file"
              accept=".txt,.lrc"
              ref={fileInputRef}
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />

            {/* Current File Indicator */}
            {hasLyrics && (
              <div className={`mb-6 text-sm font-semibold flex items-center gap-2 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                <FileMusic className="w-4 h-4 flex-shrink-0" />
                <span className="truncate">{lyricsFileName}</span>
              </div>
            )}

            {/* Output Toggle */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4 pl-4">
                <Switch
                  checked={isOutputOn}
                  onCheckedChange={handleToggle}
                  className={`
            scale-[1.8]
            ${darkMode
                      ? "data-[state=checked]:bg-green-400 data-[state=unchecked]:bg-gray-600"
                      : "data-[state=checked]:bg-black"}
          `}
                />
                <span className={`text-sm ml-5 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                  {isOutputOn ? 'Display Output is ON' : 'Display Output is OFF'}
                </span>
              </div>

              {/* Help trigger button */}
              <button
                onClick={() => {
                  showModal({
                    title: 'Control Panel Help',
                    headerDescription: 'Master your LyricDisplay workflow with these essential tools',
                    component: 'ControlPanelHelp',
                    variant: 'info',
                    size: 'large',
                    dismissLabel: 'Got it'
                  });
                }}
                className={`p-2 rounded-lg transition-colors ${darkMode
                  ? 'hover:bg-gray-700 text-gray-400 hover:text-gray-200'
                  : 'hover:bg-gray-100 text-gray-500 hover:text-gray-700'
                  }`}
                title="Control Panel Help"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </button>
            </div>

            <div className={`border-t my-8 ${darkMode ? 'border-gray-700' : 'border-gray-100'}`}></div>

            {/* Output Tabs */}
            <Tabs value={activeTab} onValueChange={(val) => {
              setHasInteractedWithTabs(true);
              setActiveTab(val);

              if (scrollableSettingsRef.current) {
                scrollableSettingsRef.current.scrollTop = 0;
              }
            }}>
              <TabsList className={`w-full p-1.5 h-11 mb-8 gap-2 ${darkMode ? 'bg-gray-700 text-gray-300' : ''}`}>
                <TabsTrigger value="output1" className={`flex-1 h-full text-sm min-w-0 ${darkMode ? 'data-[state=active]:bg-white data-[state=active]:text-gray-900' : 'data-[state=active]:bg-black data-[state=active]:text-white'}`}>
                  Output 1
                </TabsTrigger>
                <TabsTrigger value="output2" className={`flex-1 h-full text-sm min-w-0 ${darkMode ? 'data-[state=active]:bg-white data-[state=active]:text-gray-900' : 'data-[state=active]:bg-black data-[state=active]:text-white'}`}>
                  Output 2
                </TabsTrigger>
                <TabsTrigger value="stage" className={`flex-1 h-full text-sm min-w-0 ${darkMode ? 'data-[state=active]:bg-white data-[state=active]:text-gray-900' : 'data-[state=active]:bg-black data-[state=active]:text-white'}`}>
                  Stage
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* Scrollable Settings Panel */}
          <div
            ref={scrollableSettingsRef}
            className="flex-1 overflow-y-auto px-6 relative"
            onScroll={(e) => {
              const scrollTop = e.currentTarget.scrollTop;
              const shadow = e.currentTarget.previousElementSibling;
              if (shadow) {
                if (scrollTop > 10) {
                  shadow.classList.add('shadow-md');
                } else {
                  shadow.classList.remove('shadow-md');
                }
              }
            }}
          >
            {/* Tab Content */}
            <div>
              {activeTab === 'output1' && (
                <OutputSettingsPanel
                  outputKey="output1"
                  settings={output1Settings}
                  updateSettings={(settings) => {
                    updateOutput1Settings(settings);
                    emitStyleUpdate('output1', settings);
                  }}
                  fontOptions={fontOptions}
                />
              )}

              {activeTab === 'output2' && (
                <OutputSettingsPanel
                  outputKey="output2"
                  settings={output2Settings}
                  updateSettings={(settings) => {
                    updateOutput2Settings(settings);
                    emitStyleUpdate('output2', settings);
                  }}
                  fontOptions={fontOptions}
                />
              )}

              {activeTab === 'stage' && (
                <OutputSettingsPanel
                  outputKey="stage"
                  settings={stageSettings}
                  updateSettings={(settings) => {
                    updateStageSettings(settings);
                    emitStyleUpdate('stage', settings);
                  }}
                />
              )}
            </div>

            <div className={`border-t my-8 ${darkMode ? 'border-gray-700' : 'border-gray-100'}`}></div>

            <div className={`mt-4 pb-6 text-[12px] text-left space-y-1 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              © 2025 LyricDisplay. All rights reserved. Designed and developed by Peter Alakembi and David Okaliwe.
            </div>
          </div>
        </div>

        {/* Right Main Area */}
        <div className="flex-1 min-w-0 p-6 flex flex-col h-screen">
          {/* Fixed Header */}
          <div className="mb-6 flex-shrink-0 min-w-0" ref={headerContainerRef}>
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0 flex-1">
                <h2 className={`text-xl font-bold whitespace-nowrap overflow-hidden text-ellipsis ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                  {hasLyrics ? lyricsFileName : ''}
                </h2>
                {hasLyrics && (
                  <p className={`text-xs mt-1 whitespace-nowrap overflow-hidden text-ellipsis ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                    {selectedLine !== null && selectedLine !== undefined
                      ? `Line ${selectedLine + 1} of ${lyrics.length} loaded lyric lines`
                      : `${lyrics.length} loaded lyric ${lyrics.length === 1 ? 'line' : 'lines'}`
                    }
                  </p>
                )}
              </div>
              {hasLyrics && (
                <div className="flex items-center gap-2 flex-shrink-0">
                  {/* Autoplay Button */}
                  <Tooltip content={remoteAutoplayActive ? "Autoplay is active on mobile controller" : autoplayActive ? "Stop autoplay" : "Start automatic lyric progression"} side="bottom">
                    <div className="relative flex">
                      <button
                        onClick={handleAutoplayToggle}
                        disabled={remoteAutoplayActive}
                        className={`flex items-center gap-2 text-xs font-medium transition-all ${remoteAutoplayActive
                          ? useIconOnlyButtons
                            ? 'bg-gray-400 text-gray-600 cursor-not-allowed px-2 py-2 rounded-lg opacity-60'
                            : 'bg-gray-400 text-gray-600 cursor-not-allowed px-4 py-2 rounded-lg opacity-60'
                          : autoplayActive
                            ? useIconOnlyButtons
                              ? 'bg-green-600 hover:bg-green-700 text-white px-2 py-2 rounded-lg'
                              : 'bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg'
                            : useIconOnlyButtons
                              ? darkMode
                                ? 'bg-gray-700 hover:bg-gray-600 text-gray-200 px-2 py-2 rounded-l-lg'
                                : 'bg-gray-100 hover:bg-gray-200 text-gray-800 px-2 py-2 rounded-l-lg'
                              : darkMode
                                ? 'bg-gray-700 hover:bg-gray-600 text-gray-200 px-4 py-2 rounded-l-lg'
                                : 'bg-gray-100 hover:bg-gray-200 text-gray-800 px-4 py-2 rounded-l-lg'
                          }`}
                      >
                        {autoplayActive ? (
                          <>
                            <Square className="w-4 h-4 flex-shrink-0 fill-current" />
                            {!useIconOnlyButtons && <span className="whitespace-nowrap">Autoplay</span>}
                          </>
                        ) : (
                          <>
                            <Play className="w-4 h-4 flex-shrink-0" />
                            {!useIconOnlyButtons && <span className="whitespace-nowrap">Autoplay</span>}
                          </>
                        )}
                      </button>

                      {/* Settings dropdown trigger - Always show when not active */}
                      {!autoplayActive && !remoteAutoplayActive && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenAutoplaySettings();
                          }}
                          className={`flex items-center justify-center ${useIconOnlyButtons ? 'px-1.5' : 'px-2'} py-2 rounded-r-lg transition-colors border-l ${autoplayActive
                            ? 'bg-green-600 hover:bg-green-700 text-white border-green-500'
                            : darkMode
                              ? 'bg-gray-700 hover:bg-gray-600 text-gray-200 border-gray-600'
                              : 'bg-gray-100 hover:bg-gray-200 text-gray-800 border-gray-300'
                            }`}
                          title="Autoplay settings"
                        >
                          <ChevronDown className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </Tooltip>

                  {/* Add to Setlist Button */}
                  <Tooltip content="Add current lyrics to your setlist for quick access during service" side="bottom">
                    <button
                      onClick={handleAddToSetlist}
                      aria-disabled={addDisabled}
                      className={`flex items-center gap-2 rounded-lg text-xs font-medium transition-colors ${addDisabled
                        ? (darkMode ? 'bg-gray-700 text-gray-500' : 'bg-gray-100 text-gray-400')
                        : (darkMode ? 'bg-gray-700 hover:bg-gray-600 text-gray-200' : 'bg-gray-100 hover:bg-gray-200 text-gray-800')
                        } ${useIconOnlyButtons ? 'px-2 py-2' : 'px-4 py-2'}`}
                      title={addTitle}
                      style={{ cursor: addDisabled ? 'not-allowed' : 'pointer', opacity: addDisabled ? 0.9 : 1 }}
                    >
                      <Plus className="w-4 h-4 flex-shrink-0" />
                      {!useIconOnlyButtons && <span className="whitespace-nowrap overflow-hidden text-ellipsis">Add to Setlist</span>}
                    </button>
                  </Tooltip>

                  {/* Edit Button */}
                  <Tooltip content="Edit current lyrics in the song canvas editor" side="bottom">
                    <button
                      onClick={handleEditLyrics}
                      className={`flex items-center gap-2 rounded-lg text-xs font-medium transition-colors ${darkMode
                        ? 'bg-gray-700 hover:bg-gray-600 text-gray-200'
                        : 'bg-gray-100 hover:bg-gray-200 text-gray-800'
                        } ${useIconOnlyButtons ? 'px-2 py-2' : 'px-4 py-2'}`}
                    >
                      <Edit className="w-4 h-4 flex-shrink-0" />
                      {!useIconOnlyButtons && <span className="whitespace-nowrap overflow-hidden text-ellipsis">Edit Lyrics</span>}
                    </button>
                  </Tooltip>

                  {/* Song Info Button */}
                  <Tooltip content="View song information" side="bottom">
                    <button
                      onClick={() => {
                        showModal({
                          title: 'Song Information',
                          component: 'SongInfoModal',
                          variant: 'info',
                          size: 'sm',
                          dismissLabel: 'Close'
                        });
                      }}
                      className={`p-2 rounded-lg transition-colors ${darkMode
                        ? 'bg-gray-700 hover:bg-gray-600 text-gray-200'
                        : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                        }`}
                      title="Song Information"
                    >
                      <Info className="w-4 h-4" />
                    </button>
                  </Tooltip>
                </div>
              )}
            </div>

            {/* Search Bar */}
            {hasLyrics && (
              <div className="mt-3 w-full">
                <SearchBar
                  darkMode={darkMode}
                  searchQuery={searchQuery}
                  onSearch={handleSearch}
                  totalMatches={totalMatches}
                  currentMatchIndex={currentMatchIndex}
                  onPrev={navigateToPreviousMatch}
                  onNext={navigateToNextMatch}
                  onClear={clearSearch}
                />
              </div>
            )}
          </div>

          {/* Scrollable Content Area */}
          <div className={`rounded-lg shadow-sm border flex-1 flex flex-col overflow-hidden ${darkMode ? 'bg-gray-800 border-gray-600' : 'bg-white border-gray-200'
            }`}>
            {hasLyrics ? (
              <div
                ref={lyricsContainerRef}
                className="flex-1 overflow-y-auto"
                onDrop={async (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const file = e.dataTransfer.files && e.dataTransfer.files[0];
                  if (!file) return;
                  const success = await handleFileUpload(file);
                  if (success) {
                    clearSearch();
                  }
                }}
                onDragOver={e => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onDragEnter={e => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
              >
                <LyricsList
                  searchQuery={searchQuery}
                  highlightedLineIndex={highlightedLineIndex}
                  onSelectLine={handleLineSelect}
                />
              </div>
            ) : (
              /* Empty State - Drag and Drop */
              <div
                className="flex-1 flex items-center justify-center p-4"
                onDrop={async (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const file = e.dataTransfer.files && e.dataTransfer.files[0];
                  if (!file) return;
                  await handleFileUpload(file);
                }}
                onDragOver={e => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onDragEnter={e => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
              >
                <div className="text-center">
                  <div className={`w-20 h-20 mx-auto mb-4 rounded-full flex items-center justify-center ${darkMode ? 'bg-gray-700' : 'bg-gray-200'
                    }`}>
                    <FolderOpen className={`w-10 h-10 ${darkMode ? 'text-gray-400' : 'text-gray-400'}`} />
                  </div>
                  <p className={`text-lg ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    Drag and drop TXT lyric files here
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Setlist Modal */}
        <SetlistModal />

        {/* Online Lyrics Search Modal */}
        <OnlineLyricsSearchModal
          isOpen={onlineLyricsModalOpen}
          onClose={handleCloseOnlineLyricsSearch}
          darkMode={darkMode}
          onImportLyrics={handleImportFromLibrary}
        />

        {/* EasyWorship Import Modal */}
        <EasyWorshipImportModal
          isOpen={easyWorshipModalOpen}
          onClose={() => setEasyWorshipModalOpen(false)}
          darkMode={darkMode}
        />
      </div>
    </>
  );
};

export default LyricDisplayApp;