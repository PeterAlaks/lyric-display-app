import React from 'react';
import { Input } from "@/components/ui/input";
import { ChevronUp, ChevronDown, Search, X } from 'lucide-react';

const SearchBar = ({
  darkMode,
  searchQuery,
  onSearch,
  totalMatches,
  currentMatchIndex,
  onPrev,
  onNext,
  onClear,
  density = 'default',
}) => {
  const compact = density === 'dock' || density === 'compact';
  const inputHeightClass = compact ? 'h-8 text-xs' : 'h-10 text-[13px]';
  const inputToneClass = darkMode
    ? 'border-gray-700/70 bg-gray-800/90 text-white placeholder:text-gray-500 focus-visible:border-blue-500/50 focus-visible:ring-blue-500/20'
    : 'border-gray-200 bg-white text-gray-900 placeholder:text-gray-400 focus-visible:border-blue-500/40 focus-visible:ring-blue-500/15';
  const searchIconClass = darkMode ? 'text-gray-500' : 'text-gray-400';
  const actionButtonClass = `${compact ? 'h-6 w-6' : 'h-7 w-7'} inline-flex items-center justify-center rounded-full transition-all ${darkMode
    ? 'text-gray-400 hover:bg-blue-500/10 hover:text-blue-300 focus-visible:bg-blue-500/10 focus-visible:text-blue-300'
    : 'text-gray-500 hover:bg-blue-50 hover:text-blue-600 focus-visible:bg-blue-50 focus-visible:text-blue-600'
    }`;
  const actionIconClass = compact ? 'h-3.5 w-3.5' : 'h-4 w-4';

  return (
    <div className="w-full">
      <div className="relative">
        <Search className={`absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 ${searchIconClass}`} />
        <Input
          type="text"
          placeholder="Search loaded lyrics..."
          value={searchQuery}
          onChange={(e) => onSearch(e.target.value)}
          data-search-input
          className={`w-full rounded-full border pl-10 pr-24 shadow-none transition-all ${inputHeightClass} ${inputToneClass}`}
        />
        <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center gap-1">
          {searchQuery && totalMatches > 0 && (
            <>
              <button
                onClick={onPrev}
                className={actionButtonClass}
                title="Previous match (Shift+Up)"
              >
                <ChevronUp className={actionIconClass} />
              </button>
              <button
                onClick={onNext}
                className={actionButtonClass}
                title="Next match (Shift+Down)"
              >
                <ChevronDown className={actionIconClass} />
              </button>
            </>
          )}
          {searchQuery && (
            <button
              onClick={onClear}
              className={actionButtonClass}
              title="Clear search"
            >
              <X className={actionIconClass} />
            </button>
          )}
        </div>
      </div>

      {searchQuery && (
        <div className={`${compact ? 'mt-1 text-[10px]' : 'mt-2 text-xs'} ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
          {totalMatches > 0 ? (
            `Showing result ${currentMatchIndex + 1} of ${totalMatches} matches`
          ) : (
            'No matches found'
          )}
        </div>
      )}
    </div>
  );
};

export default SearchBar;
