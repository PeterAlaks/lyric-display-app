import { parseLyrics } from './parseLyrics.js';
import { parseLrc } from './parseLrc.js';
import { parseTxtContent, parseLrcContent } from '../../shared/lyricsParsing.js';
import { normalizeLyricFileType } from '../../shared/lyricImportRegistry.js';
import { parseLyricImportContent } from '../../shared/documentTextExtraction.js';

let workerInstance = null;
let workerInitAttempted = false;
let workerInitFailed = false;
let requestIdCounter = 0;
const pendingRequests = new Map();

const isElectron = () => typeof window !== 'undefined' && Boolean(window.electronAPI);

const teardownWorker = () => {
  if (workerInstance) {
    try {
      workerInstance.terminate();
    } catch { /* ignore */ }
  }
  workerInstance = null;
  workerInitAttempted = false;
  workerInitFailed = true;

  pendingRequests.forEach(({ reject }) => {
    reject(new Error('Lyrics parser worker terminated'));
  });
  pendingRequests.clear();
};

const ensureWorker = () => {
  if (workerInstance) return workerInstance;
  if (workerInitAttempted) return workerInitFailed ? null : workerInstance;
  workerInitAttempted = true;

  if (typeof window === 'undefined' || typeof Worker === 'undefined') {
    workerInitFailed = true;
    return null;
  }

  if (isElectron()) {
    workerInitFailed = true;
    return null;
  }

  try {
    workerInstance = new Worker(new URL('../workers/lyricsParser.worker.js', import.meta.url), { type: 'module' });
    workerInstance.addEventListener('message', (event) => {
      const { id, status, result, error } = event.data || {};
      if (!id || !pendingRequests.has(id)) return;
      const { resolve, reject } = pendingRequests.get(id);
      pendingRequests.delete(id);

      if (status === 'success') {
        resolve(result);
      } else {
        reject(new Error(error || 'Failed to parse lyrics'));
      }
    });
    workerInstance.addEventListener('error', () => {
      teardownWorker();
    });
  } catch (error) {
    console.error('Failed to initialise lyrics parser worker:', error);
    workerInitFailed = true;
    workerInstance = null;
  }

  return workerInstance;
};

const sendToWorker = (payload) => {
  const worker = ensureWorker();
  if (!worker) return null;

  const id = ++requestIdCounter;
  return new Promise((resolve, reject) => {
    pendingRequests.set(id, { resolve, reject });
    try {
      worker.postMessage({ id, ...payload });
    } catch (error) {
      pendingRequests.delete(id);
      reject(error);
    }
  });
};

const readRawTextFromFile = async (file) => {
  if (!file) return null;

  if (typeof file.text === 'function') {
    return file.text();
  }

  if (typeof file.arrayBuffer === 'function') {
    const buffer = await file.arrayBuffer();
    return new TextDecoder('utf-8').decode(buffer);
  }

  return null;
};

const readRawBytesFromFile = async (file) => {
  if (!file || typeof file.arrayBuffer !== 'function') return null;
  return file.arrayBuffer();
};

const parseViaElectronIPC = async (file, options) => {
  if (!isElectron() || !window.electronAPI?.parseLyricsFile) return null;
  const fileType = options.fileType || 'txt';
  const prefersBytes = fileType === 'docx' || fileType === 'rtf';
  const filePath = file?.path || options.path || options.filePath || null;
  let rawText = typeof options.rawText === 'string' ? options.rawText : null;
  let rawBytes = options.rawBytes || null;

  if (!filePath && rawText === null && !prefersBytes) {
    rawText = await readRawTextFromFile(file);
  }

  if (!filePath && rawText === null && !rawBytes && prefersBytes) {
    rawBytes = await readRawBytesFromFile(file);
  }

  if (!filePath && rawText === null && !rawBytes) {
    return null;
  }

  const payload = {
    fileType,
    name: options.name || file?.name || '',
    path: filePath,
    rawText,
    rawBytes,
  };

  try {
    const response = await window.electronAPI.parseLyricsFile(payload);
    if (response?.success && response.payload) {
      return response.payload;
    }
    if (response?.error) {
      throw new Error(response.error);
    }
    return null;
  } catch (error) {
    console.error('Electron IPC lyric parsing failed, falling back:', error);
    return null;
  }
};

const parseViaWorker = (file, options) => {
  if (!['txt', 'lrc'].includes(options.fileType)) return null;

  const workerPromise = sendToWorker({
    action: 'parse-file',
    payload: {
      fileType: options.fileType,
      file: file ?? null,
      content: options.rawText ?? null,
      enableSplitting: options.enableSplitting,
      splitConfig: options.splitConfig,
      groupingConfig: options.groupingConfig,
    },
  });

  return workerPromise;
};

const parseSynchronously = async (file, options) => {
  const parserOptions = {
    enableSplitting: options.enableSplitting,
    splitConfig: options.splitConfig,
    groupingConfig: options.groupingConfig,
  };

  if (!['txt', 'lrc'].includes(options.fileType)) {
    let rawBytes = options.rawBytes || null;
    let rawText = typeof options.rawText === 'string' ? options.rawText : null;
    const prefersBytes = options.fileType === 'docx' || options.fileType === 'rtf';

    if (rawText === null && !prefersBytes) {
      rawText = await readRawTextFromFile(file);
    }
    if (!rawBytes && prefersBytes) {
      rawBytes = await readRawBytesFromFile(file);
    }

    return parseLyricImportContent({
      fileType: options.fileType,
      fileName: options.name || file?.name || '',
      rawText,
      rawBytes,
      parsingOptions: parserOptions,
    });
  }

  if (typeof options.rawText === 'string') {
    return options.fileType === 'lrc'
      ? parseLrcContent(options.rawText, parserOptions)
      : parseTxtContent(options.rawText, parserOptions);
  }

  if (options.fileType === 'lrc') {
    return parseLrc(file, parserOptions);
  }
  return parseLyrics(file, parserOptions);
};

const detectFileType = (file, explicitType) => {
  return normalizeLyricFileType({
    fileType: explicitType,
    fileName: file?.name,
    fallback: 'txt',
  });
};

/**
 * Parse a lyrics file asynchronously using the best available strategy.
 * @param {File|undefined|null} file
 * @param {{ fileType?: 'txt' | 'lrc' | 'md' | 'rtf' | 'docx', rawText?: string, rawBytes?: ArrayBuffer, path?: string, name?: string, enableSplitting?: boolean, splitConfig?: object }} options
 */
export async function parseLyricsFileAsync(file, options = {}) {
  const fileType = detectFileType(file, options.fileType);
  const parseOptions = {
    ...options,
    fileType,
    name: options.name || file?.name || '',
    enableSplitting: options.enableSplitting ?? false,
    splitConfig: options.splitConfig || {},
  };

  const ipcResult = await parseViaElectronIPC(file, parseOptions);
  if (ipcResult) return ipcResult;

  const workerPromise = parseViaWorker(file, parseOptions);
  if (workerPromise) {
    try {
      return await workerPromise;
    } catch (error) {
      console.warn('Worker lyric parsing failed, falling back:', error);
    }
  }

  return parseSynchronously(file, parseOptions);
}
