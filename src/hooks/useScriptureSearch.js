import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  fetchScriptureChapter,
  matchBooks,
  parseScriptureQuery,
} from '../utils/scripture.js';

const SEARCH_DEBOUNCE_MS = 300;

const IDLE_RESULT = { status: 'idle', verses: [], reference: '', translationName: '', error: null };

/**
 * Debounced scripture reference search. Parses the query into
 * book/chapter/verse parts, fetches the matching chapter (cached), and keeps
 * track of which verses are highlighted for projection.
 */
export default function useScriptureSearch({ translationId }) {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [result, setResult] = useState(IDLE_RESULT);
  const [selectedVerses, setSelectedVerses] = useState(() => new Set());
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (!query.trim()) {
      setDebouncedQuery('');
      return undefined;
    }
    const timer = setTimeout(() => setDebouncedQuery(query), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  const parsed = useMemo(() => parseScriptureQuery(debouncedQuery), [debouncedQuery]);
  const bookMatches = useMemo(() => (parsed ? matchBooks(parsed.bookQuery) : []), [parsed]);
  const activeBook = bookMatches[0] || null;
  const chapter = parsed?.chapter ?? null;

  useEffect(() => {
    requestIdRef.current += 1;
    const requestId = requestIdRef.current;

    if (!parsed || !activeBook || !chapter) {
      setResult(IDLE_RESULT);
      return;
    }

    if (chapter < 1 || chapter > activeBook.chapters) {
      setResult({
        ...IDLE_RESULT,
        status: 'error',
        error: `${activeBook.name} has ${activeBook.chapters} chapter${activeBook.chapters === 1 ? '' : 's'}.`,
      });
      return;
    }

    setResult((previous) => ({ ...previous, status: 'loading', error: null }));
    fetchScriptureChapter({ translationId, bookName: activeBook.name, chapter })
      .then((data) => {
        if (requestIdRef.current !== requestId) return;
        setResult({
          status: 'success',
          verses: data.verses,
          reference: data.reference,
          translationName: data.translationName,
          error: null,
        });
      })
      .catch((error) => {
        if (requestIdRef.current !== requestId) return;
        setResult({
          ...IDLE_RESULT,
          status: 'error',
          error: error?.message || 'Could not load scripture. Check your connection.',
        });
      });
  }, [parsed, activeBook?.name, activeBook?.chapters, chapter, translationId]);

  // Auto-highlight the requested verse range; otherwise leave the selection
  // to the user.
  useEffect(() => {
    if (result.status !== 'success') {
      setSelectedVerses(new Set());
      return;
    }
    if (parsed?.verseStart) {
      const start = parsed.verseStart;
      const end = parsed.verseEnd ?? start;
      setSelectedVerses(new Set(
        result.verses
          .filter((verse) => verse.verse >= start && verse.verse <= end)
          .map((verse) => verse.verse)
      ));
    } else {
      setSelectedVerses(new Set());
    }
  }, [result, parsed?.verseStart, parsed?.verseEnd]);

  const toggleVerse = useCallback((verseNumber) => {
    setSelectedVerses((previous) => {
      const next = new Set(previous);
      if (next.has(verseNumber)) next.delete(verseNumber);
      else next.add(verseNumber);
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => setSelectedVerses(new Set()), []);

  const selectAllVerses = useCallback(() => {
    setSelectedVerses(new Set(result.verses.map((verse) => verse.verse)));
  }, [result.verses]);

  const clearQuery = useCallback(() => {
    setQuery('');
    setDebouncedQuery('');
  }, []);

  const applyBookSuggestion = useCallback((bookName) => {
    const suffix = parsed?.chapter
      ? ` ${parsed.chapter}${parsed.verseStart ? `:${parsed.verseStart}${parsed.verseEnd && parsed.verseEnd !== parsed.verseStart ? `-${parsed.verseEnd}` : ''}` : ''}`
      : ' ';
    const nextQuery = `${bookName}${suffix}`;
    setQuery(nextQuery);
    setDebouncedQuery(nextQuery);
  }, [parsed]);

  return {
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
  };
}
