import React from 'react';
import { ArrowRight, Copy, Link2, Redo, Undo, Ungroup, X } from 'lucide-react';
import { ContextMenu, ContextMenuItem, ContextMenuSeparator } from '@/components/ui/context-menu';

const LyricsListContextMenu = React.forwardRef(({
  visible,
  position,
  darkMode,
  onMeasured,
  selectedIndicesArray,
  hasSelection,
  canGroupSelected,
  canUngroupSelected,
  canUndo,
  canRedo,
  onSendSelectionToOutput,
  onDeselectFromMenu,
  onGroupSelected,
  onUngroupSelected,
  onCopySelection,
  onUndo,
  onRedo,
}, ref) => (
  <ContextMenu
    ref={ref}
    visible={visible}
    position={position}
    positioning="fixed"
    darkMode={darkMode}
    onMeasured={onMeasured}
  >
    <ContextMenuItem
      onClick={onSendSelectionToOutput}
      disabled={selectedIndicesArray.length !== 1}
      icon={<ArrowRight className="w-4 h-4" />}
      darkMode={darkMode}
    >
      Send to output
    </ContextMenuItem>
    <ContextMenuItem
      onClick={onDeselectFromMenu}
      disabled={!hasSelection}
      icon={<X className="w-4 h-4" />}
      darkMode={darkMode}
    >
      Clear output
    </ContextMenuItem>
    <ContextMenuSeparator darkMode={darkMode} />
    <ContextMenuItem
      onClick={onGroupSelected}
      disabled={!canGroupSelected}
      icon={<Link2 className="w-4 h-4" />}
      darkMode={darkMode}
    >
      Group
    </ContextMenuItem>
    <ContextMenuItem
      onClick={onUngroupSelected}
      disabled={!canUngroupSelected}
      icon={<Ungroup className="w-4 h-4" />}
      darkMode={darkMode}
    >
      Ungroup
    </ContextMenuItem>
    <ContextMenuSeparator darkMode={darkMode} />
    <ContextMenuItem
      onClick={onCopySelection}
      disabled={!hasSelection}
      icon={<Copy className="w-4 h-4" />}
      darkMode={darkMode}
    >
      Copy
    </ContextMenuItem>
    <ContextMenuItem
      onClick={onUndo}
      disabled={!canUndo}
      icon={<Undo className="w-4 h-4" />}
      darkMode={darkMode}
    >
      Undo
    </ContextMenuItem>
    <ContextMenuItem
      onClick={onRedo}
      disabled={!canRedo}
      icon={<Redo className="w-4 h-4" />}
      darkMode={darkMode}
    >
      Redo
    </ContextMenuItem>
  </ContextMenu>
));

LyricsListContextMenu.displayName = 'LyricsListContextMenu';

export default LyricsListContextMenu;
