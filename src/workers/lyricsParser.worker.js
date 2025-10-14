import { parseTxtContent, parseLrcContent } from '../../shared/lyricsParsing.js';

const RESULT_OK = 'success';
const RESULT_ERROR = 'error';

const getRawTextFromPayload = async (payload) => {
  if (!payload) return '';
  if (typeof payload.rawText === 'string') return payload.rawText;
  if (payload.file && typeof payload.file.text === 'function') {
    return await payload.file.text();
  }
  if (payload.file && typeof payload.file.arrayBuffer === 'function') {
    const buffer = await payload.file.arrayBuffer();
    const decoder = new TextDecoder('utf-8');
    return decoder.decode(buffer);
  }
  if (payload.content && typeof payload.content === 'string') {
    return payload.content;
  }
  return '';
};

self.addEventListener('message', async (event) => {
  const { id, action, payload } = event.data || {};
  if (!id) return;

  if (action !== 'parse-file') {
    self.postMessage({ id, status: RESULT_ERROR, error: 'Unknown action' });
    return;
  }

  try {
    const { fileType = 'txt', content, enableSplitting, splitConfig } = payload || {};
    let result;

    if (content) {

      if (fileType === 'lrc') {
        const mod = await import('../../shared/lyricsParsing.js');
        result = mod.parseLrcContent(content, { enableSplitting, splitConfig });
      } else {
        const mod = await import('../../shared/lyricsParsing.js');
        result = mod.parseTxtContent(content, { enableSplitting, splitConfig });
      }
    } else {

      const rawText = await getRawTextFromPayload(payload);
      const mod = await import('../../shared/lyricsParsing.js');
      if (fileType === 'lrc') {
        result = mod.parseLrcContent(rawText, { enableSplitting, splitConfig });
      } else {
        result = mod.parseTxtContent(rawText, { enableSplitting, splitConfig });
      }
    }

    self.postMessage({ id, status: RESULT_OK, result });
  } catch (error) {
    self.postMessage({
      id,
      status: RESULT_ERROR,
      error: error?.message || String(error),
    });
  }
});
