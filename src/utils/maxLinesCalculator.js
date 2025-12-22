/**
 * Measures how many lines a text will occupy with given styling
 * Accounts for translation lines (text with \n) by rendering them as separate blocks
 * @param {Object} params - Measurement parameters
 * @param {string} params.text - The text to measure
 * @param {number} params.testFontSize - Font size to test in pixels
 * @param {string} params.fontStyle - Font family name
 * @param {boolean} params.bold - Whether text is bold
 * @param {boolean} params.italic - Whether text is italic
 * @param {number} params.horizontalMarginRem - Horizontal margin in rem units
 * @param {Function} params.processDisplayText - Function to process text (e.g., uppercase)
 * @returns {number} Number of lines the text will occupy
 */
export const measureLineCount = ({
  text,
  testFontSize,
  fontStyle,
  bold,
  italic,
  horizontalMarginRem,
  processDisplayText,
  maxLinesEnabled = false,
  maxLines = 3,
  containerWidth = null,
}) => {
  const processedText = processDisplayText(text);

  if (processedText.includes('\n')) {

    const segments = processedText.split('\n').filter(s => s.trim());
    let totalLines = 0;
    let totalGapHeight = 0;

    let GAP_PX = 4;
    let rootFontSize = 16;
    try {
      rootFontSize = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
      GAP_PX = 0.25 * rootFontSize;
    } catch { }

    const viewportWidth = window.innerWidth;
    const horizontalMarginPx = horizontalMarginRem * rootFontSize;
    const availableWidth = containerWidth && containerWidth > 0
      ? containerWidth
      : Math.max(0, viewportWidth - (2 * horizontalMarginPx));

    segments.forEach((segment, index) => {
      const tempDiv = document.createElement('div');
      tempDiv.style.position = 'absolute';
      tempDiv.style.visibility = 'hidden';
      tempDiv.style.fontFamily = fontStyle;
      tempDiv.style.fontSize = `${testFontSize}px`;
      tempDiv.style.fontWeight = bold ? 'bold' : 'normal';
      tempDiv.style.fontStyle = italic ? 'italic' : 'normal';
      tempDiv.style.lineHeight = '1.05';
      tempDiv.style.textAlign = 'center';
      tempDiv.style.whiteSpace = 'pre-wrap';
      tempDiv.style.wordWrap = 'break-word';
      tempDiv.style.wordBreak = 'break-word';
      tempDiv.style.overflowWrap = 'break-word';
      tempDiv.style.width = `${availableWidth}px`;

      const displayText = index > 0
        ? segment.replace(/^[\[({<]|[\])}>\s]*$/g, '').trim()
        : segment;

      tempDiv.textContent = displayText;
      document.body.appendChild(tempDiv);

      const computedStyle = window.getComputedStyle(tempDiv);
      const computedLineHeight = parseFloat(computedStyle.lineHeight);
      const actualLineHeight = isNaN(computedLineHeight) ? testFontSize * 1.05 : computedLineHeight;

      const totalHeight = tempDiv.scrollHeight;
      const rawLines = totalHeight / actualLineHeight;
      const segmentLines = (rawLines % 1 < 0.15) ? Math.floor(rawLines) : Math.ceil(rawLines);

      document.body.removeChild(tempDiv);

      totalLines += segmentLines;
      if (index > 0) totalGapHeight += GAP_PX;
    });

    const lineHeightPx = testFontSize * 1.05;
    const totalLineUnits = totalLines + (totalGapHeight / lineHeightPx);
    const finalLineCount = (totalLineUnits % 1 < 0.15) ? Math.floor(totalLineUnits) : Math.ceil(totalLineUnits);
    return finalLineCount;
  } else {

    const tempDiv = document.createElement('div');
    tempDiv.style.position = 'absolute';
    tempDiv.style.visibility = 'hidden';
    tempDiv.style.fontFamily = fontStyle;
    tempDiv.style.fontSize = `${testFontSize}px`;
    tempDiv.style.fontWeight = bold ? 'bold' : 'normal';
    tempDiv.style.fontStyle = italic ? 'italic' : 'normal';
    tempDiv.style.lineHeight = '1.05';
    tempDiv.style.textAlign = 'center';
    tempDiv.style.whiteSpace = 'pre-wrap';
    tempDiv.style.wordWrap = 'break-word';
    tempDiv.style.wordBreak = 'break-word';
    tempDiv.style.overflowWrap = 'break-word';

    let rootFontSize = 16;
    try {
      rootFontSize = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    } catch { }
    const viewportWidth = window.innerWidth;
    const horizontalMarginPx = horizontalMarginRem * rootFontSize;
    const availableWidth = containerWidth && containerWidth > 0
      ? containerWidth
      : Math.max(0, viewportWidth - (2 * horizontalMarginPx));
    tempDiv.style.width = `${availableWidth}px`;

    tempDiv.textContent = processedText;
    document.body.appendChild(tempDiv);

    const computedStyle = window.getComputedStyle(tempDiv);
    const computedLineHeight = parseFloat(computedStyle.lineHeight);
    const actualLineHeight = isNaN(computedLineHeight) ? testFontSize * 1.05 : computedLineHeight;

    const totalHeight = tempDiv.scrollHeight;
    const rawLines = totalHeight / actualLineHeight;
    const lineCount = (rawLines % 1 < 0.15) ? Math.floor(rawLines) : Math.ceil(rawLines);

    document.body.removeChild(tempDiv);
    return lineCount;
  }
};

/**
 * Calculates the optimal font size to fit text within max lines constraint
 * @param {Object} params - Calculation parameters
 * @param {string} params.text - The text to fit
 * @param {number} params.fontSize - User's preferred font size
 * @param {number} params.maxLines - Maximum allowed lines
 * @param {number} params.minFontSize - Minimum allowed font size
 * @param {string} params.fontStyle - Font family name
 * @param {boolean} params.bold - Whether text is bold
 * @param {boolean} params.italic - Whether text is italic
 * @param {number} params.horizontalMarginRem - Horizontal margin in rem units
 * @param {Function} params.processDisplayText - Function to process text
 * @param {number|null} params.currentAdjustedSize - Current adjusted font size (for optimization)
 * @returns {Object} Result object with adjustedSize and isTruncated properties
 */
export const calculateOptimalFontSize = ({
  text,
  fontSize,
  maxLines,
  minFontSize,
  fontStyle,
  bold,
  italic,
  horizontalMarginRem,
  processDisplayText,
  currentAdjustedSize,
  maxLinesEnabled = false,
  containerWidth = null,
}) => {
  const targetMaxLines = Math.max(1, Math.min(10, maxLines));
  const targetMinSize = Math.max(12, Math.min(100, minFontSize));

  let currentLineCount = measureLineCount({
    text,
    testFontSize: fontSize,
    fontStyle,
    bold,
    italic,
    horizontalMarginRem,
    processDisplayText,
    maxLinesEnabled,
    maxLines,
    containerWidth,
  });

  if (currentLineCount <= targetMaxLines) {
    return { adjustedSize: null, isTruncated: false };
  }

  let testSize = fontSize;
  while (testSize > targetMinSize && currentLineCount > targetMaxLines) {
    testSize -= 1;
    currentLineCount = measureLineCount({
      text,
      testFontSize: testSize,
      fontStyle,
      bold,
      italic,
      horizontalMarginRem,
      processDisplayText,
      maxLinesEnabled,
      maxLines,
      containerWidth,
    });
  }

  if (currentLineCount <= targetMaxLines) {

    return { adjustedSize: testSize, isTruncated: false };
  } else {

    return { adjustedSize: targetMinSize, isTruncated: true };
  }
};