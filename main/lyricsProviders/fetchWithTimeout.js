/**
 * Fetch with automatic timeout and abort support
 * @param {string} url 
 * @param {object} options 
 * @param {number} timeoutMs - Timeout in milliseconds (default 10s)
 * @returns {Promise<Response>}
 */
export async function fetchWithTimeout(url, options = {}, timeoutMs = 10000) {
    const controller = new AbortController();
    const { signal: externalSignal, ...restOptions } = options;
    let timedOut = false;
    let externalAbortReason = null;

    const handleExternalAbort = () => {
        externalAbortReason = externalSignal?.reason || Object.assign(new Error('Request aborted'), { name: 'AbortError' });
        controller.abort(externalAbortReason);
    };
    if (externalSignal) {
        if (externalSignal.aborted) {
            handleExternalAbort();
        } else {
            externalSignal.addEventListener('abort', handleExternalAbort, { once: true });
        }
    }

    const timeoutId = setTimeout(() => {
        timedOut = true;
        controller.abort();
    }, timeoutMs);

    try {
        const response = await fetch(url, {
            ...restOptions,
            signal: controller.signal,
        });
        clearTimeout(timeoutId);
        if (externalSignal) {
            externalSignal.removeEventListener('abort', handleExternalAbort);
        }
        return response;
    } catch (error) {
        clearTimeout(timeoutId);
        if (externalSignal) {
            externalSignal.removeEventListener('abort', handleExternalAbort);
        }
        if (error.name === 'AbortError') {
            if (externalAbortReason) {
                throw externalAbortReason;
            }
            if (timedOut) {
                throw new Error(`Request timeout after ${timeoutMs}ms`);
            }
            throw error;
        }
        throw error;
    }
}
