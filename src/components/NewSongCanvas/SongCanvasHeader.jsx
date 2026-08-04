import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  ChevronDown,
  ClipboardCopy,
  ClipboardPaste,
  Copy,
  CopyPlus,
  FilePlusCorner,
  FileText,
  FolderOpen,
  Languages,
  ListOrdered,
  Redo,
  Save,
  Scissors,
  Search,
  Tags,
  Timer,
  Undo,
  Wand2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tooltip } from '@/components/ui/tooltip';
import { METADATA_OPTIONS, SONG_SECTIONS } from '../../constants/songCanvas';

const titleText = (composeMode, editMode) => {
  if (composeMode) return 'Compose Lyrics';
  return editMode ? 'Edit Lyrics File' : 'New Lyrics File';
};

const HelpButton = ({ darkMode, showModal }) => (
  <button
    onClick={() => {
      showModal({
        title: 'Song Canvas Help',
        headerDescription: 'Professional lyrics editor with powerful formatting tools',
        component: 'SongCanvasHelp',
        variant: 'info',
        size: 'large',
        dismissLabel: 'Got it'
      });
    }}
    className={`rounded-lg p-1.5 transition-all ${darkMode
      ? 'bg-transparent text-gray-400 hover:bg-blue-500/10 hover:text-blue-300 focus-visible:bg-blue-500/10 focus-visible:text-blue-300'
      : 'bg-transparent text-gray-500 hover:bg-blue-50 hover:text-blue-600 focus-visible:bg-blue-50 focus-visible:text-blue-600'
      }`}
    title="Song Canvas Help"
    aria-label="Open lyrics canvas help"
  >
    <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  </button>
);

const SaveActions = ({
  composeMode,
  editMode,
  getSaveAndLoadButtonTooltip,
  getSaveButtonTooltip,
  handleLoadDraft,
  handleSave,
  handleSaveAndLoad,
  hasUnsavedChanges,
  isContentEmpty,
  isTitleEmpty,
  toolbarGhostClass,
}) => {
  const disabled = isContentEmpty || isTitleEmpty || (editMode && !hasUnsavedChanges);
  const gradientActionClass = 'flex items-center gap-1.5 rounded-full bg-linear-to-r from-blue-400 to-purple-600 px-3 py-1.5 text-[11px] font-semibold text-white transition-all duration-200 hover:from-blue-500 hover:to-purple-700 disabled:from-gray-400 disabled:to-gray-500 disabled:text-white disabled:opacity-55';

  if (composeMode) {
    return (
      <Tooltip content={getSaveAndLoadButtonTooltip()} side="bottom">
        <span className="inline-block">
          <Button
            onClick={handleLoadDraft}
            disabled={isContentEmpty || isTitleEmpty}
            className={gradientActionClass}
            size="sm"
          >
            <FolderOpen className="h-4 w-4" /> Load Draft
          </Button>
        </span>
      </Tooltip>
    );
  }

  return (
    <>
      <Tooltip content={getSaveButtonTooltip()} side="bottom">
        <span className="inline-block">
          <Button
            onClick={handleSave}
            disabled={disabled}
            variant="ghost"
            size="sm"
            title="Save"
            className={`${toolbarGhostClass} text-[11px] font-semibold`}
          >
            <Save className="h-4 w-4" /> Save
          </Button>
        </span>
      </Tooltip>
      <Tooltip content={getSaveAndLoadButtonTooltip()} side="bottom">
        <span className="inline-block">
          <Button
            onClick={handleSaveAndLoad}
            disabled={disabled}
            className={gradientActionClass}
            size="sm"
          >
            <FolderOpen className="h-4 w-4" /> Save &amp; Load
          </Button>
        </span>
      </Tooltip>
    </>
  );
};

