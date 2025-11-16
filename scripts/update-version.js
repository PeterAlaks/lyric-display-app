import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const pkgPath = path.resolve(__dirname, '../package.json');
const readmePath = path.resolve(__dirname, '../README.md');
const guidePath = path.resolve(__dirname, '../LyricDisplay Installation & Integration Guide.md');

function getCurrentVersion() {
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  return pkg.version;
}

function replaceVersion(filePath, regex, label) {
  if (!fs.existsSync(filePath)) {
    console.warn(`⚠️  ${label} file not found: ${filePath}`);
    return;
  }
  const version = getCurrentVersion();
  let content = fs.readFileSync(filePath, 'utf8');
  const updated = content.replace(regex, `$1${version}`);
  fs.writeFileSync(filePath, updated);
  console.log(`✅ Updated ${label} to version ${version}`);
}

/**
 * Update GitHub release download links in Installation Guide only
 * @param {string} version - Version number (e.g., "5.7.0")
 * @param {boolean} alsoUpdateVersion - Whether to also update version numbers in the same operation
 */
export function updateGitHubReleaseLinks(version, alsoUpdateVersion = false) {
  if (!version || !/^\d+\.\d+\.\d+/.test(version)) {
    console.warn('⚠️  Invalid version provided, skipping link update');
    return false;
  }

  if (!fs.existsSync(guidePath)) {
    console.warn('⚠️  Installation Guide not found');
    return false;
  }

  const githubLinks = {
    windows: `https://github.com/PeterAlaks/lyric-display-app/releases/download/v${version}/LyricDisplay-${version}-Windows-Setup.exe`,
    macos: `https://github.com/PeterAlaks/lyric-display-app/releases/download/v${version}/LyricDisplay-${version}-macOS.dmg`,
    linux: `https://github.com/PeterAlaks/lyric-display-app/releases/download/v${version}/LyricDisplay-${version}-Linux.AppImage`
  };

  let guideContent = fs.readFileSync(guidePath, 'utf8');

  guideContent = guideContent.replace(
    /(\[​Click here to download for Windows​\]\()[^\)]+(\))/,
    `$1${githubLinks.windows}$2`
  );

  guideContent = guideContent.replace(
    /(\[​Click here to download for MacOS​\]\()[^\)]+(\))/,
    `$1${githubLinks.macos}$2`
  );

  guideContent = guideContent.replace(
    /(\[​Click here to download for Linux​\]\()[^\)]+(\))/,
    `$1${githubLinks.linux}$2`
  );

  if (alsoUpdateVersion) {
    guideContent = guideContent.replace(
      /(Version:\s*)(\d+\.\d+\.\d+)/i,
      `$1${version}`
    );
  }

  fs.writeFileSync(guidePath, guideContent);

  console.log(`✅ Updated Installation Guide with GitHub release links for v${version}`);
  console.log(`   Windows: ${githubLinks.windows}`);
  console.log(`   macOS: ${githubLinks.macos}`);
  console.log(`   Linux: ${githubLinks.linux}`);
  if (alsoUpdateVersion) {
    console.log(`✅ Updated Installation Guide to version ${version}`);
  }

  return true;
}

export function updateVersionOnly() {
  replaceVersion(readmePath, /(\*\*Version:\*\*\s*)(\d+\.\d+\.\d+)/i, 'README.md');
  replaceVersion(guidePath, /(Version:\s*)(\d+\.\d+\.\d+)/i, 'Installation Guide');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  updateVersionOnly();
}