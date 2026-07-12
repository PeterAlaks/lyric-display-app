import { clearRuntimeGroupingConfig, setRuntimeGroupingConfig } from './runtimeConfig.js';
import { processRawTextToLines } from './txtProcessor.js';
import { deriveSectionsFromProcessedLines } from './sections.js';
import { EXPLICIT_GROUPING_MAX_LINES, extractExplicitGroupingDirective } from './groupingDirective.js';

/**
 * Parse plain text lyric content into processed lines with translation and normal groupings.
 * Enhanced with intelligent line splitting.
 * @param {string} rawText
 * @param {object} options - { enableSplitting: boolean, splitConfig: object, groupingConfig: object }
 * @returns {{ rawText: string, processedLines: Array<string | object> }}
 */
export function parseTxtContent(rawText = '', options = {}) {
  const directive = extractExplicitGroupingDirective(rawText);
  if (options.groupingConfig || directive.explicitGrouping) {
    setRuntimeGroupingConfig({
      ...(options.groupingConfig || {}),
      ...(directive.explicitGrouping ? {
        enableCrossBlankLineGrouping: false,
        maxLinesPerGroup: EXPLICIT_GROUPING_MAX_LINES,
      } : {}),
    });
  }

  try {
    const processedLines = processRawTextToLines(directive.content, options);
    const { sections, lineToSection } = deriveSectionsFromProcessedLines(processedLines);

    const reconstructed = processedLines.map((line) => {
      if (typeof line === 'string') return line;
      if (line && line.type === 'group') {
        return `${line.mainLine}\n${line.translation}`;
      }
      if (line && line.type === 'normal-group') {
        if (Array.isArray(line.lines) && line.lines.length > 0) {
          return line.lines.join('\n');
        }
        return `${line.line1 || ''}\n${line.line2 || ''}`.trim();
      }
      return '';
    }).join('\n\n');

    return { rawText: reconstructed, processedLines, sections, lineToSection };
  } finally {
    clearRuntimeGroupingConfig();
  }
}
