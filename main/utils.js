import os from 'os';

export function getLocalIPAddress() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    const entries = interfaces[name] || [];
    for (const conn of entries) {
      if (conn.family === 'IPv4' && !conn.internal) {
        return conn.address;
      }
    }
  }
  return 'localhost';
}

