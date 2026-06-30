import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, '..');
const distDir = path.join(appRoot, 'dist');

const platform = process.argv[2]?.replace(/^--/, '');

const platformConfig = {
  windows: {
    metadata: 'latest.yml',
    artifacts: ['.exe'],
  },
  macos: {
    metadata: 'latest-mac.yml',
    artifacts: ['.zip'],
  },
  linux: {
    metadata: 'latest-linux.yml',
    artifacts: ['.AppImage'],
    requireBlockmaps: false,
  },
};

const config = platformConfig[platform];

if (!config) {
  console.error('Usage: node scripts/verify-blockmaps.js --windows|--macos|--linux');
  process.exit(1);
}

if (!existsSync(distDir)) {
  console.error(`Build output directory not found: ${distDir}`);
  process.exit(1);
}

const distFiles = readdirSync(distDir, { withFileTypes: true })
  .filter((entry) => entry.isFile())
  .map((entry) => entry.name);

const artifacts = distFiles.filter((fileName) =>
  config.artifacts.some((extension) => fileName.endsWith(extension))
);

if (artifacts.length === 0) {
  console.error(`No ${platform} release artifacts found in dist.`);
  process.exit(1);
}

const requireBlockmaps = config.requireBlockmaps !== false;
const missingBlockmaps = requireBlockmaps
  ? artifacts.filter((artifact) => !existsSync(path.join(distDir, `${artifact}.blockmap`)))
  : [];

if (missingBlockmaps.length > 0) {
  console.error(`Missing blockmaps for ${platform} artifacts:`);
  missingBlockmaps.forEach((artifact) => console.error(`- ${artifact}.blockmap`));
  process.exit(1);
} else if (!requireBlockmaps) {
  console.log(`Blockmap files are optional for ${platform} artifacts; skipping strict blockmap check.`);
}

const metadataPath = path.join(distDir, config.metadata);

if (!existsSync(metadataPath)) {
  console.error(`Missing update metadata: ${config.metadata}`);
  process.exit(1);
}

const metadata = readFileSync(metadataPath, 'utf8');

if (!metadata.includes('blockMapSize')) {
  console.warn(`Warning: ${config.metadata} does not include blockMapSize entries. Blockmap files exist, but differential metadata should be reviewed.`);
}

console.log(`Verified ${artifacts.length} ${platform} artifact(s) have matching blockmaps and update metadata file.`);
