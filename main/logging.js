import { app } from 'electron';
import fs from 'fs';
import path from 'path';
import util from 'util';
import { getUserDataMigrationResult } from './appIdentity.js';

const MAX_LOG_BYTES = 5 * 1024 * 1024;
const MAX_ROTATED_LOGS = 3;
const RESOURCE_LOG_INTERVAL_MS = 60_000;

let initialized = false;
let logDir = null;
let logFilePath = null;
let latestLogFilePath = null;
let logStream = null;
let originals = null;
let resourceDiagnosticsTimer = null;
let resourceDiagnosticsPending = false;

const timestamp = () => new Date().toISOString();

const safeInspect = (value) => {
  if (typeof value === 'string') return value;
  return util.inspect(value, {
    depth: 5,
    breakLength: 140,
    maxArrayLength: 80,
  });
};

const formatArgs = (args) => args.map(safeInspect).join(' ');

const createSessionLogFileName = () => {
  const stamp = new Date()
    .toISOString()
    .replace(/[:.]/g, '-')
    .replace('T', '_')
    .replace('Z', '');
  return `lyricdisplay-${stamp}-pid${process.pid}.log`;
};

const resolveLogDir = () => {
  try {
    app.setAppLogsPath();
    const electronLogDir = app.getPath('logs');
    if (electronLogDir) return electronLogDir;
  } catch {
  }

  try {
    return path.join(app.getPath('userData'), 'logs');
  } catch {
    return path.join(process.cwd(), 'logs');
  }
};

const rotateLogs = (filePath) => {
  try {
    if (!fs.existsSync(filePath)) return;
    const stat = fs.statSync(filePath);
    if (!stat.isFile() || stat.size < MAX_LOG_BYTES) return;

    for (let index = MAX_ROTATED_LOGS; index >= 1; index -= 1) {
      const source = `${filePath}.${index}`;
      const target = `${filePath}.${index + 1}`;
      if (index === MAX_ROTATED_LOGS && fs.existsSync(source)) {
        fs.rmSync(source, { force: true });
        continue;
      }
      if (fs.existsSync(source)) {
        fs.renameSync(source, target);
      }
    }

    fs.renameSync(filePath, `${filePath}.1`);
  } catch (error) {
    try {
      originals?.warn?.('[Logging] Failed to rotate log file:', error);
    } catch {
    }
  }
};

const writeLine = (level, message) => {
  if (!logStream) return;
  const normalized = String(message || '').replace(/\r?\n/g, '\n');
  const lines = normalized.split('\n');
  for (const line of lines) {
    if (line.length === 0) continue;
    logStream.write(`[${timestamp()}] [${level}] ${line}\n`);
  }
};

export const writeLog = (level, ...args) => {
  writeLine(level, formatArgs(args));
};

export const writeRawLog = (level, text) => {
  writeLine(level, text);
};

export const getLogPaths = () => ({
  logDir,
  logFilePath,
  latestLogFilePath,
});

function summarizeAppMetrics() {
  try {
    return app.getAppMetrics().map((metric) => ({
      type: metric.type,
      pid: metric.pid,
      cpuPercent: metric.cpu?.percentCPUUsage,
      memory: metric.memory,
    }));
  } catch (error) {
    return { error: error?.message || String(error) };
  }
}

async function logResourceDiagnostics(reason) {
  if (resourceDiagnosticsPending) return;
  resourceDiagnosticsPending = true;
  try {
    const systemMemory = typeof process.getSystemMemoryInfo === 'function'
      ? process.getSystemMemoryInfo()
      : null;
    const mainProcessMemory = typeof process.getProcessMemoryInfo === 'function'
      ? await process.getProcessMemoryInfo()
      : null;

    writeLog('APP_RESOURCE', reason, {
      systemMemory,
      mainProcessMemory,
      appMetrics: summarizeAppMetrics(),
    });
  } catch (error) {
    writeLog('APP_RESOURCE_ERROR', reason, error);
  } finally {
    resourceDiagnosticsPending = false;
  }
}

function startResourceDiagnostics() {
  if (resourceDiagnosticsTimer) return;

  app.whenReady()
    .then(() => logResourceDiagnostics('startup'))
    .catch((error) => writeLog('APP_RESOURCE_ERROR', 'startup', error));

  resourceDiagnosticsTimer = setInterval(() => {
    logResourceDiagnostics('interval');
  }, RESOURCE_LOG_INTERVAL_MS);
  resourceDiagnosticsTimer.unref?.();

  app.once('before-quit', () => {
    if (resourceDiagnosticsTimer) {
      clearInterval(resourceDiagnosticsTimer);
      resourceDiagnosticsTimer = null;
    }
  });
}

export function initFileLogging() {
  if (initialized) return getLogPaths();
  initialized = true;
  originals = {
    log: console.log.bind(console),
    info: console.info.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console),
    debug: console.debug.bind(console),
  };

  try {
    logDir = resolveLogDir();
    fs.mkdirSync(logDir, { recursive: true });
    logFilePath = path.join(logDir, createSessionLogFileName());
    latestLogFilePath = path.join(logDir, 'latest.log');
    rotateLogs(logFilePath);
    rotateLogs(latestLogFilePath);
    logStream = fs.createWriteStream(logFilePath, { flags: 'a' });
    try {
      fs.writeFileSync(latestLogFilePath, logFilePath, 'utf8');
    } catch (error) {
      originals.warn('[Logging] Failed to write latest log pointer:', error);
    }
  } catch (error) {
    originals.warn('[Logging] Failed to initialize file logging:', error);
    return getLogPaths();
  }

  ['log', 'info', 'warn', 'error', 'debug'].forEach((method) => {
    console[method] = (...args) => {
      try {
        originals[method](...args);
      } catch {
      }
      writeLog(method.toUpperCase(), ...args);
    };
  });

  process.on('uncaughtExceptionMonitor', (error) => {
    writeLog('FATAL', 'Uncaught exception:', error?.stack || error);
    try {
      originals.error('[Logging] Uncaught exception:', error);
    } catch {
    }
  });

  process.on('unhandledRejection', (reason) => {
    writeLog('FATAL', 'Unhandled rejection:', reason?.stack || reason);
    try {
      originals.error('[Logging] Unhandled rejection:', reason);
    } catch {
    }
  });

  process.on('warning', (warning) => {
    writeLog('PROCESS_WARNING', {
      name: warning?.name,
      code: warning?.code,
      message: warning?.message,
      stack: warning?.stack,
    });
  });

  writeLog('INFO', 'Logging initialized', {
    appName: app.getName?.(),
    version: app.getVersion?.(),
    packaged: app.isPackaged,
    pid: process.pid,
    logFilePath,
  });
  writeLog('INFO', 'User data migration status', getUserDataMigrationResult());
  startResourceDiagnostics();

  return getLogPaths();
}

export function mirrorStreamToLog(stream, level, targetStream = null) {
  if (!stream) return;
  stream.on('data', (chunk) => {
    const text = Buffer.isBuffer(chunk) ? chunk.toString('utf8') : String(chunk);
    if (targetStream?.write) {
      try {
        targetStream.write(text);
      } catch {
      }
    }
    writeRawLog(level, text);
  });
}
