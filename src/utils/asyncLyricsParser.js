import { parseLyrics } from './parseLyrics';
import { parseLrc } from './parseLrc';
import { parseTxtContent, parseLrcContent } from '../../shared/lyricsParsing.js';

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

const parseViaElectronIPC = async (file, options) => {
  if (!isElectron() || !window.electronAPI?.parseLyricsFile) return null;
  const fileType = options.fileType || 'txt';
  const payload = {
    fileType,
    name: options.name || file?.name || '',
    path: file?.path || options.path || null,
    rawText: options.rawText || null,
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
  const workerPromise = sendToWorker({
    action: 'parse-file',
    payload: {
      fileType: options.fileType,
      file: file ?? null,
      content: options.rawText ?? null,
    },
  });

  return workerPromise;
};

const parseSynchronously = async (file, options) => {
  if (options.rawText) {
    return options.fileType === 'lrc'
      ? parseLrcContent(options.rawText)
      : parseTxtContent(options.rawText);
  }

  if (options.fileType === 'lrc') {
    return parseLrc(file);
  }
  return parseLyrics(file);
};

const detectFileType = (file, explicitType) => {
  if (explicitType) return explicitType;
  const name = (file?.name || '').toLowerCase();
  if (name.endsWith('.lrc')) return 'lrc';
  return 'txt';
};

/**
 * Parse a lyrics file asynchronously using the best available strategy.
 * @param {File|undefined|null} file
 * @param {{ fileType?: 'txt' | 'lrc', rawText?: string, path?: string, name?: string, enableSplitting?: boolean, splitConfig?: object }} options
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
