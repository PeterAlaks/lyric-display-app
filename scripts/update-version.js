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

/**
 * Replace version numbers in documentation files
 */
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

/**
 * Update MEGA download links in documentation files
 * @param {string} newMegaLink - The new MEGA public link
 * @param {boolean} alsoUpdateVersion - Whether to also update version numbers in the same operation
 */
export function updateMegaLinks(newMegaLink, alsoUpdateVersion = false) {
  if (!newMegaLink || !newMegaLink.startsWith('https://mega.nz/')) {
    console.warn('⚠️  Invalid MEGA link provided, skipping link update');
    return false;
  }

  let filesUpdated = 0;

  const megaLinkPattern = /https:\/\/mega\.nz\/[^\s\)]+/g;

  if (fs.existsSync(guidePath)) {
    let guideContent = fs.readFileSync(guidePath, 'utf8');
    const guideMatches = guideContent.match(megaLinkPattern);

    if (guideMatches && guideMatches.length > 0) {

      guideContent = guideContent.replace(megaLinkPattern, newMegaLink);

      if (alsoUpdateVersion) {
        guideContent = guideContent.replace(/(Version:\s*)(\d+\.\d+\.\d+)/i, `$1${version}`);
      }

      fs.writeFileSync(guidePath, guideContent);
      console.log(`✅ Updated ${guideMatches.length} MEGA link(s) in Installation Guide`);
      if (alsoUpdateVersion) {
        console.log(`✅ Updated Installation Guide to version ${version}`);
      }
      filesUpdated++;
    }
  }

  if (fs.existsSync(readmePath)) {
    let readmeContent = fs.readFileSync(readmePath, 'utf8');
    const readmeMatches = readmeContent.match(megaLinkPattern);

    if (readmeMatches && readmeMatches.length > 0) {

      readmeContent = readmeContent.replace(megaLinkPattern, newMegaLink);

      if (alsoUpdateVersion) {
        readmeContent = readmeContent.replace(/(\*\*Version:\*\*\s*)(\d+\.\d+\.\d+)/i, `$1${version}`);
      }

      fs.writeFileSync(readmePath, readmeContent);
      console.log(`✅ Updated ${readmeMatches.length} MEGA link(s) in README.md`);
      if (alsoUpdateVersion) {
        console.log(`✅ Updated README.md to version ${version}`);
      }
      filesUpdated++;
    }
  }

  return filesUpdated > 0;
}

/**
 * Update only version numbers (no MEGA links)
 */
export function updateVersionOnly() {
  replaceVersion(readmePath, /(\*\*Version:\*\*\s*)(\d+\.\d+\.\d+)/i, 'README.md');
  replaceVersion(guidePath, /(Version:\s*)(\d+\.\d+\.\d+)/i, 'Installation Guide');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  updateVersionOnly();
}