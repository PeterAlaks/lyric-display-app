import { useEffect } from 'react';

export const useCanvasDismissalEffects = ({
  closeContextMenu,
  closeSearchBar,
  contextMenuRef,
  contextMenuVisible,
  editorContainerRef,
  handleBack,
  searchBarVisible,
  sectionDropdownOpen,
  sectionDropdownRef,
  selectedLineIndex,
  setSectionDropdownOpen,
  setSelectedLineIndex,
}) => {
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        if (searchBarVisible) {
          closeSearchBar();
        } else if (contextMenuVisible || selectedLineIndex !== null) {
          setSelectedLineIndex(null);
          closeContextMenu();
        } else {
          handleBack();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [closeContextMenu, closeSearchBar, contextMenuVisible, handleBack, searchBarVisible, selectedLineIndex, setSelectedLineIndex]);

  useEffect(() => {
    const handleMouseDown = (event) => {
      if (!editorContainerRef.current) return;
      if (!editorContainerRef.current.contains(event.target)) {
        setSelectedLineIndex(null);
        closeContextMenu();
      } else if (
        contextMenuVisible &&
        contextMenuRef.current &&
        !contextMenuRef.current.contains(event.target)
      ) {
        closeContextMenu();
      }

      if (sectionDropdownOpen && sectionDropdownRef.current && !sectionDropdownRef.current.contains(event.target)) {
        const button = sectionDropdownRef.current.previousElementSibling;
        if (!button || !button.contains(event.target)) {
          setSectionDropdownOpen(false);
        }
      }
    };
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [closeContextMenu, contextMenuRef, contextMenuVisible, editorContainerRef, sectionDropdownOpen, sectionDropdownRef, setSectionDropdownOpen, setSelectedLineIndex]);
};
