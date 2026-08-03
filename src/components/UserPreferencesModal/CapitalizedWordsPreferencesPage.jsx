import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Check, Edit, Plus, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  MAX_CAPITALIZED_WORD_LENGTH,
  normalizeCapitalizedWord,
  normalizeCapitalizedWords,
} from '../../../shared/capitalizedWords.js';

const CapitalizedWordsPreferencesPage = ({
  darkMode,
  labelClass,
  mutedClass,
  onBack,
  onWordsChange,
  showModal,
  words,
}) => {
  const normalizedWords = useMemo(() => normalizeCapitalizedWords(words), [words]);
  const [editingIndex, setEditingIndex] = useState(null);
  const [isAdding, setIsAdding] = useState(false);
  const [draft, setDraft] = useState('');
  const [draftError, setDraftError] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (isAdding || editingIndex !== null) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editingIndex, isAdding]);

  const resetEditor = () => {
    setEditingIndex(null);
    setIsAdding(false);
    setDraft('');
    setDraftError('');
  };

  const startAdding = () => {
    setEditingIndex(null);
    setIsAdding(true);
    setDraft('');
    setDraftError('');
  };

  const startEditing = (index) => {
    setIsAdding(false);
    setEditingIndex(index);
    setDraft(normalizedWords[index]);
    setDraftError('');
  };

  const saveDraft = () => {
    if (!draft.trim()) {
      setDraftError('Enter a word or phrase.');
      return;
    }

    const normalized = normalizeCapitalizedWord(draft);
    if (!normalized) {
      setDraftError(`Use up to ${MAX_CAPITALIZED_WORD_LENGTH} letters, numbers, spaces, apostrophes, or hyphens.`);
      return;
    }

    const duplicateIndex = normalizedWords.findIndex((word, index) => (
      index !== editingIndex && word.toLocaleLowerCase() === normalized.toLocaleLowerCase()
    ));
    if (duplicateIndex !== -1) {
      setDraftError('That word or phrase is already in the list.');
      return;
    }

    if (isAdding) {
      onWordsChange([...normalizedWords, normalized]);
    } else if (editingIndex !== null) {
      const nextWords = [...normalizedWords];
      nextWords[editingIndex] = normalized;
      onWordsChange(nextWords);
    }
    resetEditor();
  };

  const handleDelete = async (index) => {
    const word = normalizedWords[index];
    const confirmation = await showModal({
      title: `Delete ${word}?`,
      description: 'This word will no longer be automatically capitalized during lyric cleanup.',
      variant: 'destructive',
      size: 'sm',
      actions: [
        {
          label: 'Cancel',
          value: 'cancel',
          variant: 'outline',
        },
        {
          label: 'Delete',
          value: 'delete',
          variant: 'destructive',
          autoFocus: true,
        },
      ],
    });

    if (confirmation !== 'delete') return;

    onWordsChange(normalizedWords.filter((_entry, entryIndex) => entryIndex !== index));
    if (editingIndex === index) {
      resetEditor();
    } else if (editingIndex !== null && index < editingIndex) {
      setEditingIndex(editingIndex - 1);
    }
  };

  const renderInlineEditor = ({ isNew = false } = {}) => (
    <form
      className="flex min-h-10 items-center justify-between gap-3 px-3 py-1.5"
      onSubmit={(event) => {
        event.preventDefault();
        saveDraft();
      }}
    >
      <div className="min-w-0 flex-1">
        <input
          ref={inputRef}
          value={draft}
          maxLength={MAX_CAPITALIZED_WORD_LENGTH}
          aria-label={isNew ? 'New capitalized word' : 'Edit capitalized word'}
          aria-invalid={Boolean(draftError)}
          title={draftError || undefined}
          onChange={(event) => {
            setDraft(event.target.value);
            if (draftError) setDraftError('');
          }}
          className={`w-full border-0 bg-transparent p-0 text-xs font-medium outline-none ring-0 focus:outline-none focus:ring-0 ${draftError ? 'text-red-500' : labelClass}`}
          placeholder={isNew ? 'Enter a word or phrase' : undefined}
        />
        {draftError && <p className="mt-0.5 truncate text-[10px] text-red-500" role="alert">{draftError}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Button type="submit" size="sm" variant="ghost" className="h-7 gap-1 px-2 text-[11px]">
          <Check className="h-3 w-3" />
          Save
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={resetEditor}
          className="h-7 gap-1 px-2 text-[11px]"
        >
          <X className="h-3 w-3" />
          Cancel
        </Button>
      </div>
    </form>
  );

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={onBack}
            aria-label="Back to Lyrics Formatting"
            className="h-7 w-7 shrink-0"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
          </Button>
          <div className="min-w-0">
            <h3 className={`truncate text-base font-semibold ${labelClass}`}>Capitalized Words</h3>
            <p className={`text-[11px] ${mutedClass}`}>{normalizedWords.length} {normalizedWords.length === 1 ? 'entry' : 'entries'}</p>
          </div>
        </div>
        <Button
          type="button"
          size="sm"
          onClick={startAdding}
          disabled={isAdding}
          className="shrink-0 gap-1.5"
        >
          <Plus className="h-3.5 w-3.5" />
          Add new word
        </Button>
      </div>

      <p className={`mb-3 text-[11px] ${mutedClass}`}>
        These words and phrases are title-cased when Capitalize Religious Terms is enabled.
      </p>

      <div className={`overflow-hidden rounded-lg border ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
        {isAdding && (
          <div className={darkMode ? 'border-b border-gray-700' : 'border-b border-gray-200'}>
            {renderInlineEditor({ isNew: true })}
          </div>
        )}

        {normalizedWords.length === 0 && !isAdding ? (
          <div className="px-3 py-7 text-center">
            <p className={`text-xs font-medium ${labelClass}`}>No capitalized words</p>
            <p className={`mt-1 text-[11px] ${mutedClass}`}>Add a word or phrase to use it during lyric cleanup.</p>
          </div>
        ) : (
          <div className={`divide-y ${darkMode ? 'divide-gray-700' : 'divide-gray-200'}`}>
            {normalizedWords.map((word, index) => (
              <React.Fragment key={`${word}-${index}`}>
                {editingIndex === index ? (
                  renderInlineEditor()
                ) : (
                  <div className="flex min-h-10 items-center justify-between gap-3 px-3 py-1.5">
                    <span className={`min-w-0 truncate text-xs font-medium ${labelClass}`}>{word}</span>
                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => startEditing(index)}
                        className="h-7 gap-1 px-2 text-[11px]"
                      >
                        <Edit className="h-3 w-3" />
                        Edit
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(index)}
                        className={`h-7 gap-1 px-2 text-[11px] ${darkMode ? 'text-red-400 hover:bg-red-950/40 hover:text-red-300' : 'text-red-600 hover:bg-red-50 hover:text-red-700'}`}
                      >
                        <Trash2 className="h-3 w-3" />
                        Delete
                      </Button>
                    </div>
                  </div>
                )}
              </React.Fragment>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default CapitalizedWordsPreferencesPage;
