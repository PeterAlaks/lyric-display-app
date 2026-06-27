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
      className={`pointer-events-auto absolute flex items-center gap-1 rounded-full border px-1.5 py-1 text-xs font-medium shadow-lg backdrop-blur transition-all duration-150 ${darkMode ? 'bg-gray-900/95 text-gray-100 border-gray-800' : 'bg-white/95 text-gray-700 border-gray-200'}`}
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
            className={`rounded-full px-2.5 py-1 transition-colors duration-150 ${darkMode ? 'hover:bg-blue-500/10 hover:text-blue-300 focus-visible:bg-blue-500/10 focus-visible:text-blue-300' : 'hover:bg-blue-50 hover:text-blue-600 focus-visible:bg-blue-50 focus-visible:text-blue-600'}`}
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
          <div className={`h-4 w-px ${darkMode ? 'bg-gray-800' : 'bg-gray-200'}`} />
        </>
      )}
      <button
        type="button"
        className={`rounded-full px-2.5 py-1 transition-colors duration-150 ${darkMode ? 'hover:bg-blue-500/10 hover:text-blue-300 focus-visible:bg-blue-500/10 focus-visible:text-blue-300' : 'hover:bg-blue-50 hover:text-blue-600 focus-visible:bg-blue-50 focus-visible:text-blue-600'}`}
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
