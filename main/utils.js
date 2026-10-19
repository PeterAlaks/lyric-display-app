import { networkInterfaces } from 'os';
import dgram from 'dgram';

function getActiveIP() {
    return new Promise((resolve) => {
        const socket = dgram.createSocket('udp4');

        socket.connect(80, '8.8.8.8', () => {
            const { address } = socket.address();
            socket.close();
            resolve(address);
        });

        socket.on('error', () => resolve('localhost'));
    });
}


export function isIPv4AddressAssigned(address, nets = networkInterfaces()) {
    if (!address) return false;
    return Object.values(nets || {}).some((entries) => (entries ?? []).some((net) => (
        (net.family === 'IPv4' || net.family === 4) &&
        !net.internal &&
        net.address === address
    )));
}

/**
 * Keep reporting the same LAN address while it is still assigned to this machine.
 * An adapter with several static addresses/gateways can change which one Windows uses
 * for outbound routes at any time; outputs connected to the earlier address keep working.
 */
export function selectStableLocalIPAddress({ activeIP, preferredAddress, nets = networkInterfaces() } = {}) {
    if (isIPv4AddressAssigned(preferredAddress, nets)) return preferredAddress;
    if (!activeIP || activeIP === '0.0.0.0') return 'localhost';
    return activeIP;
}

let lastReportedIPAddress = '';

export async function getLocalIPAddress({ preferredAddress = lastReportedIPAddress } = {}) {
    const address = selectStableLocalIPAddress({
        activeIP: await getActiveIP(),
        preferredAddress,
    });
    if (address !== 'localhost') lastReportedIPAddress = address;
    return address;
}
