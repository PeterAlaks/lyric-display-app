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


export async function getLocalIPAddress() {
    const activeIP = await getActiveIP();
    const nets = networkInterfaces();

    if (!activeIP || activeIP === '0.0.0.0') {
        return 'localhost';
    }

    for (const name of Object.keys(nets)) {
        for (const net of nets[name] ?? []) {
            if (
                net.family === 'IPv4' &&
                !net.internal &&
                net.address === activeIP
            ) {
                return net.address;
            }
        }
    }

    return activeIP;
}
