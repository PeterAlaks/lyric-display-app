/**
 * MIDI Controller Module
 * Handles MIDI input for external hardware control of LyricDisplay
 */

import { app } from 'electron';
import { EventEmitter } from 'events';
import Store from 'electron-store';

// MIDI controller singleton
class MIDIController extends EventEmitter {
  constructor() {
    super();
    this.midi = null;
    this.input = null;
    this.isInitialized = false;
    this.isEnabled = false;
    this.selectedPortIndex = -1;
    this.availablePorts = [];
    
    // Store for persisting MIDI settings
    this.store = new Store({
      name: 'midi-settings',
      defaults: {
        enabled: false,
        selectedPort: -1,
        mappings: this.getDefaultMappings()
      }
    });
    
    this.mappings = this.store.get('mappings') || this.getDefaultMappings();
  }

  /**
   * Default MIDI mappings
   * Maps MIDI note numbers to actions
   */
  getDefaultMappings() {
    return {
      // Note mappings (Note On messages)
      notes: {
        // Navigation
        36: { action: 'prev-line', description: 'Previous Line (C2)' },
        37: { action: 'next-line', description: 'Next Line (C#2)' },
        38: { action: 'toggle-output', description: 'Toggle Output (D2)' },
        39: { action: 'clear-output', description: 'Clear Output (D#2)' },
        40: { action: 'toggle-autoplay', description: 'Toggle Autoplay (E2)' },
        41: { action: 'prev-song', description: 'Previous Song (F2)' },
        42: { action: 'next-song', description: 'Next Song (F#2)' },
        
        // Direct line selection (C4-C6 = lines 1-25)
        60: { action: 'select-line', line: 0, description: 'Select Line 1 (C4)' },
        61: { action: 'select-line', line: 1, description: 'Select Line 2 (C#4)' },
        62: { action: 'select-line', line: 2, description: 'Select Line 3 (D4)' },
        63: { action: 'select-line', line: 3, description: 'Select Line 4 (D#4)' },
        64: { action: 'select-line', line: 4, description: 'Select Line 5 (E4)' },
        65: { action: 'select-line', line: 5, description: 'Select Line 6 (F4)' },
        66: { action: 'select-line', line: 6, description: 'Select Line 7 (F#4)' },
        67: { action: 'select-line', line: 7, description: 'Select Line 8 (G4)' },
        68: { action: 'select-line', line: 8, description: 'Select Line 9 (G#4)' },
        69: { action: 'select-line', line: 9, description: 'Select Line 10 (A4)' },
        70: { action: 'select-line', line: 10, description: 'Select Line 11 (A#4)' },
        71: { action: 'select-line', line: 11, description: 'Select Line 12 (B4)' },
        72: { action: 'select-line', line: 12, description: 'Select Line 13 (C5)' },
        73: { action: 'select-line', line: 13, description: 'Select Line 14 (C#5)' },
        74: { action: 'select-line', line: 14, description: 'Select Line 15 (D5)' },
        75: { action: 'select-line', line: 15, description: 'Select Line 16 (D#5)' },
        76: { action: 'select-line', line: 16, description: 'Select Line 17 (E5)' },
        77: { action: 'select-line', line: 17, description: 'Select Line 18 (F5)' },
        78: { action: 'select-line', line: 18, description: 'Select Line 19 (F#5)' },
        79: { action: 'select-line', line: 19, description: 'Select Line 20 (G5)' },
        80: { action: 'select-line', line: 20, description: 'Select Line 21 (G#5)' },
        81: { action: 'select-line', line: 21, description: 'Select Line 22 (A5)' },
        82: { action: 'select-line', line: 22, description: 'Select Line 23 (A#5)' },
        83: { action: 'select-line', line: 23, description: 'Select Line 24 (B5)' },
        84: { action: 'select-line', line: 24, description: 'Select Line 25 (C6)' }
      },
      
      // Control Change mappings
      controlChanges: {
        1: { action: 'scroll-lines', description: 'Scroll Lines (Mod Wheel)' },
        7: { action: 'scroll-lines', description: 'Scroll Lines (Volume)' }
      }
    };
  }

