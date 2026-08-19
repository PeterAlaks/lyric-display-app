import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  consumeAppDataResetRequest,
  createAppDataResetRequest,
  requestAppDataResetAndRelaunch,
} from '../main/appReset.js';

const makeSandbox = () => {
  const appDataPath = fs.mkdtempSync(path.join(os.tmpdir(), 'lyricdisplay-reset-'));
  const userDataPath = path.join(appDataPath, 'LyricDisplay');
  fs.mkdirSync(path.join(userDataPath, 'nested'), { recursive: true });
  fs.writeFileSync(path.join(userDataPath, 'preferences.json'), '{"theme":"dark"}', 'utf8');
  fs.writeFileSync(path.join(userDataPath, 'nested', 'cache.bin'), 'cached', 'utf8');
  return { appDataPath, userDataPath };
};

test('authorized app reset removes the complete user-data directory exactly once', (t) => {
  const { appDataPath, userDataPath } = makeSandbox();
  t.after(() => fs.rmSync(appDataPath, { recursive: true, force: true }));

  const request = createAppDataResetRequest({
    appDataPath,
    userDataPath,
    argv: ['electron', '.'],
    createToken: () => '3d6f0a72-96fc-4f89-907d-735a297ce550',
  });

  assert.equal(fs.existsSync(request.markerPath), true);
  assert.deepEqual(request.relaunchArgs, ['.', request.resetArg]);

  const result = consumeAppDataResetRequest({
    appDataPath,
    userDataPath,
    argv: ['electron', '.', request.resetArg],
  });

  assert.equal(result.requested, true);
  assert.equal(result.reset, true);
  assert.equal(fs.existsSync(userDataPath), false);
  assert.equal(fs.existsSync(request.markerPath), false);

  const repeated = consumeAppDataResetRequest({
    appDataPath,
    userDataPath,
    argv: ['electron', '.', request.resetArg],
  });
  assert.equal(repeated.requested, true);
  assert.equal(repeated.reset, false);
  assert.equal(repeated.alreadyCompleted, true);
  assert.equal(repeated.error, undefined);
});

test('reset authorization cannot target a different folder', (t) => {
  const { appDataPath, userDataPath } = makeSandbox();
  const unrelatedPath = path.join(appDataPath, 'UnrelatedApp');
  fs.mkdirSync(unrelatedPath);
  fs.writeFileSync(path.join(unrelatedPath, 'keep.txt'), 'keep', 'utf8');
  t.after(() => fs.rmSync(appDataPath, { recursive: true, force: true }));

  const request = createAppDataResetRequest({
    appDataPath,
    userDataPath,
    argv: ['LyricDisplay'],
    createToken: () => '55ed9ac7-3de6-4514-8335-2d5f8a41d93f',
  });

  const result = consumeAppDataResetRequest({
    appDataPath,
    userDataPath: unrelatedPath,
    argv: ['LyricDisplay', request.resetArg],
  });

  assert.equal(result.reset, false);
  assert.match(result.error, /target/i);
  assert.equal(fs.readFileSync(path.join(unrelatedPath, 'keep.txt'), 'utf8'), 'keep');
  assert.equal(fs.existsSync(userDataPath), true);
});

test('reset request preserves launch arguments, schedules relaunch, and exits after responding', (t) => {
  const { appDataPath, userDataPath } = makeSandbox();
  t.after(() => fs.rmSync(appDataPath, { recursive: true, force: true }));
  const calls = [];
  const appApi = {
    getPath: (name) => name === 'appData' ? appDataPath : userDataPath,
    relaunch: (options) => calls.push(['relaunch', options]),
    exit: (code) => calls.push(['exit', code]),
  };

  const result = requestAppDataResetAndRelaunch({
    appApi,
    argv: ['LyricDisplay', '--headless'],
    createToken: () => '03e546f0-da7d-4332-b780-6f32104aad8c',
    scheduleExit: (callback, delay) => {
      calls.push(['schedule', delay]);
      callback();
    },
  });

  assert.equal(result.success, true);
  assert.equal(calls[0][0], 'relaunch');
  assert.deepEqual(calls[0][1].args.slice(0, 1), ['--headless']);
  assert.match(calls[0][1].args[1], /^--lyricdisplay-reset-token=/);
  assert.deepEqual(calls.slice(1), [['schedule', 100], ['exit', 0]]);
});
