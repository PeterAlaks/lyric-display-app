import { BookOpen, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

const VERSION_LABELS = [
  { key: 'live', label: 'Live', pattern: /\blive\b|\bconcert\b|\bsession\b/i },
  { key: 'acoustic', label: 'Acoustic', pattern: /\bacoustic\b|\bstripped\b|\bunplugged\b/i },
  { key: 'remix', label: 'Remix', pattern: /\bremix\b|\bmix\b/i },
  { key: 'instrumental', label: 'Instrumental', pattern: /\binstrumental\b|\bkaraoke\b/i },
  { key: 'radio', label: 'Radio edit', pattern: /\bradio edit\b|\bedit\b/i },
  { key: 'cover', label: 'Cover', pattern: /\bcover\b/i },
  { key: 'demo', label: 'Demo', pattern: /\bdemo\b/i },
];

const formatDuration = (duration) => {
  const numeric = Number(duration);
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  const minutes = Math.floor(numeric / 60);
  const seconds = Math.round(numeric % 60);
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
};

const getResultBadges = (item) => {
  const badges = [];
  const versionText = `${item?.title || ''} ${item?.album || ''} ${item?.snippet || ''}`;

  VERSION_LABELS.forEach(({ key, label, pattern }) => {
    if (badges.some((badge) => badge.key === key)) return;
    if (pattern.test(versionText) || (key === 'instrumental' && item?.metadata?.instrumental)) {
      badges.push({ key, label });
    }
  });

  if (item?.metadata?.hasSyncedLyrics) {
    badges.push({ key: 'synced', label: 'Synced' });
  }

  const duration = formatDuration(item?.metadata?.duration ?? item?.payload?.duration);
  if (duration) {
    badges.push({ key: 'duration', label: duration });
  }

  if (item?.album) {
    badges.push({ key: 'album', label: item.album });
  }

  return badges.slice(0, 5);
};

const ResultBadges = ({ darkMode, item }) => {
  const badges = getResultBadges(item);
  if (!badges.length) return null;

  return (
    <div className="mt-1.5 flex min-w-0 flex-wrap gap-1.5">
      {badges.map((badge) => (
        <span
          key={badge.key}
          className={`max-w-[13rem] truncate text-[10px] font-medium ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}
          title={badge.label}
        >
          {badge.label}
        </span>
      ))}
    </div>
  );
};

export const SuggestionsList = ({
  darkMode,
  handleSelectResult,
  isSearchFocused,
  items,
  popover = false,
  providerMap,
  query,
  selectionIndex,
  selectionLoadingId,
  setSelectionIndex,
  showFullResults,
  suggestionListRef,
}) => {
  if (!isSearchFocused) return null;

  const containerClassName = popover
    ? `absolute left-0 right-0 top-[calc(100%+0.5rem)] z-30 rounded-xl border shadow-2xl backdrop-blur-md ${darkMode ? 'border-gray-800 bg-gray-900/92 ring-1 ring-black/40' : 'border-gray-200 bg-white/92 ring-1 ring-black/5'}`
    : `mt-3 rounded-xl border ${darkMode ? 'border-gray-800 bg-gray-900/60' : 'border-gray-200 bg-white'}`;

  if (!items?.length) {
    if (!query.trim()) return null;

    return (
      <div className={containerClassName}>
        <p className={`p-4 text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
          No suggestions yet.
        </p>
      </div>
    );
  }

  return (
    <div
      ref={suggestionListRef}
      className={`${containerClassName} max-h-64 overflow-y-auto ${popover ? (darkMode ? 'bg-[linear-gradient(135deg,rgba(255,255,255,0.025)_0,rgba(255,255,255,0)_36%)]' : 'bg-[linear-gradient(135deg,rgba(15,23,42,0.025)_0,rgba(15,23,42,0)_36%)]') : ''}`}
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
            className={`flex w-full items-center justify-between gap-3 border-b px-4 py-3 text-left transition last:border-b-0 ${darkMode
              ? `${isSelected ? 'bg-blue-500/10 text-blue-100' : 'border-gray-800'} hover:bg-blue-500/5 disabled:hover:bg-transparent`
              : `${isSelected ? 'bg-blue-50/80 text-blue-950' : 'border-gray-100'} hover:bg-blue-50/50 disabled:hover:bg-transparent`
              }`}
            aria-selected={isSelected}
            onMouseEnter={() => setSelectionIndex(index)}
          >
            <div className="min-w-0">
              <p className={`truncate text-sm font-medium ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>{item.title}</p>
              <p className={`truncate text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{item.artist || 'Unknown artist'}</p>
              <ResultBadges darkMode={darkMode} item={item} />
            </div>
            <div className="flex items-center gap-3">
              <span className={`whitespace-nowrap uppercase tracking-wide ${popover ? 'text-[10px]' : 'text-xs'} ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
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
      <div className="mt-6 flex min-h-32 items-center justify-center">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="w-4 h-4 animate-spin" />
          Fetching results...
        </div>
      </div>
    );
  }

  if (!items?.length) {
    return (
      <div className="mt-6">
        <div className="flex flex-col items-center justify-center gap-3 py-8 text-center">
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
      className="mt-2 overflow-y-auto"
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
            className={`w-full border-b px-1 py-4 text-left transition last:border-b-0 sm:px-2 ${darkMode
              ? `${isSelected ? 'border-gray-800 bg-blue-500/10' : 'border-gray-800'} hover:bg-blue-500/5 disabled:hover:bg-transparent`
              : `${isSelected ? 'border-gray-100 bg-blue-50/80' : 'border-gray-100'} hover:bg-blue-50/50 disabled:hover:bg-transparent`
              }`}
            aria-selected={isSelected}
            onMouseEnter={() => setSelectionIndex(index)}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 space-y-1">
                <p className={`truncate text-sm font-semibold ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>{item.title}</p>
                <p className={`truncate text-xs ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>{item.artist || 'Unknown artist'}</p>
                <ResultBadges darkMode={darkMode} item={item} />
                {item.snippet && (
                  <p className={`line-clamp-2 text-xs ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                    {item.snippet}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-xs font-medium uppercase tracking-wide ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                  {providerName}
                </span>
                {isLoading && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
              </div>
            </div>
          </button>
        );
      })}
      {lowQualityResults.length > 0 && !showingLowQuality && (
        <div className={`w-full border-t px-1 py-3 sm:px-2 ${darkMode ? 'border-gray-800' : 'border-gray-100'}`}>
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
