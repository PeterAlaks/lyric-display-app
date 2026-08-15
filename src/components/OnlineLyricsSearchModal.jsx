import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ExternalLink, Globe2, HelpCircle, Library, Search, Wifi, WifiOff, X } from 'lucide-react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import useToast from '../hooks/useToast';
import OnlineLyricsWelcomeSplash from './OnlineLyricsWelcomeSplash';
import useNetworkStatus from '../hooks/OnlineLyricsSearchModal/useNetworkStatus';
import useLyricsProviderKeys from '../hooks/OnlineLyricsSearchModal/useLyricsProviderKeys';
import { FullResultsList, SuggestionsList } from './OnlineLyricsSearchModal/LyricsSearchResults';
import ProviderAdvancedPanel from './OnlineLyricsSearchModal/ProviderAdvancedPanel';
import { classifyError } from '../utils/errorClassification';
import { useKeyboardShortcuts } from '../hooks/OnlineLyricsSearchModal/useKeyboardShortcuts';
import { REQUEST_MODAL_CLOSE_EVENT } from '@/constants/modalEvents';

const DEFAULT_TAB = 'libraries';
const INITIAL_STATE = {
  query: '',
  suggestionResults: [],
  providerStatuses: [],
  fullResults: [],
};
const animationDuration = 220;

const isElectronBridgeAvailable = () => typeof window !== 'undefined' && !!window?.electronAPI?.lyrics;

