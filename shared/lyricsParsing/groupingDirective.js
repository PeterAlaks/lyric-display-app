export const EXPLICIT_GROUPING_DIRECTIVE = '[#:LyricDisplay grouping=explicit]';

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
