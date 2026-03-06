import net from 'net';

const DEFAULT_HOST = '127.0.0.1';
const DEFAULT_PORT = 9137;
const DEFAULT_TIMEOUT_MS = 1500;
const RESPONSE_IDLE_MS = 60;

export function sendNativeCommand(command, options = {}) {
  const host = options.host || DEFAULT_HOST;
  const port = Number(options.port || DEFAULT_PORT);
  const timeoutMs = Number(options.timeoutMs || DEFAULT_TIMEOUT_MS);

  return new Promise((resolve) => {
    let settled = false;
    let buffer = '';
    const responses = [];
    let responseIdleTimer = null;

    const socket = net.createConnection({ host, port });

    const finish = (result) => {
      if (settled) return;
      settled = true;

      if (responseIdleTimer) {
        clearTimeout(responseIdleTimer);
      }

      try {
        socket.destroy();
      } catch {
      }

      resolve(result);
    };

    const timeout = setTimeout(() => {
      finish({
        success: responses.length > 0,
        responses,
        error: responses.length > 0 ? null : `native IPC timeout after ${timeoutMs}ms`
      });
    }, timeoutMs);

    const scheduleFinishAfterIdle = () => {
      if (responseIdleTimer) {
        clearTimeout(responseIdleTimer);
      }
      responseIdleTimer = setTimeout(() => {
        clearTimeout(timeout);
        finish({ success: true, responses, error: null });
      }, RESPONSE_IDLE_MS);
    };

    socket.on('connect', () => {
      try {
        socket.write(`${JSON.stringify(command)}\n`);
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
          try {
            responses.push(JSON.parse(line));
          } catch {
            responses.push({ type: 'error', payload: { message: 'invalid JSON response' } });
          }
        }

        idx = buffer.indexOf('\n');
      }

      scheduleFinishAfterIdle();
    });

    socket.on('error', (error) => {
      clearTimeout(timeout);
      finish({ success: false, responses, error: error.message });
    });

    socket.on('end', () => {
      clearTimeout(timeout);
      finish({ success: responses.length > 0, responses, error: responses.length > 0 ? null : 'native IPC closed connection' });
    });
  });
}

export function createNativeCommand(type, payload = {}, extra = {}) {
  return {
    type,
    seq: Number.isFinite(extra.seq) ? extra.seq : undefined,
    ts: Number.isFinite(extra.ts) ? extra.ts : Date.now(),
    output: extra.output,
    payload
  };
}
