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
    className={`p-1.5 rounded-lg transition-colors ${darkMode
      ? 'hover:bg-gray-700 text-gray-400 hover:text-gray-200'
      : 'hover:bg-gray-100 text-gray-500 hover:text-gray-700'
      }`}
    title="Song Canvas Help"
  >
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
  if (composeMode) {
    return (
      <Tooltip content={getSaveAndLoadButtonTooltip()} side={mobile ? 'left' : 'bottom'}>
        <span className="inline-block">
          <Button
            onClick={handleLoadDraft}
            disabled={isContentEmpty || isTitleEmpty}
            className={`${mobile ? 'whitespace-nowrap' : 'flex items-center gap-2 px-2.5 py-1.5'} bg-gradient-to-r from-blue-400 to-purple-600 text-white hover:from-blue-500 hover:to-purple-700 text-sm`}
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
            className={mobile ? 'text-sm' : `${toolbarGhostClass} text-sm`}
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
            className={`${mobile ? 'whitespace-nowrap' : 'flex items-center gap-2 px-2.5 py-1.5'} bg-gradient-to-r from-blue-400 to-purple-600 text-white text-sm`}
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
        className={`absolute top-full left-0 mt-1 w-40 rounded-md border shadow-lg z-50 max-h-80 overflow-y-auto ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
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
              ? 'hover:bg-gray-700 text-gray-200'
              : 'hover:bg-gray-100 text-gray-900'
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
}) => (
  <div className={`shadow-sm border-b p-4 ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
    <div className="md:hidden">
      <div className="flex items-center justify-between mb-3">
        <Tooltip content="Return to control panel" side="right">
          <button
            onClick={handleBack}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md font-medium transition-colors ${darkMode
              ? 'bg-gray-700 hover:bg-gray-600 text-gray-200'
              : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
              }`}
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
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md font-medium transition-colors ${darkMode
                  ? 'bg-gray-700 hover:bg-gray-600 text-gray-200'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                  }`}
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
          className={`flex-1 px-3 py-1.5 rounded-md ${isTitlePrefilled ? 'italic' : ''
            } ${darkMode
              ? `bg-gray-700 placeholder-gray-400 border-gray-600 ${isTitlePrefilled ? 'text-gray-400' : 'text-gray-200'}`
              : `bg-white placeholder-gray-400 border-gray-300 ${isTitlePrefilled ? 'text-gray-500' : 'text-gray-900'}`
            }`}
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
            className={`flex items-center justify-center gap-2 px-4 py-1.5 rounded-md font-medium transition-colors w-[120px] ${darkMode
              ? 'bg-gray-700 hover:bg-gray-600 text-gray-200'
              : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
              }`}
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
              className={`flex items-center justify-center gap-2 px-4 py-1.5 rounded-md font-medium transition-colors w-[120px] ${darkMode
                ? 'bg-gray-700 hover:bg-gray-600 text-gray-200'
                : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                }`}
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
        <div className={`w-px h-6 ${darkMode ? 'bg-gray-600' : 'bg-gray-300'}`}></div>
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
        <div className={`w-px h-6 ${darkMode ? 'bg-gray-600' : 'bg-gray-300'}`}></div>
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
          className={`px-3 py-1.5 rounded-md flex-shrink min-w-[100px] max-w-xs ${isTitlePrefilled ? 'italic' : ''
            } ${darkMode
              ? `bg-gray-700 placeholder-gray-400 border-gray-600 ${isTitlePrefilled ? 'text-gray-400' : 'text-gray-200'}`
              : `bg-white placeholder-gray-400 border-gray-300 ${isTitlePrefilled ? 'text-gray-500' : 'text-gray-900'}`
            }`}
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

export default SongCanvasHeader;
