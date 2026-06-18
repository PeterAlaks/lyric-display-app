export function createSocketAuthenticator({ verifyToken }) {
  return (socket, next) => {
    if (socket.handshake.query?.token) {
      const error = new Error('Token in query string not allowed');
      error.data = { code: 'AUTH_TOKEN_IN_QUERY' };
      return next(error);
    }

    const token = socket.handshake.auth?.token;

    if (!token) {
      console.warn('Socket connection rejected: missing authentication token');
      const error = new Error('Authentication token required');
      error.data = { code: 'AUTH_TOKEN_REQUIRED' };
      return next(error);
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      console.warn('Socket connection rejected: invalid or expired token');
      const error = new Error('Invalid or expired token');
      error.data = { code: 'AUTH_TOKEN_INVALID' };
      return next(error);
    }

    socket.userData = {
      clientType: decoded.clientType,
      deviceId: decoded.deviceId,
      sessionId: decoded.sessionId,
      permissions: decoded.permissions,
      connectedAt: Date.now(),
      isPreview: socket.handshake.auth?.preview === true
    };

    console.log('Socket authenticated:', decoded.clientType, '(' + decoded.deviceId + ')');
    return next();
  };
}
