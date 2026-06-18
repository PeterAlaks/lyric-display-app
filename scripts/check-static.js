import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const checkDirs = ['main', 'server', 'shared', 'scripts', 'src', 'tests'];
const rootFiles = ['main.js', 'preload.js', 'vite.config.js', 'tailwind.config.js', 'postcss.config.js'];
const sourceExtensions = new Set(['.js', '.jsx', '.json', '.css', '.html', '.md']);
const conflictMarkerPattern = /^(<<<<<<<|=======|>>>>>>>)($|[\s:])/m;

function walk(dir, visitor) {
  if (!fs.existsSync(dir)) return;

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === 'build') continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, visitor);
    } else if (entry.isFile()) {
      visitor(fullPath);
    }
  }
}

const syntaxFiles = [];
const conflictFiles = [];

for (const file of rootFiles) {
  const fullPath = path.join(root, file);
  if (fs.existsSync(fullPath)) syntaxFiles.push(fullPath);
}

for (const dir of checkDirs) {
  walk(path.join(root, dir), (file) => {
    const ext = path.extname(file);
    if (ext === '.js') syntaxFiles.push(file);
    if (sourceExtensions.has(ext)) conflictFiles.push(file);
  });
}

let failed = false;

for (const file of syntaxFiles) {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (result.status !== 0) {
    failed = true;
    console.error(`Syntax check failed: ${path.relative(root, file)}`);
    if (result.stderr) console.error(result.stderr.trim());
    if (result.stdout) console.error(result.stdout.trim());
  }
}

for (const file of conflictFiles) {
  const content = fs.readFileSync(file, 'utf8');
  if (conflictMarkerPattern.test(content)) {
    failed = true;
    console.error(`Conflict marker found: ${path.relative(root, file)}`);
  }
}

if (failed) {
  process.exitCode = 1;
} else {
  console.log(`Static checks passed (${syntaxFiles.length} JS syntax checks, ${conflictFiles.length} conflict-marker scans).`);
}
