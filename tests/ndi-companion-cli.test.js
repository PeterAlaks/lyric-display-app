import assert from 'node:assert/strict';
import test from 'node:test';
import { parseArgs } from '../lyricdisplay-ndi/src/cli.js';

test('NDI companion CLI parses auth token without changing existing defaults', () => {
  const args = parseArgs([
    'electron',
    '.',
    '--host',
    '127.0.0.1',
    '--port',
    '9138',
    '--auth-token',
    'abc123',
    '--app-url',
    'http://localhost:5173',
    '--no-hash',
  ]);

  assert.equal(args.host, '127.0.0.1');
  assert.equal(args.port, 9138);
  assert.equal(args.authToken, 'abc123');
  assert.equal(args.appUrl, 'http://localhost:5173');
  assert.equal(args.hashRouting, false);
});

test('NDI companion CLI ignores invalid ports', () => {
  const args = parseArgs(['electron', '.', '--port', '80']);
  assert.equal(args.port, 9137);
  assert.equal(args.authToken, '');
  assert.equal(args.hashRouting, true);
});
