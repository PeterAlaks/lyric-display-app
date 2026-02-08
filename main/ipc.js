/**
 * IPC Handlers (Legacy Entry Point)
 * 
 * This file now serves as a compatibility layer, re-exporting from the new
 * modular IPC handler structure located in the ./ipc folder.
 * 
 * The handlers have been organized into logical groups for better maintainability:
 */

export { registerIpcHandlers } from './ipc/index.js';