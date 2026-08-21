import React, { useEffect, useState } from 'react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  CaseSensitive,
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
  MonitorOff,
  Redo,
  Save,
  Scissors,
  Search,
  Tags,
  Timer,
  Trash2,
  Undo,
  Wand2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tooltip } from '@/components/ui/tooltip';
import { METADATA_OPTIONS } from '../../constants/songCanvas';
import { TEXT_CASING } from '../../utils/textCasing';

const HelpButton = ({ darkMode, showModal }) => (
  <Tooltip content="Song Canvas Help" side="bottom">
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
      aria-label="Open lyrics canvas help"
    >
      <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    </button>
  </Tooltip>
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
  const gradientActionClass = 'flex h-10 items-center gap-1.5 rounded-full bg-linear-to-r from-blue-400 to-purple-600 px-5 py-2.5 text-sm font-semibold text-white transition-all duration-200 hover:from-blue-500 hover:to-purple-700 disabled:from-gray-400 disabled:to-gray-500 disabled:text-white disabled:opacity-55';

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
            className={`${toolbarGhostClass} h-10 px-5 py-2.5 text-sm font-semibold`}
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
  pressed,
  title,
  toolbarGhostClass,
}) => {
  const selected = typeof pressed === 'boolean' ? pressed : active;

  return (
    <Tooltip content={title} side="bottom">
      <Button
        type="button"
        onClick={onClick}
        disabled={disabled}
        variant="ghost"
        size="sm"
        className={`control-group-item-squircle h-8 w-8 shrink-0 p-0 ${toolbarGhostClass} ${selected
          ? (darkMode ? 'bg-blue-500/15 text-blue-300' : 'bg-blue-100 text-blue-700')
          : ''}`}
        title={title}
        aria-label={ariaLabel || title}
        aria-pressed={typeof pressed === 'boolean' ? pressed : (active || undefined)}
      >
        {children}
      </Button>
    </Tooltip>
  );
};

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
      <Tooltip content={label} side="bottom" disabled={open}>
        <Button
          type="button"
          onClick={() => setOpenMenu((current) => current === id ? null : id)}
          disabled={disabled}
          variant="ghost"
          size="sm"
          className={`control-group-item-squircle h-8 min-w-8 shrink-0 gap-0.5 px-1.5 ${toolbarGhostClass} ${open
            ? (darkMode ? 'bg-blue-500/15 text-blue-300' : 'bg-blue-100 text-blue-700')
            : ''}`}
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
          className={`absolute top-full z-50 mt-2 max-h-80 w-max min-w-52 max-w-72 overflow-y-auto rounded-xl border py-1 text-[13px] shadow-xl backdrop-blur-xl ${align === 'right' ? 'right-0' : 'left-0'} ${menuClass}`}
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
              className={`mx-1 flex w-[calc(100%-0.5rem)] items-center gap-2.5 rounded-xl px-3 py-2.5 text-left outline-none transition-colors ${item.emphasis ? 'font-semibold' : ''} ${item.disabled ? 'cursor-not-allowed opacity-45' : itemClass}`}
              role="menuitem"
            >
              {item.icon ? <item.icon className="h-4 w-4 shrink-0 opacity-75" /> : null}
              <span className="min-w-0 whitespace-normal break-words">{item.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const ActionGroup = ({ children, darkMode }) => (
  <div className={`control-group-squircle flex items-center gap-2 border p-1 ${darkMode
    ? 'border-gray-700/70 bg-gray-950/30'
    : 'border-slate-200/90 bg-white/80 shadow-sm'
    }`}>
    {children}
  </div>
);

const SongCanvasHeader = ({
  activeLineHasContent,
  activeLineHasTimestamp,
  activeLineIndex,
  activeLineIsStageOnly,
  canAddTranslationOnActiveLine,
  canMoveActiveLineDown,
  canMoveActiveLineUp,
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
  handleChangeSelectionCase,
  handleCopy,
  handleCopyActiveLine,
  handleCut,
  handleDeleteActiveLine,
  handleDuplicateActiveLine,
  handleLoadDraft,
  handleMoveActiveLineDown,
  handleMoveActiveLineUp,
  handlePaste,
  handleRedo,
  handleSave,
  handleSaveAndLoad,
  handleSearchButtonClick,
  handleStartNewSong,
  handleTitleBlur,
  handleTitleChange,
  handleToggleStageOnlyActiveLine,
  handleUndo,
  hasUnsavedChanges,
  hasTextSelection,
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
  songSections = [],
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
    ? `border-0 bg-transparent text-gray-100 shadow-none hover:text-white focus-visible:border-0 focus-visible:ring-0 ${isTitlePrefilled || isTitleEmpty ? 'italic text-gray-400' : ''}`
    : `border-0 bg-transparent text-gray-900 shadow-none hover:text-blue-700 focus-visible:border-0 focus-visible:ring-0 ${isTitlePrefilled || isTitleEmpty ? 'italic text-gray-500' : ''}`;
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
  const sectionItems = songSections.map((section) => ({
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
  const casingItems = [
    {
      key: TEXT_CASING.UPPERCASE,
      label: 'UPPERCASE',
      onSelect: () => handleChangeSelectionCase(TEXT_CASING.UPPERCASE),
    },
    {
      key: TEXT_CASING.SENTENCE,
      label: 'Sentence case',
      onSelect: () => handleChangeSelectionCase(TEXT_CASING.SENTENCE),
    },
    {
      key: TEXT_CASING.LOWERCASE,
      label: 'lower case',
      onSelect: () => handleChangeSelectionCase(TEXT_CASING.LOWERCASE),
    },
    {
      key: TEXT_CASING.CAPITALIZE_WORDS,
      label: 'Capitalize Each Word',
      onSelect: () => handleChangeSelectionCase(TEXT_CASING.CAPITALIZE_WORDS),
    },
    {
      key: TEXT_CASING.TOGGLE,
      label: 'tOGGLE cASE',
      onSelect: () => handleChangeSelectionCase(TEXT_CASING.TOGGLE),
    },
  ];

  return (
    <header className={`relative border-b px-4 py-3 md:px-5 md:py-4 ${darkMode ? 'border-gray-800 bg-gray-900' : 'border-slate-200 bg-white'}`}>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-blue-500/70 to-transparent" />

      <div className="mb-3 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 md:mb-4">
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

        <div className="flex w-full max-w-lg min-w-0 items-center justify-self-start gap-2.5 px-1">
          <FileText className={`hidden h-5 w-5 shrink-0 sm:block ${darkMode ? 'text-blue-300' : 'text-blue-600'}`} />
          <div className="min-w-0 flex-1">
            <label htmlFor="lyrics-file-name" className="sr-only">Lyrics file name</label>
            <Input
              id="lyrics-file-name"
              type="text"
              value={title}
              onChange={handleTitleChange}
              onFocus={(event) => event.currentTarget.select()}
              onBlur={(event) => {
                event.currentTarget.scrollLeft = 0;
                handleTitleBlur(event);
              }}
              maxLength={65}
              placeholder="Untitled Lyrics"
              aria-label="Lyrics file name"
              title={title}
              className={`h-9 min-w-0 truncate rounded-none px-0 py-0 text-left text-base font-semibold md:text-base ${titleInputClass}`}
            />
          </div>
          {isTitlePrefilled && (
            <span className={`hidden shrink-0 text-[10px] italic sm:inline ${darkMode ? 'text-blue-300/70' : 'text-blue-600/70'}`}>Auto-filled</span>
          )}
        </div>

        <div className="flex items-center justify-self-end gap-1.5">
          <HelpButton darkMode={darkMode} showModal={showModal} />
          {editMode && (
            <Tooltip content="Start a new lyrics file" side="left">
              <button
                onClick={handleStartNewSong}
                className={`flex items-center justify-center gap-2 rounded-lg px-3 py-1.5 font-medium transition-all md:w-[120px] md:px-4 ${navButtonClass}`}
              >
                <FilePlusCorner className="h-4 w-4" />
                <span className="hidden sm:inline">New</span>
              </button>
            </Tooltip>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between md:gap-4">
        <div className="flex w-fit max-w-full min-w-0 flex-wrap items-center gap-3" role="toolbar" aria-label="Lyrics actions">
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
              <IconAction
                onClick={handleToggleStageOnlyActiveLine}
                disabled={!hasActiveLine || !activeLineHasContent}
                pressed={activeLineIsStageOnly}
                title={activeLineIsStageOnly
                  ? 'Mark current line for all outputs'
                  : 'Mark current line for Stage only'}
                toolbarGhostClass={toolbarGhostClass}
                darkMode={darkMode}
              >
                <MonitorOff className="h-4 w-4" />
              </IconAction>
            </ActionGroup>
            <ActionGroup darkMode={darkMode}>
              <IconAction onClick={handleCopyActiveLine} disabled={!hasActiveLine} title="Copy current line" toolbarGhostClass={toolbarGhostClass} darkMode={darkMode}>
                <ClipboardCopy className="h-4 w-4" />
              </IconAction>
              <IconAction onClick={handleDuplicateActiveLine} disabled={!hasActiveLine} title="Duplicate current line" toolbarGhostClass={toolbarGhostClass} darkMode={darkMode}>
                <CopyPlus className="h-4 w-4" />
              </IconAction>
              <IconAction onClick={handleDeleteActiveLine} disabled={!hasActiveLine || isContentEmpty} title="Delete current line" toolbarGhostClass={toolbarGhostClass} darkMode={darkMode}>
                <Trash2 className="h-4 w-4" />
              </IconAction>
              <IconAction onClick={handleMoveActiveLineUp} disabled={!canMoveActiveLineUp} title="Move current line up" toolbarGhostClass={toolbarGhostClass} darkMode={darkMode}>
                <ArrowUp className="h-4 w-4" />
              </IconAction>
              <IconAction onClick={handleMoveActiveLineDown} disabled={!canMoveActiveLineDown} title="Move current line down" toolbarGhostClass={toolbarGhostClass} darkMode={darkMode}>
                <ArrowDown className="h-4 w-4" />
              </IconAction>
            </ActionGroup>
            <ActionGroup darkMode={darkMode}>
              <ToolbarDropdown
                align="right"
                darkMode={darkMode}
                disabled={sectionItems.length === 0 || !isCursorAtEligiblePosition()}
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
              <ToolbarDropdown
                align="right"
                darkMode={darkMode}
                disabled={!hasTextSelection}
                icon={CaseSensitive}
                id="casing"
                items={casingItems}
                label="Change casing"
                openMenu={openMenu}
                setOpenMenu={setOpenMenu}
                toolbarGhostClass={toolbarGhostClass}
              />
            </ActionGroup>
        </div>

        <div className="flex shrink-0 items-center justify-end self-end md:ml-auto md:self-center" role="group" aria-label="File actions">
          <div className="flex items-center justify-end gap-1.5">
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
        </div>
      </div>
    </header>
  );
};

export default SongCanvasHeader;
