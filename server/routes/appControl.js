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

export function registerAppControlRoutes(app, { localhostOnly }) {
  app.get('/api/app/capabilities', localhostOnly, (req, res) => {
    if (!isAllowedLocalOrigin(req.get('origin'))) {
      return res.status(403).json({ error: 'Desktop app control is only allowed from a local dock page' });
    }

    res.json({
      openMainWindow: Boolean(process.send),
      obsDockLocalAuth: process.env.LYRICDISPLAY_OBS_DOCK_LOCAL_AUTH === '1',
    });
  });

  app.post('/api/app/open-main-window', localhostOnly, (req, res) => {
    if (!isAllowedLocalOrigin(req.get('origin'))) {
      return res.status(403).json({ error: 'Desktop app control is only allowed from a local dock page' });
    }

    if (!process.send) {
      return res.status(503).json({
        error: 'Desktop app control is only available when LyricDisplay is running under Electron',
      });
    }

    try {
      process.send({ type: 'open-main-window', source: 'obs-dock' });
      res.json({ success: true });
    } catch (error) {
      console.error('Failed to request main window open:', error);
      res.status(500).json({ error: 'Failed to request main window open' });
    }
  });

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
}
