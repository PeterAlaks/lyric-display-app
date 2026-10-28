import React from 'react';
import { AlertTriangle, ArrowDown, ArrowUp, ChevronDown, Combine, Plus, Repeat, SplitSquareVertical, Trash2, X } from 'lucide-react';
import { Tooltip } from '@/components/ui/tooltip';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';
import { getSectionHotkey } from '../../../shared/lyricsParsing/sections.js';

export const ROLE_STYLES = {
  lyric: { label: 'Lyric', light: 'bg-gray-100 text-gray-600', dark: 'bg-gray-700 text-gray-300' },
  translation: { label: 'Translation', light: 'bg-amber-100 text-amber-800', dark: 'bg-amber-400/15 text-amber-200' },
  stage: { label: 'Stage only', light: 'bg-violet-100 text-violet-700', dark: 'bg-violet-400/15 text-violet-200' },
};

const NEXT_ROLE = { lyric: 'translation', translation: 'stage', stage: 'lyric' };

const iconButtonClass = (darkMode, disabled = false) => `inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors ${disabled
  ? 'cursor-not-allowed opacity-35'
  : darkMode ? 'text-gray-400 hover:bg-gray-700 hover:text-gray-100' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-800'
  }`;

// Type any section name, or open the list to pick one of your section titles.
function SectionNameField({ value, options, darkMode, openRequested, onOpenHandled, onChange }) {
  const [open, setOpen] = React.useState(false);
  const inputRef = React.useRef(null);
  const query = value.trim().toLowerCase();
  const matches = query ? options.filter((option) => option.toLowerCase().includes(query)) : options;

  React.useEffect(() => {
    if (!openRequested) return;
    inputRef.current?.focus();
    setOpen(true);
    onOpenHandled?.();
  }, [onOpenHandled, openRequested]);

  return (
    <Popover open={open && matches.length > 0} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <div className={`flex min-w-0 max-w-xs flex-1 items-center rounded-md border transition-colors focus-within:ring-2 ${darkMode
          ? 'border-gray-600 bg-gray-900/60 focus-within:border-blue-500/60 focus-within:ring-blue-500/15'
          : 'border-gray-300 bg-white focus-within:border-blue-400 focus-within:ring-blue-500/10'
          }`}>
          <input
            ref={inputRef}
            value={value}
            onChange={(event) => {
              onChange(event.target.value);
              setOpen(true);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Escape' || event.key === 'Enter') setOpen(false);
              if (event.key === 'ArrowDown') setOpen(true);
            }}
            placeholder="Name this section"
            aria-label="Section name"
            className={`min-w-0 flex-1 bg-transparent px-2.5 py-1 text-sm font-semibold outline-none ${darkMode ? 'text-gray-100 placeholder-gray-500' : 'text-gray-800 placeholder-gray-400'}`}
          />
          <button
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              setOpen((current) => !current);
              inputRef.current?.focus();
            }}
            aria-label="Choose a section name"
            className={`flex h-7 w-7 shrink-0 items-center justify-center border-l ${darkMode ? 'border-gray-600 text-gray-400 hover:text-gray-100' : 'border-gray-300 text-gray-500 hover:text-gray-800'}`}
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
        </div>
      </PopoverAnchor>
      <PopoverContent
        align="start"
        onOpenAutoFocus={(event) => event.preventDefault()}
        className={`max-h-64 w-56 overflow-y-auto p-1 ${darkMode ? 'border-gray-700 bg-gray-800 text-gray-100' : 'border-gray-200 bg-white text-gray-800'}`}
      >
        {matches.map((option) => (
          <button
            key={option}
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              onChange(option);
              setOpen(false);
            }}
            className={`block w-full rounded px-2.5 py-1.5 text-left text-sm ${option === value
              ? 'bg-blue-600 text-white'
              : darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
              }`}
          >
            {option}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

function LineRow({ line, darkMode, registerInput, onChange, onKeyDown, onPaste, onFocus, onRemove }) {
  const role = ROLE_STYLES[line.role] ? line.role : 'lyric';
  const style = ROLE_STYLES[role];

  return (
    <div className={`group/line flex items-center gap-2 ${role === 'translation' ? 'pl-5' : ''}`}>
      <Tooltip content="Change line role (Lyric, Translation, Stage only)" side="left">
        <button
          type="button"
          onClick={() => onChange(line.id, { role: NEXT_ROLE[role] })}
          className={`w-21 shrink-0 rounded px-1.5 py-1 text-[9px] font-bold uppercase tracking-[0.1em] ${darkMode ? style.dark : style.light}`}
        >
          {style.label}
        </button>
      </Tooltip>
      <input
        ref={(element) => registerInput(line.id, element)}
        value={line.text}
        onChange={(event) => onChange(line.id, { text: event.target.value }, { coalesce: true })}
        onKeyDown={(event) => onKeyDown(event, line)}
        onPaste={(event) => onPaste(event, line)}
        onFocus={() => onFocus(line)}
        placeholder={role === 'translation' ? 'Translation of the line above' : role === 'stage' ? 'Note for the stage display only' : 'Type a lyric line'}
        spellCheck
        className={`min-w-0 flex-1 rounded-md border bg-transparent px-2.5 py-1.5 text-[15px] outline-none transition-colors focus:ring-2 ${role === 'translation' ? 'italic' : ''} ${role === 'stage' ? 'font-mono text-[13px]' : ''} ${darkMode
          ? 'border-transparent text-gray-100 placeholder-gray-600 hover:border-gray-700 focus:border-blue-500/60 focus:ring-blue-500/15'
          : 'border-transparent text-gray-900 placeholder-gray-400 hover:border-gray-200 focus:border-blue-400 focus:ring-blue-500/10'
          }`}
      />
      <button
        type="button"
        onClick={() => onRemove(line.id)}
        aria-label="Remove line"
        className={`${iconButtonClass(darkMode)} opacity-0 group-hover/line:opacity-100 focus-visible:opacity-100`}
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export default function SongEditorSection({
  section,
  index,
  total,
  darkMode,
  sectionOptions,
  openNameRequested,
  onNameOpenHandled,
  isLabelRecognized,
  selectedSlideId,
  getSlideIssues,
  registerInput,
  onLabelChange,
  onAddSectionTitle,
  onMove,
  onRemove,
  onAddSlide,
  onAddLine,
  onLineChange,
  onLineKeyDown,
  onLinePaste,
  onLineFocus,
  onStartSectionAtSlide,
  onRemoveLine,
  onMergeSlide,
  onRemoveSlide,
}) {
  const label = section.label || '';
  const hotkey = getSectionHotkey(label);
  const showLabelWarning = label.trim() && !isLabelRecognized;
  const labelBase = label.split(':')[0].replace(/\s+\d+$/, '').trim();

  return (
    <section
      className={`rounded-xl border ${darkMode ? 'border-gray-700 bg-gray-800/60' : 'border-gray-200 bg-white'}`}
      aria-label={label || 'Untitled section'}
    >
      <header className={`flex items-center gap-2 border-b px-3 py-2 ${darkMode ? 'border-gray-700' : 'border-gray-100'}`}>
        <SectionNameField
          value={label}
          options={sectionOptions}
          darkMode={darkMode}
          openRequested={openNameRequested}
          onOpenHandled={onNameOpenHandled}
          onChange={(nextLabel) => onLabelChange(section.id, nextLabel)}
        />
        <span className="flex-1" />
        {hotkey && (
          <Tooltip content={`Jump here live with Shift+${hotkey}`} side="top">
            <kbd className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold ${darkMode ? 'bg-gray-700 text-gray-400' : 'bg-gray-100 text-gray-500'}`}>⇧{hotkey}</kbd>
          </Tooltip>
        )}
        <button type="button" onClick={() => onMove(section.id, -1)} disabled={index === 0} aria-label="Move section up" className={iconButtonClass(darkMode, index === 0)}>
          <ArrowUp className="h-3.5 w-3.5" />
        </button>
        <button type="button" onClick={() => onMove(section.id, 1)} disabled={index === total - 1} aria-label="Move section down" className={iconButtonClass(darkMode, index === total - 1)}>
          <ArrowDown className="h-3.5 w-3.5" />
        </button>
        <button type="button" onClick={() => onRemove(section.id)} aria-label="Remove section" className={iconButtonClass(darkMode)}>
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </header>

      {showLabelWarning && (
        <div className={`flex flex-wrap items-center gap-2 px-3 py-2 text-xs ${darkMode ? 'bg-amber-400/10 text-amber-200' : 'bg-amber-50 text-amber-800'}`}>
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          <span className="min-w-0 flex-1">“{labelBase}” isn’t in your section titles, so the control panel would show it as a lyric line.</span>
          {labelBase && (
            <button type="button" onClick={() => onAddSectionTitle(labelBase)} className="font-semibold underline underline-offset-2">
              Add to section titles
            </button>
          )}
        </div>
      )}

      <div className="space-y-2 p-3">
        {section.repeat && section.slides.length === 0 && (
          <div className={`flex items-center gap-2 rounded-lg border border-dashed px-3 py-2 text-xs ${darkMode ? 'border-gray-600 text-gray-400' : 'border-gray-300 text-gray-500'}`}>
            <Repeat className="h-3.5 w-3.5" />
            Repeats the earlier “{label}” section.
          </div>
        )}

        {section.slides.map((slide, slideIndex) => {
          const issues = getSlideIssues(slide);
          const selected = slide.id === selectedSlideId;
          return (
            <div
              key={slide.id}
              className={`rounded-lg border p-2 transition-colors ${selected
                ? darkMode ? 'border-blue-500/50 bg-gray-900/60' : 'border-blue-300 bg-blue-50/40'
                : darkMode ? 'border-gray-700/80 bg-gray-900/30' : 'border-gray-200 bg-gray-50/60'
                }`}
            >
              <div className="mb-1 flex items-center justify-between gap-2 px-1">
                <span className={`text-[10px] font-semibold uppercase tracking-[0.14em] ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                  Slide {slideIndex + 1}
                </span>
                <div className="flex items-center gap-0.5">
                  <Tooltip content={slideIndex === 0 ? 'Name this section' : 'Start a new section at this slide'} side="top">
                    <button type="button" onClick={() => onStartSectionAtSlide(slide.id)} aria-label="Section starts here" className={iconButtonClass(darkMode)}>
                      <SplitSquareVertical className="h-3.5 w-3.5" />
                    </button>
                  </Tooltip>
                  {slideIndex > 0 && (
                    <Tooltip content="Merge into the slide above" side="top">
                      <button type="button" onClick={() => onMergeSlide(slide.id)} aria-label="Merge with previous slide" className={iconButtonClass(darkMode)}>
                        <Combine className="h-3.5 w-3.5" />
                      </button>
                    </Tooltip>
                  )}
                  <Tooltip content="Delete this slide" side="top">
                    <button type="button" onClick={() => onRemoveSlide(slide.id)} aria-label="Delete slide" className={iconButtonClass(darkMode)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </Tooltip>
                </div>
              </div>

              <div className="space-y-1">
                {slide.lines.map((line) => (
                  <LineRow
                    key={line.id}
                    line={line}
                    darkMode={darkMode}
                    registerInput={registerInput}
                    onChange={onLineChange}
                    onKeyDown={onLineKeyDown}
                    onPaste={onLinePaste}
                    onFocus={(focusedLine) => onLineFocus(focusedLine, slide)}
                    onRemove={onRemoveLine}
                  />
                ))}
              </div>

              <div className="mt-1.5 flex flex-wrap items-center gap-1 px-1">
                <button
                  type="button"
                  onClick={() => onAddLine(slide.lines[slide.lines.length - 1]?.id, 'lyric')}
                  className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium ${darkMode ? 'text-gray-400 hover:bg-gray-700 hover:text-gray-100' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-800'}`}
                >
                  <Plus className="h-3 w-3" /> Line
                </button>
                <button
                  type="button"
                  onClick={() => onAddLine(slide.lines[slide.lines.length - 1]?.id, 'translation')}
                  className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium ${darkMode ? 'text-gray-400 hover:bg-gray-700 hover:text-gray-100' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-800'}`}
                >
                  <Plus className="h-3 w-3" /> Translation
                </button>
                {issues.length > 0 && (
                  <span className={`ml-auto inline-flex items-center gap-1 text-[11px] ${darkMode ? 'text-amber-300' : 'text-amber-700'}`}>
                    <AlertTriangle className="h-3 w-3" />
                    {issues[0]}
                  </span>
                )}
              </div>
            </div>
          );
        })}

        <button
          type="button"
          onClick={() => onAddSlide(section.id)}
          className={`flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed py-2 text-xs font-medium transition-colors ${darkMode
            ? 'border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-200'
            : 'border-gray-300 text-gray-500 hover:border-gray-400 hover:text-gray-800'
            }`}
        >
          <Plus className="h-3.5 w-3.5" /> Add slide
        </button>
      </div>
    </section>
  );
}
