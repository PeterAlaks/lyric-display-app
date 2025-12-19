const BLOCK_TAG_PATTERN = /^<(h[1-6]|p|ul|ol|li|pre|code|blockquote|hr|table|thead|tbody|tr|td|th|div|section|article|aside|header|footer)/i;
const HTML_TAG_PATTERN = /<\/?[a-z][\s\S]*>/i;

function isLikelyHtml(content) {
  return HTML_TAG_PATTERN.test(content);
}

function sanitizeHtml(html) {
  if (!html) return '';
  let safe = String(html);

  safe = safe.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '');
  safe = safe.replace(/\son\w+="[^"]*"/gi, '');
  safe = safe.replace(/\son\w+='[^']*'/gi, '');
  safe = safe.replace(/javascript:/gi, '');
  return safe;
}

export function convertMarkdownToHTML(markdown) {
  if (!markdown) return '';

  const original = String(markdown).trim();

  if (isLikelyHtml(original)) {
    return sanitizeHtml(original);
  }

  let html = original;

  html = html.replace(/^### (.*)$/gim, '<h3 style="font-size: 1.125rem; font-weight: 600; margin-top: 1.5rem; margin-bottom: 0.75rem; line-height: 1.4;">$1</h3>');
  html = html.replace(/^## (.*)$/gim, '<h2 style="font-size: 1.5rem; font-weight: 700; margin-top: 0; margin-bottom: 1rem; line-height: 1.3;">$1</h2>');
  html = html.replace(/^# (.*)$/gim, '<h1 style="font-size: 1.875rem; font-weight: 700; margin-top: 0; margin-bottom: 1rem; line-height: 1.2;">$1</h1>');

  html = html.replace(/\*\*(.+?)\*\*/g, '<strong style="font-weight: 600;">$1</strong>');
  html = html.replace(/__(.+?)__/g, '<strong style="font-weight: 600;">$1</strong>');

  html = html.replace(/\*([^*]+?)\*/g, '<em style="font-style: italic;">$1</em>');
  html = html.replace(/_([^_]+?)_/g, '<em style="font-style: italic;">$1</em>');

  html = html.replace(/`(.+?)`/g, '<code style="background-color: rgba(0,0,0,0.1); padding: 0.125rem 0.25rem; border-radius: 0.25rem; font-family: monospace; font-size: 0.875em;">$1</code>');

  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" style="color: #3b82f6; text-decoration: underline;">$1</a>');

  const lines = html.split('\n');
  let inList = false;
  const processedLines = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const listMatch = line.match(/^[\s]*[-*+]\s+(.*)$/);

    if (listMatch) {
      if (!inList) {
        processedLines.push('<ul style="margin-top: 0.5rem; margin-bottom: 0.5rem; padding-left: 1.5rem; list-style-type: disc;">');
        inList = true;
      }
      processedLines.push(`<li style="margin-bottom: 0.25rem;">${listMatch[1]}</li>`);
      continue;
    }

    const isBlank = line.trim() === '';
    const nextLine = lines[i + 1] || '';
    const nextIsList = /^\s*[-*+]\s+/.test(nextLine);
    if (inList && isBlank && nextIsList) {
      continue;
    }

    if (inList) {
      processedLines.push('</ul>');
      inList = false;
    }

    processedLines.push(line);
  }

  if (inList) {
    processedLines.push('</ul>');
  }

  html = processedLines.join('\n');

  const paragraphs = html.split('\n\n');
  html = paragraphs.map(para => {
    const trimmed = para.trim();
    if (!trimmed) return '';
    if (BLOCK_TAG_PATTERN.test(trimmed) || trimmed.startsWith('</ul>')) {
      return trimmed;
    }
    return `<p style="margin-bottom: 0.75rem; line-height: 1.6;">${trimmed.replace(/\n/g, '<br>')}</p>`;
  }).join('\n');

  return sanitizeHtml(html);
}

export function trimReleaseNotes(content, separator = '---') {
  if (!content) {
    return '';
  }

  const raw = String(content);

  const hrIndex = raw.search(/<hr\s*\/?>/i);
  if (hrIndex !== -1) {
    return raw.slice(0, hrIndex).trim();
  }

  if (raw.includes(separator)) {
    return raw.split(separator)[0].trim();
  }

  return raw.trim();
}

export function formatReleaseNotes(releaseNotes) {
  if (!releaseNotes) return '';

  if (typeof releaseNotes === 'string') {
    return releaseNotes;
  }

  if (Array.isArray(releaseNotes)) {
    return releaseNotes.map(note => {
      if (typeof note === 'string') return note;
      if (note?.note) return note.note;
      return '';
    }).filter(Boolean).join('\n\n');
  }

  return '';
}