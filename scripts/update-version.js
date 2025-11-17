import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const pkgPath = path.resolve(__dirname, '../package.json');
const readmePath = path.resolve(__dirname, '../README.md');
const guidePath = path.resolve(__dirname, '../LyricDisplay Installation & Integration Guide.md');

function getCurrentVersion() {
  if (!fs.existsSync(pkgPath)) return '0.0.0';
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  return pkg.version;
}

function updateVersionNumbers(version) {
  if (!version) version = getCurrentVersion();

  if (fs.existsSync(readmePath)) {
    let content = fs.readFileSync(readmePath, 'utf8');
    content = content.replace(
      /(\*\*Version:\*\*\s*)(\d+\.\d+\.\d+)/i,
      `$1${version}`
    );
    fs.writeFileSync(readmePath, content);
    console.log(`✅ Updated README.md to version ${version}`);
  }

  if (fs.existsSync(guidePath)) {
    let content = fs.readFileSync(guidePath, 'utf8');
    content = content.replace(
      /(Version:\s*)(\d+\.\d+\.\d+)/i,
      `$1${version}`
    );
    fs.writeFileSync(guidePath, content);
    console.log(`✅ Updated Installation Guide to version ${version}`);
  }
}

function updateGitHubReleaseLinks(version) {
  if (!version || !/^\d+\.\d+\.\d+/.test(version)) {
    console.warn('⚠️  Invalid version provided, skipping link update');
    return false;
  }

  const githubLinks = {
    windows: `https://github.com/PeterAlaks/lyric-display-app/releases/download/v${version}/LyricDisplay-${version}-Windows-Setup.exe`,
    macosArm: `https://github.com/PeterAlaks/lyric-display-app/releases/download/v${version}/LyricDisplay-${version}-macOS-arm64.dmg`,
    macosIntel: `https://github.com/PeterAlaks/lyric-display-app/releases/download/v${version}/LyricDisplay-${version}-macOS-x64.dmg`,
    linux: `https://github.com/PeterAlaks/lyric-display-app/releases/download/v${version}/LyricDisplay-${version}-Linux.AppImage`
  };

  if (fs.existsSync(guidePath)) {
    let content = fs.readFileSync(guidePath, 'utf8');

    content = content.replace(
      /(\[.*?download for Windows.*?\]\()([^\)]+)(\))/i,
      `$1${githubLinks.windows}$3`
    );

    content = content.replace(
      /(\[.*?download for Apple Silicon.*?\]\()([^\)]+)(\))/i,
      `$1${githubLinks.macosArm}$3`
    );

    content = content.replace(
      /(\[.*?download for Intel Mac.*?\]\()([^\)]+)(\))/i,
      `$1${githubLinks.macosIntel}$3`
    );

    content = content.replace(
      /(\[.*?download for Linux.*?\]\()([^\)]+)(\))/i,
      `$1${githubLinks.linux}$3`
    );

    fs.writeFileSync(guidePath, content);
    console.log(`✅ Updated Installation Guide with links for v${version}`);
    return true;
  }
  return false;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const version = args[0] || getCurrentVersion();

  console.log(`\n📝 Updating documentation version to v${version}...\n`);
  updateVersionNumbers(version);

  updateGitHubReleaseLinks(version);
}

export { updateVersionNumbers, updateGitHubReleaseLinks };