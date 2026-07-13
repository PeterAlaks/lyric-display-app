import { clearRuntimeGroupingConfig, setRuntimeGroupingConfig } from './runtimeConfig.js';
import { processRawTextToLines } from './txtProcessor.js';
import { deriveSectionsFromProcessedLines } from './sections.js';
import { extractExplicitGroupingDirective } from './groupingDirective.js';
import { applyGroupingPlan, createGroupingPlan } from './groupingPlan.js';

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
      } : {}),
    });
  }

  try {
    const initiallyProcessedLines = processRawTextToLines(directive.content, options);
    const groupingResult = applyGroupingPlan(initiallyProcessedLines, options.groupingPlan);
    const processedLines = groupingResult.processedLines;
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

    return {
      rawText: reconstructed,
      processedLines,
      sections,
      lineToSection,
      groupingPlan: createGroupingPlan(processedLines),
      groupingPlanApplied: groupingResult.applied,
    };
  } finally {
    clearRuntimeGroupingConfig();
  }
}
