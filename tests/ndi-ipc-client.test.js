import assert from 'node:assert/strict';
import net from 'node:net';
import test from 'node:test';
import { createNdiIpcClient } from '../main/ndi/ipcClient.js';

function startJsonLineServer(handler) {
  const server = net.createServer((socket) => {
    let buffer = '';
    socket.on('data', (chunk) => {
      buffer += chunk.toString('utf8');
      const idx = buffer.indexOf('\n');
      if (idx < 0) return;
      const line = buffer.slice(0, idx);
      const message = JSON.parse(line);
      handler(message, socket);
    });
  });

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      server.off('error', reject);
      resolve(server);
    });
  });
}

test('NDI IPC client includes auth token and treats protocol errors as failures', async () => {
  let received = null;
  const server = await startJsonLineServer((message, socket) => {
    received = message;
    socket.write(JSON.stringify({
      type: 'error',
      seq: message.seq,
      payload: { message: 'unauthorized' },
    }) + '\n');
  });

  try {
    const { port } = server.address();
    const client = createNdiIpcClient({
      getIpcConfig: () => ({ host: '127.0.0.1', port }),
      getNextSeq: () => 42,
      getAuthToken: () => 'test-token',
    });

    const result = await client.sendCommand('hello', {}, { timeoutMs: 500 });

    assert.equal(received.type, 'hello');
    assert.equal(received.seq, 42);
    assert.equal(received.token, 'test-token');
    assert.equal(result.success, false);
    assert.equal(result.error, 'unauthorized');
  } finally {
    server.close();
  }
});

test('NDI IPC client resolves ack responses as success', async () => {
  const server = await startJsonLineServer((message, socket) => {
    socket.write(JSON.stringify({
      type: 'ack',
      seq: message.seq,
      payload: { ok: true },
    }) + '\n');
  });

  try {
    const { port } = server.address();
    const client = createNdiIpcClient({
      getIpcConfig: () => ({ host: '127.0.0.1', port }),
      getNextSeq: () => 7,
    });

    const result = await client.sendCommand('disable_output', {}, { timeoutMs: 500 });

    assert.equal(result.success, true);
    assert.equal(result.responses[0].type, 'ack');
  } finally {
    server.close();
  }
});
