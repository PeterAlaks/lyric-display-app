import fs from 'fs/promises';
import path from 'path';

const TEMPLATES_FOLDER = 'UserTemplates';
const TEMPLATE_FILES = {
  output: 'output-templates.json',
  stage: 'stage-templates.json',
};

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

const getUserDataDir = () => {
  if (process.env.LYRICDISPLAY_USER_DATA_DIR) {
    return path.resolve(process.env.LYRICDISPLAY_USER_DATA_DIR);
  }

  if (process.env.LYRICDISPLAY_DATA_DIR) {
    return path.dirname(path.resolve(process.env.LYRICDISPLAY_DATA_DIR));
  }

  return null;
};

async function loadUserTemplates(type) {
  const fileName = TEMPLATE_FILES[type];
  const userDataDir = getUserDataDir();
  if (!fileName || !userDataDir) return [];

  const filePath = path.join(userDataDir, TEMPLATES_FOLDER, fileName);
  try {
    const content = await fs.readFile(filePath, 'utf8');
    const templates = JSON.parse(content);
    return Array.isArray(templates) ? templates : [];
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

export function registerTemplateRoutes(app, { localhostOnly }) {
  app.get('/api/templates/:type', localhostOnly, async (req, res) => {
    if (!isAllowedLocalOrigin(req.get('origin'))) {
      return res.status(403).json({ error: 'Templates are only available from a local LyricDisplay page' });
    }

    const type = String(req.params?.type || '').toLowerCase();
    if (!Object.prototype.hasOwnProperty.call(TEMPLATE_FILES, type)) {
      return res.status(400).json({ error: 'Unknown template type' });
    }

    try {
      const templates = await loadUserTemplates(type);
      return res.json({ success: true, templates });
    } catch (error) {
      console.error(`Failed to load ${type} templates:`, error);
      return res.status(500).json({ error: 'Failed to load templates' });
    }
  });
}