  /**
   * Initialize MIDI system
   * Attempts to load the midi library dynamically
   */
  async initialize() {
    if (this.isInitialized) {
      return { success: true, message: 'Already initialized' };
    }

    try {
      // Dynamic import of midi library
      // Using @julusian/midi which is a maintained fork of node-midi
      const midiModule = await import('@julusian/midi');
      this.midi = midiModule.default || midiModule;
      
      this.isInitialized = true;
      this.refreshPorts();
      
      // Restore saved settings
      const savedEnabled = this.store.get('enabled');
      const savedPort = this.store.get('selectedPort');
      
      if (savedEnabled && savedPort >= 0) {
        await this.selectPort(savedPort);
        if (this.input) {
          this.enable();
        }
      }
      
      console.log('[MIDI] Controller initialized successfully');
      return { success: true, ports: this.availablePorts };
    } catch (error) {
      console.warn('[MIDI] Failed to initialize MIDI controller:', error.message);
      console.warn('[MIDI] MIDI functionality will be unavailable. Install @julusian/midi to enable.');
      return { 
        success: false, 
        error: error.message,
        hint: 'Run "npm install @julusian/midi" to enable MIDI support'
      };
    }
  }

  /**
   * Refresh available MIDI input ports
   */
  refreshPorts() {
    if (!this.midi) {
      this.availablePorts = [];
      return [];
    }

    try {
      const tempInput = new this.midi.Input();
      const portCount = tempInput.getPortCount();
      
      this.availablePorts = [];
      for (let i = 0; i < portCount; i++) {
        this.availablePorts.push({
          index: i,
          name: tempInput.getPortName(i)
        });
      }
      
      tempInput.closePort();
      console.log('[MIDI] Found', portCount, 'input ports:', this.availablePorts.map(p => p.name));
      return this.availablePorts;
    } catch (error) {
      console.error('[MIDI] Error refreshing ports:', error);
      this.availablePorts = [];
      return [];
    }
  }

  /**
   * Select and open a MIDI input port
   */
  async selectPort(portIndex) {
    if (!this.midi) {
      return { success: false, error: 'MIDI not initialized' };
    }

    // Close existing port if open
    if (this.input) {
      try {
        this.input.closePort();
      } catch (e) {
        console.warn('[MIDI] Error closing previous port:', e);
      }
      this.input = null;
    }

    if (portIndex < 0 || portIndex >= this.availablePorts.length) {
      this.selectedPortIndex = -1;
      this.store.set('selectedPort', -1);
      return { success: false, error: 'Invalid port index' };
    }

    try {
      this.input = new this.midi.Input();
      this.input.openPort(portIndex);
      this.selectedPortIndex = portIndex;
      this.store.set('selectedPort', portIndex);
      
      // Set up message handler
      this.input.on('message', (deltaTime, message) => {
        this.handleMIDIMessage(message);
      });
      
      console.log('[MIDI] Opened port:', this.availablePorts[portIndex].name);
      return { success: true, port: this.availablePorts[portIndex] };
    } catch (error) {
      console.error('[MIDI] Error opening port:', error);
      this.input = null;
      this.selectedPortIndex = -1;
      return { success: false, error: error.message };
    }
  }

  /**
   * Handle incoming MIDI messages
   */
  handleMIDIMessage(message) {
    if (!this.isEnabled || !message || message.length < 2) return;

    const statusByte = message[0];
    const channel = statusByte & 0x0F;
    const messageType = statusByte & 0xF0;
    const data1 = message[1];
    const data2 = message.length > 2 ? message[2] : 0;

    // Note On (0x90) with velocity > 0
    if (messageType === 0x90 && data2 > 0) {
      this.handleNoteOn(data1, data2, channel);
    }
    // Note Off (0x80) or Note On with velocity 0
    else if (messageType === 0x80 || (messageType === 0x90 && data2 === 0)) {
      this.handleNoteOff(data1, channel);
    }
    // Control Change (0xB0)
    else if (messageType === 0xB0) {
      this.handleControlChange(data1, data2, channel);
    }
  }

  /**
   * Handle Note On messages
   */
  handleNoteOn(note, velocity, channel) {
    const mapping = this.mappings.notes[note];
    if (!mapping) {
      console.log('[MIDI] Unmapped note:', note, 'velocity:', velocity);
      this.emit('unmapped-note', { note, velocity, channel });
      return;
    }

    console.log('[MIDI] Note On:', note, '→', mapping.action);
    
    const action = {
      type: mapping.action,
      source: 'midi',
      note,
      velocity,
      channel
    };

    if (mapping.action === 'select-line') {
      action.lineIndex = mapping.line;
    }

    this.emit('action', action);
  }

  /**
   * Handle Note Off messages
   */
  handleNoteOff(note, channel) {
    // Currently we only trigger on Note On
    // Could be used for momentary actions in the future
  }

