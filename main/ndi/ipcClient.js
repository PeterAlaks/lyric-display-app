import net from 'net';

function createNdiIpcClient({ getIpcConfig, getNextSeq, getAuthToken = () => '' }) {
  let persistentSocket = null;
  let persistentBuffer = '';
  let persistentConnecting = false;
  let persistentReady = false;

  /** @type {Map<number, { resolve: Function, responses: object[], timer: ReturnType<typeof setTimeout>, idleTimer: ReturnType<typeof setTimeout>|null }>} */
  const persistentPendingCallbacks = new Map();

  function buildCommandResult(responses, fallbackError = null) {
    const protocolError = responses.find((response) => response?.type === 'error');
    if (protocolError) {
      return {
        success: false,
        responses,
        error: protocolError.payload?.message || fallbackError || 'Companion returned an error',
      };
    }

    return {
      success: responses.length > 0,
      responses,
      error: responses.length > 0 ? null : fallbackError,
    };
  }

  function drainPendingCallbacks(reason) {
    for (const [, pending] of persistentPendingCallbacks) {
      clearTimeout(pending.timer);
      if (pending.idleTimer) clearTimeout(pending.idleTimer);
      pending.resolve(buildCommandResult(pending.responses, reason));
    }
    persistentPendingCallbacks.clear();
  }

  function connectPersistentSocket() {
    if (persistentSocket && !persistentSocket.destroyed) return;
    if (persistentConnecting) return;

    const { host, port } = getIpcConfig();
    persistentConnecting = true;
    persistentReady = false;

    const socket = net.createConnection({ host, port });

    socket.on('connect', () => {
      persistentConnecting = false;
      persistentReady = true;
      persistentSocket = socket;
      persistentBuffer = '';
      console.log('[NDI] Persistent IPC connection established');
    });

    socket.on('data', (chunk) => {
      persistentBuffer += chunk.toString('utf8');
      let idx = persistentBuffer.indexOf('\n');
      while (idx >= 0) {
        const line = persistentBuffer.slice(0, idx).trim();
        persistentBuffer = persistentBuffer.slice(idx + 1);
        if (line) {
          try {
            const msg = JSON.parse(line);
            if (msg.seq != null) {
              const pending = persistentPendingCallbacks.get(msg.seq);
              if (pending) {
                pending.responses.push(msg);

                if (pending.idleTimer) clearTimeout(pending.idleTimer);
                pending.idleTimer = setTimeout(() => {
                  clearTimeout(pending.timer);
                  persistentPendingCallbacks.delete(msg.seq);
                  pending.resolve(buildCommandResult(pending.responses));
                }, 60);
              }
            }
          } catch { /* ignore malformed lines */ }
        }
        idx = persistentBuffer.indexOf('\n');
      }
    });

    socket.on('error', () => {
      persistentConnecting = false;
      persistentReady = false;
      drainPendingCallbacks('connection error');
      persistentSocket = null;
    });

    socket.on('close', () => {
      persistentConnecting = false;
      persistentReady = false;
      drainPendingCallbacks('connection closed');
      persistentSocket = null;
    });
  }

  function destroyPersistentSocket() {
    if (persistentSocket) {
      try { persistentSocket.destroy(); } catch { /* ignore */ }
      persistentSocket = null;
    }
    persistentConnecting = false;
    persistentReady = false;
    drainPendingCallbacks('socket destroyed');
  }

  /**
   * Send a JSON-line command to the companion over TCP and collect responses.
   * Prefers the persistent socket when available; falls back to a one-shot
   * connection otherwise.
   */
  function sendCommand(type, payload = {}, extra = {}) {
    const timeoutMs = extra.timeoutMs ?? 3000;
    const token = getAuthToken();

    const command = {
      type,
      seq: extra.seq ?? getNextSeq(),
      ts: Date.now(),
      output: extra.output,
      payload,
      ...(token ? { token } : {}),
    };

    if (persistentReady && persistentSocket && !persistentSocket.destroyed) {
      return new Promise((resolve) => {
        const entry = {
          resolve,
          responses: [],
          idleTimer: null,
          timer: setTimeout(() => {
            persistentPendingCallbacks.delete(command.seq);
            if (entry.idleTimer) clearTimeout(entry.idleTimer);
            resolve(buildCommandResult(entry.responses, `IPC timeout after ${timeoutMs}ms`));
          }, timeoutMs),
        };
        persistentPendingCallbacks.set(command.seq, entry);

        try {
          persistentSocket.write(JSON.stringify(command) + '\n');
        } catch (error) {
          clearTimeout(entry.timer);
          persistentPendingCallbacks.delete(command.seq);
          resolve({ success: false, responses: [], error: error.message });
        }
      });
    }

    const { host, port } = getIpcConfig();

    return new Promise((resolve) => {
      let settled = false;
      let buffer = '';
      const responses = [];
      let idleTimer = null;

      const socket = net.createConnection({ host, port });

      const finish = (result) => {
        if (settled) return;
        settled = true;
        if (idleTimer) clearTimeout(idleTimer);
        try { socket.destroy(); } catch { /* ignore */ }
        resolve(result);
      };

      const timeout = setTimeout(() => {
        finish(buildCommandResult(responses, `IPC timeout after ${timeoutMs}ms`));
      }, timeoutMs);

      const scheduleIdleFinish = () => {
        if (idleTimer) clearTimeout(idleTimer);
        idleTimer = setTimeout(() => {
          clearTimeout(timeout);
          finish(buildCommandResult(responses));
        }, 60);
      };

      socket.on('connect', () => {
        try {
          socket.write(JSON.stringify(command) + '\n');
        } catch (error) {
          clearTimeout(timeout);
          finish({ success: false, responses, error: error.message });
        }
      });

      socket.on('data', (chunk) => {
        buffer += chunk.toString('utf8');
        let idx = buffer.indexOf('\n');
        while (idx >= 0) {
          const line = buffer.slice(0, idx).trim();
          buffer = buffer.slice(idx + 1);
          if (line) {
            try { responses.push(JSON.parse(line)); } catch { responses.push({ type: 'error', payload: { message: 'invalid JSON' } }); }
          }
          idx = buffer.indexOf('\n');
        }
        scheduleIdleFinish();
      });

      socket.on('error', (error) => {
        clearTimeout(timeout);
        finish({ success: false, responses, error: error.message });
      });

      socket.on('end', () => {
        clearTimeout(timeout);
        finish(buildCommandResult(responses, 'connection closed'));
      });
    });
  }

  return {
    sendCommand,
    connectPersistentSocket,
    destroyPersistentSocket,
  };
}

export { createNdiIpcClient };
