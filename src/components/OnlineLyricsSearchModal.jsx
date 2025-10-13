import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Search, X, ExternalLink, Loader2, Key, Trash2, Globe2, BookOpen } from 'lucide-react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import useToast from '../hooks/useToast';
import OnlineLyricsWelcomeSplash from './OnlineLyricsWelcomeSplash';

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

  const { showToast } = useToast();
  const suggestionsRequestRef = useRef(0);
  const fullSearchRequestRef = useRef(0);
  const hasElectronBridge = useMemo(() => isElectronBridgeAvailable(), []);
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

    const requestId = ++suggestionsRequestRef.current;
    setLoadingSuggestions(true);
    const timer = setTimeout(async () => {
      try {
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
      } catch (error) {
        if (requestId !== suggestionsRequestRef.current) return;
        setLoadingSuggestions(false);
        setSuggestionResults([]);
        showToast({
          title: 'Search failed',
          message: error?.message || 'Could not fetch suggestions.',
          variant: 'error',
        });
      }
    }, 320);

    return () => clearTimeout(timer);
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
    const trimmed = query.trim();
    const requestId = ++fullSearchRequestRef.current;
    setLoadingFullResults(true);
    setShowFullResults(true);
    try {
      const response = await window.electronAPI.lyrics.search({ query: trimmed, limit: 25, skipCache: true });
      if (requestId !== fullSearchRequestRef.current) return;
      setLoadingFullResults(false);
      if (response?.success) {
        setFullResults(response.results || []);
        setProviderStatuses(response.meta?.providers || []);
      } else {
        setFullResults([]);
        throw new Error(response?.error || 'No results found.');
      }
    } catch (error) {
      if (requestId !== fullSearchRequestRef.current) return;
      setLoadingFullResults(false);
      setFullResults([]);
      showToast({
        title: 'Search failed',
        message: error?.message || 'Unable to complete search.',
        variant: 'error',
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
      const is404 = error?.message?.includes('404') || error?.message?.toLowerCase().includes('not found');
      showToast({
        title: is404 ? 'Lyrics not found' : 'Unable to load lyrics',
        message: is404
          ? 'This song may not be available from this provider. Try another result.'
          : error?.message || 'Provider returned an error.',
        variant: is404 ? 'warning' : 'error',
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
      showToast({
        title: 'Save failed',
        message: error?.message || 'Could not store provider key.',
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
      showToast({
        title: 'Removal failed',
        message: error?.message || 'Could not remove provider key.',
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
          <div className="flex flex-col items-center justify-center gap-2 p-8 text-center">
            <BookOpen className={`w-6 h-6 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`} />
            <p className={`text-sm ${darkMode ? 'text-gray-200' : 'text-gray-600'}`}>No matches found. Try a different title or artist.</p>
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
    'flex flex-col max-h-[92vh]',
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

        <div className="flex-1 overflow-y-auto px-6 py-5 h-[500px]">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className={darkMode ? 'bg-gray-800 text-gray-300' : undefined}>
              <TabsTrigger value="google">Google Search</TabsTrigger>
              <TabsTrigger value="libraries">Online Song Libraries</TabsTrigger>
            </TabsList>

            <TabsContent value="google">
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
                    Opens an in-app browser with Google search results. Perfect for finding lyrics from any website, copying them with Ctrl/Cmd + C key action, and pasting into LyricDisplay.
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
                      <span>The browser stays open while you copy lyrics</span>
                    </li>
                    <li className={`text-xs flex items-start gap-2 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                      <span className={`mt-0.5 w-1 h-1 rounded-full flex-shrink-0 ${darkMode ? 'bg-blue-400' : 'bg-blue-600'}`}></span>
                      <span>Use "Online Song Libraries" for one-click imports</span>
                    </li>
                  </ul>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="libraries">
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
                      <div className="flex flex-wrap gap-3">
                        {providerDefinitions.map((provider) => (
                          <a
                            key={provider.id}
                            href={provider.homepage}
                            target="_blank"
                            rel="noreferrer"
                            className={`group flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition ${darkMode
                              ? 'border-gray-700 bg-gray-800 text-gray-300 hover:border-gray-500 hover:text-white'
                              : 'border-gray-200 bg-gray-50 text-gray-600 hover:border-gray-400 hover:text-gray-800'
                              }`}
                          >
                            <span>{provider.displayName}</span>
                            <ExternalLink className="w-3 h-3 opacity-0 transition-opacity group-hover:opacity-100" />
                          </a>
                        ))}
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
                          return (
                            <div key={provider.id} className={`rounded-md border px-3 py-3 ${darkMode ? 'border-gray-700 bg-gray-900/60' : 'border-gray-200 bg-white'}`}>
                              <div className="flex flex-wrap items-center justify-between gap-3">
                                <div>
                                  <p className={`text-sm font-medium ${darkMode ? 'text-gray-100' : 'text-gray-800'}`}>{provider.displayName}</p>
                                  <p className={`text-xs ${configured ? 'text-green-500' : 'text-red-500'}`}>
                                    {configured ? 'Configured' : 'Key required'}
                                  </p>
                                </div>
                                {!isEditing && (
                                  <div className="flex items-center gap-2">
                                    <Button size="sm" variant="secondary" onClick={() => openKeyEditor(provider.id)}>
                                      {configured ? 'Update key' : 'Add key'}
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
                                    <Button variant="ghost" size="sm" onClick={() => { setKeyEditor(null); setKeyInputValue(''); }} disabled={savingKey}>
                                      Cancel
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