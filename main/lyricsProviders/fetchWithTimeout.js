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

    if (externalSignal) {
        externalSignal.addEventListener('abort', () => controller.abort());
    }

    const timeoutId = setTimeout(() => {
        controller.abort();
    }, timeoutMs);

    try {
        const response = await fetch(url, {
            ...restOptions,
            signal: controller.signal,
        });
        clearTimeout(timeoutId);
        return response;
    } catch (error) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
            throw new Error(`Request timeout after ${timeoutMs}ms`);
        }
        throw error;
    }
}