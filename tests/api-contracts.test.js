import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { validateApiContracts } from '../scripts/validate-api-contracts.js';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('checked-in OpenAPI and AsyncAPI contracts match audited runtime registries', () => {
  assert.deepEqual(validateApiContracts(rootDir), []);
});

test('contract validation catches event, permission, limit, and route drift', async () => {
  const fixtureRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'lyricdisplay-contracts-'));
  const fixtureDocs = path.join(fixtureRoot, 'docs');
  try {
    await fs.mkdir(fixtureDocs);
    const asyncApi = await fs.readFile(path.join(rootDir, 'docs', 'asyncapi.yaml'), 'utf8');
    const openApi = await fs.readFile(path.join(rootDir, 'docs', 'openapi.yaml'), 'utf8');
    await fs.writeFile(
      path.join(fixtureDocs, 'asyncapi.yaml'),
      asyncApi
        .replace('name: outputRemove', 'name: outputRemoveDrifted')
        .replace("      - $ref: '#/channels/socketChannel/messages/actionLogClear'", '')
        .replace("x-permissions: ['admin:full']", "x-permissions: ['settings:read']")
        .replace(/(^    setlistReplace:[\s\S]*?maxItems:) 100/m, '$1 99'),
      'utf8'
    );
    await fs.writeFile(
      path.join(fixtureDocs, 'openapi.yaml'),
      openApi.replace('  /api/app/capabilities:', '  /api/app/capabilities-drifted:'),
      'utf8'
    );

    const errors = validateApiContracts(fixtureRoot);
    assert.ok(errors.some((error) => error.includes('outputRemove') && error.includes('mismatched')));
    assert.ok(errors.some((error) => error.includes('permissions drifted')));
    assert.ok(errors.some((error) => error.includes('client operation') && error.includes('actionLogClear')));
    assert.ok(errors.some((error) => error.includes('setlistReplace maximum')));
    assert.ok(errors.some((error) => error.includes('GET /api/app/capabilities')));
  } finally {
    await fs.rm(fixtureRoot, { recursive: true, force: true });
  }
});
