import React, { useEffect, useMemo, useRef } from 'react';
import { Loader2, MonitorUp, Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tooltip } from '@/components/ui/tooltip';
import { SCRIPTURE_TRANSLATIONS } from '../../constants/scripture.js';
import useScriptureSearch from '../../hooks/useScriptureSearch.js';

// Memoized so typing in the search box (which re-renders ScripturePanel on
// every keystroke, well before the debounced result changes) doesn't force
// React to re-diff every verse row in long chapters (Psalm 119 has 176).
// Only the row(s) whose own props actually changed re-render.
const VerseRow = React.memo(function VerseRow({ verse, selected, darkMode, mutedTextClass, onToggle }) {
  return (
    <button
      type="button"
      data-verse={verse.verse}
      role="option"
      aria-selected={selected}
      onClick={() => onToggle(verse.verse)}
      className={`w-full text-left px-3 py-2 rounded-lg text-xs leading-5 transition-colors ${selected
        ? 'bg-blue-500 text-white'
        : darkMode
          ? 'bg-gray-800/80 text-gray-200 hover:bg-blue-500/10 hover:text-blue-300'
          : 'bg-gray-50 text-gray-700 hover:bg-blue-50 hover:text-blue-600'
        }`}
    >
      <sup className={`font-bold mr-1 text-[9px] ${selected ? 'text-blue-100' : mutedTextClass}`}>{verse.verse}</sup>
      {verse.text}
    </button>
  );
});

