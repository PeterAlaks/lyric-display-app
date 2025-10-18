import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Search, X, ExternalLink, Loader2, Key, Trash2, Globe2, BookOpen, AlertTriangle } from 'lucide-react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import useToast from '../hooks/useToast';
import OnlineLyricsWelcomeSplash from './OnlineLyricsWelcomeSplash';
import useNetworkStatus from '../hooks/useNetworkStatus';
import { classifyError } from '../utils/errorClassification';

const DEFAULT_TAB = 'libraries';
const INITIAL_STATE = {
  query: '',
  suggestionResults: [],
  providerStatuses: [],
  fullResults: [],
};

const isElectronBridgeAvailable = () => typeof window !== 'undefined' && !!window?.electronAPI?.lyrics;

const OnlineLyricsSearchModal = ({ isOpen, onClose, darkMode, onImportLyrics }) => {
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [entering, setEntering] = useState(false);
  const [activeTab, setActiveTab] = useState(DEFAULT_TAB);
  const [query, setQuery] = useState('');
  const [suggestionResults, setSuggestionResults] = useState([]);
  const [fullResults, setFullResults] = useState([]);
  const [providerStatuses, setProviderStatuses] = useState([]);
  const [providerDefinitions, setProviderDefinitions] = useState([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [loadingFullResults, setLoadingFullResults] = useState(false);
  const [selectionLoadingId, setSelectionLoadingId] = useState(null);
  const [showFullResults, setShowFullResults] = useState(false);
  const [keyEditor, setKeyEditor] = useState(null);
  const [keyInputValue, setKeyInputValue] = useState('');
  const [savingKey, setSavingKey] = useState(false);
  const [showWelcomeSplash, setShowWelcomeSplash] = useState(false);
  const [lastError, setLastError] = useState(null);
  const [retrying, setRetrying] = useState(false);
  const isOnline = useNetworkStatus();

  const { showToast } = useToast();
  const suggestionsRequestRef = useRef(0);
  const fullSearchRequestRef = useRef(0);
  const hasElectronBridge = useMemo(() => isElectronBridgeAvailable(), []);
  const abortControllerRef = useRef(null);
  const partialResultsCleanupRef = useRef(null);
  const hasCheckedWelcome = useRef(false);

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
    }, 280);
    return () => clearTimeout(timeout);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen && !visible) {
      setQuery(INITIAL_STATE.query);
      setSuggestionResults(INITIAL_STATE.suggestionResults);
      setProviderStatuses(INITIAL_STATE.providerStatuses);
      setFullResults(INITIAL_STATE.fullResults);
      setShowFullResults(false);
      setSelectionLoadingId(null);
      setActiveTab(DEFAULT_TAB);
      setKeyEditor(null);
      setKeyInputValue('');
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
    setActiveTab(DEFAULT_TAB);
    setKeyEditor(null);
    setKeyInputValue('');
    setLastError(null);
    setRetrying(false);
  };

  useEffect(() => {
    if (!isOpen || !hasElectronBridge) return;
    let cancelled = false;
    const loadProviders = async () => {
      try {
        const response = await window.electronAPI.lyrics.listProviders();
        if (!cancelled && response?.success) {
          setProviderDefinitions(response.providers || []);
        }
      } catch (error) {
        console.error('Failed to load provider definitions:', error);
      }
    };
    loadProviders();
    return () => { cancelled = true; };
  }, [isOpen, hasElectronBridge]);

  useEffect(() => {
    if (!isOpen || activeTab !== 'libraries' || !hasElectronBridge) return;
    const trimmed = query.trim();
    if (!trimmed) {
      setSuggestionResults([]);
      setLoadingSuggestions(false);
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
  }, [query, activeTab, isOpen, hasElectronBridge]);

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
    resetState();
    onClose?.();
  };

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
      } else {
        setFullResults([]);
        throw new Error(response?.error || 'No results found.');
      }

      cleanup();
    } catch (error) {
      if (requestId !== fullSearchRequestRef.current) return;
      setLoadingFullResults(false);
      setFullResults([]);
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

      resetState();
      onClose?.();
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

  const handleKeyDown = (event) => {
    if (event.key !== 'Enter') return;
    if (activeTab === 'google') {
      handleGoogleSearch();
    } else if (activeTab === 'libraries') {
      performFullSearch();
    }
  };

  const openKeyEditor = async (providerId) => {
    if (!hasElectronBridge) return;
    setKeyEditor(providerId);
    setKeyInputValue('');
    try {
      const response = await window.electronAPI.lyrics.getProviderKey(providerId);
      if (response?.success && response?.key) {
        setKeyInputValue(response.key);
      }
    } catch (error) {
      console.error('Failed to read provider key:', error);
    }
  };

  const handleSaveKey = async (providerId) => {
    if (!hasElectronBridge || !providerId) return;
    setSavingKey(true);
    try {
      await window.electronAPI.lyrics.saveProviderKey(providerId, keyInputValue.trim());
      showToast({
        title: 'Key saved',
        message: 'Provider credentials updated successfully.',
        variant: 'success',
      });
      setKeyEditor(null);
      setKeyInputValue('');
      const list = await window.electronAPI.lyrics.listProviders();
      if (list?.success) setProviderDefinitions(list.providers || []);
    } catch (error) {
      const classified = classifyError(error);
      showToast({
        title: classified.title,
        message: classified.message,
        variant: 'error',
      });
    } finally {
      setSavingKey(false);
    }
  };

  const handleDeleteKey = async (providerId) => {
    if (!hasElectronBridge || !providerId) return;
    setSavingKey(true);
    try {
      await window.electronAPI.lyrics.deleteProviderKey(providerId);
      showToast({
        title: 'Key removed',
        message: 'Provider key deleted.',
        variant: 'success',
      });
      setKeyEditor(null);
      setKeyInputValue('');
      const list = await window.electronAPI.lyrics.listProviders();
      if (list?.success) setProviderDefinitions(list.providers || []);
    } catch (error) {
      const classified = classifyError(error);
      showToast({
        title: classified.title,
        message: classified.message,
        variant: 'error',
      });
    } finally {
      setSavingKey(false);
    }
  };

  const renderSuggestionList = (items) => {
    if (!items?.length) {
      if (!query.trim()) {
        return null;
      }
      return (
        <div className={`mt-3 rounded-md border ${darkMode ? 'border-gray-600 bg-gray-800/80' : 'border-gray-200 bg-white'}`}>
          <p className={`p-4 text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
            No suggestions yet. Press Enter to run a full catalog search.
          </p>
        </div>
      );
    }

    return (
      <div className={`mt-3 rounded-md border ${darkMode ? 'border-gray-600 bg-gray-800/90' : 'border-gray-200 bg-white'} max-h-56 overflow-y-auto`}>
        {items.map((item) => {
          const providerName = providerMap.get(item.provider)?.displayName || item.provider;
          const isLoading = selectionLoadingId === item.id;
          return (
            <button
              key={item.id}
              onClick={() => handleSelectResult(item)}
              disabled={isLoading}
              className={`flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition ${darkMode
                ? 'hover:bg-gray-700 disabled:hover:bg-gray-800/90'
                : 'hover:bg-gray-100 disabled:hover:bg-white'
                }`}
            >
              <div className="min-w-0">
                <p className={`truncate text-sm font-medium ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>{item.title}</p>
                <p className={`truncate text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{item.artist || 'Unknown artist'}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className={`whitespace-nowrap text-xs uppercase tracking-wide ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  {providerName}
                </span>
                {isLoading && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
              </div>
            </button>
          );
        })}
      </div>
    );
  };

  const renderFullResults = (items) => {
    if (loadingFullResults) {
      return (
        <div className={`mt-4 flex h-48 items-center justify-center rounded-md border ${darkMode ? 'border-gray-600 bg-gray-800/80' : 'border-gray-200 bg-gray-50'}`}>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Loader2 className="w-4 h-4 animate-spin" />
            Fetching results...
          </div>
        </div>
      );
    }

    if (!items?.length) {
      return (
        <div className={`mt-4 rounded-md border ${darkMode ? 'border-gray-600 bg-gray-800/80' : 'border-gray-200 bg-white'}`}>
          <div className="flex flex-col items-center justify-center gap-3 p-8 text-center">
            <BookOpen className={`w-6 h-6 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`} />
            <div>
              <p className={`text-sm ${darkMode ? 'text-gray-200' : 'text-gray-600'}`}>No matches found. Try a different title or artist.</p>
              {lastError && lastError.context === 'fullSearch' && lastError.retryable && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={performFullSearch}
                  disabled={loadingFullResults}
                  className="mt-3"
                >
                  Retry Search
                </Button>
              )}
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className={`mt-4 rounded-md border ${darkMode ? 'border-gray-600 bg-gray-800/90' : 'border-gray-200 bg-white'} max-h-72 overflow-y-auto`}>
        {items.map((item) => {
          const provider = providerMap.get(item.provider);
          const providerName = provider?.displayName || item.provider;
          const isLoading = selectionLoadingId === item.id;
          return (
            <button
              key={item.id}
              onClick={() => handleSelectResult(item)}
              disabled={isLoading}
              className={`w-full border-b px-4 py-4 text-left transition last:border-b-0 ${darkMode
                ? 'border-gray-700 hover:bg-gray-700/70 disabled:hover:bg-transparent'
                : 'border-gray-200 hover:bg-gray-100 disabled:hover:bg-white'
                }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 space-y-1">
                  <p className={`truncate text-sm font-semibold ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>{item.title}</p>
                  <p className={`truncate text-xs ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>{item.artist || 'Unknown artist'}</p>
                  {item.snippet && (
                    <p className={`line-clamp-2 text-xs ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                      {item.snippet}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className={`rounded-md px-2 py-1 text-xs font-medium ${darkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600'}`}>
                    {providerName}
                  </span>
                  {isLoading && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    );
  };

  if (!visible) return null;

  const modalClasses = [
    'rounded-lg shadow-xl w-[90vw] max-w-2xl mx-4',
    'flex flex-col h-[700px]',
    darkMode ? 'bg-gray-900 border border-gray-700' : 'bg-white border border-gray-200',
    'transition-all duration-300 ease-out',
    (exiting || entering) ? 'opacity-0 translate-y-1 scale-95' : 'opacity-100 translate-y-0 scale-100',
  ].join(' ');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className={`absolute inset-0 bg-black transition-opacity duration-300 ${(exiting || entering) ? 'opacity-0' : 'opacity-60'}`}
        onClick={() => onClose?.()}
      />
      <div className={modalClasses}>
        <div className={`flex items-center justify-between border-b px-6 py-4 ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
          <div>
            <h2 className={`text-lg font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>Online Lyrics Search</h2>
            <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              Search Google or browse connected lyric libraries directly inside LyricDisplay.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Network Status Indicator */}
            <div
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border transition-colors ${isOnline
                ? (darkMode ? 'bg-green-500/10 border-green-500/30 text-green-400' : 'bg-green-50 border-green-200 text-green-700')
                : (darkMode ? 'bg-red-500/10 border-red-500/30 text-red-400 animate-pulse' : 'bg-red-50 border-red-200 text-red-700 animate-pulse')
                }`}
              title={isOnline ? 'Connected to internet' : 'No internet connection'}
            >
              <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500' : 'bg-red-500'}`} />
              <span className="text-[10px] font-semibold uppercase tracking-wide">
                {isOnline ? 'Online' : 'Offline'}
              </span>
            </div>
            {/* Help Button */}
            <button
              onClick={() => setShowWelcomeSplash(true)}
              className={`p-1.5 rounded-md transition-colors ${darkMode
                ? 'text-gray-400 hover:text-gray-200 hover:bg-gray-700'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                }`}
              title="How to use Online Lyrics Search"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>

            {/* Close Button */}
            <button
              onClick={() => { resetState(); onClose?.(); }}
              className={`p-1.5 rounded-md transition-colors ${darkMode ? 'text-gray-400 hover:text-gray-200 hover:bg-gray-700' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'}`}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
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

              {activeTab === 'libraries' && (
                <span
                  className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-sm border
      ${darkMode
                      ? 'border-gray-600 bg-gray-700 text-gray-300'
                      : 'border-gray-300 bg-gray-100 text-gray-700'
                    }`}
                >
                  Beta
                </span>
              )}
            </div>

            <TabsContent value="google" className="animate-in slide-in-from-left-8 duration-300">
              <div className="mt-4 space-y-4">
                <div className="relative">
                  <Input
                    type="text"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    onKeyDown={handleKeyDown}
                    autoFocus={activeTab === 'google'}
                    placeholder="Song title and artist"
                    className={darkMode ? 'border-gray-700 bg-gray-800 text-white placeholder-gray-500 pr-10' : 'pr-10'}
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
                  className="w-full"
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
                        onChange={(event) => { setQuery(event.target.value); setShowFullResults(false); }}
                        onKeyDown={handleKeyDown}
                        autoFocus={activeTab === 'libraries'}
                        placeholder="Search title, artist, or hymn"
                        className={darkMode ? 'border-gray-700 bg-gray-800 text-white placeholder-gray-500 pr-10' : 'pr-10'}
                      />
                      {query && (
                        <button
                          onClick={() => {
                            setQuery('');
                            setShowFullResults(false);
                            setSuggestionResults([]);
                            setFullResults([]);
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
                        variant="secondary"
                        disabled={loadingSuggestions || loadingFullResults}
                        onClick={() => setShowFullResults(false)}
                      >
                        Live Suggestions
                      </Button>
                      <Button
                        onClick={performFullSearch}
                        disabled={!query.trim() || loadingFullResults}
                        className="flex-1"
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

                  {loadingSuggestions && !showFullResults && (
                    <div className="mt-3 flex items-center gap-2 text-xs text-gray-500">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Fetching matches...
                    </div>
                  )}

                  {!showFullResults && renderSuggestionList(suggestionResults)}
                  {showFullResults && renderFullResults(fullResults)}

                  {providerStatuses?.length > 0 && (
                    <div className={`mt-6 rounded-md border px-4 py-3 text-xs ${darkMode ? 'border-gray-700 bg-gray-800 text-gray-300' : 'border-gray-200 bg-gray-50 text-gray-600'}`}>
                      <p className="font-medium mb-2 flex items-center gap-2">
                        <Globe2 className="w-4 h-4" />
                        Provider status
                      </p>
                      <ul className="space-y-1">
                        {providerStatuses.map((provider) => (
                          <li key={provider.id} className="flex items-center justify-between gap-3">
                            <span className="font-medium">{provider.displayName}</span>
                            <div className="flex items-center gap-2">
                              <span className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${darkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-200/40 text-gray-600'}`}>
                                {provider.count} hit{provider.count === 1 ? '' : 's'}
                              </span>
                              {provider.duration && (
                                <span className={`text-[10px] ${provider.duration > 3000 ? 'text-red-500' : provider.duration > 1000 ? 'text-yellow-500' : 'text-gray-500'}`}>
                                  {provider.duration}ms
                                </span>
                              )}
                              {provider.errors?.[0] && (
                                <span className="text-[10px] text-red-500">{provider.errors[0]}</span>
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {providerDefinitions?.length > 0 && (
                    <div className="mt-6">
                      <p className={`mb-3 text-xs font-medium uppercase tracking-wide ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                        Featured libraries
                      </p>
                      <div className="grid grid-cols-3 gap-3">
                        {providerDefinitions.map((provider) => {
                          const logoMap = {
                            lyricsOvh: '/logos/lyricsovh-logo.png',
                            vagalume: '/logos/vagalume-logo.png',
                            hymnary: '/logos/hymnaryorg-logo.png',
                            openHymnal: '/logos/openhymnal-logo.png',
                            lrclib: '/logos/lrclib-logo.png',
                            chartlyrics: '/logos/chartlyrics-logo.png',
                          };

                          return (
                            <a
                              key={provider.id}
                              href={provider.homepage}
                              target="_blank"
                              rel="noreferrer"
                              className="group relative transition-all hover:opacity-75 hover:scale-105"
                            >
                              <img
                                src={logoMap[provider.id]}
                                alt={provider.displayName}
                                className="h-10 w-auto object-contain"
                              />
                            </a>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {providerDefinitions.some((provider) => provider.requiresKey) && (
                    <div className={`mt-6 rounded-md border px-4 py-4 ${darkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-gray-50'}`}>
                      <p className={`mb-3 flex items-center gap-2 text-sm font-semibold ${darkMode ? 'text-gray-100' : 'text-gray-800'}`}>
                        <Key className="w-4 h-4" />
                        Provider access keys
                      </p>
                      <div className="space-y-4">
                        {providerDefinitions.filter((provider) => provider.requiresKey).map((provider) => {
                          const configured = provider.configured;
                          const isEditing = keyEditor === provider.id;
                          const iconMap = {
                            'vagalume': '/logos/vagalume-icon.png',
                            'hymnary': '/logos/hymnaryorg-icon.png',
                            'openHymnal': '/logos/openhymnal-icon.png',
                            'lyricsOvh': '/logos/lyricsovh-icon.png',
                            'lrclib': '/logos/lrclib-icon.png',
                            'chartlyrics': '/logos/chartlyrics-icon.png',
                          };

                          return (
                            <div key={provider.id} className={`rounded-md border px-3 py-3 ${darkMode ? 'border-gray-700 bg-gray-900/60' : 'border-gray-200 bg-white'}`}>
                              <div className="flex flex-wrap items-center justify-between gap-3">
                                <div className="flex items-center gap-3">
                                  {iconMap[provider.id] && (
                                    <img
                                      src={iconMap[provider.id]}
                                      alt={provider.displayName}
                                      className="h-8 w-8 object-contain"
                                    />
                                  )}
                                  <div>
                                    <p className={`text-sm font-medium ${darkMode ? 'text-gray-100' : 'text-gray-800'}`}>{provider.displayName}</p>
                                    <p className={`text-xs ${configured ? 'text-green-500' : 'text-red-500'}`}>
                                      {configured ? 'Configured' : 'Key required'}
                                    </p>
                                  </div>
                                </div>
                                {!isEditing && (
                                  <div className="flex items-center gap-2">
                                    <Button size="sm" variant="secondary" onClick={() => openKeyEditor(provider.id)} className={
                                      darkMode
                                        ? 'bg-gray-700 text-white hover:bg-gray-600'
                                        : ''
                                    }
                                    >{configured ? 'Update key' : 'Add key'}
                                    </Button>
                                    {configured && (
                                      <Button size="icon" variant="ghost" onClick={() => handleDeleteKey(provider.id)} disabled={savingKey}>
                                        <Trash2 className="w-4 h-4" />
                                      </Button>
                                    )}
                                  </div>
                                )}
                              </div>
                              {isEditing && (
                                <div className="mt-3 space-y-3">
                                  <Input
                                    type="text"
                                    value={keyInputValue}
                                    onChange={(event) => setKeyInputValue(event.target.value)}
                                    placeholder="Paste provider API key"
                                    className={darkMode ? 'border-gray-700 bg-gray-800 text-white placeholder-gray-500' : ''}
                                  />
                                  <div className="flex justify-end gap-2">
                                    <Button variant="ghost" size="sm" onClick={() => { setKeyEditor(null); setKeyInputValue(''); }} disabled={savingKey} className={
                                      darkMode
                                        ? 'text-gray-400 hover:bg-gray-700/60 hover:text-white'
                                        : ''
                                    }
                                    >Cancel
                                    </Button>
                                    <Button size="sm" onClick={() => handleSaveKey(provider.id)} disabled={savingKey || !keyInputValue.trim()}>
                                      {savingKey ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save key'}
                                    </Button>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </>
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