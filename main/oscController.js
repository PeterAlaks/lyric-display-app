/**
 * OSC Controller Module
 * Handles OSC (Open Sound Control) input/output for external control of LyricDisplay
 */

import { EventEmitter } from 'events';
import Store from 'electron-store';
import dgram from 'dgram';

// OSC message types
const OSC_TYPE_INT = 'i';
const OSC_TYPE_FLOAT = 'f';
const OSC_TYPE_STRING = 's';
const OSC_TYPE_BLOB = 'b';
const OSC_TYPE_TRUE = 'T';
const OSC_TYPE_FALSE = 'F';
const OSC_TYPE_NIL = 'N';

/**
 * Simple OSC message parser
 */
function parseOSCMessage(buffer) {
  let offset = 0;
  
  // Read address pattern (null-terminated string, padded to 4 bytes)
  const addressEnd = buffer.indexOf(0, offset);
  if (addressEnd === -1) return null;
  
  const address = buffer.toString('utf8', offset, addressEnd);
  offset = Math.ceil((addressEnd + 1) / 4) * 4;
  
  // Read type tag string
  if (buffer[offset] !== 0x2C) { // ','
    // No type tag, assume no arguments
    return { address, args: [] };
  }
  
  const typeTagEnd = buffer.indexOf(0, offset);
  if (typeTagEnd === -1) return null;
  
  const typeTag = buffer.toString('utf8', offset + 1, typeTagEnd);
  offset = Math.ceil((typeTagEnd + 1) / 4) * 4;
  
  // Parse arguments based on type tags
  const args = [];
  for (const type of typeTag) {
    switch (type) {
      case OSC_TYPE_INT:
        args.push({ type: 'int', value: buffer.readInt32BE(offset) });
        offset += 4;
        break;
      case OSC_TYPE_FLOAT:
        args.push({ type: 'float', value: buffer.readFloatBE(offset) });
        offset += 4;
        break;
      case OSC_TYPE_STRING:
        const strEnd = buffer.indexOf(0, offset);
        args.push({ type: 'string', value: buffer.toString('utf8', offset, strEnd) });
        offset = Math.ceil((strEnd + 1) / 4) * 4;
        break;
      case OSC_TYPE_TRUE:
        args.push({ type: 'bool', value: true });
        break;
      case OSC_TYPE_FALSE:
        args.push({ type: 'bool', value: false });
        break;
      case OSC_TYPE_NIL:
        args.push({ type: 'nil', value: null });
        break;
      default:
        // Unknown type, skip
        break;
    }
  }
  
  return { address, args };
}

/**
 * Create an OSC message buffer
 */
function createOSCMessage(address, args = []) {
  const parts = [];
  
  // Address pattern (null-terminated, padded to 4 bytes)
  const addressBuf = Buffer.from(address + '\0');
  const addressPadded = Buffer.alloc(Math.ceil(addressBuf.length / 4) * 4);
  addressBuf.copy(addressPadded);
  parts.push(addressPadded);
  
  // Type tag string
  let typeTag = ',';
  const argBuffers = [];
  
  for (const arg of args) {
    if (typeof arg === 'number') {
      if (Number.isInteger(arg)) {
        typeTag += OSC_TYPE_INT;
        const buf = Buffer.alloc(4);
        buf.writeInt32BE(arg);
        argBuffers.push(buf);
      } else {
        typeTag += OSC_TYPE_FLOAT;
        const buf = Buffer.alloc(4);
        buf.writeFloatBE(arg);
        argBuffers.push(buf);
      }
    } else if (typeof arg === 'string') {
      typeTag += OSC_TYPE_STRING;
      const strBuf = Buffer.from(arg + '\0');
      const strPadded = Buffer.alloc(Math.ceil(strBuf.length / 4) * 4);
      strBuf.copy(strPadded);
      argBuffers.push(strPadded);
    } else if (typeof arg === 'boolean') {
      typeTag += arg ? OSC_TYPE_TRUE : OSC_TYPE_FALSE;
    } else if (arg === null || arg === undefined) {
      typeTag += OSC_TYPE_NIL;
    }
  }
  
  const typeTagBuf = Buffer.from(typeTag + '\0');
  const typeTagPadded = Buffer.alloc(Math.ceil(typeTagBuf.length / 4) * 4);
  typeTagBuf.copy(typeTagPadded);
  parts.push(typeTagPadded);
  
  // Arguments
  parts.push(...argBuffers);
  
  return Buffer.concat(parts);
}

/**
 * OSC Controller class
 */
