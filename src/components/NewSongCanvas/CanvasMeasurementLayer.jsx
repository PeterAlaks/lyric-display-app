const CanvasMeasurementLayer = ({ editorPadding, lines, measurementContainerRef, measurementRefs }) => (
  <div
    ref={measurementContainerRef}
    aria-hidden="true"
    className="pointer-events-none absolute inset-0 select-none overflow-hidden whitespace-pre-wrap wrap-break-word font-mono text-base leading-relaxed opacity-0"
    style={{
      paddingTop: `${editorPadding.top}px`,
      paddingRight: `${editorPadding.right}px`,
      paddingBottom: `${editorPadding.bottom}px`,
      paddingLeft: `${editorPadding.left}px`
    }}
  >
    {lines.map((line, index) => (
      <div
        key={index}
        ref={(node) => {
          measurementRefs.current[index] = node;
        }}
      >
        <span className="inline-block whitespace-pre-wrap wrap-break-word">
          {line.length > 0 ? line : '\u00A0'}
        </span>
      </div>
    ))}
  </div>
);

export default CanvasMeasurementLayer;
