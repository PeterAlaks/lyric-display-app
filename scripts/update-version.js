import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const pkgPath = path.resolve(__dirname, '../package.json');
const readmePath = path.resolve(__dirname, '../README.md');
const guidePath = path.resolve(__dirname, '../INSTALLATION.md');
const openapiPath = path.resolve(__dirname, '../docs/openapi.yaml');
const asyncapiPath = path.resolve(__dirname, '../docs/asyncapi.yaml');

function getCurrentVersion() {
  if (!fs.existsSync(pkgPath)) return '0.0.0';
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  return pkg.version;
}

function updateCopyrightYear(content) {
  const currentYear = new Date().getFullYear();
  // Match patterns like "© 2025", "Copyright © 2025", "© 2024", etc.
  return content.replace(
    /(©\s*)(\d{4})/g,
    `$1${currentYear}`
  );
}

function updateVersionNumbers(version) {
  if (!version) version = getCurrentVersion();

  if (fs.existsSync(readmePath)) {
    let content = fs.readFileSync(readmePath, 'utf8');
    content = content.replace(
      /(\*\*Version:\*\*\s*)(\d+\.\d+\.\d+)/i,
      `$1${version}`
    );
    content = updateCopyrightYear(content);
    fs.writeFileSync(readmePath, content);
    console.log(`ƒo. Updated README.md to version ${version}`);
  }

  if (fs.existsSync(guidePath)) {
    let content = fs.readFileSync(guidePath, 'utf8');
    content = content.replace(
      /(Version:\s*)(\d+\.\d+\.\d+)/i,
      `$1${version}`
    );
    content = updateCopyrightYear(content);
    fs.writeFileSync(guidePath, content);
    console.log(`ƒo. Updated Installation Guide to version ${version}`);
  }

  if (fs.existsSync(openapiPath)) {
    let content = fs.readFileSync(openapiPath, 'utf8');
    content = content.replace(
      /(version:\s*)(\d+\.\d+\.\d+)/i,
      `$1${version}`
    );
    fs.writeFileSync(openapiPath, content);
    console.log(`ƒo. Updated OpenAPI spec to version ${version}`);
  }

  if (fs.existsSync(asyncapiPath)) {
    let content = fs.readFileSync(asyncapiPath, 'utf8');
    content = content.replace(
      /(version:\s*)(\d+\.\d+\.\d+)/i,
      `$1${version}`
    );
    fs.writeFileSync(asyncapiPath, content);
    console.log(`ƒo. Updated AsyncAPI spec to version ${version}`);
  }
}

function updateGitHubReleaseLinks(version) {
  if (!version || !/^\d+\.\d+\.\d+/.test(version)) {
    console.warn('Invalid version provided, skipping link update');
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

    const releaseAssetPatterns = [
      {
        pattern: /https:\/\/github\.com\/PeterAlaks\/lyric-display-app\/releases\/download\/v[\d.]+\/LyricDisplay-[\d.]+-Windows-Setup\.exe/g,
        replacement: githubLinks.windows,
      },
      {
        pattern: /https:\/\/github\.com\/PeterAlaks\/lyric-display-app\/releases\/download\/v[\d.]+\/LyricDisplay-[\d.]+-macOS-arm64\.dmg/g,
        replacement: githubLinks.macosArm,
      },
      {
        pattern: /https:\/\/github\.com\/PeterAlaks\/lyric-display-app\/releases\/download\/v[\d.]+\/LyricDisplay-[\d.]+-macOS-x64\.dmg/g,
        replacement: githubLinks.macosIntel,
      },
      {
        pattern: /https:\/\/github\.com\/PeterAlaks\/lyric-display-app\/releases\/download\/v[\d.]+\/LyricDisplay-[\d.]+-Linux\.AppImage/g,
        replacement: githubLinks.linux,
      },
    ];

    for (const { pattern, replacement } of releaseAssetPatterns) {
      content = content.replace(pattern, replacement);
    }

    fs.writeFileSync(guidePath, content);
    console.log(`Updated Installation Guide with links for v${version}`);
    return true;
  }
  return false;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const version = args[0] || getCurrentVersion();

  console.log(`\nUpdating documentation version to v${version}...\n`);
  updateVersionNumbers(version);

  updateGitHubReleaseLinks(version);
}

export { updateVersionNumbers, updateGitHubReleaseLinks };