class OSCController extends EventEmitter {
  constructor() {
    super();
    this.server = null;
    this.feedbackClients = new Map(); // Track clients for feedback
    this.isEnabled = false;
    this.port = 8000;
    this.feedbackPort = 9000;
    this.addressPrefix = '/lyricdisplay';
    
    // Store for persisting OSC settings
    this.store = new Store({
      name: 'osc-settings',
      defaults: {
        enabled: false,
        port: 8000,
        feedbackPort: 9000,
        addressPrefix: '/lyricdisplay',
        feedbackEnabled: true
      }
    });
    
    // Load saved settings
    this.port = this.store.get('port');
    this.feedbackPort = this.store.get('feedbackPort');
    this.addressPrefix = this.store.get('addressPrefix');
    
    // Current state for feedback
    this.currentState = {
      line: null,
      output: false,
      output1: false,
      output2: false,
      stage: false,
      songName: '',
      lineCount: 0,
      autoplay: false
    };
    
    // Define supported OSC addresses and their handlers
    this.addressHandlers = this.createAddressHandlers();
  }

  /**
   * Create address handlers map
   */
  createAddressHandlers() {
    const prefix = this.addressPrefix;
    return {
      [`${prefix}/line`]: this.handleLineSelect.bind(this),
      [`${prefix}/line/next`]: this.handleNextLine.bind(this),
      [`${prefix}/line/prev`]: this.handlePrevLine.bind(this),
      [`${prefix}/output`]: this.handleOutputToggle.bind(this),
      [`${prefix}/output/1`]: this.handleOutput1Toggle.bind(this),
      [`${prefix}/output/2`]: this.handleOutput2Toggle.bind(this),
      [`${prefix}/output/stage`]: this.handleStageToggle.bind(this),
      [`${prefix}/autoplay`]: this.handleAutoplayToggle.bind(this),
      [`${prefix}/autoplay/start`]: this.handleAutoplayStart.bind(this),
      [`${prefix}/autoplay/stop`]: this.handleAutoplayStop.bind(this),
      [`${prefix}/setlist/next`]: this.handleNextSong.bind(this),
      [`${prefix}/setlist/prev`]: this.handlePrevSong.bind(this),
      [`${prefix}/setlist/load`]: this.handleLoadSetlistItem.bind(this),
      [`${prefix}/clear`]: this.handleClearOutput.bind(this),
      [`${prefix}/sync`]: this.handleSync.bind(this)
    };
  }

