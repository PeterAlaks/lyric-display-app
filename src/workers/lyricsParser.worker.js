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
    const { fileType = 'txt', content, enableSplitting, splitConfig, groupingConfig } = payload || {};
    const parseOptions = { enableSplitting, splitConfig, groupingConfig };
    let result;

    if (content) {
      if (fileType === 'lrc') {
        result = parseLrcContent(content, parseOptions);
      } else {
        result = parseTxtContent(content, parseOptions);
      }
    } else {
      const rawText = await getRawTextFromPayload(payload);
      if (fileType === 'lrc') {
        result = parseLrcContent(rawText, parseOptions);
      } else {
        result = parseTxtContent(rawText, parseOptions);
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
