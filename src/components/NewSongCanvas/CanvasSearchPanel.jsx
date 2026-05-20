import { ChevronDown, ChevronRight, ChevronUp, X } from 'lucide-react';
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
}) => (
  <div className="absolute top-4 right-4 z-20 w-full max-w-sm pointer-events-auto">
    <div className={`relative rounded-lg border shadow-lg p-3 ${darkMode ? 'bg-gray-900/95 border-gray-700' : 'bg-white border-gray-200'}`}>
      <div className="flex items-stretch gap-2">
        <button
          type="button"
          onClick={toggleSearchExpansion}
          className={`px-2.5 rounded-md border transition-colors h-10 ${darkMode
            ? 'border-gray-700 text-gray-300 hover:bg-gray-800'
            : 'border-gray-200 text-gray-600 hover:bg-gray-100'
            }`}
          title="Expand for replace"
        >
          <ChevronRight className={`w-4 h-4 transition-transform ${searchExpanded ? 'rotate-90' : ''}`} />
        </button>
        <div className="flex-1">
          <div className="relative">
            <Input
              ref={searchInputRef}
              type="text"
              placeholder="Search in canvas..."
              value={searchQuery}
              onChange={(e) => handleSearchInputChange(e.target.value)}
              className={`pr-20 text-sm h-10 ${darkMode
                ? 'border-gray-700 bg-gray-800 text-gray-100 placeholder-gray-400'
                : 'border-gray-300 bg-white text-gray-900 placeholder-gray-500'
                }`}
            />
            <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-1">
              {searchQuery && totalMatches > 0 && (
                <>
                  <button
                    type="button"
                    onClick={handlePreviousMatch}
                    className={`p-1 rounded transition-colors ${darkMode
                      ? 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
                      : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                      }`}
                    title="Previous match"
                  >
                    <ChevronUp className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={handleNextMatch}
                    className={`p-1 rounded transition-colors ${darkMode
                      ? 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
                      : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                      }`}
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
                  className={`p-1 rounded transition-colors ${darkMode
                    ? 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                    }`}
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
                className={`text-sm ${darkMode
                  ? 'border-gray-700 bg-gray-800 text-gray-100 placeholder-gray-400'
                  : 'border-gray-300 bg-white text-gray-900 placeholder-gray-500'
                  }`}
              />
              <div className="flex justify-end gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleReplaceCurrent}
                  disabled={!searchQuery || totalMatches === 0}
                  className={`${darkMode ? 'border-gray-600 text-gray-100 hover:bg-gray-800' : ''} text-xs`}
                >
                  Replace
                </Button>
                <Button
                  size="sm"
                  onClick={handleReplaceAll}
                  disabled={!searchQuery || totalMatches === 0}
                  className="bg-blue-500 text-white hover:bg-blue-600 text-xs"
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
          className={`px-2.5 rounded-md border transition-colors h-10 ${darkMode
            ? 'border-gray-700 text-gray-300 hover:bg-gray-800'
            : 'border-gray-200 text-gray-600 hover:bg-gray-100'
            }`}
          title="Close search"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  </div>
);

export default CanvasSearchPanel;
