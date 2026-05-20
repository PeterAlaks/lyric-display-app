import { networkInterfaces } from 'os';
import dgram from 'dgram';

const DEFAULT_PORT = 4000;

function getLanAddress() {
  const nets = networkInterfaces();

  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }

  return null;
}

function getActiveLanAddress() {
  return new Promise((resolve) => {
    const socket = dgram.createSocket('udp4');
    let settled = false;

    const finish = (address) => {
      if (settled) return;
      settled = true;
      try {
        socket.close();
      } catch {
        // Ignore close errors.
      }
      resolve(address || getLanAddress());
    };

    socket.on('error', () => finish(null));
    socket.connect(80, '8.8.8.8', () => {
      try {
        const address = socket.address()?.address;
        finish(address && address !== '0.0.0.0' ? address : null);
      } catch {
        finish(null);
      }
    });
  });
}

function formatOutputLabel(outputId) {
  if (outputId === 'stage') return 'Stage Display';
  if (outputId === 'time') return 'Timer Display';

  const match = /^output(\d+)$/i.exec(outputId || '');
  if (match) return `Output ${match[1]}`;

  return outputId;
}

function buildSource(outputId, port) {
  return {
    id: outputId,
    label: formatOutputLabel(outputId),
    path: `/#/${outputId}`,
    defaultWidth: 1920,
    defaultHeight: 1080,
    fps: 30,
    transparent: outputId !== 'time',
    projectionPath: `/#/${outputId}?projection=true`,
    previewPath: outputId.startsWith('output') ? `/#/${outputId}?preview=true` : `/#/${outputId}`,
    port,
  };
}

export function registerIntegrationRoutes(app, { getOutputRegistry, port = DEFAULT_PORT }) {
  app.get('/api/integrations/sources', async (req, res) => {
    const registry = getOutputRegistry();
    const outputs = Array.isArray(registry.outputs) ? registry.outputs : [];
    const sourceIds = [...outputs, 'stage', 'time'];
    const lanAddress = await getActiveLanAddress();

    res.json({
      success: true,
      appName: 'LyricDisplay',
      baseUrls: {
        local: `http://127.0.0.1:${port}`,
        network: lanAddress ? `http://${lanAddress}:${port}` : null,
      },
      sources: sourceIds.map((outputId) => buildSource(outputId, port)),
      timestamp: Date.now(),
    });
  });
}
