function createAbortError() {
  const error = new Error('Request aborted');
  error.name = 'AbortError';
  error.code = 'ABORT_ERR';
  return error;
}

function normalizeHeaders(headers = {}) {
  return Object.fromEntries(
    Object.entries(headers).map(([name, value]) => [name.toLowerCase(), value])
  );
}

function createElectronNetworkFetch(net) {
  if (typeof net?.request !== 'function') {
    throw new TypeError('Electron network transport requires net.request');
  }

  return function electronNetworkFetch(url, {
    method = 'GET',
    headers = {},
    redirect = 'follow',
    signal,
  } = {}) {
    return new Promise((resolve, reject) => {
      if (signal?.aborted) {
        reject(createAbortError());
        return;
      }

      const request = net.request({ url, method, headers, redirect });
      let settled = false;

      const cleanup = () => signal?.removeEventListener?.('abort', onAbort);
      const resolveOnce = (response) => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(response);
      };
      const rejectOnce = (error) => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(error);
      };
      const onAbort = () => {
        if (settled) return;
        settled = true;
        cleanup();
        request.abort();
        reject(createAbortError());
      };

      request.on('error', rejectOnce);
      request.on('response', (response) => {
        const body = response;
        if (typeof body.cancel !== 'function') {
          body.cancel = async () => body.destroy();
        }
        resolveOnce({
          status: Number(response.statusCode || 0),
          statusCode: Number(response.statusCode || 0),
          headers: normalizeHeaders(response.headers),
          body,
        });
      });

      if (redirect === 'manual') {
        request.on('redirect', (statusCode, _method, redirectUrl, responseHeaders) => {
          const redirectHeaders = normalizeHeaders(responseHeaders);
          redirectHeaders.location = redirectUrl;
          resolveOnce({
            status: Number(statusCode || 0),
            statusCode: Number(statusCode || 0),
            headers: redirectHeaders,
            body: null,
          });
          // Electron cancels a manual redirect when followRedirect() is not
          // called synchronously. That is intentional: the installer validates
          // the target and starts the next request itself.
        });
      }

      signal?.addEventListener?.('abort', onAbort, { once: true });
      try {
        request.end();
      } catch (error) {
        rejectOnce(error);
      }
    });
  };
}

export { createElectronNetworkFetch };
