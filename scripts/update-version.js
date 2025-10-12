import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const pkgPath = path.resolve(__dirname, '../package.json');
const readmePath = path.resolve(__dirname, '../README.md');
const guidePath = path.resolve(__dirname, '../LyricDisplay Installation & Integration Guide.md');

const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const version = pkg.version;

function replaceVersion(filePath, regex, label) {
  if (!fs.existsSync(filePath)) {
    console.warn(`⚠️  ${label} file not found: ${filePath}`);
    return;
  }
  let content = fs.readFileSync(filePath, 'utf8');
  const updated = content.replace(regex, `$1${version}`);
  fs.writeFileSync(filePath, updated);
  console.log(`✅ Updated ${label} to version ${version}`);
}

replaceVersion(readmePath, /(\*\*Version:\*\*\s*)(\d+\.\d+\.\d+)/i, 'README.md');
replaceVersion(guidePath, /(Version:\s*)(\d+\.\d+\.\d+)/i, 'Installation Guide');
