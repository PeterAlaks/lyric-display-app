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

/**
 * Update version numbers in documentation files
 * @param {string} version - Version number (e.g., "5.7.0")
 */
function updateVersionNumbers(version) {
  if (!version) {
    version = getCurrentVersion();
  }

  if (fs.existsSync(readmePath)) {
    let readmeContent = fs.readFileSync(readmePath, 'utf8');
    readmeContent = readmeContent.replace(
      /(\*\*Version:\*\*\s*)(\d+\.\d+\.\d+)/i,
      `$1${version}`
    );
    fs.writeFileSync(readmePath, readmeContent);
    console.log(`✅ Updated README.md to version ${version}`);
  }

  if (fs.existsSync(guidePath)) {
    let guideContent = fs.readFileSync(guidePath, 'utf8');
    guideContent = guideContent.replace(
      /(Version:\s*)(\d+\.\d+\.\d+)/i,
      `$1${version}`
    );
    fs.writeFileSync(guidePath, guideContent);
    console.log(`✅ Updated Installation Guide to version ${version}`);
  }
}

/**
 * Update GitHub release download links in documentation files
 * @param {string} version - Version number (e.g., "5.7.0")
 */
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

  let updated = false;

  if (fs.existsSync(guidePath)) {
    let guideContent = fs.readFileSync(guidePath, 'utf8');

    guideContent = guideContent.replace(
      /(\[​Click here to download for Windows​\]\()[^\)]+(\))/,
      `$1${githubLinks.windows}$2`
    );

    guideContent = guideContent.replace(
      /(\[​Click here to download for Apple Silicon \(M1\/M2\/M3\)​\]\()[^\)]+(\))/,
      `$1${githubLinks.macosArm}$2`
    );

    guideContent = guideContent.replace(
      /(\[​Click here to download for Intel Mac​\]\()[^\)]+(\))/,
      `$1${githubLinks.macosIntel}$2`
    );

    guideContent = guideContent.replace(
      /(\[​Click here to download for Linux​\]\()[^\)]+(\))/,
      `$1${githubLinks.linux}$2`
    );

    fs.writeFileSync(guidePath, guideContent);
    console.log(`✅ Updated Installation Guide with GitHub release links for v${version}`);
    console.log(`   Windows: ${githubLinks.windows}`);
    console.log(`   macOS (Apple Silicon): ${githubLinks.macosArm}`);
    console.log(`   macOS (Intel): ${githubLinks.macosIntel}`);
    console.log(`   Linux: ${githubLinks.linux}`);
    updated = true;
  }

  return updated;
}

/**
 * Main function - handles both version updates and link updates
 */
function main() {
  const args = process.argv.slice(2);

  if (args[0] === '--update-links-only') {
    const version = args[1] || getCurrentVersion();
    console.log(`\n📝 Updating download links for v${version}...\n`);
    updateGitHubReleaseLinks(version);
    return;
  }

  const version = args[0] || getCurrentVersion();
  console.log(`\n📝 Updating documentation version to v${version}...\n`);
  updateVersionNumbers(version);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { updateVersionNumbers, updateGitHubReleaseLinks };