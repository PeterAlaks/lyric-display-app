import { app } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';

// Determine app root relative to this module (main/ -> project root)
const moduleDir = path.dirname(fileURLToPath(import.meta.url));
export const appRoot = path.resolve(moduleDir, '..');

export const isDev = !app.isPackaged;

export function resolveProductionPath(...segments) {
  if (isDev) {
    return path.join(appRoot, ...segments);
  } else {
    return path.join(process.resourcesPath, 'app.asar.unpacked', ...segments);
  }
}

