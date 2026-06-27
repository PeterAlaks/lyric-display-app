import React from 'react';
import { ArrowLeft, ClipboardPaste, Copy, FilePlusCorner, FolderOpen, ListOrdered, Redo, Save, Scissors, Search, Undo, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tooltip } from '@/components/ui/tooltip';
import { SONG_SECTIONS } from '../../constants/songCanvas';

const titleText = (composeMode, editMode, mobile = false) => {
  if (composeMode) return mobile ? 'Create Lyrics' : 'Compose Lyrics';
  return editMode ? 'Edit Song Canvas' : 'New Song Canvas';
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
    className={`p-1.5 rounded-lg transition-all ${darkMode
      ? 'bg-transparent text-gray-400 hover:bg-blue-500/10 hover:text-blue-300 focus-visible:bg-blue-500/10 focus-visible:text-blue-300'
      : 'bg-transparent text-gray-500 hover:bg-blue-50 hover:text-blue-600 focus-visible:bg-blue-50 focus-visible:text-blue-600'
      }`}
    title="Song Canvas Help"
  >
    <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
  mobile = false,
  toolbarGhostClass,
}) => {
  const disabled = isContentEmpty || isTitleEmpty || (editMode && !hasUnsavedChanges);
  const gradientActionClass = `${mobile ? 'whitespace-nowrap' : 'flex items-center gap-2 px-3 py-1.5'} rounded-full bg-linear-to-r from-blue-400 to-purple-600 text-sm text-white transition-all duration-200 hover:from-blue-500 hover:to-purple-700 disabled:from-gray-400 disabled:to-gray-500 disabled:text-white disabled:opacity-55`;

  if (composeMode) {
    return (
      <Tooltip content={getSaveAndLoadButtonTooltip()} side={mobile ? 'left' : 'bottom'}>
        <span className="inline-block">
          <Button
            onClick={handleLoadDraft}
            disabled={isContentEmpty || isTitleEmpty}
            className={gradientActionClass}
            size="sm"
          >
            <FolderOpen className="w-4 h-4 mr-1" /> {mobile ? 'Load' : 'Load Draft'}
          </Button>
        </span>
      </Tooltip>
    );
  }

  return (
    <>
      <Tooltip content={getSaveButtonTooltip()} side={mobile ? 'left' : 'bottom'}>
        <span className="inline-block">
          <Button
            onClick={handleSave}
            disabled={disabled}
            variant="ghost"
            size="sm"
            title="Save"
            className={`${toolbarGhostClass} text-sm`}
          >
            <Save className="w-4 h-4" /> {!mobile && 'Save'}
          </Button>
        </span>
      </Tooltip>
      <Tooltip content={getSaveAndLoadButtonTooltip()} side={mobile ? 'left' : 'bottom'}>
        <span className="inline-block">
          <Button
            onClick={handleSaveAndLoad}
            disabled={disabled}
            className={gradientActionClass}
            size="sm"
          >
            <FolderOpen className="w-4 h-4 mr-1" /> Save & Load
          </Button>
        </span>
      </Tooltip>
    </>
  );
};

const SectionDropdown = ({
  darkMode,
  insertSectionAtCursor,
  isCursorAtEligiblePosition,
  sectionDropdownOpen,
  sectionDropdownRef,
  setSectionDropdownOpen,
  showToast,
  toolbarGhostClass,
}) => (
  <div className="relative">
    <Tooltip content="Add song section" side="bottom">
      <Button
        onClick={() => {
          if (isCursorAtEligiblePosition()) {
            setSectionDropdownOpen(!sectionDropdownOpen);
          } else {
            showToast({
              title: 'Invalid cursor position',
              message: 'Move cursor to beginning/end of line or blank line to add section',
              variant: 'warn'
            });
          }
        }}
        variant="ghost"
        size="sm"
        className={`${toolbarGhostClass} text-sm relative`}
      >
        <ListOrdered className="w-4 h-4" />
      </Button>
    </Tooltip>
    {sectionDropdownOpen && (
      <div
        ref={sectionDropdownRef}
        className={`absolute top-full left-0 mt-1 w-40 rounded-xl border shadow-lg z-50 max-h-80 overflow-y-auto ${darkMode ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'
          }`}
      >
        {SONG_SECTIONS.map((section) => (
          <button
            key={section.key}
            onClick={() => {
              insertSectionAtCursor(section.key);
              setSectionDropdownOpen(false);
            }}
            className={`w-full text-left px-3 py-2 text-sm transition-colors ${darkMode
              ? 'text-gray-200 hover:bg-blue-500/10 hover:text-blue-300'
              : 'text-gray-900 hover:bg-blue-50 hover:text-blue-600'
              }`}
          >
            {section.label}
          </button>
        ))}
      </div>
    )}
  </div>
);

