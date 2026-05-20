import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Search, X, ExternalLink, Loader2, Globe2, AlertTriangle } from 'lucide-react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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
  const [retrying, setRetrying] = useState(false);
  const [advancedExpanded, setAdvancedExpanded] = useState(false);
  const isOnline = useNetworkStatus();

  const { showToast } = useToast();
  const suggestionsRequestRef = useRef(0);
  const fullSearchRequestRef = useRef(0);
  const hasElectronBridge = useMemo(() => isElectronBridgeAvailable(), []);
  const abortControllerRef = useRef(null);
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
  }, [isOnline, lastError]);

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
  }, [isOpen, visible]);

  const resetState = () => {
    setQuery(INITIAL_STATE.query);
    setSuggestionResults(INITIAL_STATE.suggestionResults);
    setProviderStatuses(INITIAL_STATE.providerStatuses);
    setFullResults(INITIAL_STATE.fullResults);
    setShowFullResults(false);
    setSelectionLoadingId(null);
    setSelectionIndex(-1);
    setActiveTab(DEFAULT_TAB);
    resetKeyEditor();
    setLastError(null);
    setRetrying(false);
  };

  const handleCloseModal = useCallback(() => {
    resetState();
    onClose?.();
  }, [onClose, resetState]);

  useEffect(() => {
    if (!isOpen || activeTab !== 'libraries' || !hasElectronBridge || !isSearchFocused) return;
    const trimmed = query.trim();
    if (!trimmed) {
      setSuggestionResults([]);
      setLoadingSuggestions(false);
      setLowQualityResults([]);
      setShowingLowQuality(false);
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    if (partialResultsCleanupRef.current) {
      partialResultsCleanupRef.current();
      partialResultsCleanupRef.current = null;
    }

    abortControllerRef.current = new AbortController();
    const requestId = ++suggestionsRequestRef.current;
    setLoadingSuggestions(true);

    const timer = setTimeout(async () => {
      try {
        const cleanup = window.electronAPI.lyrics.onPartialResults((partialPayload) => {
          if (requestId !== suggestionsRequestRef.current) return;
          if (partialPayload?.results) {
            setSuggestionResults(partialPayload.results);
            setProviderStatuses(partialPayload.meta?.providers || []);
            setLowQualityResults(partialPayload.meta?.search?.lowQualityResults || []);
            setShowingLowQuality(false);
          }
        });
        partialResultsCleanupRef.current = cleanup;

        const response = await window.electronAPI.lyrics.search({ query: trimmed, limit: 10 });

        if (requestId !== suggestionsRequestRef.current) return;
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
      } catch (error) {
        if (error.name === 'AbortError') return;
        if (requestId !== suggestionsRequestRef.current) return;
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
      if (partialResultsCleanupRef.current) {
        partialResultsCleanupRef.current();
        partialResultsCleanupRef.current = null;
      }
    };
  }, [query, activeTab, isOpen, hasElectronBridge, isSearchFocused]);

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
    const requestId = ++fullSearchRequestRef.current;
    setLoadingFullResults(true);
    setShowFullResults(true);

    try {
      const cleanup = window.electronAPI.lyrics.onPartialResults((partialPayload) => {
        if (requestId !== fullSearchRequestRef.current) return;
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
        skipCache: true
      });

      if (requestId !== fullSearchRequestRef.current) return;
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

      cleanup();
    } catch (error) {
      if (requestId !== fullSearchRequestRef.current) return;
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

  const modalClasses = [
    'rounded-2xl border shadow-2xl ring-1 w-[90vw] max-w-2xl mx-4',
    'flex flex-col h-[650px]',
    darkMode ? 'bg-gray-900 text-gray-50 border-gray-800 ring-blue-500/35' : 'bg-white text-gray-900 border-gray-200 ring-blue-500/20',
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
        <div className={`flex items-center justify-between border-b px-6 py-4 ${darkMode ? 'border-gray-800' : 'border-gray-200'}`}>
          <div>
            <h2 className={`text-lg font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>Online Lyrics Search</h2>
            <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              Search Google or browse connected lyric libraries directly inside LyricDisplay.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Network Status Indicator */}
            <Tooltip content={isOnline ? 'Connected to the internet' : 'No internet connection'}>
              <div
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border transition-colors ${isOnline
                  ? (darkMode ? 'bg-green-500/10 border-green-500/30 text-green-400' : 'bg-green-50 border-green-200 text-green-700')
                  : (darkMode ? 'bg-red-500/10 border-red-500/30 text-red-400 animate-pulse' : 'bg-red-50 border-red-200 text-red-700 animate-pulse')
                  }`}
              >
                <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500' : 'bg-red-500'}`} />
                <span className="text-[10px] font-semibold uppercase tracking-wide">
                  {isOnline ? 'Online' : 'Offline'}
                </span>
              </div>
            </Tooltip>
            {/* Help Button */}
            <Tooltip content="How to use Online Lyrics Search">
              <button
                onClick={() => setShowWelcomeSplash(true)}
                className={`p-1.5 rounded-md transition-colors ${darkMode
                  ? 'text-gray-400 hover:text-gray-200 hover:bg-gray-700'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                  }`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </button>
            </Tooltip>

            {/* Close Button */}
            <button
              onClick={handleCloseModal}
              className={`p-1.5 rounded-md transition-colors ${darkMode ? 'text-gray-400 hover:text-gray-200 hover:bg-gray-700' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'}`}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-scroll px-6 py-5">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <div className="flex items-center gap-2">
              <TabsList className={darkMode ? 'bg-gray-800 text-gray-300' : undefined}>
                <TabsTrigger value="google" className={darkMode
                  ? 'data-[state=active]:bg-white data-[state=active]:text-gray-900'
                  : 'data-[state=active]:bg-white data-[state=active]:text-gray-900'}
                >Google Search</TabsTrigger>
                <TabsTrigger value="libraries" className={darkMode
                  ? 'data-[state=active]:bg-white data-[state=active]:text-gray-900'
                  : 'data-[state=active]:bg-white data-[state=active]:text-gray-900'}
                >Online Song Libraries</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="google" className="animate-in slide-in-from-left-8 duration-300">
              <div className="mt-4 space-y-4">
                <div className="relative">
                  <Input
                    type="text"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    autoFocus={activeTab === 'google'}
                    placeholder="Enter song title and artist"
                    className={darkMode ? 'border-gray-700 bg-gray-800 text-white placeholder-gray-500 pr-10 h-10' : 'pr-10 h-10'}
                  />
                  {query && (
                    <button
                      onClick={() => setQuery('')}
                      className={`absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md transition-colors ${darkMode
                        ? 'text-gray-400 hover:text-gray-200 hover:bg-gray-700'
                        : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                        }`}
                      aria-label="Clear search"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <Button
                  onClick={handleGoogleSearch}
                  disabled={!query.trim()}
                  className="w-full h-10"
                >
                  <Search className="w-4 h-4" />
                  Open Google Search
                </Button>

                {/* Google Search Info Section */}
                <div className={`mt-8 rounded-lg border p-6 text-center ${darkMode ? 'border-gray-700 bg-gray-800/50' : 'border-gray-200 bg-gray-50'}`}>
                  <div className="flex justify-center mb-4">
                    <img
                      src="https://www.google.com/images/branding/googlelogo/2x/googlelogo_color_272x92dp.png"
                      alt="Google"
                      className="w-32 h-auto"
                    />
                  </div>
                  <h3 className={`text-lg font-semibold mb-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                    Search the Web for Lyrics
                  </h3>
                  <p className={`text-sm mb-4 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    Opens an in-app browser with Google search results. Perfect for finding lyrics from any website, copying them and pasting into LyricDisplay.
                  </p>
                  <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${darkMode ? 'bg-blue-500/10 text-blue-400' : 'bg-blue-50 text-blue-700'}`}>
                    <Globe2 className="w-3.5 h-3.5" />
                    Browse any lyrics website
                  </div>
                </div>

                {/* Quick Tips */}
                <div className={`rounded-lg border p-4 ${darkMode ? 'border-gray-700 bg-gray-800/30' : 'border-gray-200 bg-white'}`}>
                  <p className={`text-xs font-medium mb-3 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    💡 Quick Tips
                  </p>
                  <ul className="space-y-2">
                    <li className={`text-xs flex items-start gap-2 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                      <span className={`mt-0.5 w-1 h-1 rounded-full flex-shrink-0 ${darkMode ? 'bg-blue-400' : 'bg-blue-600'}`}></span>
                      <span>Enter song title and artist for best results</span>
                    </li>
                    <li className={`text-xs flex items-start gap-2 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                      <span className={`mt-0.5 w-1 h-1 rounded-full flex-shrink-0 ${darkMode ? 'bg-blue-400' : 'bg-blue-600'}`}></span>
                      <span>The browser stays open while you copy lyrics. You can only copy with Ctrl/Cmd + C key action.</span>
                    </li>
                    <li className={`text-xs flex items-start gap-2 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                      <span className={`mt-0.5 w-1 h-1 rounded-full flex-shrink-0 ${darkMode ? 'bg-blue-400' : 'bg-blue-600'}`}></span>
                      <span>Use "Online Song Libraries" for one-click imports</span>
                    </li>
                  </ul>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="libraries" className="animate-in slide-in-from-right-8 duration-300">
              {/* Offline Banner */}
              {!isOnline && (
                <div className={`mt-4 rounded-lg border-2 px-4 py-3 ${darkMode ? 'border-red-500/50 bg-red-500/10' : 'border-red-200 bg-red-50'}`}>
                  <div className="flex items-start gap-3">
                    <AlertTriangle className={`w-5 h-5 flex-shrink-0 mt-0.5 ${darkMode ? 'text-red-400' : 'text-red-600'}`} />
                    <div>
                      <p className={`text-sm font-semibold ${darkMode ? 'text-red-300' : 'text-red-900'}`}>
                        No internet connection
                      </p>
                      <p className={`text-xs mt-1 ${darkMode ? 'text-red-400' : 'text-red-700'}`}>
                        Online library search requires an active internet connection. Please check your network and try again.
                      </p>
                    </div>
                  </div>
                </div>
              )}
              {!hasElectronBridge ? (
                <div className={`mt-6 rounded-md border px-4 py-6 text-center ${darkMode ? 'border-gray-700 bg-gray-800 text-gray-300' : 'border-gray-200 bg-gray-50 text-gray-600'}`}>
                  <p className="text-sm">
                    Online libraries require the desktop app. Connect through Electron to search and import lyrics directly.
                  </p>
                </div>
              ) : (
                <>
                  <div className="mt-4 space-y-3">
                    <div className="relative">
                      <Input
                        type="text"
                        value={query}
                        onChange={(event) => { setQuery(event.target.value); setShowFullResults(false); setShowingLowQuality(false); }}
                        onFocus={() => setIsSearchFocused(true)}
                        onBlur={() => {
                          setIsSearchFocused(false);
                          setSuggestionResults([]);
                          setLoadingSuggestions(false);
                          setSelectionIndex(-1);
                        }}
                        autoFocus={activeTab === 'libraries'}
                        placeholder="Search for song titles, artists or hymns"
                        className={darkMode ? 'border-gray-700 bg-gray-800 text-white placeholder-gray-500 pr-10 h-10' : 'pr-10 h-10'}
                      />
                      {query && (
                        <button
                          onClick={() => {
                            setQuery('');
                            setShowFullResults(false);
                            setSuggestionResults([]);
                            setFullResults([]);
                            setLowQualityResults([]);
                            setShowingLowQuality(false);
                            setIsSearchFocused(false);
                          }}
                          className={`absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md transition-colors ${darkMode
                            ? 'text-gray-400 hover:text-gray-200 hover:bg-gray-700'
                            : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                            }`}
                          aria-label="Clear search"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <Button
                        onClick={performFullSearch}
                        disabled={!query.trim() || loadingFullResults}
                        className="flex-1 h-10"
                      >
                        <Search className="w-4 h-4" />
                        Search Libraries
                      </Button>
                    </div>
                  </div>

                  {/* Error State with Retry */}
                  {lastError && lastError.context === 'suggestions' && !loadingSuggestions && (
                    <div className={`mt-3 rounded-md border px-4 py-3 ${darkMode ? 'border-yellow-500/30 bg-yellow-500/10' : 'border-yellow-200 bg-yellow-50'}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-2 flex-1">
                          <AlertTriangle className={`w-4 h-4 flex-shrink-0 mt-0.5 ${darkMode ? 'text-yellow-400' : 'text-yellow-600'}`} />
                          <div className="min-w-0">
                            <p className={`text-sm font-medium ${darkMode ? 'text-yellow-300' : 'text-yellow-900'}`}>
                              {lastError.title}
                            </p>
                            <p className={`text-xs mt-1 ${darkMode ? 'text-yellow-400/80' : 'text-yellow-700'}`}>
                              {lastError.message}
                            </p>
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

                  {!showFullResults && (
                    <SuggestionsList
                      darkMode={darkMode}
                      handleSelectResult={handleSelectResult}
                      isSearchFocused={isSearchFocused}
                      items={suggestionResults}
                      providerMap={providerMap}
                      query={query}
                      selectionIndex={selectionIndex}
                      selectionLoadingId={selectionLoadingId}
                      setSelectionIndex={setSelectionIndex}
                      showFullResults={showFullResults}
                      suggestionListRef={suggestionListRef}
                    />
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

                  <ProviderAdvancedPanel
                    advancedExpanded={advancedExpanded}
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
                  />                </>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Welcome Splash Overlay */}
      <OnlineLyricsWelcomeSplash
        isOpen={showWelcomeSplash}
        onClose={() => setShowWelcomeSplash(false)}
        darkMode={darkMode}
      />
    </div>
  );
};

export default OnlineLyricsSearchModal;