export default function ScripturePanel({ darkMode, translationId, onTranslationChange, onProject, projecting = false, expandedResults = false }) {
  const {
    query,
    setQuery,
    clearQuery,
    parsed,
    bookMatches,
    activeBook,
    chapter,
    result,
    selectedVerses,
    toggleVerse,
    clearSelection,
    selectAllVerses,
    applyBookSuggestion,
  } = useScriptureSearch({ translationId });

  const versesContainerRef = useRef(null);

  const selectedCount = selectedVerses.size;
  const hasResults = result.status === 'success' && result.verses.length > 0;
  const versesToProject = useMemo(() => {
    if (!hasResults) return [];
    if (selectedCount === 0) return result.verses;
    return result.verses.filter((verse) => selectedVerses.has(verse.verse));
  }, [hasResults, result.verses, selectedCount, selectedVerses]);

  const firstSelectedVerse = useMemo(() => {
    if (selectedCount === 0) return null;
    return Math.min(...[...selectedVerses]);
  }, [selectedCount, selectedVerses]);

  // Bring the first auto-highlighted verse into view when a verse search lands.
  useEffect(() => {
    if (firstSelectedVerse === null || !versesContainerRef.current) return;
    const row = versesContainerRef.current.querySelector(`[data-verse="${firstSelectedVerse}"]`);
    row?.scrollIntoView({ block: 'nearest' });
  }, [firstSelectedVerse, result]);

  const handleProject = () => {
    if (!hasResults || !activeBook || !chapter || versesToProject.length === 0) return;
    onProject({
      bookName: activeBook.name,
      chapter,
      verses: versesToProject,
      wholeChapter: versesToProject.length === result.verses.length,
      translationId,
      translationName: result.translationName,
    });
  };

  const inputToneClass = darkMode
    ? 'border-gray-700/70 bg-gray-800/90 text-white placeholder:text-gray-500 focus-visible:border-blue-500/50 focus-visible:ring-blue-500/20'
    : 'border-gray-200 bg-white text-gray-900 placeholder:text-gray-400 focus-visible:border-blue-500/40 focus-visible:ring-blue-500/15';
  const mutedTextClass = darkMode ? 'text-gray-400' : 'text-gray-500';
  const subtleButtonClass = darkMode
    ? 'text-gray-400 hover:text-blue-300 hover:bg-blue-500/10'
    : 'text-gray-500 hover:text-blue-600 hover:bg-blue-50';

  const showBookSuggestions = parsed && !chapter && bookMatches.length > 0;
  const showNoBookMatch = parsed && bookMatches.length === 0;
  const resultsHeightClass = 'max-h-[44vh]';

  return (
    <div className="mb-6">
      {/* Search bar */}
      <div className="relative mb-2">
        <Search className={`absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`} />
        <Input
          type="text"
          placeholder="Search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          aria-label="Search scripture"
          className={`w-full rounded-full border pl-10 pr-10 shadow-none transition-all h-10 text-[13px] ${inputToneClass}`}
        />
        {query && (
          <button
            type="button"
            onClick={clearQuery}
            title="Clear search"
            className={`absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 inline-flex items-center justify-center rounded-full transition-all ${subtleButtonClass}`}
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Translation selector — plain text with a chevron, no bounding box */}
      <div className="flex items-center mb-2 px-1">
        <Select value={translationId} onValueChange={onTranslationChange}>
          <SelectTrigger
            aria-label="Bible translation"
            className={`h-auto w-auto border-0 bg-transparent px-0 py-1 shadow-none gap-1 justify-start text-xs font-medium focus:ring-0 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}
          >
            <SelectValue placeholder="Translation" />
          </SelectTrigger>
          <SelectContent>
            {SCRIPTURE_TRANSLATIONS.map((translation) => (
              <SelectItem key={translation.id} value={translation.id}>
                {translation.abbreviation} — {translation.name}
                {translation.language !== 'English' ? ` (${translation.language})` : ''}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Results - hidden (not cleared) while formatting is shown, so they
          reappear as-is once formatting is hidden again. */}
      {expandedResults && (
      <div className="mb-3">
        {showNoBookMatch && (
          <p className={`text-xs px-1 ${mutedTextClass}`}>No book matches “{parsed.bookQuery}”.</p>
        )}

        {showBookSuggestions && (
          <div className={`${resultsHeightClass} overflow-y-auto space-y-1 pr-1`}>
            {bookMatches.slice(0, 10).map((book) => (
              <button
                key={book.name}
                type="button"
                onClick={() => applyBookSuggestion(book.name)}
                className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors ${darkMode
                  ? 'bg-gray-800/80 text-gray-200 hover:bg-blue-500/10 hover:text-blue-300'
                  : 'bg-gray-50 text-gray-700 hover:bg-blue-50 hover:text-blue-600'
                  }`}
              >
                {book.name}
                <span className={`ml-2 font-normal ${mutedTextClass}`}>
                  {book.chapters} chapter{book.chapters === 1 ? '' : 's'}
                </span>
              </button>
            ))}
          </div>
        )}

        {result.status === 'loading' && (
          <div className={`flex items-center gap-2 text-xs px-1 py-2 ${mutedTextClass}`}>
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Searching…
          </div>
        )}

        {result.status === 'error' && (
          <p className="text-xs px-1 py-2 text-red-500">{result.error}</p>
        )}

        {hasResults && (
          <>
            {bookMatches.length > 1 && (
              <div className="flex flex-wrap gap-1 mb-2">
                {bookMatches.slice(0, 6).map((book) => (
                  <button
                    key={book.name}
                    type="button"
                    onClick={() => applyBookSuggestion(book.name)}
                    className={`px-2 py-0.5 rounded-full text-[11px] font-medium transition-colors ${book.name === activeBook?.name
                      ? darkMode ? 'bg-white text-gray-900' : 'bg-black text-white'
                      : darkMode
                        ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                  >
                    {book.name}
                  </button>
                ))}
              </div>
            )}

            <div className={`flex items-center justify-between px-1 mb-1.5 text-xs ${mutedTextClass}`}>
              <span className="font-semibold truncate">
                {result.reference}
                {result.translationName ? ` · ${result.translationName}` : ''}
              </span>
              <span className="shrink-0 flex items-center gap-2 ml-2">
                {selectedCount > 0 ? `${selectedCount} of ${result.verses.length} selected` : `${result.verses.length} verses`}
                {selectedCount > 0 ? (
                  <button type="button" onClick={clearSelection} className={`underline-offset-2 hover:underline ${subtleButtonClass} !bg-transparent`}>
                    Clear
                  </button>
                ) : (
                  <button type="button" onClick={selectAllVerses} className={`underline-offset-2 hover:underline ${subtleButtonClass} !bg-transparent`}>
                    Select all
                  </button>
                )}
              </span>
            </div>

            <div ref={versesContainerRef} className={`${resultsHeightClass} overflow-y-auto space-y-1 pr-1`} role="listbox" aria-label="Search results" aria-multiselectable="true">
              {result.verses.map((verse) => (
                <VerseRow
                  key={verse.verse}
                  verse={verse}
                  selected={selectedVerses.has(verse.verse)}
                  darkMode={darkMode}
                  mutedTextClass={mutedTextClass}
                  onToggle={toggleVerse}
                />
              ))}
            </div>
          </>
        )}
      </div>
      )}

      {/* Project button */}
      {hasResults && (
        <Tooltip
          content={selectedCount > 0
            ? 'Send the highlighted verses to the main viewing area'
            : 'Send every verse in this chapter to the main viewing area'}
          side="right"
        >
          <button
            type="button"
            onClick={handleProject}
            disabled={projecting || versesToProject.length === 0}
            className="w-full py-3 px-4 bg-linear-to-r from-blue-400 to-purple-600 text-white rounded-2xl text-sm font-medium hover:from-blue-500 hover:to-purple-700 transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <MonitorUp className="w-4 h-4" />
            {selectedCount > 0
              ? `Project ${selectedCount} verse${selectedCount === 1 ? '' : 's'}`
              : 'Project chapter'}
          </button>
        </Tooltip>
      )}
    </div>
  );
}
