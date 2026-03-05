/**
 * IPC Handlers (Legacy Entry Point)
 *
 * This file serves as a compatibility layer, re-exporting from the new
 * modular IPC handler structure located in the ./ipc folder.
 *
 * Handlers are organized into logical groups for better maintainability.
 */

export { registerIpcHandlers } from './ipc/index.js';
