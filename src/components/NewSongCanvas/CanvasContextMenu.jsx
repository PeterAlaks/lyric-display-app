import { ChevronRight } from 'lucide-react';
import { ContextMenu, ContextMenuItem, ContextMenuSeparator, ContextMenuSubmenu } from '@/components/ui/context-menu';
import { METADATA_OPTIONS, SONG_SECTIONS } from '../../constants/songCanvas';

const CanvasContextMenu = ({
  activeSubmenu,
  canAddTranslationInContextMenu,
  closeContextMenu,
  contextMenuLineHasTimestamp,
  contextMenuPosition,
  contextMenuRef,
  contextMenuState,
  darkMode,
  handleAddDefaultTags,
  handleAddTranslation,
  handleCleanupFromContext,
  handleContextMenuEnter,
  handleContextMenuLeave,
  handleCopy,
  handleCopyLine,
  handleCut,
  handleDuplicateLine,
  handlePaste,
  handleRootItemEnter,
  handleSubmenuPanelEnter,
  handleSubmenuPanelLeave,
  handleSubmenuTriggerEnter,
  handleSubmenuTriggerLeave,
  insertEnhancedTimestampAtCursor,
  insertMetadataTagAtCursor,
  insertSectionAtCursor,
  insertStandardTimestampAtLine,
  isCursorAtEligiblePosition,
  metadataSubmenuRef,
  sectionSubmenuRef,
  setActiveSubmenu,
  setContextMenuDimensions,
  submenuHorizontal,
  submenuMaxHeight,
  submenuOffsets,
  timestampSubmenuRef,
}) => {
  if (!contextMenuState.visible || !contextMenuPosition) return null;

  return (
    <ContextMenu
      ref={contextMenuRef}
      visible
      position={contextMenuPosition}
      darkMode={darkMode}
      className="w-44"
      onMouseEnter={handleContextMenuEnter}
      onMouseLeave={handleContextMenuLeave}
      onMeasured={setContextMenuDimensions}
    >
      {contextMenuState.mode === 'selection' ? (
        <>
          <ContextMenuItem
            onClick={async (event) => {
              event.preventDefault();
              event.stopPropagation();
              await handleCut();
              closeContextMenu();
            }}
            onMouseEnter={handleRootItemEnter}
            darkMode={darkMode}
          >
            Cut
          </ContextMenuItem>
          <ContextMenuItem
            onClick={async (event) => {
              event.preventDefault();
              event.stopPropagation();
              await handleCopy();
              closeContextMenu();
            }}
            onMouseEnter={handleRootItemEnter}
            darkMode={darkMode}
          >
            Copy
          </ContextMenuItem>
          <ContextMenuItem
            onClick={async (event) => {
              event.preventDefault();
              event.stopPropagation();
              await handlePaste();
              closeContextMenu();
            }}
            onMouseEnter={handleRootItemEnter}
            darkMode={darkMode}
          >
            Paste
          </ContextMenuItem>
          <ContextMenuItem
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              handleCleanupFromContext();
            }}
            onMouseEnter={handleRootItemEnter}
            darkMode={darkMode}
          >
            Cleanup
          </ContextMenuItem>
        </>
      ) : (
        <>
          <div
            className="relative"
            onMouseEnter={() => handleSubmenuTriggerEnter('timestamp')}
            onFocus={() => handleSubmenuTriggerEnter('timestamp')}
            onMouseLeave={handleSubmenuTriggerLeave}
          >
            <ContextMenuItem
              className="justify-between"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                setActiveSubmenu('timestamp');
              }}
              darkMode={darkMode}
            >
              <span>Add Timestamp</span>
              <ChevronRight className={`h-4 w-4 ${submenuHorizontal === 'left' ? 'transform rotate-180' : ''}`} />
            </ContextMenuItem>
            <ContextMenuSubmenu
              ref={timestampSubmenuRef}
              open={activeSubmenu === 'timestamp'}
              direction={submenuHorizontal}
              offsetTop={submenuOffsets.timestamp ?? 0}
              maxHeight={submenuMaxHeight}
              darkMode={darkMode}
              onMouseEnter={handleSubmenuPanelEnter}
              onMouseLeave={handleSubmenuPanelLeave}
            >
              <ContextMenuItem
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  if (contextMenuState.lineIndex !== null) {
                    insertStandardTimestampAtLine(contextMenuState.lineIndex);
                  }
                }}
                darkMode={darkMode}
              >
                Standard Timestamp
              </ContextMenuItem>
              <ContextMenuItem
                disabled={!contextMenuLineHasTimestamp}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  if (contextMenuState.lineIndex !== null && contextMenuLineHasTimestamp) {
                    insertEnhancedTimestampAtCursor(contextMenuState.lineIndex);
                  }
                }}
                darkMode={darkMode}
              >
                Enhanced Timestamp
              </ContextMenuItem>
            </ContextMenuSubmenu>
          </div>
          {contextMenuState.lineIndex !== null && (
            <ContextMenuItem
              disabled={!canAddTranslationInContextMenu}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                if (contextMenuState.lineIndex !== null && canAddTranslationInContextMenu) {
                  handleAddTranslation(contextMenuState.lineIndex);
                }
              }}
              onMouseEnter={handleRootItemEnter}
              darkMode={darkMode}
            >
              Add Translation
            </ContextMenuItem>
          )}
          <ContextMenuItem
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              if (contextMenuState.lineIndex !== null) {
                handleCopyLine(contextMenuState.lineIndex);
              }
            }}
            onMouseEnter={handleRootItemEnter}
            darkMode={darkMode}
          >
            Copy Line
          </ContextMenuItem>
          <ContextMenuItem
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              if (contextMenuState.lineIndex !== null) {
                handleDuplicateLine(contextMenuState.lineIndex);
              }
            }}
            onMouseEnter={handleRootItemEnter}
            darkMode={darkMode}
          >
            Duplicate Line
          </ContextMenuItem>
          <div
            className="relative"
            onMouseEnter={() => {
              if (isCursorAtEligiblePosition()) {
                handleSubmenuTriggerEnter('section');
              }
            }}
            onFocus={() => {
              if (isCursorAtEligiblePosition()) {
                handleSubmenuTriggerEnter('section');
              }
            }}
            onMouseLeave={handleSubmenuTriggerLeave}
          >
            <ContextMenuItem
              className="justify-between"
              disabled={!isCursorAtEligiblePosition()}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                if (isCursorAtEligiblePosition()) {
                  setActiveSubmenu('section');
                }
              }}
              darkMode={darkMode}
            >
              <span>Add Section</span>
              <ChevronRight className={`h-4 w-4 ${submenuHorizontal === 'left' ? 'transform rotate-180' : ''}`} />
            </ContextMenuItem>
            <ContextMenuSubmenu
              ref={sectionSubmenuRef}
              open={activeSubmenu === 'section'}
              direction={submenuHorizontal}
              offsetTop={submenuOffsets.section ?? 0}
              maxHeight={submenuMaxHeight}
              darkMode={darkMode}
              className="w-40"
              onMouseEnter={handleSubmenuPanelEnter}
              onMouseLeave={handleSubmenuPanelLeave}
            >
              {SONG_SECTIONS.map((section) => (
                <ContextMenuItem
                  key={section.key}
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    insertSectionAtCursor(section.key);
                  }}
                  darkMode={darkMode}
                >
                  {section.label}
                </ContextMenuItem>
              ))}
            </ContextMenuSubmenu>
          </div>
          <div
            className="relative"
            onMouseEnter={() => handleSubmenuTriggerEnter('metadata')}
            onFocus={() => handleSubmenuTriggerEnter('metadata')}
            onMouseLeave={handleSubmenuTriggerLeave}
          >
            <ContextMenuItem
              className="justify-between"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                setActiveSubmenu('metadata');
              }}
              darkMode={darkMode}
            >
              <span>Add Metadata</span>
              <ChevronRight className={`h-4 w-4 ${submenuHorizontal === 'left' ? 'transform rotate-180' : ''}`} />
            </ContextMenuItem>
            <ContextMenuSubmenu
              ref={metadataSubmenuRef}
              open={activeSubmenu === 'metadata'}
              direction={submenuHorizontal}
              offsetTop={submenuOffsets.metadata ?? 0}
              maxHeight={submenuMaxHeight}
              darkMode={darkMode}
              className="w-52"
              onMouseEnter={handleSubmenuPanelEnter}
              onMouseLeave={handleSubmenuPanelLeave}
            >
              <ContextMenuItem
                className="font-semibold"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  handleAddDefaultTags();
                }}
                darkMode={darkMode}
              >
                Add Default Tags
              </ContextMenuItem>
              <ContextMenuSeparator darkMode={darkMode} />
              {METADATA_OPTIONS.map((option) => (
                <ContextMenuItem
                  key={option.key}
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    if (contextMenuState.lineIndex !== null) {
                      insertMetadataTagAtCursor(contextMenuState.lineIndex, option.key);
                    }
                  }}
                  darkMode={darkMode}
                >
                  {option.label}
                </ContextMenuItem>
              ))}
            </ContextMenuSubmenu>
          </div>
          <ContextMenuItem
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              handleCleanupFromContext();
            }}
            onMouseEnter={handleRootItemEnter}
            darkMode={darkMode}
          >
            Cleanup
          </ContextMenuItem>
        </>
      )}
    </ContextMenu>
  );
};

export default CanvasContextMenu;
