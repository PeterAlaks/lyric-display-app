const isAllowedLocalOrigin = (origin) => {
  if (!origin || origin === 'null') return true;

  try {
    const url = new URL(origin);
    return url.protocol === 'http:' && (
      url.hostname === 'localhost' ||
      url.hostname === '127.0.0.1' ||
      url.hostname === '::1'
    );
  } catch {
    return false;
  }
};

const pendingAppControlRequests = new Map();
let appControlResponseListenerInstalled = false;

function ensureAppControlResponseListener() {
  if (appControlResponseListenerInstalled) return;
  appControlResponseListenerInstalled = true;

  process.on('message', (message) => {
    if (message?.type !== 'app-control-response' || typeof message.requestId !== 'string') {
      return;
    }

    const pending = pendingAppControlRequests.get(message.requestId);
    if (!pending) return;

    pendingAppControlRequests.delete(message.requestId);
    clearTimeout(pending.timeout);

    if (message.success) {
      pending.resolve(message);
    } else {
      pending.reject(new Error(message.error || 'Electron did not complete the requested action'));
    }
  });
}

function requestElectronAppControl(payload, timeoutMs = 4000) {
  if (!process.send) {
    return Promise.reject(new Error('Desktop app control is only available when LyricDisplay is running under Electron'));
  }

  ensureAppControlResponseListener();

  const requestId = `app_control_${Date.now()}_${Math.random().toString(36).slice(2)}`;

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      pendingAppControlRequests.delete(requestId);
      reject(new Error('Timed out waiting for LyricDisplay to respond'));
    }, timeoutMs);

    pendingAppControlRequests.set(requestId, { resolve, reject, timeout });

    try {
      process.send({ ...payload, requestId });
    } catch (error) {
      pendingAppControlRequests.delete(requestId);
      clearTimeout(timeout);
      reject(error);
    }
  });
}

export function registerAppControlRoutes(app, { localhostOnly, appControlTimeoutMs = 4000 }) {
  app.get('/api/app/capabilities', localhostOnly, (req, res) => {
    if (!isAllowedLocalOrigin(req.get('origin'))) {
      return res.status(403).json({ error: 'Desktop app control is only allowed from a local dock page' });
    }

    res.json({
      switchToDesktopMode: Boolean(process.send),
      obsDockLocalAuth: process.env.LYRICDISPLAY_OBS_DOCK_LOCAL_AUTH === '1',
    });
  });

  const handleDesktopModeRequest = async (req, res) => {
    if (!isAllowedLocalOrigin(req.get('origin'))) {
      return res.status(403).json({ error: 'Desktop app control is only allowed from a local dock page' });
    }

    if (!process.send) {
      return res.status(503).json({
        error: 'Desktop app control is only available when LyricDisplay is running under Electron',
      });
    }

    try {
      await requestElectronAppControl(
        { type: 'switch-to-desktop-mode', source: 'obs-dock' },
        appControlTimeoutMs
      );
      res.json({ success: true });
    } catch (error) {
      console.error('Failed to request desktop mode switch:', error);
      res.status(error?.message?.includes('Timed out') ? 504 : 500).json({
        error: error.message || 'Failed to request desktop mode switch',
      });
    }
  };

  app.post('/api/app/switch-to-desktop-mode', localhostOnly, handleDesktopModeRequest);

  app.post('/api/app/switch-to-dock-mode', localhostOnly, (req, res) => {
    if (!isAllowedLocalOrigin(req.get('origin'))) {
      return res.status(403).json({ error: 'Dock Mode control is only allowed from a local dock page' });
    }

    if (!process.send) {
      return res.status(503).json({
        error: 'Dock Mode control is only available when LyricDisplay is running under Electron',
      });
    }

    try {
      process.send({ type: 'switch-to-dock-mode', source: 'obs-dock' });
      res.json({ success: true });
    } catch (error) {
      console.error('Failed to request Dock Mode switch:', error);
      res.status(500).json({ error: 'Failed to request Dock Mode switch' });
    }
  });

  app.post('/api/app/quit', localhostOnly, async (req, res) => {
    if (!isAllowedLocalOrigin(req.get('origin'))) {
      return res.status(403).json({ error: 'App control is only allowed from a local page or helper' });
    }

    if (!process.send) {
      return res.status(503).json({
        error: 'App control is only available when LyricDisplay is running under Electron',
      });
    }

    try {
      await requestElectronAppControl(
        { type: 'quit-app', source: 'tray-helper' },
        appControlTimeoutMs
      );
      res.json({ success: true });
    } catch (error) {
      console.error('Failed to request app quit:', error);
      res.status(error?.message?.includes('Timed out') ? 504 : 500).json({
        error: error.message || 'Failed to request app quit',
      });
    }
  });
}