  /**
   * Initialize and start OSC server
   */
  async initialize() {
    if (this.server) {
      return { success: true, message: 'Already initialized' };
    }

    try {
      this.server = dgram.createSocket('udp4');
      
      this.server.on('error', (err) => {
        console.error('[OSC] Server error:', err);
        this.emit('error', err);
      });

      this.server.on('message', (msg, rinfo) => {
        this.handleMessage(msg, rinfo);
      });

      this.server.on('listening', () => {
        const address = this.server.address();
        console.log(`[OSC] Server listening on ${address.address}:${address.port}`);
        this.emit('listening', address);
      });

      // Bind to port
      await new Promise((resolve, reject) => {
        this.server.bind(this.port, '0.0.0.0', (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      // Restore enabled state
      if (this.store.get('enabled')) {
        this.enable();
      }

      console.log('[OSC] Controller initialized on port', this.port);
      return { success: true, port: this.port };
    } catch (error) {
      console.error('[OSC] Failed to initialize:', error);
      this.server = null;
      return { success: false, error: error.message };
    }
  }

  /**
   * Handle incoming OSC message
   */
  handleMessage(buffer, rinfo) {
    if (!this.isEnabled) return;

    try {
      const message = parseOSCMessage(buffer);
      if (!message) {
        console.warn('[OSC] Failed to parse message from', rinfo.address);
        return;
      }

      console.log('[OSC] Received:', message.address, 'args:', message.args.map(a => a.value));

      // Track client for feedback
      this.feedbackClients.set(`${rinfo.address}:${this.feedbackPort}`, {
        address: rinfo.address,
        port: this.feedbackPort,
        lastSeen: Date.now()
      });

      // Find and execute handler
      const handler = this.addressHandlers[message.address];
      if (handler) {
        handler(message.args, rinfo);
      } else {
        console.log('[OSC] Unhandled address:', message.address);
        this.emit('unhandled', { address: message.address, args: message.args, rinfo });
      }
    } catch (error) {
      console.error('[OSC] Error handling message:', error);
    }
  }

  // ============ Address Handlers ============

  handleLineSelect(args) {
    const lineIndex = args[0]?.value;
    if (typeof lineIndex === 'number' && lineIndex >= 0) {
      this.emitAction('select-line', { lineIndex: Math.floor(lineIndex) });
    }
  }

  handleNextLine() {
    this.emitAction('next-line');
  }

  handlePrevLine() {
    this.emitAction('prev-line');
  }

  handleOutputToggle(args) {
    const state = args[0]?.value;
    if (typeof state === 'number' || typeof state === 'boolean') {
      this.emitAction('set-output', { enabled: Boolean(state) });
    } else {
      this.emitAction('toggle-output');
    }
  }

  handleOutput1Toggle(args) {
    const state = args[0]?.value;
    if (typeof state === 'number' || typeof state === 'boolean') {
      this.emitAction('set-output-1', { enabled: Boolean(state) });
    } else {
      this.emitAction('toggle-output-1');
    }
  }

  handleOutput2Toggle(args) {
    const state = args[0]?.value;
    if (typeof state === 'number' || typeof state === 'boolean') {
      this.emitAction('set-output-2', { enabled: Boolean(state) });
    } else {
      this.emitAction('toggle-output-2');
    }
  }

  handleStageToggle(args) {
    const state = args[0]?.value;
    if (typeof state === 'number' || typeof state === 'boolean') {
      this.emitAction('set-stage', { enabled: Boolean(state) });
    } else {
      this.emitAction('toggle-stage');
    }
  }

  handleAutoplayToggle(args) {
    const state = args[0]?.value;
    if (typeof state === 'number' || typeof state === 'boolean') {
      this.emitAction(state ? 'autoplay-start' : 'autoplay-stop');
    } else {
      this.emitAction('toggle-autoplay');
    }
  }

  handleAutoplayStart() {
    this.emitAction('autoplay-start');
  }

  handleAutoplayStop() {
    this.emitAction('autoplay-stop');
  }

  handleNextSong() {
    this.emitAction('next-song');
  }

  handlePrevSong() {
    this.emitAction('prev-song');
  }

  handleLoadSetlistItem(args) {
    const index = args[0]?.value;
    if (typeof index === 'number' && index >= 0) {
      this.emitAction('load-setlist-item', { index: Math.floor(index) });
    }
  }

  handleClearOutput() {
    this.emitAction('clear-output');
  }

  handleSync() {
    this.emitAction('sync-outputs');
  }

  /**
   * Emit an action event
   */
  emitAction(type, data = {}) {
    const action = {
      type,
      source: 'osc',
      ...data
    };
    console.log('[OSC] Action:', type, data);
    this.emit('action', action);
  }

  // ============ Feedback Methods ============

  /**
   * Update internal state and send feedback
   */
  updateState(updates) {
    Object.assign(this.currentState, updates);
    
    if (this.store.get('feedbackEnabled')) {
      this.sendFeedback();
    }
  }

  /**
   * Send current state as OSC feedback to all known clients
   */
  sendFeedback() {
    if (!this.server || !this.isEnabled) return;

    const prefix = this.addressPrefix;
    const messages = [
      { address: `${prefix}/state/line`, args: [this.currentState.line ?? -1] },
      { address: `${prefix}/state/output`, args: [this.currentState.output ? 1 : 0] },
      { address: `${prefix}/state/output/1`, args: [this.currentState.output1 ? 1 : 0] },
      { address: `${prefix}/state/output/2`, args: [this.currentState.output2 ? 1 : 0] },
      { address: `${prefix}/state/stage`, args: [this.currentState.stage ? 1 : 0] },
      { address: `${prefix}/state/songname`, args: [this.currentState.songName || ''] },
      { address: `${prefix}/state/linecount`, args: [this.currentState.lineCount || 0] },
      { address: `${prefix}/state/autoplay`, args: [this.currentState.autoplay ? 1 : 0] }
    ];

    // Clean up old clients (older than 5 minutes)
    const now = Date.now();
    for (const [key, client] of this.feedbackClients) {
      if (now - client.lastSeen > 300000) {
        this.feedbackClients.delete(key);
      }
    }

    // Send to all known clients
    for (const client of this.feedbackClients.values()) {
      for (const msg of messages) {
        try {
          const buffer = createOSCMessage(msg.address, msg.args);
          this.server.send(buffer, client.port, client.address);
        } catch (error) {
          console.warn('[OSC] Error sending feedback to', client.address, error.message);
        }
      }
    }
  }

  /**
   * Send a single feedback message to all clients
   */
  sendFeedbackMessage(address, args) {
    if (!this.server || !this.isEnabled) return;

    const fullAddress = address.startsWith('/') ? address : `${this.addressPrefix}/${address}`;
    
    for (const client of this.feedbackClients.values()) {
      try {
        const buffer = createOSCMessage(fullAddress, args);
        this.server.send(buffer, client.port, client.address);
      } catch (error) {
        console.warn('[OSC] Error sending feedback:', error.message);
      }
    }
  }

  // ============ Control Methods ============

  /**
   * Enable OSC processing
   */
  enable() {
    this.isEnabled = true;
    this.store.set('enabled', true);
    console.log('[OSC] Enabled');
    this.emit('enabled');
    return { success: true };
  }

  /**
   * Disable OSC processing
   */
  disable() {
    this.isEnabled = false;
    this.store.set('enabled', false);
    console.log('[OSC] Disabled');
    this.emit('disabled');
    return { success: true };
  }

  /**
   * Change listening port (requires restart)
   */
  setPort(port) {
    if (port < 1 || port > 65535) {
      return { success: false, error: 'Invalid port number' };
    }
    this.port = port;
    this.store.set('port', port);
    return { success: true, requiresRestart: true };
  }

  /**
   * Change feedback port
   */
  setFeedbackPort(port) {
    if (port < 1 || port > 65535) {
      return { success: false, error: 'Invalid port number' };
    }
    this.feedbackPort = port;
    this.store.set('feedbackPort', port);
    return { success: true };
  }

  /**
   * Change address prefix
   */
  setAddressPrefix(prefix) {
    if (!prefix.startsWith('/')) {
      prefix = '/' + prefix;
    }
    this.addressPrefix = prefix;
    this.store.set('addressPrefix', prefix);
    this.addressHandlers = this.createAddressHandlers();
    return { success: true };
  }

  /**
   * Toggle feedback sending
   */
  setFeedbackEnabled(enabled) {
    this.store.set('feedbackEnabled', enabled);
    return { success: true };
  }

  /**
   * Get current status
   */
  getStatus() {
    return {
      initialized: this.server !== null,
      enabled: this.isEnabled,
      port: this.port,
      feedbackPort: this.feedbackPort,
      addressPrefix: this.addressPrefix,
      feedbackEnabled: this.store.get('feedbackEnabled'),
      connectedClients: this.feedbackClients.size,
      currentState: this.currentState
    };
  }

  /**
   * Get supported addresses documentation
   */
  getSupportedAddresses() {
    const prefix = this.addressPrefix;
    return [
      { address: `${prefix}/line`, args: '[int]', description: 'Select specific line (0-indexed)' },
      { address: `${prefix}/line/next`, args: '', description: 'Go to next line' },
      { address: `${prefix}/line/prev`, args: '', description: 'Go to previous line' },
      { address: `${prefix}/output`, args: '[0|1]', description: 'Toggle or set main output' },
      { address: `${prefix}/output/1`, args: '[0|1]', description: 'Toggle or set Output 1' },
      { address: `${prefix}/output/2`, args: '[0|1]', description: 'Toggle or set Output 2' },
      { address: `${prefix}/output/stage`, args: '[0|1]', description: 'Toggle or set Stage output' },
      { address: `${prefix}/autoplay`, args: '[0|1]', description: 'Toggle or set autoplay' },
      { address: `${prefix}/autoplay/start`, args: '', description: 'Start autoplay' },
      { address: `${prefix}/autoplay/stop`, args: '', description: 'Stop autoplay' },
      { address: `${prefix}/setlist/next`, args: '', description: 'Load next song in setlist' },
      { address: `${prefix}/setlist/prev`, args: '', description: 'Load previous song in setlist' },
      { address: `${prefix}/setlist/load`, args: '[int]', description: 'Load setlist item by index' },
      { address: `${prefix}/clear`, args: '', description: 'Clear output (deselect line)' },
      { address: `${prefix}/sync`, args: '', description: 'Force sync all outputs' }
    ];
  }

  /**
   * Cleanup and close OSC server
   */
  destroy() {
    if (this.server) {
      try {
        this.server.close();
      } catch (e) {
        console.warn('[OSC] Error closing server:', e);
      }
      this.server = null;
    }
    this.isEnabled = false;
    this.feedbackClients.clear();
    this.removeAllListeners();
    console.log('[OSC] Controller destroyed');
  }
}

// Singleton instance
let oscController = null;

/**
 * Get or create the OSC controller instance
 */
export function getOSCController() {
  if (!oscController) {
    oscController = new OSCController();
  }
  return oscController;
}

/**
 * Initialize OSC controller
 */
export async function initializeOSC() {
  const controller = getOSCController();
  return controller.initialize();
}

/**
 * Cleanup OSC controller
 */
export function destroyOSC() {
  if (oscController) {
    oscController.destroy();
    oscController = null;
  }
}

export default OSCController;
