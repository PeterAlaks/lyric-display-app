import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const rootDir = process.cwd();

const runGit = (command) => {
  try {
    return execSync(command, {
      cwd: rootDir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return null;
  }
};

const readPackageVersion = () => {
  try {
    const packageJson = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
    return packageJson.version || null;
  } catch {
    return null;
  }
};

const status = runGit('git status --short');
const buildInfo = {
  version: readPackageVersion(),
  builtAt: new Date().toISOString(),
  commit: process.env.GITHUB_SHA || runGit('git rev-parse HEAD'),
  shortCommit: process.env.GITHUB_SHA
    ? process.env.GITHUB_SHA.slice(0, 12)
    : runGit('git rev-parse --short=12 HEAD'),
  branch: process.env.GITHUB_REF_NAME || runGit('git branch --show-current'),
  tag: process.env.GITHUB_REF_TYPE === 'tag'
    ? process.env.GITHUB_REF_NAME
    : runGit('git describe --tags --exact-match HEAD'),
  dirty: Boolean(status),
  dirtySummary: status || '',
  source: process.env.GITHUB_ACTIONS ? 'github-actions' : 'local',
};

const outputPath = path.join(rootDir, 'dist', 'build-info.json');
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(buildInfo, null, 2)}\n`, 'utf8');
console.log(`[build-info] Wrote ${path.relative(rootDir, outputPath)} (${buildInfo.shortCommit || 'unknown'})`);
