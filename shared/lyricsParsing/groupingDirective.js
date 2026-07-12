export const EXPLICIT_GROUPING_DIRECTIVE = '[#:LyricDisplay grouping=explicit]';
export const EXPLICIT_GROUPING_MAX_LINES = 12;

const ESCAPED_DIRECTIVE = EXPLICIT_GROUPING_DIRECTIVE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const DIRECTIVE_LINE_REGEX = new RegExp(`^\\s*${ESCAPED_DIRECTIVE}\\s*(?:\\r?\\n|$)`, 'i');

export function extractExplicitGroupingDirective(rawText = '') {
  const content = typeof rawText === 'string' ? rawText : '';
  const explicitGrouping = DIRECTIVE_LINE_REGEX.test(content);

  return {
    explicitGrouping,
    content: explicitGrouping ? content.replace(DIRECTIVE_LINE_REGEX, '') : content,
  };
}

export function serializeExplicitGroupingContent(content = '') {
  const extracted = extractExplicitGroupingDirective(content);
  if (!extracted.content) return EXPLICIT_GROUPING_DIRECTIVE;
  return `${EXPLICIT_GROUPING_DIRECTIVE}\n${extracted.content}`;
}
