import { BookOpen, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const SuggestionsList = ({
  darkMode,
  handleSelectResult,
  isSearchFocused,
  items,
  providerMap,
  query,
  selectionIndex,
  selectionLoadingId,
  setSelectionIndex,
  showFullResults,
  suggestionListRef,
}) => {
  if (!isSearchFocused) return null;

  if (!items?.length) {
    if (!query.trim()) return null;

    return (
      <div className={`mt-3 rounded-md border ${darkMode ? 'border-gray-600 bg-gray-800/80' : 'border-gray-200 bg-white'}`}>
        <p className={`p-4 text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
          No suggestions yet. Press Enter to run a full catalog search.
        </p>
      </div>
    );
  }

  return (
    <div
      ref={suggestionListRef}
      className={`mt-3 rounded-md border ${darkMode ? 'border-gray-600 bg-gray-800/90' : 'border-gray-200 bg-white'} max-h-56 overflow-y-auto`}
    >
      {items.map((item, index) => {
        const providerName = providerMap.get(item.provider)?.displayName || item.provider;
        const isLoading = selectionLoadingId === item.id;
        const isSelected = selectionIndex === index && !showFullResults;
        return (
          <button
            data-result-row
            key={item.id}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => handleSelectResult(item)}
            disabled={isLoading}
            className={`flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition ${darkMode
              ? `${isSelected ? 'bg-blue-900/40 border-l-2 border-blue-500/70' : ''} hover:bg-gray-700 disabled:hover:bg-gray-800/90`
              : `${isSelected ? 'bg-blue-50 border-l-2 border-blue-500/70' : ''} hover:bg-gray-100 disabled:hover:bg-white`
              }`}
            aria-selected={isSelected}
            onMouseEnter={() => setSelectionIndex(index)}
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

export const FullResultsList = ({
  darkMode,
  fullResultsRef,
  handleSelectResult,
  handleShowLowQuality,
  items,
  lastError,
  loadingFullResults,
  lowQualityResults,
  performFullSearch,
  providerMap,
  selectionIndex,
  selectionLoadingId,
  setSelectionIndex,
  showFullResults,
  showingLowQuality,
}) => {
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
    <div
      ref={fullResultsRef}
      className={`mt-4 rounded-md border ${darkMode ? 'border-gray-600 bg-gray-800/90' : 'border-gray-200 bg-white'} max-h-72 overflow-y-auto`}
    >
      {items.map((item, index) => {
        const provider = providerMap.get(item.provider);
        const providerName = provider?.displayName || item.provider;
        const isLoading = selectionLoadingId === item.id;
        const isSelected = selectionIndex === index && showFullResults;
        return (
          <button
            data-result-row
            key={item.id}
            onClick={() => handleSelectResult(item)}
            disabled={isLoading}
            className={`w-full border-b px-4 py-4 text-left transition last:border-b-0 ${darkMode
              ? `${isSelected ? 'bg-blue-900/40 border-blue-500/70' : 'border-gray-700'} hover:bg-gray-700/70 disabled:hover:bg-transparent`
              : `${isSelected ? 'bg-blue-50 border-blue-500/70' : 'border-gray-200'} hover:bg-gray-100 disabled:hover:bg-white`
              }`}
            aria-selected={isSelected}
            onMouseEnter={() => setSelectionIndex(index)}
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
      {lowQualityResults.length > 0 && !showingLowQuality && (
        <div className={`w-full px-4 py-3 border-t ${darkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-gray-50'}`}>
          <button
            onClick={handleShowLowQuality}
            disabled={loadingFullResults}
            className={`text-sm underline underline-offset-4 ${darkMode ? 'text-blue-300 hover:text-blue-200' : 'text-blue-700 hover:text-blue-900'}`}
          >
            All Results
          </button>
        </div>
      )}
    </div>
  );
};