const OnlineLyricsSearchModal = ({ isOpen, onClose, darkMode, onImportLyrics }) => {
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [entering, setEntering] = useState(false);
  const [activeTab, setActiveTab] = useState(DEFAULT_TAB);
  const [query, setQuery] = useState('');
  const [suggestionResults, setSuggestionResults] = useState([]);
  const [fullResults, setFullResults] = useState([]);
  const [lowQualityResults, setLowQualityResults] = useState([]);
  const [showingLowQuality, setShowingLowQuality] = useState(false);
  const [providerStatuses, setProviderStatuses] = useState([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [loadingFullResults, setLoadingFullResults] = useState(false);
  const [selectionLoadingId, setSelectionLoadingId] = useState(null);
  const [showFullResults, setShowFullResults] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [showWelcomeSplash, setShowWelcomeSplash] = useState(false);
  const [lastError, setLastError] = useState(null);
  const [, setRetrying] = useState(false);
  const [advancedExpanded, setAdvancedExpanded] = useState(false);
  const isOnline = useNetworkStatus();

  const { showToast } = useToast();
  const suggestionsRequestRef = useRef(0);
  const fullSearchRequestRef = useRef(0);
  const hasElectronBridge = useMemo(() => isElectronBridgeAvailable(), []);
  const abortControllerRef = useRef(null);
  const activeSuggestionSearchRequestIdRef = useRef(null);
  const activeFullSearchRequestIdRef = useRef(null);
  const partialResultsCleanupRef = useRef(null);
  const hasCheckedWelcome = useRef(false);
  const {
    handleDeleteKey,
    handleSaveKey,
    keyEditor,
    keyInputValue,
    openKeyEditor,
    providerDefinitions,
    resetKeyEditor,
    savingKey,
    setKeyInputValue,
  } = useLyricsProviderKeys({ hasElectronBridge, isOpen, showToast });

  const cancelLyricsSearch = useCallback((requestId) => {
    if (!requestId || !window?.electronAPI?.lyrics?.cancelSearch) return;
    window.electronAPI.lyrics.cancelSearch(requestId).catch((error) => {
      console.warn('Failed to cancel lyrics search:', error);
    });
  }, []);

  const cancelActiveSearches = useCallback(() => {
    cancelLyricsSearch(activeSuggestionSearchRequestIdRef.current);
    cancelLyricsSearch(activeFullSearchRequestIdRef.current);
    activeSuggestionSearchRequestIdRef.current = null;
    activeFullSearchRequestIdRef.current = null;
  }, [cancelLyricsSearch]);

  useEffect(() => {
    if (!isOpen) {
      cancelActiveSearches();
    }
  }, [cancelActiveSearches, isOpen]);

  useEffect(() => {
    if (!isOpen || !visible || hasCheckedWelcome.current) return;

    const timer = setTimeout(() => {
      try {
        const hasSeenWelcome = localStorage.getItem('lyricdisplay_hideWelcomeSplash');
        if (!hasSeenWelcome) {
          setShowWelcomeSplash(true);
          localStorage.setItem('lyricdisplay_hideWelcomeSplash', 'true');
        }
        hasCheckedWelcome.current = true;
      } catch (error) {
        console.warn('Failed to check welcome splash preference:', error);
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [isOpen, visible]);

  useEffect(() => {
    if (!isOpen && !visible) {
      hasCheckedWelcome.current = false;
    }
  }, [isOpen, visible]);

  useEffect(() => {
    if (isOnline && lastError && (lastError.type === 'offline' || lastError.type === 'network' || lastError.type === 'timeout')) {
      setLastError(null);
      showToast({
        title: 'Connection restored',
        message: 'You can now search for lyrics.',
        variant: 'success',
      });
    }
  }, [isOnline, lastError, showToast]);

  useEffect(() => {
    if (!isOpen || !visible) return;
    try {
      const saved = localStorage.getItem('lyricdisplay_advancedExpanded');
      if (saved !== null) {
        setAdvancedExpanded(saved === 'true');
      }
    } catch (err) {
      console.warn('Failed to load advanced section state:', err);
    }
  }, [isOpen, visible]);

  useLayoutEffect(() => {
    if (isOpen) {
      setVisible(true);
      setExiting(false);
      setEntering(true);
      const raf = requestAnimationFrame(() => setEntering(false));
      return () => cancelAnimationFrame(raf);
    }
    setEntering(false);
    setExiting(true);
    const timeout = setTimeout(() => {
      setExiting(false);
      setVisible(false);
    }, animationDuration);
    return () => clearTimeout(timeout);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen && !visible) {
      setQuery(INITIAL_STATE.query);
      setSuggestionResults(INITIAL_STATE.suggestionResults);
      setProviderStatuses(INITIAL_STATE.providerStatuses);
      setFullResults(INITIAL_STATE.fullResults);
      setLowQualityResults([]);
      setShowingLowQuality(false);
      setShowFullResults(false);
      setSelectionLoadingId(null);
      setActiveTab(DEFAULT_TAB);
      resetKeyEditor();
      setLoadingSuggestions(false);
      setLoadingFullResults(false);
      setLastError(null);
      setRetrying(false);
    }
  }, [isOpen, resetKeyEditor, visible]);

  const resetState = () => {
    setQuery(INITIAL_STATE.query);
    setSuggestionResults(INITIAL_STATE.suggestionResults);
    setProviderStatuses(INITIAL_STATE.providerStatuses);
    setFullResults(INITIAL_STATE.fullResults);
    setLowQualityResults([]);
    setShowingLowQuality(false);
    setShowFullResults(false);
    setSelectionLoadingId(null);
    setSelectionIndex(-1);
    setActiveTab(DEFAULT_TAB);
    resetKeyEditor();
    setLastError(null);
    setRetrying(false);
  };

  const handleCloseModal = useCallback(() => {
    cancelActiveSearches();
    resetState();
    onClose?.();
  }, [cancelActiveSearches, onClose, resetState]);

  useEffect(() => {
    if (!isOpen || activeTab !== 'libraries' || !hasElectronBridge || !isSearchFocused) return;
    const trimmed = query.trim();
    if (!trimmed) {
      cancelLyricsSearch(activeSuggestionSearchRequestIdRef.current);
      activeSuggestionSearchRequestIdRef.current = null;
      setSuggestionResults([]);
      setLoadingSuggestions(false);
      setLowQualityResults([]);
      setShowingLowQuality(false);
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    cancelLyricsSearch(activeSuggestionSearchRequestIdRef.current);
    activeSuggestionSearchRequestIdRef.current = null;
    if (partialResultsCleanupRef.current) {
      partialResultsCleanupRef.current();
      partialResultsCleanupRef.current = null;
    }

    abortControllerRef.current = new AbortController();
    const requestSequence = ++suggestionsRequestRef.current;
    const searchRequestId = `suggestions-${requestSequence}-${Date.now()}`;
    activeSuggestionSearchRequestIdRef.current = searchRequestId;
    setLoadingSuggestions(true);

    const timer = setTimeout(async () => {
      try {
        const cleanup = window.electronAPI.lyrics.onPartialResults((partialPayload) => {
          if (partialPayload?.requestId !== searchRequestId) return;
          if (requestSequence !== suggestionsRequestRef.current) return;
          if (partialPayload?.results) {
            setSuggestionResults(partialPayload.results);
            setProviderStatuses(partialPayload.meta?.providers || []);
            setLowQualityResults(partialPayload.meta?.search?.lowQualityResults || []);
            setShowingLowQuality(false);
          }
        });
        partialResultsCleanupRef.current = cleanup;

        const response = await window.electronAPI.lyrics.search({
          query: trimmed,
          limit: 10,
          mode: 'suggestions',
          requestId: searchRequestId,
        });

        if (requestSequence !== suggestionsRequestRef.current) return;
        if (response?.cancelled) return;
        setLoadingSuggestions(false);

        if (response?.success) {
          setSuggestionResults(response.results || []);
          setProviderStatuses(response.meta?.providers || []);
        } else {
          setSuggestionResults([]);
          setProviderStatuses([]);
        }

        if (cleanup) cleanup();
        partialResultsCleanupRef.current = null;
        if (activeSuggestionSearchRequestIdRef.current === searchRequestId) {
          activeSuggestionSearchRequestIdRef.current = null;
        }
      } catch (error) {
        if (error.name === 'AbortError') return;
        if (requestSequence !== suggestionsRequestRef.current) return;
        setLoadingSuggestions(false);
        setSuggestionResults([]);
        const classified = classifyError(error);
        setLastError({ ...classified, context: 'suggestions' });
        showToast({
          title: classified.title,
          message: classified.message,
          variant: classified.type === 'not_found' ? 'warning' : 'error',
        });

        if (partialResultsCleanupRef.current) {
          partialResultsCleanupRef.current();
          partialResultsCleanupRef.current = null;
        }
      }
    }, 500);

    return () => {
      clearTimeout(timer);
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      cancelLyricsSearch(searchRequestId);
      if (activeSuggestionSearchRequestIdRef.current === searchRequestId) {
        activeSuggestionSearchRequestIdRef.current = null;
      }
      if (partialResultsCleanupRef.current) {
        partialResultsCleanupRef.current();
        partialResultsCleanupRef.current = null;
      }
    };
  }, [query, activeTab, isOpen, hasElectronBridge, isSearchFocused, cancelLyricsSearch, showToast]);

  useEffect(() => {
    setSelectionIndex(-1);
  }, [suggestionResults, fullResults, showFullResults, isOpen]);

  const providerMap = useMemo(() => {
    const map = new Map();
    providerDefinitions.forEach((provider) => map.set(provider.id, provider));
    return map;
  }, [providerDefinitions]);

  const handleGoogleSearch = () => {
    if (!query.trim()) return;
    const normalizedQuery = query.toLowerCase().includes('lyrics') ? query : `${query} lyrics`;
    const url = `https://www.google.com/search?q=${encodeURIComponent(normalizedQuery)}`;
    if (window?.electronAPI?.openInAppBrowser) {
      window.electronAPI.openInAppBrowser(url, { darkMode });
    } else {
      window.open(url, '_blank', 'noopener');
    }
    handleCloseModal();
  };

  const combinedFullResults = showFullResults
    ? (showingLowQuality ? [...fullResults, ...lowQualityResults] : fullResults)
    : fullResults;

  const performFullSearch = async () => {
    if (!query.trim() || !hasElectronBridge) return;
    if (!isOnline) {
      showToast({
        title: 'No internet connection',
        message: 'Please check your network connection and try again.',
        variant: 'error',
      });
      return;
    }
    const trimmed = query.trim();
    cancelLyricsSearch(activeFullSearchRequestIdRef.current);
    activeFullSearchRequestIdRef.current = null;
    const requestSequence = ++fullSearchRequestRef.current;
    const searchRequestId = `full-${requestSequence}-${Date.now()}`;
    activeFullSearchRequestIdRef.current = searchRequestId;
    setLoadingFullResults(true);
    setShowFullResults(true);

    let cleanup = null;
    try {
      cleanup = window.electronAPI.lyrics.onPartialResults((partialPayload) => {
        if (partialPayload?.requestId !== searchRequestId) return;
        if (requestSequence !== fullSearchRequestRef.current) return;
        if (partialPayload?.results) {
          setFullResults(partialPayload.results);
          setProviderStatuses(partialPayload.meta?.providers || []);
          setLowQualityResults(partialPayload.meta?.search?.lowQualityResults || []);
          setShowingLowQuality(false);
        }
      });

      const response = await window.electronAPI.lyrics.search({
        query: trimmed,
        limit: 25,
        skipCache: true,
        mode: 'full',
        requestId: searchRequestId,
      });

      if (requestSequence !== fullSearchRequestRef.current) return;
      if (response?.cancelled) return;
      setLoadingFullResults(false);

      if (response?.success) {
        setFullResults(response.results || []);
        setProviderStatuses(response.meta?.providers || []);
        setLowQualityResults(response.meta?.search?.lowQualityResults || []);
        setShowingLowQuality(false);
      } else {
        setFullResults([]);
        throw new Error(response?.error || 'No results found.');
      }
    } catch (error) {
      if (requestSequence !== fullSearchRequestRef.current) return;
      setLoadingFullResults(false);
      setFullResults([]);
      setLowQualityResults([]);
      setShowingLowQuality(false);
      const classified = classifyError(error);
      setLastError({ ...classified, context: 'fullSearch' });
      showToast({
        title: classified.title,
        message: classified.message,
        variant: classified.type === 'not_found' ? 'warning' : 'error',
      });
    } finally {
      if (cleanup) cleanup();
      if (activeFullSearchRequestIdRef.current === searchRequestId) {
        activeFullSearchRequestIdRef.current = null;
      }
    }
  };

  const handleSelectResult = async (item) => {
    if (!item || !item.provider || !hasElectronBridge || selectionLoadingId) return;
    setSelectionLoadingId(item.id);
    try {
      const response = await window.electronAPI.lyrics.fetch({ providerId: item.provider, payload: item.payload });
      if (!response?.success || !response?.lyric) {
        throw new Error(response?.error || 'Provider did not return lyrics.');
      }

      const imported = await (onImportLyrics
        ? onImportLyrics({
          providerId: item.provider,
          providerName: providerMap.get(item.provider)?.displayName || item.provider,
          lyric: response.lyric,
        })
        : true);

      if (!imported) {
        return;
      }

      handleCloseModal();
    } catch (error) {
      console.error('Failed to load lyrics selection:', error);
      const classified = classifyError(error);
      showToast({
        title: classified.title,
        message: classified.message,
        variant: classified.type === 'not_found' ? 'warning' : 'error',
      });
    } finally {
      setSelectionLoadingId(null);
    }
  };

  const handleShowLowQuality = () => {
    setShowingLowQuality(true);
  };

  const {
    selectionIndex,
    setSelectionIndex,
    suggestionListRef,
    fullResultsRef,
  } = useKeyboardShortcuts({
    isOpen: isOpen && visible,
    activeTab,
    showFullResults,
    suggestionResults,
    fullResults: combinedFullResults,
    onSelectResult: handleSelectResult,
    onPerformFullSearch: performFullSearch,
    onGoogleSearch: handleGoogleSearch,
  });

  useEffect(() => {
    if (!isOpen || !visible) return undefined;

    const registerCloseCandidate = (event) => {
      const detail = event?.detail;
      if (!detail || !Array.isArray(detail.candidates)) return;
      detail.candidates.push({
        priority: 50,
        close: () => handleCloseModal(),
      });
    };

    window.addEventListener(REQUEST_MODAL_CLOSE_EVENT, registerCloseCandidate);
    return () => window.removeEventListener(REQUEST_MODAL_CLOSE_EVENT, registerCloseCandidate);
  }, [handleCloseModal, isOpen, visible]);

  if (!visible) return null;

  const isLibrariesMode = activeTab === 'libraries';
  const sourceModeClasses = (mode) => [
    'inline-flex h-9 items-center justify-center gap-2 rounded-md px-3 text-sm font-medium transition-colors',
    activeTab === mode
      ? (darkMode ? 'bg-gray-100 text-gray-900 shadow-sm' : 'bg-gray-900 text-white shadow-sm')
      : (darkMode ? 'text-gray-300' : 'text-gray-600 hover:bg-gray-100'),
  ].join(' ');
  const inputClasses = darkMode
    ? 'h-10 rounded-full border-gray-700/70 bg-gray-800/90 pl-10 pr-10 text-[13px] text-white placeholder:text-gray-500 focus-visible:border-blue-500/50 focus-visible:ring-blue-500/20'
    : 'h-10 rounded-full border-gray-200 bg-white pl-10 pr-10 text-[13px] text-gray-900 placeholder:text-gray-400 focus-visible:border-blue-500/40 focus-visible:ring-blue-500/15';
  const searchIconClass = darkMode ? 'text-gray-500' : 'text-gray-400';
  const clearSearchButtonClass = darkMode
    ? 'text-gray-400 hover:bg-blue-500/10 hover:text-blue-300 focus-visible:bg-blue-500/10 focus-visible:text-blue-300'
    : 'text-gray-500 hover:bg-blue-50 hover:text-blue-600 focus-visible:bg-blue-50 focus-visible:text-blue-600';
  const clearSearch = () => {
    setQuery('');
    setShowFullResults(false);
    setSuggestionResults([]);
    setFullResults([]);
    setLowQualityResults([]);
    setShowingLowQuality(false);
    setIsSearchFocused(false);
    setLastError(null);
  };
  const handlePrimarySearch = () => {
    if (isLibrariesMode) {
      performFullSearch();
    } else {
      handleGoogleSearch();
    }
  };
  const setSearchMode = (mode) => {
    setActiveTab(mode);
    setIsSearchFocused(false);
    setSuggestionResults([]);
    setSelectionIndex(-1);
  };
  const primarySearchDisabled = !query.trim()
    || (isLibrariesMode && (!hasElectronBridge || !isOnline || loadingFullResults));

  const modalClasses = [
    'rounded-xl border shadow-2xl ring-1 w-[94vw] max-w-5xl mx-4',
    'flex max-h-[calc(100vh-2rem)] h-[min(86vh,760px)] flex-col overflow-hidden sm:min-h-[620px]',
    darkMode ? 'bg-gray-900 text-gray-50 border-slate-800/80 ring-blue-500/35' : 'bg-white text-gray-900 border-slate-200/80 ring-blue-500/20',
    'transition-all duration-200 ease-out',
    (exiting || entering) ? 'opacity-0 translate-y-8 scale-95' : 'opacity-100 translate-y-0 scale-100',
  ].join(' ');

  const topMenuHeight = typeof document !== 'undefined'
    ? (getComputedStyle(document.body).getPropertyValue('--top-menu-height')?.trim() || '0px')
    : '0px';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ top: topMenuHeight }}>
      <div
        className={`absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-200 ${(exiting || entering) ? 'opacity-0' : 'opacity-100'}`}
        onClick={handleCloseModal}
      />
      <div className={modalClasses}>
        <div className={`flex items-center justify-between border-b px-5 py-4 ${darkMode ? 'border-white/5 bg-slate-950/45' : 'border-slate-900/5 bg-[#f8fafc]'}`}>
          <div className="min-w-0">
            <h2 className={`truncate text-lg font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>Online Lyrics Search</h2>
            <div className={`mt-1 flex items-center gap-2 text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              {isOnline ? <Wifi className="h-3.5 w-3.5 text-green-500" /> : <WifiOff className="h-3.5 w-3.5 text-red-500" />}
              <span>{isOnline ? 'Online' : 'Offline'}</span>
              {hasElectronBridge && <span className={darkMode ? 'text-gray-600' : 'text-gray-300'}>|</span>}
              {hasElectronBridge && <span>{providerDefinitions.length} providers</span>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Tooltip content="Open help">
              <button
                onClick={() => setShowWelcomeSplash(true)}
                className={`rounded-md p-2 transition-colors ${darkMode ? 'text-gray-400 hover:bg-gray-800 hover:text-gray-200' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'}`}
                aria-label="Open help"
              >
                <HelpCircle className="h-5 w-5" />
              </button>
            </Tooltip>
            <Tooltip content="Close">
              <button
                onClick={handleCloseModal}
                className={`rounded-md p-2 transition-colors ${darkMode ? 'text-gray-400 hover:bg-gray-800 hover:text-gray-200' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'}`}
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </Tooltip>
          </div>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[minmax(0,1fr)_18rem]">
          <section className={`flex min-h-0 flex-col ${darkMode ? 'bg-gray-900' : 'bg-white'}`}>
            <div className={`border-b p-4 ${darkMode ? 'border-slate-800/60 bg-gray-900' : 'border-slate-200/70 bg-white'}`}>
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                <div className={`inline-flex w-fit rounded-lg p-1 ${darkMode ? 'bg-gray-800' : 'bg-gray-100'}`}>
                  <button type="button" onClick={() => setSearchMode('libraries')} className={sourceModeClasses('libraries')}>
                    <Library className="h-4 w-4" />
                    Libraries
                  </button>
                  <button type="button" onClick={() => setSearchMode('google')} className={sourceModeClasses('google')}>
                    <Globe2 className="h-4 w-4" />
                    Web
                  </button>
                </div>
                <div className="flex min-w-0 flex-1 gap-2">
                  <div className="relative min-w-0 flex-1">
                    <Search className={`absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 ${searchIconClass}`} />
                    <Input
                      type="text"
                      value={query}
                      onChange={(event) => {
                        setQuery(event.target.value);
                        setShowFullResults(false);
                        setShowingLowQuality(false);
                        setLastError(null);
                      }}
                      onFocus={() => {
                        if (isLibrariesMode) setIsSearchFocused(true);
                      }}
                      onBlur={() => {
                        if (!isLibrariesMode) return;
                        setIsSearchFocused(false);
                        setSuggestionResults([]);
                        setLoadingSuggestions(false);
                        setSelectionIndex(-1);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' && !event.shiftKey) {
                          event.preventDefault();
                          handlePrimarySearch();
                        }
                      }}
                      autoFocus
                      placeholder={isLibrariesMode ? 'Song title, artist, hymn' : 'Song title and artist'}
                      className={inputClasses}
                    />
                    {query && (
                      <button
                        onClick={clearSearch}
                        className={`absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 transition-all ${clearSearchButtonClass}`}
                        aria-label="Clear search"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                    {isLibrariesMode && hasElectronBridge && !showFullResults && (
                      <SuggestionsList
                        darkMode={darkMode}
                        handleSelectResult={handleSelectResult}
                        isSearchFocused={isSearchFocused}
                        items={suggestionResults}
                        popover
                        providerMap={providerMap}
                        query={query}
                        selectionIndex={selectionIndex}
                        selectionLoadingId={selectionLoadingId}
                        setSelectionIndex={setSelectionIndex}
                        showFullResults={showFullResults}
                        suggestionListRef={suggestionListRef}
                      />
                    )}
                  </div>
                  <Button
                    onClick={handlePrimarySearch}
                    disabled={primarySearchDisabled}
                    className="h-10 w-24 shrink-0 justify-center rounded-full"
                  >
                    {isLibrariesMode ? <Search className="h-4 w-4" /> : <ExternalLink className="h-4 w-4" />}
                    {isLibrariesMode ? 'Search' : 'Open'}
                  </Button>
                </div>
              </div>
            </div>

            <div
              className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5"
              style={{ scrollbarGutter: 'stable' }}
            >
              {isLibrariesMode && !isOnline && (
                <div className={`rounded-md border px-4 py-3 ${darkMode ? 'border-red-500/40 bg-red-500/10' : 'border-red-200 bg-red-50'}`}>
                  <div className="flex items-start gap-3">
                    <AlertTriangle className={`mt-0.5 h-4 w-4 shrink-0 ${darkMode ? 'text-red-400' : 'text-red-600'}`} />
                    <div>
                      <p className={`text-sm font-semibold ${darkMode ? 'text-red-300' : 'text-red-900'}`}>No internet connection</p>
                      <p className={`mt-1 text-xs ${darkMode ? 'text-red-400' : 'text-red-700'}`}>Online library search is unavailable.</p>
                    </div>
                  </div>
                </div>
              )}

              {isLibrariesMode && !hasElectronBridge && (
                <div className={`rounded-md border px-4 py-6 text-center ${darkMode ? 'border-gray-700 bg-gray-800 text-gray-300' : 'border-gray-200 bg-gray-50 text-gray-600'}`}>
                  <p className="text-sm">Online libraries require the desktop app.</p>
                </div>
              )}

              {!isLibrariesMode && (
                <div className={`rounded-md border p-6 ${darkMode ? 'border-gray-700 bg-gray-800/60' : 'border-gray-200 bg-gray-50'}`}>
                  <div className="flex flex-col items-center justify-center gap-4 text-center">
                    <img
                      src="https://www.google.com/images/branding/googlelogo/2x/googlelogo_color_272x92dp.png"
                      alt="Google"
                      className="h-auto w-32"
                    />
                    <Button onClick={handleGoogleSearch} disabled={!query.trim()} className="h-10">
                      <ExternalLink className="h-4 w-4" />
                      Open Google Results
                    </Button>
                  </div>
                </div>
              )}

              {isLibrariesMode && hasElectronBridge && (
                <>
                  {lastError && lastError.context === 'suggestions' && !loadingSuggestions && (
                    <div className={`mb-3 rounded-md border px-4 py-3 ${darkMode ? 'border-yellow-500/30 bg-yellow-500/10' : 'border-yellow-200 bg-yellow-50'}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 flex-1 items-start gap-2">
                          <AlertTriangle className={`mt-0.5 h-4 w-4 shrink-0 ${darkMode ? 'text-yellow-400' : 'text-yellow-600'}`} />
                          <div className="min-w-0">
                            <p className={`text-sm font-medium ${darkMode ? 'text-yellow-300' : 'text-yellow-900'}`}>{lastError.title}</p>
                            <p className={`mt-1 text-xs ${darkMode ? 'text-yellow-400/80' : 'text-yellow-700'}`}>{lastError.message}</p>
                          </div>
                        </div>
                        {lastError.retryable && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setLastError(null);
                              if (query.trim()) {
                                setQuery(query + ' ');
                                setTimeout(() => setQuery(query.trim()), 0);
                              }
                            }}
                            className={darkMode ? 'border-yellow-500/50 text-yellow-300 hover:bg-yellow-500/20' : 'border-yellow-400 text-yellow-700 hover:bg-yellow-100'}
                          >
                            Retry
                          </Button>
                        )}
                      </div>
                    </div>
                  )}

                  {showFullResults && (
                    <FullResultsList
                      darkMode={darkMode}
                      fullResultsRef={fullResultsRef}
                      handleSelectResult={handleSelectResult}
                      handleShowLowQuality={handleShowLowQuality}
                      items={combinedFullResults}
                      lastError={lastError}
                      loadingFullResults={loadingFullResults}
                      lowQualityResults={lowQualityResults}
                      performFullSearch={performFullSearch}
                      providerMap={providerMap}
                      selectionIndex={selectionIndex}
                      selectionLoadingId={selectionLoadingId}
                      setSelectionIndex={setSelectionIndex}
                      showFullResults={showFullResults}
                      showingLowQuality={showingLowQuality}
                    />
                  )}
                </>
              )}
            </div>
          </section>

          <aside
            className={`min-h-0 overflow-y-auto border-t p-4 md:border-l md:border-t-0 ${darkMode ? 'border-slate-800/60 bg-gray-950/60' : 'border-slate-200/70 bg-gray-50'}`}
            style={{ scrollbarGutter: 'stable' }}
          >
            <ProviderAdvancedPanel
              advancedExpanded={advancedExpanded}
              compact
              darkMode={darkMode}
              handleDeleteKey={handleDeleteKey}
              handleSaveKey={handleSaveKey}
              keyEditor={keyEditor}
              keyInputValue={keyInputValue}
              openKeyEditor={openKeyEditor}
              providerDefinitions={providerDefinitions}
              providerStatuses={providerStatuses}
              resetKeyEditor={resetKeyEditor}
              savingKey={savingKey}
              setAdvancedExpanded={setAdvancedExpanded}
              setKeyInputValue={setKeyInputValue}
            />
          </aside>
        </div>
      </div>

      <OnlineLyricsWelcomeSplash
        isOpen={showWelcomeSplash}
        onClose={() => setShowWelcomeSplash(false)}
        darkMode={darkMode}
      />
    </div>
  );
};

export default OnlineLyricsSearchModal;