const IconAction = ({
  active = false,
  ariaLabel,
  children,
  darkMode,
  disabled = false,
  onClick,
  title,
  toolbarGhostClass,
}) => (
  <Tooltip content={title} side="bottom">
    <Button
      type="button"
      onClick={onClick}
      disabled={disabled}
      variant="ghost"
      size="sm"
      className={`h-8 w-8 shrink-0 p-0 ${toolbarGhostClass} ${active
        ? (darkMode ? 'bg-blue-500/15 text-blue-300' : 'bg-blue-100 text-blue-700')
        : ''}`}
      title={title}
      aria-label={ariaLabel || title}
      aria-pressed={active || undefined}
    >
      {children}
    </Button>
  </Tooltip>
);

const ToolbarDropdown = ({
  align = 'left',
  darkMode,
  disabled = false,
  icon: Icon,
  id,
  items,
  label,
  openMenu,
  setOpenMenu,
  toolbarGhostClass,
}) => {
  const open = openMenu === id;
  const menuClass = darkMode
    ? 'border-gray-700/90 bg-gray-900/98 text-gray-100 shadow-black/35'
    : 'border-gray-200 bg-white/98 text-gray-800 shadow-slate-900/15';
  const itemClass = darkMode
    ? 'text-gray-200 hover:bg-blue-500/10 hover:text-blue-200 focus-visible:bg-blue-500/10'
    : 'text-gray-700 hover:bg-blue-50 hover:text-blue-700 focus-visible:bg-blue-50';

  return (
    <div className="relative" data-song-canvas-menu>
      <Tooltip content={label} side="bottom">
        <Button
          type="button"
          onClick={() => setOpenMenu((current) => current === id ? null : id)}
          disabled={disabled}
          variant="ghost"
          size="sm"
          className={`h-8 min-w-8 shrink-0 gap-0.5 px-1.5 ${toolbarGhostClass} ${open
            ? (darkMode ? 'bg-blue-500/15 text-blue-300' : 'bg-blue-100 text-blue-700')
            : ''}`}
          title={label}
          aria-label={label}
          aria-haspopup="menu"
          aria-expanded={open}
        >
          <Icon className="h-4 w-4" />
          <ChevronDown className={`h-3 w-3 transition-transform ${open ? 'rotate-180' : ''}`} />
        </Button>
      </Tooltip>

      {open && (
        <div
          className={`absolute top-full z-50 mt-2 max-h-80 min-w-52 overflow-y-auto rounded-xl border py-1.5 text-[13px] shadow-xl backdrop-blur-xl ${align === 'right' ? 'right-0' : 'left-0'} ${menuClass}`}
          role="menu"
        >
          {items.map((item, index) => item.separator ? (
            <div
              key={`separator-${index}`}
              className={`my-1 h-px ${darkMode ? 'bg-gray-700/80' : 'bg-gray-200'}`}
              role="separator"
            />
          ) : (
            <button
              key={item.key || item.label}
              type="button"
              disabled={item.disabled}
              onClick={() => {
                item.onSelect();
                setOpenMenu(null);
              }}
              className={`flex w-full items-center gap-2.5 px-3 py-2 text-left outline-none transition-colors ${item.emphasis ? 'font-semibold' : ''} ${item.disabled ? 'cursor-not-allowed opacity-45' : itemClass}`}
              role="menuitem"
            >
              {item.icon ? <item.icon className="h-4 w-4 shrink-0 opacity-75" /> : null}
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const ActionGroup = ({ children, darkMode }) => (
  <div className={`flex items-center gap-1 rounded-xl border p-1 ${darkMode
    ? 'border-gray-700/70 bg-gray-950/30'
    : 'border-slate-200/90 bg-white/80 shadow-sm'
    }`}>
    {children}
  </div>
);

const SongCanvasHeader = ({
  activeLineHasTimestamp,
  activeLineIndex,
  canAddTranslationOnActiveLine,
  canRedo,
  canUndo,
  composeMode,
  darkMode,
  editMode,
  getSaveAndLoadButtonTooltip,
  getSaveButtonTooltip,
  handleAddDefaultTags,
  handleAddTranslationAtActiveLine,
  handleBack,
  handleCleanup,
  handleCopy,
  handleCopyActiveLine,
  handleCut,
  handleDuplicateActiveLine,
  handleLoadDraft,
  handlePaste,
  handleRedo,
  handleSave,
  handleSaveAndLoad,
  handleSearchButtonClick,
  handleStartNewSong,
  handleTitleChange,
  handleUndo,
  hasUnsavedChanges,
  insertEnhancedTimestampAtActiveLine,
  insertMetadataAtActiveLine,
  insertSectionAtCursor,
  insertStandardTimestampAtActiveLine,
  isContentEmpty,
  isCursorAtEligiblePosition,
  isTitleEmpty,
  isTitlePrefilled,
  searchBarVisible,
  showModal,
  title,
  toolbarGhostClass,
}) => {
  const [openMenu, setOpenMenu] = useState(null);

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (!event.target.closest?.('[data-song-canvas-menu]')) {
        setOpenMenu(null);
      }
    };
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setOpenMenu(null);
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const navButtonClass = darkMode
    ? 'bg-transparent text-gray-300 hover:bg-blue-500/10 hover:text-blue-300 focus-visible:bg-blue-500/10 focus-visible:text-blue-300'
    : 'bg-transparent text-gray-600 hover:bg-blue-50 hover:text-blue-600 focus-visible:bg-blue-50 focus-visible:text-blue-600';
  const titleInputClass = darkMode
    ? `rounded-xl border-gray-700/70 bg-gray-950/45 text-[13px] placeholder:text-gray-500 focus-visible:border-blue-500/50 focus-visible:ring-blue-500/20 ${isTitlePrefilled ? 'text-gray-400' : 'text-gray-100'}`
    : `rounded-xl border-gray-200 bg-white text-[13px] placeholder:text-gray-400 focus-visible:border-blue-500/40 focus-visible:ring-blue-500/15 ${isTitlePrefilled ? 'text-gray-500' : 'text-gray-900'}`;
  const panelClass = darkMode
    ? 'border-gray-800/90 bg-gray-950/25'
    : 'border-slate-200/90 bg-slate-50/75 shadow-sm';
  const editorStatus = composeMode
    ? 'Draft workspace'
    : (hasUnsavedChanges ? 'Unsaved changes' : (editMode ? 'All changes saved' : 'Ready to create'));
  const editorStatusDot = hasUnsavedChanges ? 'bg-amber-400' : 'bg-emerald-400';
  const hasActiveLine = activeLineIndex !== null && activeLineIndex !== undefined;

  const timestampItems = [
    {
      key: 'standard',
      label: 'Add Standard Timestamp',
      onSelect: insertStandardTimestampAtActiveLine,
      disabled: !hasActiveLine,
    },
    {
      key: 'enhanced',
      label: 'Add Enhanced Timestamp',
      onSelect: insertEnhancedTimestampAtActiveLine,
      disabled: !activeLineHasTimestamp,
    },
  ];
  const sectionItems = SONG_SECTIONS.map((section) => ({
    key: section.key,
    label: section.label,
    onSelect: () => insertSectionAtCursor(section.key),
  }));
  const metadataItems = [
    {
      key: 'defaults',
      label: 'Add Default Tags',
      onSelect: handleAddDefaultTags,
      emphasis: true,
    },
    { separator: true },
    ...METADATA_OPTIONS.map((option) => ({
      key: option.key,
      label: option.label,
      onSelect: () => insertMetadataAtActiveLine(option.key),
      disabled: !hasActiveLine,
    })),
  ];

  return (
    <header className={`relative border-b px-4 py-3 md:px-5 md:py-4 ${darkMode ? 'border-gray-800 bg-gray-900' : 'border-slate-200 bg-white'}`}>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-blue-500/70 to-transparent" />

      <div className="mb-3 grid grid-cols-[1fr_auto_1fr] items-center gap-3 md:mb-4">
        <div className="justify-self-start">
          <Tooltip content="Return to control panel" side="right">
            <button
              onClick={handleBack}
              className={`flex items-center justify-center gap-2 rounded-lg px-3 py-1.5 font-medium transition-all md:w-[120px] md:px-4 ${navButtonClass}`}
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Back</span>
            </button>
          </Tooltip>
        </div>

        <div className="flex min-w-0 items-center justify-center gap-2.5">
          <FileText className={`hidden h-6 w-6 shrink-0 sm:block ${darkMode ? 'text-blue-300' : 'text-blue-600'}`} />
          <div className="min-w-0 text-center sm:text-left">
            <h1 className={`truncate text-base font-semibold sm:text-lg md:text-xl ${darkMode ? 'text-white' : 'text-gray-900'}`}>
              {titleText(composeMode, editMode)}
            </h1>
            <div className={`hidden items-center justify-center gap-1.5 text-[11px] sm:flex sm:justify-start ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${editorStatusDot}`} />
              {editorStatus}
            </div>
          </div>
          <HelpButton darkMode={darkMode} showModal={showModal} />
        </div>

        <div className="justify-self-end">
          {editMode ? (
            <Tooltip content="Start a new lyrics file" side="left">
              <button
                onClick={handleStartNewSong}
                className={`flex items-center justify-center gap-2 rounded-lg px-3 py-1.5 font-medium transition-all md:w-[120px] md:px-4 ${navButtonClass}`}
              >
                <FilePlusCorner className="h-4 w-4" />
                <span className="hidden sm:inline">New</span>
              </button>
            </Tooltip>
          ) : (
            <div className="w-8 sm:w-[72px] md:w-[120px]" />
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4">
        <section className={`flex min-w-0 flex-col justify-center rounded-2xl border p-2.5 ${panelClass}`} aria-label="Actions">
          <div className={`mb-1.5 px-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${darkMode ? 'text-gray-500' : 'text-slate-500'}`}>
            Actions
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ActionGroup darkMode={darkMode}>
              <IconAction onClick={handleUndo} disabled={!canUndo} title="Undo last change — Ctrl+Z" toolbarGhostClass={toolbarGhostClass} darkMode={darkMode}>
                <Undo className="h-4 w-4" />
              </IconAction>
              <IconAction onClick={handleRedo} disabled={!canRedo} title="Redo last change — Ctrl+Shift+Z" toolbarGhostClass={toolbarGhostClass} darkMode={darkMode}>
                <Redo className="h-4 w-4" />
              </IconAction>
              <IconAction onClick={handleSearchButtonClick} active={searchBarVisible} title="Search and replace — Ctrl+F" toolbarGhostClass={toolbarGhostClass} darkMode={darkMode}>
                <Search className="h-4 w-4" />
              </IconAction>
            </ActionGroup>

            <ActionGroup darkMode={darkMode}>
              <IconAction onClick={handleCut} disabled={isContentEmpty} title="Cut selected text" toolbarGhostClass={toolbarGhostClass} darkMode={darkMode}>
                <Scissors className="h-4 w-4" />
              </IconAction>
              <IconAction onClick={handleCopy} disabled={isContentEmpty} title="Copy selected text" toolbarGhostClass={toolbarGhostClass} darkMode={darkMode}>
                <Copy className="h-4 w-4" />
              </IconAction>
              <IconAction onClick={handlePaste} title="Paste from clipboard" toolbarGhostClass={toolbarGhostClass} darkMode={darkMode}>
                <ClipboardPaste className="h-4 w-4" />
              </IconAction>
              <IconAction onClick={handleCleanup} disabled={isContentEmpty} title="Clean up and format lyrics" toolbarGhostClass={toolbarGhostClass} darkMode={darkMode}>
                <Wand2 className="h-4 w-4" />
              </IconAction>
            </ActionGroup>

            <ActionGroup darkMode={darkMode}>
              <ToolbarDropdown
                align="right"
                darkMode={darkMode}
                disabled={!hasActiveLine}
                icon={Timer}
                id="timestamp"
                items={timestampItems}
                label="Timestamp actions"
                openMenu={openMenu}
                setOpenMenu={setOpenMenu}
                toolbarGhostClass={toolbarGhostClass}
              />
              <IconAction onClick={handleAddTranslationAtActiveLine} disabled={!canAddTranslationOnActiveLine} title="Add translation to current line" toolbarGhostClass={toolbarGhostClass} darkMode={darkMode}>
                <Languages className="h-4 w-4" />
              </IconAction>
              <IconAction onClick={handleCopyActiveLine} disabled={!hasActiveLine} title="Copy current line" toolbarGhostClass={toolbarGhostClass} darkMode={darkMode}>
                <ClipboardCopy className="h-4 w-4" />
              </IconAction>
              <IconAction onClick={handleDuplicateActiveLine} disabled={!hasActiveLine} title="Duplicate current line" toolbarGhostClass={toolbarGhostClass} darkMode={darkMode}>
                <CopyPlus className="h-4 w-4" />
              </IconAction>
            </ActionGroup>

            <ActionGroup darkMode={darkMode}>
              <ToolbarDropdown
                align="right"
                darkMode={darkMode}
                disabled={!isCursorAtEligiblePosition()}
                icon={ListOrdered}
                id="section"
                items={sectionItems}
                label="Add song section"
                openMenu={openMenu}
                setOpenMenu={setOpenMenu}
                toolbarGhostClass={toolbarGhostClass}
              />
              <ToolbarDropdown
                darkMode={darkMode}
                icon={Tags}
                id="metadata"
                items={metadataItems}
                label="Add lyrics metadata"
                openMenu={openMenu}
                setOpenMenu={setOpenMenu}
                toolbarGhostClass={toolbarGhostClass}
              />
            </ActionGroup>
          </div>
        </section>

        <section className={`flex min-w-0 flex-wrap items-end justify-end gap-2 rounded-2xl border p-2.5 md:pl-4 ${panelClass}`} aria-label="File actions">
          <div className="min-w-[120px] flex-1">
            <div className="mb-1.5 flex items-center justify-between px-1">
              <label htmlFor="lyrics-file-name" className={`text-[10px] font-semibold uppercase tracking-[0.16em] ${darkMode ? 'text-gray-500' : 'text-slate-500'}`}>
                File name
              </label>
              {isTitlePrefilled && (
                <span className={`text-[10px] italic ${darkMode ? 'text-blue-300/70' : 'text-blue-600/70'}`}>Auto-filled</span>
              )}
            </div>
            <Input
              id="lyrics-file-name"
              type="text"
              value={title}
              onChange={handleTitleChange}
              maxLength={65}
              placeholder="Enter lyrics file name..."
              className={`h-10 min-w-0 px-4 ${isTitlePrefilled ? 'italic' : ''} ${titleInputClass}`}
            />
          </div>
          <div className="flex shrink-0 items-center justify-end gap-1.5 pb-0.5">
            <SaveActions
              composeMode={composeMode}
              editMode={editMode}
              getSaveAndLoadButtonTooltip={getSaveAndLoadButtonTooltip}
              getSaveButtonTooltip={getSaveButtonTooltip}
              handleLoadDraft={handleLoadDraft}
              handleSave={handleSave}
              handleSaveAndLoad={handleSaveAndLoad}
              hasUnsavedChanges={hasUnsavedChanges}
              isContentEmpty={isContentEmpty}
              isTitleEmpty={isTitleEmpty}
              toolbarGhostClass={toolbarGhostClass}
            />
          </div>
        </section>
      </div>
    </header>
  );
};

export default SongCanvasHeader;
