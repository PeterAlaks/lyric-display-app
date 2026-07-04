import { app } from 'electron';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import util from 'util';
import { getUserDataMigrationResult } from './appIdentity.js';
import {
  LOG_RETENTION,
  MANAGED_LOG_FILE_PATTERN,
  buildLogPrunePlan,
  getLogSessionPath,
} from './logRetention.js';

const RESOURCE_LOG_INTERVAL_MS = 60_000;

let initialized = false;
let logDir = null;
let logFilePath = null;
let latestLogFilePath = null;
let fileLoggingReady = false;
let currentLogBytes = 0;
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

const readJsonFile = (filePath) => {
  try {
    if (!filePath || !fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
};

const runGit = (command) => {
  if (app.isPackaged) return null;
  try {
    return execSync(command, {
      cwd: process.cwd(),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return null;
  }
};

const getRuntimeBuildInfo = () => {
  const appPath = (() => {
    try {
      return app.getAppPath?.();
    } catch {
      return null;
    }
  })();

  const candidates = [
    appPath ? path.join(appPath, 'dist', 'build-info.json') : null,
    path.join(process.cwd(), 'dist', 'build-info.json'),
  ];
  const fromFile = candidates.map(readJsonFile).find(Boolean);
  if (fromFile) return fromFile;

  const status = runGit('git status --short');
  return {
    version: app.getVersion?.(),
    builtAt: null,
    commit: runGit('git rev-parse HEAD'),
    shortCommit: runGit('git rev-parse --short=12 HEAD'),
    branch: runGit('git branch --show-current'),
    tag: runGit('git describe --tags --exact-match HEAD'),
    dirty: Boolean(status),
    dirtySummary: status || '',
    source: app.isPackaged ? 'packaged-no-build-info' : 'local-git-fallback',
  };
};

const warnLoggingFailure = (...args) => {
  try {
    originals?.warn?.(...args);
  } catch {
  }
};

const getFileSize = (filePath) => {
  try {
    const stat = fs.statSync(filePath);
    return stat.isFile() ? stat.size : 0;
  } catch {
    return 0;
  }
};

const rotateLogs = (filePath, { force = false } = {}) => {
  try {
    if (!fs.existsSync(filePath)) return false;
    const stat = fs.statSync(filePath);
    if (!stat.isFile() || (!force && stat.size < LOG_RETENTION.maxLogBytes)) return false;

    for (let index = LOG_RETENTION.maxRotatedLogs; index >= 1; index -= 1) {
      const source = `${filePath}.${index}`;
      const target = `${filePath}.${index + 1}`;
      if (index === LOG_RETENTION.maxRotatedLogs && fs.existsSync(source)) {
        fs.rmSync(source, { force: true });
        continue;
      }
      if (fs.existsSync(source)) {
        fs.renameSync(source, target);
      }
    }

    fs.renameSync(filePath, `${filePath}.1`);
    return true;
  } catch (error) {
    warnLoggingFailure('[Logging] Failed to rotate log file:', error);
    return false;
  }
};

const listManagedLogFiles = () => {
  try {
    return fs.readdirSync(logDir, { withFileTypes: true })
      .filter((entry) => entry.isFile() && MANAGED_LOG_FILE_PATTERN.test(entry.name))
      .map((entry) => {
        const filePath = path.join(logDir, entry.name);
        const stat = fs.statSync(filePath);
        return {
          filePath,
          sessionPath: getLogSessionPath(filePath),
          size: stat.size,
          mtimeMs: stat.mtimeMs,
        };
      });
  } catch (error) {
    warnLoggingFailure('[Logging] Failed to list log files for cleanup:', error);
    return [];
  }
};

const pruneLogFolder = ({ preservePaths = [] } = {}) => {
  const deleteLogFile = (filePath) => {
    try {
      fs.rmSync(filePath, { force: true });
      return true;
    } catch (error) {
      warnLoggingFailure('[Logging] Failed to delete old log file:', filePath, error);
      return false;
    }
  };

  const plan = buildLogPrunePlan(listManagedLogFiles(), { preservePaths });
  plan.deletePaths.forEach(deleteLogFile);
  return plan.stats;
};

const appendToLogFile = (text) => {
  if (!fileLoggingReady || !logFilePath) return;

  const byteLength = Buffer.byteLength(text, 'utf8');
  if (currentLogBytes > 0 && currentLogBytes + byteLength > LOG_RETENTION.maxLogBytes) {
    if (rotateLogs(logFilePath, { force: true })) {
      currentLogBytes = 0;
    } else {
      currentLogBytes = getFileSize(logFilePath);
    }
  }

  try {
    fs.appendFileSync(logFilePath, text, 'utf8');
    currentLogBytes += byteLength;
  } catch (error) {
    fileLoggingReady = false;
    warnLoggingFailure('[Logging] Failed to write log file:', error);
  }
};

const writeLine = (level, message) => {
  if (!fileLoggingReady) return;
  const normalized = String(message || '').replace(/\r?\n/g, '\n');
  const lines = normalized.split('\n');
  for (const line of lines) {
    if (line.length === 0) continue;
    appendToLogFile(`[${timestamp()}] [${level}] ${line}\n`);
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

function logUserDataMigrationStatus() {
  const status = getUserDataMigrationResult();
  if (!status) return;

  const conflicts = [
    ...(Array.isArray(status.conflicts) ? status.conflicts : []),
    ...(Array.isArray(status.legacyNdi?.conflicts) ? status.legacyNdi.conflicts : []),
    ...(Array.isArray(status.legacyUserDataNdi?.conflicts) ? status.legacyUserDataNdi.conflicts : []),
  ];
  const errors = [
    ...(Array.isArray(status.errors) ? status.errors : []),
    ...(Array.isArray(status.legacyNdi?.errors) ? status.legacyNdi.errors : []),
    ...(Array.isArray(status.legacyUserDataNdi?.errors) ? status.legacyUserDataNdi.errors : []),
  ];
  const didMigrationWork = Boolean(
    status.attempted ||
    status.reconciliationAttempted ||
    status.legacyNdi?.attempted ||
    status.legacyUserDataNdi?.attempted ||
    conflicts.length ||
    errors.length
  );

  if (didMigrationWork) {
    writeLog('INFO', 'User data migration run status', status);
    return;
  }

  writeLog('INFO', 'User data migration already complete', {
    migratedAt: status.migratedAt,
    sourcePath: status.sourcePath,
    targetPath: status.targetPath,
    deletedLegacy: status.deletedLegacy,
    legacyNdiDeleted: status.legacyNdi?.deletedLegacy,
    legacyUserDataNdiDeleted: status.legacyUserDataNdi?.deletedLegacy,
  });
}

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
    fs.closeSync(fs.openSync(logFilePath, 'a'));
    currentLogBytes = getFileSize(logFilePath);
    fileLoggingReady = true;
    const pruneStats = pruneLogFolder({ preservePaths: [logFilePath] });
    if (pruneStats?.deletedFiles > 0) {
      writeLog('INFO', 'Log retention pruning completed', pruneStats);
    }
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
    build: getRuntimeBuildInfo(),
    pid: process.pid,
    logFilePath,
  });
  logUserDataMigrationStatus();
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