const SongCanvasHeader = ({
  canRedo,
  canUndo,
  composeMode,
  darkMode,
  editMode,
  getSaveAndLoadButtonTooltip,
  getSaveButtonTooltip,
  handleBack,
  handleCleanup,
  handleCopy,
  handleCut,
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
  insertSectionAtCursor,
  isContentEmpty,
  isCursorAtEligiblePosition,
  isTitleEmpty,
  isTitlePrefilled,
  searchBarVisible,
  sectionDropdownOpen,
  sectionDropdownRef,
  setSectionDropdownOpen,
  showModal,
  showToast,
  title,
  toolbarGhostClass,
}) => {
  const navButtonClass = darkMode
    ? 'bg-transparent text-gray-300 hover:bg-blue-500/10 hover:text-blue-300 focus-visible:bg-blue-500/10 focus-visible:text-blue-300'
    : 'bg-transparent text-gray-600 hover:bg-blue-50 hover:text-blue-600 focus-visible:bg-blue-50 focus-visible:text-blue-600';
  const titleInputClass = darkMode
    ? `rounded-full border-gray-700/70 bg-gray-900/80 text-[13px] placeholder:text-gray-500 focus-visible:border-blue-500/50 focus-visible:ring-blue-500/20 ${isTitlePrefilled ? 'text-gray-500' : 'text-gray-200'}`
    : `rounded-full border-gray-200 bg-white text-[13px] placeholder:text-gray-400 focus-visible:border-blue-500/40 focus-visible:ring-blue-500/15 ${isTitlePrefilled ? 'text-gray-500' : 'text-gray-900'}`;

  return (
  <div className={`border-b px-4 py-3 ${darkMode ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'}`}>
    <div className="md:hidden">
      <div className="flex items-center justify-between mb-3">
        <Tooltip content="Return to control panel" side="right">
          <button
            onClick={handleBack}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg font-medium transition-all ${navButtonClass}`}
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
        </Tooltip>
        <div className="flex items-center gap-2">
          <h1 className={`text-lg font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
            {titleText(composeMode, editMode, true)}
          </h1>
          <HelpButton darkMode={darkMode} showModal={showModal} />
        </div>
        <div className="flex items-center justify-end min-w-[96px]">
          {editMode && (
            <Tooltip content="Start a new song canvas" side="left">
              <button
                onClick={handleStartNewSong}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg font-medium transition-all ${navButtonClass}`}
              >
                <FilePlusCorner className="w-4 h-4" />
                New
              </button>
            </Tooltip>
          )}
        </div>
      </div>

      <div className="flex items-center justify-center gap-1 mb-3">
        <Tooltip content="Undo last change" side="top">
          <Button onClick={handleUndo} disabled={!canUndo} variant="ghost" size="sm" className={`flex-1 ${toolbarGhostClass}`} title="Undo (Ctrl+Z)">
            <Undo className="w-4 h-4" />
          </Button>
        </Tooltip>
        <Tooltip content="Redo last undone change" side="top">
          <Button onClick={handleRedo} disabled={!canRedo} variant="ghost" size="sm" className={`flex-1 ${toolbarGhostClass}`} title="Redo (Ctrl+Shift+Z)">
            <Redo className="w-4 h-4" />
          </Button>
        </Tooltip>
        <Tooltip content="Search in canvas (Ctrl+F)" side="top">
          <Button onClick={handleSearchButtonClick} variant="ghost" size="sm" className={`flex-1 ${toolbarGhostClass}`} title="Search (Ctrl+F)">
            <Search className="w-4 h-4" />
          </Button>
        </Tooltip>
        <Tooltip content="Cut selected text" side="top">
          <Button onClick={handleCut} disabled={isContentEmpty} variant="ghost" size="sm" className={`flex-1 ${toolbarGhostClass}`} title="Cut">
            <Scissors className="w-4 h-4" />
          </Button>
        </Tooltip>
        <Tooltip content="Copy selected text" side="top">
          <Button onClick={handleCopy} disabled={isContentEmpty} variant="ghost" size="sm" className={`flex-1 ${toolbarGhostClass}`} title="Copy">
            <Copy className="w-4 h-4" />
          </Button>
        </Tooltip>
        <Tooltip content="Paste from clipboard" side="top">
          <Button onClick={handlePaste} variant="ghost" size="sm" className={`flex-1 ${toolbarGhostClass}`} title="Paste">
            <ClipboardPaste className="w-4 h-4" />
          </Button>
        </Tooltip>
        <Tooltip content="Auto-format and clean up lyrics" side="top">
          <Button onClick={handleCleanup} disabled={isContentEmpty} variant="ghost" size="sm" className={`flex-1 ${toolbarGhostClass}`} title="Cleanup">
            <Wand2 className="w-4 h-4" />
          </Button>
        </Tooltip>
      </div>

      <div className="flex items-center gap-2">
        <Input
          type="text"
          value={title}
          onChange={handleTitleChange}
          maxLength={65}
          placeholder="Enter song title..."
          className={`h-10 flex-1 px-4 ${isTitlePrefilled ? 'italic' : ''} ${titleInputClass}`}
        />
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
          mobile
          toolbarGhostClass={toolbarGhostClass}
        />
      </div>
    </div>

    <div className="hidden md:block">
      <div className="flex items-center justify-between mb-4">
        <Tooltip content="Return to control panel" side="right">
          <button
            onClick={handleBack}
            className={`flex items-center justify-center gap-2 px-4 py-1.5 rounded-lg font-medium transition-all w-[120px] ${navButtonClass}`}
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
        </Tooltip>
        <div className="flex items-center gap-2">
          <h1 className={`text-xl font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
            {titleText(composeMode, editMode)}
          </h1>
          <HelpButton darkMode={darkMode} showModal={showModal} />
        </div>
        {editMode ? (
          <Tooltip content="Start a new song canvas" side="left">
            <button
              onClick={handleStartNewSong}
              className={`flex items-center justify-center gap-2 px-4 py-1.5 rounded-lg font-medium transition-all w-[120px] ${navButtonClass}`}
            >
              <FilePlusCorner className="w-4 h-4" />
              New
            </button>
          </Tooltip>
        ) : (
          <div className="w-[120px]"></div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-start gap-2">
        <Tooltip content={<span>Undo last change - <strong>Ctrl+Z</strong></span>} side="bottom">
          <Button onClick={handleUndo} disabled={!canUndo} variant="ghost" className={`${toolbarGhostClass}`}>
            <Undo className="w-4 h-4" />
          </Button>
        </Tooltip>
        <Tooltip content={<span>Redo last undone change - <strong>Ctrl+Shift+Z</strong></span>} side="bottom">
          <Button onClick={handleRedo} disabled={!canRedo} variant="ghost" className={`${toolbarGhostClass}`}>
            <Redo className="w-4 h-4" />
          </Button>
        </Tooltip>
        <Tooltip content={<span>Search in canvas - <strong>Ctrl+F</strong></span>} side="bottom">
          <Button
            onClick={handleSearchButtonClick}
            variant="ghost"
            size="sm"
            className={`${toolbarGhostClass} ${searchBarVisible ? (darkMode ? 'bg-blue-900/40' : 'bg-blue-50 text-blue-700') : ''}`}
            title="Search (Ctrl+F)"
          >
            <Search className="w-4 h-4" />
          </Button>
        </Tooltip>
        <div className={`w-px h-6 ${darkMode ? 'bg-gray-800' : 'bg-gray-200'}`}></div>
        <div className="flex flex-wrap items-center gap-2">
          <Tooltip content="Cut selected text" side="bottom">
            <Button onClick={handleCut} disabled={isContentEmpty} variant="ghost" size="sm" className={`${toolbarGhostClass} hidden lg:flex text-sm`}>
              <Scissors className="w-4 h-4" /> Cut
            </Button>
          </Tooltip>
          <Tooltip content="Copy selected text" side="bottom">
            <Button onClick={handleCopy} disabled={isContentEmpty} variant="ghost" size="sm" className={`${toolbarGhostClass} hidden lg:flex text-sm`}>
              <Copy className="w-4 h-4" /> Copy
            </Button>
          </Tooltip>
          <Tooltip content="Paste from clipboard" side="bottom">
            <Button onClick={handlePaste} variant="ghost" size="sm" className={`${toolbarGhostClass} hidden lg:flex text-sm`}>
              <ClipboardPaste className="w-4 h-4" /> Paste
            </Button>
          </Tooltip>
          <Tooltip content="Auto-format and clean up lyrics" side="bottom">
            <Button onClick={handleCleanup} disabled={isContentEmpty} variant="ghost" size="sm" className={`${toolbarGhostClass} hidden lg:flex text-sm`}>
              <Wand2 className="w-4 h-4" /> Cleanup
            </Button>
          </Tooltip>
          <div className="flex lg:hidden gap-1">
            <Tooltip content="Cut" side="bottom">
              <Button onClick={handleCut} disabled={isContentEmpty} variant="ghost" size="sm" className={toolbarGhostClass} title="Cut">
                <Scissors className="w-4 h-4" />
              </Button>
            </Tooltip>
            <Tooltip content="Copy" side="bottom">
              <Button onClick={handleCopy} disabled={isContentEmpty} variant="ghost" size="sm" className={toolbarGhostClass} title="Copy">
                <Copy className="w-4 h-4" />
              </Button>
            </Tooltip>
            <Tooltip content="Paste" side="bottom">
              <Button onClick={handlePaste} variant="ghost" size="sm" className={toolbarGhostClass} title="Paste">
                <ClipboardPaste className="w-4 h-4" />
              </Button>
            </Tooltip>
            <Tooltip content="Cleanup" side="bottom">
              <Button onClick={handleCleanup} disabled={isContentEmpty} variant="ghost" size="sm" className={toolbarGhostClass} title="Cleanup">
                <Wand2 className="w-4 h-4" />
              </Button>
            </Tooltip>
          </div>
        </div>
        <div className={`w-px h-6 ${darkMode ? 'bg-gray-800' : 'bg-gray-200'}`}></div>
        <SectionDropdown
          darkMode={darkMode}
          insertSectionAtCursor={insertSectionAtCursor}
          isCursorAtEligiblePosition={isCursorAtEligiblePosition}
          sectionDropdownOpen={sectionDropdownOpen}
          sectionDropdownRef={sectionDropdownRef}
          setSectionDropdownOpen={setSectionDropdownOpen}
          showToast={showToast}
          toolbarGhostClass={toolbarGhostClass}
        />
        <Input
          type="text"
          value={title}
          onChange={handleTitleChange}
          maxLength={65}
          placeholder="Enter song title..."
          className={`h-10 flex-shrink min-w-[100px] max-w-xs px-4 ${isTitlePrefilled ? 'italic' : ''} ${titleInputClass}`}
        />
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
  );
};

export default SongCanvasHeader;
