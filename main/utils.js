import { networkInterfaces } from 'os';

export function getLocalIPAddress() {
    const nets = networkInterfaces();
    const candidates = [];

    for (const name of Object.keys(nets)) {
        for (const net of nets[name]) {
            // Skip over non-IPv4 and internal (i.e. 127.0.0.1) addresses
            if (net.family === 'IPv4' && !net.internal) {
                candidates.push({ name, address: net.address });
            }
        }
    }

    // Priority 1: Interface name contains "Wi-Fi" (case insensitive)
    const wifiCandidate = candidates.find(c =>
        c.name.toLowerCase().includes('wi-fi') ||
        c.name.toLowerCase().includes('wifi') ||
        c.name.toLowerCase().includes('wireless') ||
        c.name.toLowerCase().includes('wlan')
    );

    if (wifiCandidate) {
        return wifiCandidate.address;
    }

    // Priority 2: Standard LAN IPs
    const lanCandidate = candidates.find(c =>
        c.address.startsWith('192.168.') ||
        c.address.startsWith('10.') ||
        (c.address.startsWith('172.') && parseInt(c.address.split('.')[1]) >= 16 && parseInt(c.address.split('.')[1]) <= 31)
    );

    if (lanCandidate) {
        return lanCandidate.address;
    }

    // Priority 3: First available
    return candidates.length > 0 ? candidates[0].address : 'localhost';
}
