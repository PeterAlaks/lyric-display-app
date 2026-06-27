import { ChevronDown, ChevronRight, ChevronUp, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const CanvasSearchPanel = ({
  closeSearchBar,
  currentMatchIndex,
  darkMode,
  handleClearSearch,
  handleNextMatch,
  handlePreviousMatch,
  handleReplaceAll,
  handleReplaceCurrent,
  handleReplaceValueChange,
  handleSearchInputChange,
  replaceInputRef,
  replaceValue,
  searchExpanded,
  searchInputRef,
  searchQuery,
  toggleSearchExpansion,
  totalMatches,
}) => {
  const panelClass = darkMode
    ? 'border-gray-800 bg-gray-900/95 text-gray-100'
    : 'border-gray-200 bg-white/95 text-gray-900';
  const inputClass = darkMode
    ? 'h-10 rounded-full border-gray-700/70 bg-gray-800/90 pl-10 pr-20 text-[13px] text-gray-100 placeholder:text-gray-500 focus-visible:border-blue-500/50 focus-visible:ring-blue-500/20'
    : 'h-10 rounded-full border-gray-200 bg-white pl-10 pr-20 text-[13px] text-gray-900 placeholder:text-gray-400 focus-visible:border-blue-500/40 focus-visible:ring-blue-500/15';
  const replaceInputClass = darkMode
    ? 'h-9 rounded-full border-gray-700/70 bg-gray-800/90 px-4 text-[13px] text-gray-100 placeholder:text-gray-500 focus-visible:border-blue-500/50 focus-visible:ring-blue-500/20'
    : 'h-9 rounded-full border-gray-200 bg-white px-4 text-[13px] text-gray-900 placeholder:text-gray-400 focus-visible:border-blue-500/40 focus-visible:ring-blue-500/15';
  const iconButtonClass = darkMode
    ? 'text-gray-400 hover:bg-blue-500/10 hover:text-blue-300 focus-visible:bg-blue-500/10 focus-visible:text-blue-300'
    : 'text-gray-500 hover:bg-blue-50 hover:text-blue-600 focus-visible:bg-blue-50 focus-visible:text-blue-600';

  return (
  <div className="absolute top-4 right-4 z-20 w-full max-w-sm pointer-events-auto">
    <div className={`relative rounded-2xl border p-3 shadow-xl backdrop-blur ${panelClass}`}>
      <div className="flex items-stretch gap-2">
        <button
          type="button"
          onClick={toggleSearchExpansion}
          className={`h-10 rounded-lg px-2.5 transition-all ${iconButtonClass}`}
          title="Expand for replace"
        >
          <ChevronRight className={`w-4 h-4 transition-transform ${searchExpanded ? 'rotate-90' : ''}`} />
        </button>
        <div className="flex-1">
          <div className="relative">
            <Search className={`absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`} />
            <Input
              ref={searchInputRef}
              type="text"
              placeholder="Search in canvas..."
              value={searchQuery}
              onChange={(e) => handleSearchInputChange(e.target.value)}
              className={inputClass}
            />
            <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-1">
              {searchQuery && totalMatches > 0 && (
                <>
                  <button
                    type="button"
                    onClick={handlePreviousMatch}
                    className={`p-1 rounded-md transition-all ${iconButtonClass}`}
                    title="Previous match"
                  >
                    <ChevronUp className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={handleNextMatch}
                    className={`p-1 rounded-md transition-all ${iconButtonClass}`}
                    title="Next match"
                  >
                    <ChevronDown className="w-4 h-4" />
                  </button>
                </>
              )}
              {searchQuery && (
                <button
                  type="button"
                  onClick={handleClearSearch}
                  className={`p-1 rounded-md transition-all ${iconButtonClass}`}
                  title="Clear search"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
          <div className={`mt-2 text-xs ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
            {searchQuery
              ? (totalMatches > 0
                ? `Result ${currentMatchIndex + 1} of ${totalMatches}`
                : 'No matches found')
              : 'Type to search this canvas'}
          </div>
          {searchExpanded && (
            <div className="mt-3 space-y-2">
              <Input
                ref={replaceInputRef}
                type="text"
                placeholder="Replace with..."
                value={replaceValue}
                onChange={(e) => handleReplaceValueChange(e.target.value)}
                className={replaceInputClass}
              />
              <div className="flex justify-end gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleReplaceCurrent}
                  disabled={!searchQuery || totalMatches === 0}
                  className={`${darkMode ? 'border-gray-700 text-gray-100 hover:bg-blue-500/10 hover:text-blue-300' : 'hover:bg-blue-50 hover:text-blue-600'} rounded-full text-xs`}
                >
                  Replace
                </Button>
                <Button
                  size="sm"
                  onClick={handleReplaceAll}
                  disabled={!searchQuery || totalMatches === 0}
                  className="rounded-full bg-blue-600 text-xs text-white hover:bg-blue-700"
                >
                  Replace All
                </Button>
              </div>
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={closeSearchBar}
          className={`h-10 rounded-lg px-2.5 transition-all ${iconButtonClass}`}
          title="Close search"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  </div>
  );
};

export default CanvasSearchPanel;