  /**
   * Handle Control Change messages
   */
  handleControlChange(controller, value, channel) {
    const mapping = this.mappings.controlChanges[controller];
    if (!mapping) {
      console.log('[MIDI] Unmapped CC:', controller, 'value:', value);
      this.emit('unmapped-cc', { controller, value, channel });
      return;
    }

    console.log('[MIDI] CC:', controller, '→', mapping.action, 'value:', value);

    const action = {
      type: mapping.action,
      source: 'midi',
      controller,
      value,
      channel
    };

    // For scroll-lines, convert 0-127 to a percentage
    if (mapping.action === 'scroll-lines') {
      action.percentage = value / 127;
    }

    this.emit('action', action);
  }

  /**
   * Enable MIDI input processing
   */
  enable() {
    if (!this.input) {
      return { success: false, error: 'No MIDI port selected' };
    }
    
    this.isEnabled = true;
    this.store.set('enabled', true);
    console.log('[MIDI] Input enabled');
    this.emit('enabled');
    return { success: true };
  }

  /**
   * Disable MIDI input processing
   */
  disable() {
    this.isEnabled = false;
    this.store.set('enabled', false);
    console.log('[MIDI] Input disabled');
    this.emit('disabled');
    return { success: true };
  }

  /**
   * Update a single mapping
   */
  setMapping(type, key, mapping) {
    if (type === 'note' || type === 'notes') {
      this.mappings.notes[key] = mapping;
    } else if (type === 'cc' || type === 'controlChanges') {
      this.mappings.controlChanges[key] = mapping;
    }
    this.store.set('mappings', this.mappings);
    return { success: true };
  }

  /**
   * Remove a mapping
   */
  removeMapping(type, key) {
    if (type === 'note' || type === 'notes') {
      delete this.mappings.notes[key];
    } else if (type === 'cc' || type === 'controlChanges') {
      delete this.mappings.controlChanges[key];
    }
    this.store.set('mappings', this.mappings);
    return { success: true };
  }

  /**
   * Reset mappings to defaults
   */
  resetMappings() {
    this.mappings = this.getDefaultMappings();
    this.store.set('mappings', this.mappings);
    return { success: true };
  }

  /**
   * Get current status
   */
  getStatus() {
    return {
      initialized: this.isInitialized,
      enabled: this.isEnabled,
      selectedPort: this.selectedPortIndex >= 0 ? this.availablePorts[this.selectedPortIndex] : null,
      selectedPortIndex: this.selectedPortIndex,
      availablePorts: this.availablePorts,
      mappings: this.mappings
    };
  }

  /**
   * Start MIDI learn mode
   * Returns a promise that resolves with the next MIDI message received
   */
  startLearnMode(timeout = 10000) {
    return new Promise((resolve, reject) => {
      if (!this.input || !this.isEnabled) {
        reject(new Error('MIDI not active'));
        return;
      }

      const timeoutId = setTimeout(() => {
        cleanup();
        reject(new Error('Learn mode timed out'));
      }, timeout);

      const cleanup = () => {
        clearTimeout(timeoutId);
        this.removeListener('unmapped-note', noteHandler);
        this.removeListener('unmapped-cc', ccHandler);
      };

      const noteHandler = (data) => {
        cleanup();
        resolve({ type: 'note', ...data });
      };

      const ccHandler = (data) => {
        cleanup();
        resolve({ type: 'cc', ...data });
      };

      this.once('unmapped-note', noteHandler);
      this.once('unmapped-cc', ccHandler);
    });
  }

  /**
   * Cleanup and close MIDI connections
   */
  destroy() {
    if (this.input) {
      try {
        this.input.closePort();
      } catch (e) {
        console.warn('[MIDI] Error closing port on destroy:', e);
      }
      this.input = null;
    }
    this.isEnabled = false;
    this.isInitialized = false;
    this.removeAllListeners();
    console.log('[MIDI] Controller destroyed');
  }
}

// Singleton instance
let midiController = null;

/**
 * Get or create the MIDI controller instance
 */
export function getMIDIController() {
  if (!midiController) {
    midiController = new MIDIController();
  }
  return midiController;
}

/**
 * Initialize MIDI controller
 */
export async function initializeMIDI() {
  const controller = getMIDIController();
  return controller.initialize();
}

/**
 * Cleanup MIDI controller
 */
export function destroyMIDI() {
  if (midiController) {
    midiController.destroy();
    midiController = null;
  }
}

export default MIDIController;
