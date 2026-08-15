import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import test from 'node:test';
import { createElectronNetworkFetch } from '../main/ndi/electronNetworkFetch.js';

class MockRequest extends EventEmitter {
  constructor(onEnd = () => {}) {
    super();
    this.onEnd = onEnd;
    this.aborted = false;
  }

  end() {
    this.onEnd(this);
  }

  abort() {
    this.aborted = true;
  }
}

test('Electron NDI transport exposes manual redirects without surfacing cancellation as a failure', async () => {
  let requestOptions;
  const request = new MockRequest((activeRequest) => {
    queueMicrotask(() => {
      activeRequest.emit('redirect', 302, 'GET', 'https://release-assets.githubusercontent.com/companion.zip', {
        location: ['https://release-assets.githubusercontent.com/companion.zip'],
      });
      activeRequest.emit('error', new Error('Redirect was cancelled'));
    });
  });
  const networkFetch = createElectronNetworkFetch({
    request(options) {
      requestOptions = options;
      return request;
    },
  });

  const response = await networkFetch('https://github.com/companion.zip', {
    redirect: 'manual',
    headers: { 'User-Agent': 'LyricDisplay-App' },
  });

  assert.equal(requestOptions.redirect, 'manual');
  assert.equal(response.status, 302);
  assert.equal(response.headers.location, 'https://release-assets.githubusercontent.com/companion.zip');
});

test('Electron NDI transport aborts an active request', async () => {
  const request = new MockRequest();
  const networkFetch = createElectronNetworkFetch({ request: () => request });
  const controller = new AbortController();
  const pending = networkFetch('https://github.com/companion.zip', { signal: controller.signal });

  controller.abort();

  await assert.rejects(pending, (error) => error.name === 'AbortError' && error.code === 'ABORT_ERR');
  assert.equal(request.aborted, true);
});
