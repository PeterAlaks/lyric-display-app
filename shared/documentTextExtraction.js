import { parseLrcContent, parseTxtContent } from './lyricsParsing.js';
import { getLyricParserType, normalizeLyricFileType } from './lyricImportRegistry.js';

const RTF_DESTINATIONS_TO_SKIP = new Set([
  'fonttbl',
  'colortbl',
  'datastore',
  'stylesheet',
  'info',
  'pict',
  'object',
  'xmlopen',
  'xmlclose',
  'header',
  'footer',
  'footnote',
  'annotation',
  'themedata',
]);

function decodeUtf8Bytes(bytes) {
  if (bytes == null) return '';
  const buffer = bytes instanceof ArrayBuffer
    ? bytes
    : ArrayBuffer.isView(bytes)
      ? bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
      : bytes;
  return new TextDecoder('utf-8').decode(buffer);
}

function decodeRtfBytes(bytes) {
  if (bytes == null) return '';
  const buffer = bytes instanceof ArrayBuffer
    ? bytes
    : ArrayBuffer.isView(bytes)
      ? bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
      : bytes;
  try {
    return new TextDecoder('windows-1252').decode(buffer);
  } catch {
    return new TextDecoder('latin1').decode(buffer);
  }
}

export function normalizeMarkdownLyrics(rawText = '') {
  const withoutBom = String(rawText || '').replace(/^\uFEFF/, '');
  let inFence = false;

  return withoutBom
    .split(/\r?\n/)
    .map((line) => {
      let next = line;
      if (/^\s*```/.test(next) || /^\s*~~~/.test(next)) {
        inFence = !inFence;
        return '';
      }

      if (!inFence) {
        next = next.replace(/<!--[\s\S]*?-->/g, '');
        next = next.replace(/^\s{0,3}#{1,6}\s+(.+?)\s*#*\s*$/, '[$1]');
        next = next.replace(/^\s{0,3}>\s?/, '');
        next = next.replace(/^\s{0,3}(?:[-*+]|\d+[.)])\s+/, '');
        next = next.replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1');
        next = next.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
        next = next.replace(/`([^`]+)`/g, '$1');
        next = next.replace(/(\*\*|__)(.*?)\1/g, '$2');
        next = next.replace(/(\*|_)(.*?)\1/g, '$2');
        next = next.replace(/~~(.*?)~~/g, '$1');
      }

      return next.trimEnd();
    })
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function decodeRtfCodepoint(value) {
  const codepoint = Number(value);
  if (!Number.isFinite(codepoint)) return '';
  const normalized = codepoint < 0 ? codepoint + 65536 : codepoint;
  try {
    return String.fromCodePoint(normalized);
  } catch {
    return '';
  }
}

function decodeRtfHex(hex) {
  const code = parseInt(hex, 16);
  if (!Number.isFinite(code)) return '';
  return String.fromCharCode(code);
}

export function extractRtfText(rawRtf = '') {
  const input = String(rawRtf || '');
  const output = [];
  const stack = [{ ignorable: false }];
  let current = stack[0];
  let pendingSkip = 0;
  let unicodeFallbackChars = 1;

  const append = (value) => {
    if (!current.ignorable && value) output.push(value);
  };

  const appendNewline = () => {
    if (current.ignorable) return;
    const text = output.join('');
    if (!text.endsWith('\n')) output.push('\n');
  };

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];

    if (pendingSkip > 0) {
      pendingSkip -= 1;
      continue;
    }

    if (char === '{') {
      current = { ...current };
      stack.push(current);
      continue;
    }

    if (char === '}') {
      stack.pop();
      current = stack[stack.length - 1] || stack[0];
      continue;
    }

    if (char !== '\\') {
      append(char);
      continue;
    }

    const next = input[i + 1];
    if (next === '\\' || next === '{' || next === '}') {
      append(next);
      i += 1;
      continue;
    }

    if (next === '~') {
      append(' ');
      i += 1;
      continue;
    }

    if (next === '-' || next === '_') {
      append('-');
      i += 1;
      continue;
    }

    if (next === '*') {
      current.ignorable = true;
      i += 1;
      continue;
    }

    if (next === "'") {
      const hex = input.slice(i + 2, i + 4);
      append(decodeRtfHex(hex));
      i += 3;
      continue;
    }

    const controlMatch = input.slice(i + 1).match(/^([a-zA-Z]+)(-?\d+)? ?/);
    if (!controlMatch) {
      i += 1;
      continue;
    }

    const [, word, rawParam] = controlMatch;
    i += controlMatch[0].length;

    if (RTF_DESTINATIONS_TO_SKIP.has(word)) {
      current.ignorable = true;
      continue;
    }

    if (word === 'par' || word === 'line') {
      appendNewline();
    } else if (word === 'tab') {
      append('\t');
    } else if (word === 'u') {
      append(decodeRtfCodepoint(rawParam));
      pendingSkip = unicodeFallbackChars;
    } else if (word === 'uc') {
      const count = Number(rawParam);
      unicodeFallbackChars = Number.isFinite(count) ? Math.max(0, count) : unicodeFallbackChars;
    }
  }

  return output
    .join('')
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function extractDocxRawText({ path, rawBytes }) {
  const mammoth = await import('mammoth');
  const input = {};

  if (path) {
    input.path = path;
  } else if (rawBytes) {
    if (typeof Buffer !== 'undefined') {
      input.buffer = Buffer.from(rawBytes);
    } else {
      input.arrayBuffer = rawBytes instanceof ArrayBuffer ? rawBytes : rawBytes.buffer;
    }
  }

  if (!input.path && !input.buffer && !input.arrayBuffer) {
    throw new Error('No DOCX content available for extraction');
  }

  const result = await mammoth.extractRawText(input, { externalFileAccess: false });
  return String(result?.value || '').trim();
}

export async function extractLyricTextFromSource({
  fileType,
  fileName,
  rawText,
  rawBytes,
  path,
  readFile,
} = {}) {
  const normalizedType = normalizeLyricFileType({ fileType, fileName, fallback: 'txt' });

  if (normalizedType === 'docx') {
    return extractDocxRawText({ path, rawBytes });
  }

  let text = typeof rawText === 'string' ? rawText : null;
  if (text === null && path && typeof readFile === 'function') {
    const content = await readFile(path, normalizedType === 'rtf' ? undefined : 'utf8');
    text = normalizedType === 'rtf' && typeof content !== 'string'
      ? decodeRtfBytes(content)
      : String(content || '');
  }
  if (text === null && rawBytes) {
    text = normalizedType === 'rtf' ? decodeRtfBytes(rawBytes) : decodeUtf8Bytes(rawBytes);
  }
  if (text === null) text = '';

  if (normalizedType === 'md') return normalizeMarkdownLyrics(text);
  if (normalizedType === 'rtf') return extractRtfText(text);
  return text;
}

export async function parseLyricImportContent({
  fileType,
  fileName,
  rawText,
  rawBytes,
  path,
  readFile,
  parsingOptions = {},
} = {}) {
  const normalizedType = normalizeLyricFileType({ fileType, fileName, fallback: 'txt' });
  const extractedText = await extractLyricTextFromSource({
    fileType: normalizedType,
    fileName,
    rawText,
    rawBytes,
    path,
    readFile,
  });

  return getLyricParserType(normalizedType) === 'lrc'
    ? parseLrcContent(extractedText, parsingOptions)
    : parseTxtContent(extractedText, parsingOptions);
}
