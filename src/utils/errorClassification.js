export function classifyError(error) {
    const message = error?.message?.toLowerCase() || '';

    // Network/connectivity errors
    if (!navigator.onLine) {
        return {
            type: 'offline',
            title: 'No internet connection',
            message: 'Please check your network connection and try again.',
            retryable: true,
        };
    }

    if (message.includes('network') || message.includes('fetch') || message.includes('failed to fetch')) {
        return {
            type: 'network',
            title: 'Connection failed',
            message: 'Unable to reach the server. Please check your internet connection.',
            retryable: true,
        };
    }

    if (message.includes('timeout') || message.includes('timed out')) {
        return {
            type: 'timeout',
            title: 'Connection timeout',
            message: 'The request took too long. Please try again.',
            retryable: true,
        };
    }

    // HTTP errors
    if (message.includes('404') || message.includes('not found')) {
        return {
            type: 'not_found',
            title: 'Lyrics not found',
            message: 'This song may not be available from this provider. Try another result.',
            retryable: false,
        };
    }

    if (message.includes('503') || message.includes('service unavailable')) {
        return {
            type: 'service_unavailable',
            title: 'Service temporarily unavailable',
            message: 'The provider is currently experiencing issues. Please try again later.',
            retryable: true,
        };
    }

    if (message.includes('429') || message.includes('rate limit')) {
        return {
            type: 'rate_limit',
            title: 'Too many requests',
            message: 'Please wait a moment before searching again.',
            retryable: true,
        };
    }

    // Generic server error
    if (message.includes('500') || message.includes('server error')) {
        return {
            type: 'server_error',
            title: 'Server error',
            message: 'The provider encountered an error. Please try again later.',
            retryable: true,
        };
    }

    // Default
    return {
        type: 'unknown',
        title: 'Unable to complete request',
        message: error?.message || 'An unexpected error occurred.',
        retryable: true,
    };
}