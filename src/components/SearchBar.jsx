import React from 'react';
import { Input } from "@/components/ui/input";
import { ChevronUp, ChevronDown, X } from 'lucide-react';

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
  return (
    <div className="w-full">
      <div className="relative">
        <Input
          type="text"
          placeholder="Search loaded lyrics..."
          value={searchQuery}
          onChange={(e) => onSearch(e.target.value)}
          data-search-input
          className={`border rounded-md w-full pr-24 ${compact ? 'h-8 text-xs' : ''} ${darkMode
            ? 'border-gray-600 bg-gray-800 text-white placeholder-gray-400'
            : 'border-gray-300 bg-white'
            }`}
        />
        <div className="absolute right-1 top-1/2 transform -translate-y-1/2 flex items-center gap-1">
          {searchQuery && totalMatches > 0 && (
            <>
              <button
                onClick={onPrev}
                className={`${compact ? 'p-0.5' : 'p-1'} rounded transition-colors ${darkMode
                  ? 'text-gray-400 hover:text-gray-200 hover:bg-gray-700'
                  : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                  }`}
                title="Previous match (Shift+Up)"
              >
                <ChevronUp className={compact ? 'w-3.5 h-3.5' : 'w-4 h-4'} />
              </button>
              <button
                onClick={onNext}
                className={`${compact ? 'p-0.5' : 'p-1'} rounded transition-colors ${darkMode
                  ? 'text-gray-400 hover:text-gray-200 hover:bg-gray-700'
                  : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                  }`}
                title="Next match (Shift+Down)"
              >
                <ChevronDown className={compact ? 'w-3.5 h-3.5' : 'w-4 h-4'} />
              </button>
            </>
          )}
          {searchQuery && (
            <button
              onClick={onClear}
              className={`${compact ? 'p-0.5' : 'p-1'} rounded transition-colors ${darkMode
                ? 'text-gray-400 hover:text-gray-200 hover:bg-gray-700'
                : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                }`}
              title="Clear search"
            >
              <X className={compact ? 'w-3.5 h-3.5' : 'w-4 h-4'} />
            </button>
          )}
        </div>
      </div>

      {searchQuery && (
        <div className={`${compact ? 'mt-1 text-[11px]' : 'mt-2 text-sm'} ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
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
