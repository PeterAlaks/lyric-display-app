import { isOutputClientType } from '../config/clientTypes.js';

export function getClientPermissions(clientType) {
  const permissions = {
    desktop: [
      'lyrics:read', 'lyrics:write', 'lyrics:delete',
      'setlist:read', 'setlist:write', 'setlist:delete',
      'output:control', 'settings:write', 'admin:full'
    ],
    web: [
      'lyrics:read', 'lyrics:write', 'lyrics:draft',
      'setlist:read',
      'output:control', 'settings:read', 'settings:write'
    ],
    obsDock: [
      'lyrics:read', 'lyrics:write',
      'setlist:read', 'setlist:write',
      'output:control', 'settings:read', 'settings:write'
    ],
    stage: ['lyrics:read', 'settings:read'],
    mobile: [
      'lyrics:read', 'lyrics:write', 'lyrics:draft',
      'setlist:read',
      'output:control', 'settings:read', 'settings:write'
    ]
  };

  if (isOutputClientType(clientType)) {
    return ['lyrics:read', 'settings:read'];
  }

  return permissions[clientType] || ['lyrics:read'];
}

export const hasPermission = (socket, permission) => {
  return socket.userData?.permissions?.includes(permission) ||
    socket.userData?.permissions?.includes('admin:full');
};
