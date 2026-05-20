const CanvasFloatingToolbar = ({
  canAddTranslationOnSelectedLine,
  darkMode,
  handleAddTranslation,
  insertStandardTimestampAtLine,
  selectedLineIndex,
  selectedMetric,
  toolbarHeight,
  toolbarLeft,
  toolbarRef,
  toolbarTop,
  toolbarVisible,
}) => {
  if (!toolbarVisible || !selectedMetric) return null;

  return (
    <div
      ref={toolbarRef}
      className={`pointer-events-auto absolute flex items-center gap-2 rounded-md border px-2 py-1 text-xs font-medium shadow-sm transition-all duration-150 ${darkMode ? 'bg-gray-800 text-gray-100 border-gray-700' : 'bg-white text-gray-700 border-gray-200'}`}
      style={{
        top: toolbarTop,
        left: toolbarLeft,
        height: toolbarHeight || undefined,
      }}
    >
      {canAddTranslationOnSelectedLine && (
        <>
          <button
            type="button"
            className={`rounded-sm px-2 py-1 transition-colors duration-150 ${darkMode ? 'hover:bg-gray-700 focus-visible:bg-gray-700' : 'hover:bg-gray-100 focus-visible:bg-gray-100'}`}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              if (selectedLineIndex !== null) {
                handleAddTranslation(selectedLineIndex);
              }
            }}
          >
            Add Translation
          </button>
          <div className={`h-4 w-px ${darkMode ? 'bg-gray-700' : 'bg-gray-200'}`} />
        </>
      )}
      <button
        type="button"
        className={`rounded-sm px-2 py-1 transition-colors duration-150 ${darkMode ? 'hover:bg-gray-700 focus-visible:bg-gray-700' : 'hover:bg-gray-100 focus-visible:bg-gray-100'}`}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          if (selectedLineIndex !== null) {
            insertStandardTimestampAtLine(selectedLineIndex);
          }
        }}
      >
        Add Timestamp
      </button>
    </div>
  );
};

export default CanvasFloatingToolbar;
