import { execSync } from 'child_process';
import prompts from 'prompts';
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import archiver from 'archiver';
import { updateMegaLinks } from './update-version.js';

function parseVersion(version) {
    const match = version.match(/^(\d+)\.(\d+)\.(\d+)(?:-(.+))?$/);
    if (!match) return null;
    return {
        major: parseInt(match[1], 10),
        minor: parseInt(match[2], 10),
        patch: parseInt(match[3], 10),
        pre: match[4] || null
    };
}

function compareVersions(a, b) {
    const va = parseVersion(a);
    const vb = parseVersion(b);
    if (!va || !vb) return 0;

    if (va.major > vb.major) return 1;
    if (va.major < vb.major) return -1;

    if (va.minor > vb.minor) return 1;
    if (va.minor < vb.minor) return -1;

    if (va.patch > vb.patch) return 1;
    if (va.patch < vb.patch) return -1;

    if (!va.pre && vb.pre) return 1;
    if (va.pre && !vb.pre) return -1;
    return 0;
}

function getNextVersions(version) {
    const [major, minor, patch] = version.split('.').map(Number);
    return {
        patch: `${major}.${minor}.${patch + 1}`,
        minor: `${major}.${minor + 1}.0`,
        major: `${major + 1}.0.0`
    };
}

function safeExec(cmd, opts = {}) {
    const defaultTimeout = 30000;
    return execSync(cmd, {
        encoding: 'utf8',
        stdio: 'pipe',
        timeout: defaultTimeout,
        ...opts
    }).toString().trim();
}

function checkRemoteTagExists(tagName) {
    try {
        const tags = safeExec('git ls-remote --tags origin');
        return tags.includes(`refs/tags/${tagName}`);
    } catch (e) {
        console.log(chalk.yellow('Warning: Could not check remote tags'));
        return false;
    }
}

function checkLocalTagExists(tagName) {
    try {
        const tags = safeExec('git tag -l');
        return tags.split('\n').includes(tagName);
    } catch (e) {
        return false;
    }
}

async function promptForCustomVersion(currentVersion) {
    while (true) {
        const response = await prompts({
            type: 'text',
            name: 'version',
            message: 'Enter your desired version (e.g. 4.2.5 or 5.0.0-beta.1):',
            validate: value =>
                /^\d+\.\d+\.\d+(-[a-zA-Z0-9-.]+)?$/.test(value)
                    ? true
                    : 'Please enter a valid semver version (e.g. 4.2.5 or 5.0.0-beta.1)'
        });

        if (!response.version) {
            return null;
        }

        const entered = response.version.trim();

        if (entered === currentVersion) {
            const { action } = await prompts({
                type: 'select',
                name: 'action',
                message: `The entered version (v${entered}) is the same as the current package.json version (v${currentVersion}). What would you like to do?`,
                choices: [
                    { title: 'Re-enter version', value: 'retry' },
                    { title: 'Cancel release', value: 'cancel' }
                ]
            });

            if (action === 'cancel' || !action) return null;
            continue;
        }

        const cmp = compareVersions(entered, currentVersion);
        if (cmp < 0) {
            const { confirmLower } = await prompts({
                type: 'confirm',
                name: 'confirmLower',
                message: chalk.redBright(
                    `⚠️  The version you entered (v${entered}) is LOWER than the current version (v${currentVersion}). Continue anyway?`
                ),
                initial: false
            });
            if (!confirmLower) {
                continue;
            }
        }

        return entered;
    }
}

async function checkGitStateInteractive() {
    if (fs.existsSync('.git/MERGE_HEAD') || fs.existsSync('.git/rebase-apply') || fs.existsSync('.git/rebase-merge')) {
        console.log(chalk.redBright('\n🚫 A Git merge or rebase is currently in progress.'));
        console.log(chalk.yellow('Please resolve all conflicts and complete the merge/rebase before releasing.\n'));
        return { ok: false };
    }

    let branch = '';
    try {
        branch = safeExec('git symbolic-ref --short -q HEAD');
    } catch (e) {
        branch = '';
    }
    if (!branch) {
        console.log(chalk.redBright('\n🚫 You are in a detached HEAD state (not on a branch).'));
        console.log(chalk.yellow('Please checkout a branch before running a release (e.g. git checkout main).\n'));
        return { ok: false };
    }

    try {
        const count = safeExec('git rev-list --count HEAD');
        if (parseInt(count, 10) === 0) {
            console.log(chalk.redBright('\n🚫 This repository has no commits yet.'));
            console.log(chalk.yellow('Please make an initial commit before running the release script.\n'));
            return { ok: false };
        }
    } catch (e) {
        console.log(chalk.redBright('\n🚫 Unable to determine commit history.'));
        console.log(chalk.yellow('Ensure this is a valid Git repository and try again.\n'));
        return { ok: false };
    }

    let status = '';
    try {
        status = safeExec('git status --porcelain');
    } catch (e) {
        status = '';
    }

    const lines = status ? status.split('\n').filter(Boolean) : [];

    const hasStaged = lines.some(line => {
        return line[0] !== ' ' && line[0] !== '?';
    });

    const hasUnstaged = lines.some(line => {
        return line.startsWith('??') || line[1] !== ' ';
    });

    if (hasUnstaged && !hasStaged) {
        console.log(chalk.yellow('\n⚠️  You have unstaged changes (no staged files).'));
        console.log(chalk.gray('Please review and stage files (git add <files> or git add .) before continuing.\n'));
        const { autoStage } = await prompts({
            type: 'confirm',
            name: 'autoStage',
            message: 'Would you like the script to automatically stage all changes now (git add .)?',
            initial: false
        });

        if (!autoStage) {
            console.log(chalk.red('Aborting release. Please stage your changes and re-run the script.'));
            return { ok: false };
        }

        try {
            execSync('git add .', { stdio: 'inherit' });
            console.log(chalk.green('✅ All changes staged.'));
            status = safeExec('git status --porcelain');
        } catch (e) {
            console.error(chalk.red('❌ Failed to stage changes:'), e.message);
            return { ok: false };
        }
    }

    const refreshedLines = status ? status.split('\n').filter(Boolean) : [];
    const nowHasStaged = refreshedLines.some(line => line[0] !== ' ' && line[0] !== '?');
    const nowHasUnstaged = refreshedLines.some(line => line.startsWith('??') || line[1] !== ' ');

    if (nowHasStaged) {
        console.log(chalk.yellow('\n📝 You have staged but uncommitted changes that will be included in this release.'));
        const { commitMessage } = await prompts({
            type: 'text',
            name: 'commitMessage',
            message: 'Enter a commit message for the staged changes (this will be committed automatically):',
            validate: val => val && val.trim().length > 0 ? true : 'Commit message cannot be empty.'
        });

        if (!commitMessage) {
            console.log(chalk.red('Aborting release. No commit message provided.'));
            return { ok: false };
        }

        try {
            execSync(`git commit -m "${commitMessage.trim().replace(/"/g, '\\"')}"`, { stdio: 'inherit' });
            console.log(chalk.green('✅ Changes committed.'));
        } catch (e) {
            console.error(chalk.red('❌ Failed to commit changes:'), e.message);
            return { ok: false };
        }
    } else if (nowHasUnstaged) {
        console.log(chalk.yellow('\n⚠️ There are unstaged changes that will NOT be included in this release.'));
        const { continueAnyway } = await prompts({
            type: 'confirm',
            name: 'continueAnyway',
            message: 'Do you want to continue without including these unstaged changes?',
            initial: false
        });
        if (!continueAnyway) {
            console.log(chalk.red('Aborting release. Please stage/commit your changes and re-run.'));
            return { ok: false };
        }
    }

    if (branch && !['main', 'master'].includes(branch)) {
        const { confirmBranch } = await prompts({
            type: 'confirm',
            name: 'confirmBranch',
            message: `You are on branch '${branch}', not on 'main' or 'master'. Are you sure you want to create a release from this branch?`,
            initial: false
        });
        if (!confirmBranch) {
            console.log(chalk.red('Aborting release. Checkout the desired branch and re-run.'));
            return { ok: false };
        }
    }

    return { ok: true, branch };
}

function extractVersionFromZipName(name) {
    const m = name.match(/LyricDisplay v(\d+\.\d+\.\d+(?:-[\w.-]+)?)\.zip/i);
    return m ? m[1] : null;
}

async function createZipWithFiles({ distDir, setupPath, readmePath, outputZipPath }) {
    return new Promise((resolve, reject) => {
        const output = fs.createWriteStream(outputZipPath);
        const archive = archiver('zip', { zlib: { level: 9 } });

        output.on('close', () => {
            resolve({ bytes: archive.pointer() });
        });
        output.on('end', () => {
            // no-op
        });
        archive.on('warning', (err) => {
            console.warn('Archive warning:', err);
        });
        archive.on('error', (err) => {
            reject(err);
        });

        archive.pipe(output);

        archive.file(setupPath, { name: path.basename(setupPath) });

        if (fs.existsSync(readmePath)) {
            archive.file(readmePath, { name: path.basename(readmePath) });
        } else {
            console.log(chalk.yellow(`⚠️ README not found at ${readmePath}; skipping README in ZIP.`));
        }

        archive.finalize();
    });
}

function escapeMegaPath(remotePath) {
    const normalized = remotePath.replace(/\\/g, '/');
    return `"${normalized.replace(/"/g, '\\"')}"`;
}

function normalizeMegaPath(megaPath) {
    return megaPath.replace(/\\/g, '/');
}

async function handleMegaUpload(version, zipFilePath, zipFilename) {
    console.log(chalk.blue('\n☁️ Starting MEGA upload process...'));

    let whoami = '';
    try {
        whoami = safeExec('mega-whoami 2>&1', { timeout: 10000 });
    } catch (e) {
        console.log(chalk.yellow('\n⚠️ MEGA check timed out or failed. Skipping upload.'));
        return null;
    }

    if (!whoami || /Not logged in|not found|ERR/i.test(whoami)) {
        console.log(chalk.yellow('\n⚠️ MEGAcmd not logged in or not available in PATH. Skipping upload.'));
        console.log(chalk.gray('To enable MEGA upload: Install MEGAcmd and run "mega-login your@email.com"'));
        return null;
    }

    console.log(chalk.gray(`🔐 MEGA session: ${whoami}`));

    const remoteFolder = process.env.MEGA_REMOTE_PATH || '/LyricDisplay';

    try {
        execSync(`mega-mkdir -p ${escapeMegaPath(remoteFolder)}`, {
            stdio: 'pipe',
            timeout: 15000
        });
        console.log(chalk.gray(`Created/verified remote folder: ${remoteFolder}`));
    } catch (e) {
        if (!/already exists/i.test(e.message)) {
            console.log(chalk.yellow(`Note: ${e.message}`));
        }
    }

    try {
        const remoteFilePath = `${remoteFolder}/${zipFilename}`;
        const lsOutput = safeExec(`mega-ls ${escapeMegaPath(remoteFilePath)} 2>&1 || echo "NOT_FOUND"`, { timeout: 10000 });

        if (!lsOutput.includes('NOT_FOUND') && !lsOutput.includes('Couldn\'t find')) {
            console.log(chalk.yellow(`\n⚠️ File already exists on MEGA: ${zipFilename}`));
            const { overwrite } = await prompts({
                type: 'confirm',
                name: 'overwrite',
                message: 'Overwrite existing file on MEGA?',
                initial: true
            });

            if (!overwrite) {
                console.log(chalk.gray('Skipping upload, using existing file.'));

                try {
                    const exportOutput = safeExec(`mega-export -a -f ${escapeMegaPath(remoteFilePath)}`, { timeout: 15000 });
                    const linkMatch = exportOutput.match(/(https:\/\/mega\.nz\/[^\s]+)/);
                    if (linkMatch) {
                        return linkMatch[1];
                    }
                } catch (e) {
                    console.log(chalk.yellow('Could not retrieve existing link.'));
                }
                return null;
            }

            try {
                execSync(`mega-rm -f ${escapeMegaPath(remoteFilePath)}`, {
                    stdio: 'inherit',
                    timeout: 15000
                });
                console.log(chalk.gray('Removed existing remote file.'));
            } catch (e) {
                console.log(chalk.yellow(`Warning: Could not remove existing file: ${e.message}`));
            }
        }
    } catch (e) {
        console.log(chalk.gray('Could not check for existing remote file, proceeding with upload...'));
    }

    console.log(chalk.blue(`\n⬆️ Uploading ${zipFilename} to MEGA ${remoteFolder}...`));
    console.log(chalk.gray('This may take several minutes depending on file size and connection speed...'));

    try {
        execSync(`mega-put "${zipFilePath}" ${escapeMegaPath(remoteFolder + '/')}`, {
            stdio: 'inherit',
            timeout: 300000
        });
        console.log(chalk.green('✅ Upload completed.'));
    } catch (e) {
        if (e.killed && e.signal === 'SIGTERM') {
            console.error(chalk.red('❌ Upload timed out after 5 minutes.'));
        } else {
            console.error(chalk.red('❌ Upload failed:'), e.message);
        }
        throw e;
    }

    try {
        const remoteFilePath = `${remoteFolder}/${zipFilename}`;
        console.log(chalk.blue('Generating public link...'));
        const exportOutput = safeExec(`mega-export -a -f ${escapeMegaPath(remoteFilePath)}`, { timeout: 20000 });

        const linkMatch = exportOutput.match(/(https:\/\/mega\.nz\/[^\s]+)/);
        if (linkMatch) {
            const megaLink = linkMatch[1];
            console.log(chalk.green(`\n🔗 Public MEGA link generated:\n${megaLink}`));
            return megaLink;
        } else {
            console.log(chalk.yellow('⚠️ Could not parse MEGA link from output.'));
            console.log(chalk.gray(`Raw output: ${exportOutput}`));
            return null;
        }
    } catch (e) {
        console.log(chalk.yellow('⚠️ Could not create public link via mega-export.'));
        console.log(chalk.gray(`Try manually: mega-export -a -f "${remoteFolder}/${zipFilename}"`));
        return null;
    }
}

async function pruneMegaZips(remoteFolder) {
    console.log(chalk.blue(`\n🧹 Pruning remote ZIPs, keeping latest two versions...`));
    try {
        const findOutput = safeExec(
            `mega-find --name "LyricDisplay v*.zip" ${escapeMegaPath(remoteFolder)} 2>&1 || echo ""`,
            { timeout: 30000 }
        );

        if (!findOutput || /not found|ERR/i.test(findOutput)) {
            console.log(chalk.gray('No existing ZIPs found or mega-find not available.'));
            return;
        }

        const lines = findOutput.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

        const items = lines.map(remotePath => {
            const normalized = normalizeMegaPath(remotePath);
            const base = path.basename(normalized);
            const ver = extractVersionFromZipName(base);
            return { remotePath: normalized, base, ver };
        }).filter(i => i.ver);

        console.log(chalk.gray(`Found ${items.length} existing ZIP(s) on MEGA.`));

        if (items.length > 2) {
            items.sort((a, b) => -compareVersions(a.ver, b.ver));
            const toKeep = items.slice(0, 2);
            const toDelete = items.slice(2);

            console.log(chalk.gray(`Keeping: ${toKeep.map(i => i.base).join(', ')}`));

            for (const item of toDelete) {
                console.log(chalk.gray(`Removing old remote ZIP: ${item.base}`));
                try {
                    execSync(`mega-rm -f ${escapeMegaPath(item.remotePath)}`, {
                        stdio: 'inherit',
                        timeout: 15000
                    });
                } catch (e) {
                    console.log(chalk.yellow(`Warning: failed to remove ${item.remotePath}: ${e.message}`));
                }
            }
            console.log(chalk.green(`✅ Pruned ${toDelete.length} old ZIP(s).`));
        } else {
            console.log(chalk.gray('No pruning needed (≤ 2 ZIP(s) found).'));
        }
    } catch (e) {
        console.log(chalk.yellow('Warning: could not prune remote ZIPs.'), e.message);
    }
}

async function main() {
    const pkg = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
    let currentVersion = pkg.version;
    const next = getNextVersions(currentVersion);

    console.log(chalk.cyan.bold('\n🚀 LyricDisplay Release Assistant\n'));
    console.log(chalk.gray(`Current version: v${currentVersion}\n`));

    const currentTagExists = checkRemoteTagExists(`v${currentVersion}`);

    if (currentTagExists) {
        console.log(chalk.yellow(`\n⚠️ Tag v${currentVersion} already exists on remote repository.`));
        console.log(chalk.gray('This usually means a release was partially completed.\n'));

        const { resumeAction } = await prompts({
            type: 'select',
            name: 'resumeAction',
            message: 'What would you like to do?',
            choices: [
                { title: '☁️ Only handle MEGA upload (skip version bump & GitHub)', value: 'mega-only' },
                { title: '🔄 Start fresh release (will create new version)', value: 'new-release' },
                { title: '❌ Cancel', value: 'cancel' }
            ]
        });

        if (resumeAction === 'cancel' || !resumeAction) {
            console.log(chalk.yellow('Release cancelled.'));
            process.exit(0);
        }

        if (resumeAction === 'mega-only') {
            console.log(chalk.blue('\n📦 MEGA-only mode: Skipping version bump and GitHub push.\n'));

            try {
                const DIST_DIR = path.resolve('./dist');
                const README_NAME = 'LyricDisplay Installation & Integration Guide.md';
                const README_PATH = path.resolve(`./${README_NAME}`);
                const zipFilename = `LyricDisplay v${currentVersion}.zip`;
                const zipFilePath = path.join(DIST_DIR, zipFilename);

                if (!fs.existsSync(zipFilePath)) {
                    console.log(chalk.yellow(`⚠️ ZIP file not found: ${zipFilePath}`));
                    console.log(chalk.blue('Creating ZIP file...'));

                    const distFiles = fs.existsSync(DIST_DIR) ? fs.readdirSync(DIST_DIR) : [];
                    const setupCandidates = distFiles.filter(f =>
                        /setup/i.test(f) || /\.(exe|dmg|appimage|AppImage)$/i.test(f)
                    );

                    if (setupCandidates.length === 0) {
                        console.log(chalk.red('❌ No setup executable found in dist/. Cannot create ZIP.'));
                        process.exit(1);
                    }

                    let setupFile = setupCandidates.find(n => /setup.*\.exe$/i.test(n)) ||
                        setupCandidates.find(n => /\.exe$/i.test(n)) ||
                        setupCandidates.find(n => /\.dmg$/i.test(n)) ||
                        setupCandidates.find(n => /\.AppImage$/i.test(n)) ||
                        setupCandidates[0];

                    const setupPath = path.join(DIST_DIR, setupFile);

                    await createZipWithFiles({
                        distDir: DIST_DIR,
                        setupPath,
                        readmePath: README_PATH,
                        outputZipPath: zipFilePath
                    });

                    console.log(chalk.green(`✅ Zip created: ${zipFilePath}`));
                }

                const megaLink = await handleMegaUpload(currentVersion, zipFilePath, zipFilename);

                if (megaLink) {
                    await pruneMegaZips(process.env.MEGA_REMOTE_PATH || '/LyricDisplay');

                    const { cleanupLocal } = await prompts({
                        type: 'confirm',
                        name: 'cleanupLocal',
                        message: `Remove local ZIP file (${zipFilename})?`,
                        initial: false
                    });

                    if (cleanupLocal) {
                        try {
                            fs.unlinkSync(zipFilePath);
                            console.log(chalk.green(`✅ Local ZIP removed: ${zipFilename}`));
                        } catch (e) {
                            console.log(chalk.yellow(`Warning: Could not remove local ZIP: ${e.message}`));
                        }
                    }

                    console.log(chalk.blue('\n📝 Updating documentation with new MEGA link and version...'));
                    const updated = updateMegaLinks(megaLink, true);

                    if (updated) {
                        console.log(chalk.green('✅ Documentation files updated with new MEGA link and version'));

                        const { shouldCommit } = await prompts({
                            type: 'confirm',
                            name: 'shouldCommit',
                            message: 'Commit and push the updated documentation to repository?',
                            initial: true
                        });

                        if (shouldCommit) {
                            try {
                                execSync('git add README.md "LyricDisplay Installation & Integration Guide.md"', { stdio: 'inherit' });
                                execSync(`git commit -m "chore: update MEGA download links and version for v${currentVersion}"`, { stdio: 'inherit' });
                                execSync('git push', { stdio: 'inherit' });
                                console.log(chalk.green('✅ Documentation updates committed and pushed to GitHub'));
                            } catch (e) {
                                console.error(chalk.yellow('⚠️ Failed to commit/push updates:'), e.message);
                                console.log(chalk.gray('You can manually commit these changes later'));
                            }
                        }
                    }
                }

                console.log(chalk.green('\n✨ MEGA upload complete!\n'));
                process.exit(0);
            } catch (e) {
                console.error(chalk.red('\n❌ MEGA upload failed:'), e.message);
                process.exit(1);
            }
        }
    }

    const { bumpType } = await prompts({
        type: 'select',
        name: 'bumpType',
        message: 'Select version bump type:',
        choices: [
            { title: `🛠 Patch (v${currentVersion} → v${next.patch})`, value: 'patch' },
            { title: `✨ Minor (v${currentVersion} → v${next.minor})`, value: 'minor' },
            { title: `💥 Major (v${currentVersion} → v${next.major})`, value: 'major' },
            { title: '🧮 Custom (enter a specific version manually)', value: 'custom' },
            { title: '❌ Cancel', value: null }
        ]
    });

    if (!bumpType) {
        console.log(chalk.yellow('Release cancelled.'));
        process.exit(0);
    }

    let customVersion = null;
    if (bumpType === 'custom') {
        const chosen = await promptForCustomVersion(currentVersion);
        if (!chosen) {
            console.log(chalk.yellow('No version entered. Release cancelled.'));
            process.exit(0);
        }
        customVersion = chosen;
    }

    const { notes } = await prompts({
        type: 'text',
        name: 'notes',
        message: 'Add a short changelog or release note (optional):'
    });

    const gitCheck = await checkGitStateInteractive();
    if (!gitCheck.ok) process.exit(1);

    let pkgAfterPrep = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
    currentVersion = pkgAfterPrep.version;

    if (bumpType === 'custom' && customVersion === currentVersion) {
        console.log(chalk.redBright(`\n🚫 The requested version (v${customVersion}) matches package.json (v${currentVersion}).`));
        console.log(chalk.yellow('Please choose a different version and re-run the release script.\n'));
        process.exit(1);
    }

    try {
        if (bumpType === 'custom') {
            console.log(chalk.blue(`\n📦 Setting custom version (v${customVersion})...`));
            execSync(`npm version ${customVersion}`, { stdio: 'inherit' });
        } else {
            console.log(chalk.blue(`\n📦 Bumping version (${bumpType})...`));
            execSync(`npm version ${bumpType}`, { stdio: 'inherit' });
        }

        const updatedPkg = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
        const appliedVersion = updatedPkg.version;
        console.log(chalk.green(`\n✅ package.json updated to v${appliedVersion}`));

        console.log(chalk.blue('\n🛠️ Building and publishing release...'));
        execSync(`npm run electron-publish`, { stdio: 'inherit' });

        console.log(chalk.blue('\n☁️ Pushing commit and tags to GitHub...'));

        const remoteTagExists = checkRemoteTagExists(`v${appliedVersion}`);

        if (remoteTagExists) {
            console.log(chalk.yellow(`\n⚠️ Tag v${appliedVersion} already exists on remote.`));
            const { forceTag } = await prompts({
                type: 'confirm',
                name: 'forceTag',
                message: 'Force push tag (this will overwrite the existing tag)?',
                initial: false
            });

            if (!forceTag) {
                console.log(chalk.red('Aborting. Please delete the remote tag manually or choose a different version.'));
                console.log(chalk.gray(`To delete: git push --delete origin v${appliedVersion}`));
                process.exit(1);
            }
        }

        try {
            execSync('git push', { stdio: 'inherit' });

            if (remoteTagExists) {
                execSync(`git push origin v${appliedVersion} --force`, { stdio: 'inherit' });
                console.log(chalk.yellow('⚠️ Force-pushed tag to remote.'));
            } else {
                execSync(`git push origin v${appliedVersion}`, { stdio: 'inherit' });
            }

        } catch (pushErr) {
            console.error(chalk.red('\n⚠️ Push failed:'), pushErr.message);
            console.log(chalk.yellow('\nTip: Ensure you have a remote set (git remote -v) and correct permissions.'));
            console.log(chalk.gray('You can manually run: git push && git push --tags\n'));
            process.exit(1);
        }

        const version = appliedVersion;
        const releaseUrl = `https://github.com/PeterAlaks/lyric-display-app/releases/tag/v${version}`;

        console.log(chalk.green.bold('\n✅ Release complete!'));
        console.log(chalk.cyan(`\n🎉 Version ${chalk.bold(`v${version}`)} has been successfully published.`));
        console.log(chalk.yellow(`\n🔗 View it here:`));
        console.log(chalk.underline.cyan(releaseUrl));

        let megaLinkGenerated = null;

        try {
            const DIST_DIR = path.resolve('./dist');
            const README_NAME = 'LyricDisplay Installation & Integration Guide.md';
            const README_PATH = path.resolve(`./${README_NAME}`);
            const zipFilename = `LyricDisplay v${version}.zip`;
            const zipFilePath = path.join(DIST_DIR, zipFilename);

            const distFiles = fs.existsSync(DIST_DIR) ? fs.readdirSync(DIST_DIR) : [];
            const setupCandidates = distFiles.filter(f => /setup/i.test(f) || /\.(exe|dmg|appimage|AppImage|zip)$/i.test(f));

            if (setupCandidates.length === 0) {
                console.log(chalk.yellow('\n⚠️ No setup executable found in dist/. Skipping MEGA upload step.'));
            } else {
                let setupFile = setupCandidates.find(n => /setup.*\.exe$/i.test(n)) ||
                    setupCandidates.find(n => /\.exe$/i.test(n)) ||
                    setupCandidates.find(n => /\.dmg$/i.test(n)) ||
                    setupCandidates.find(n => /\.AppImage$/i.test(n)) ||
                    setupCandidates[0];

                const setupPath = path.join(DIST_DIR, setupFile);
                console.log(chalk.blue(`\n📦 Creating ZIP: ${zipFilename} (contains ${setupFile} + ${README_NAME})`));

                try {
                    if (fs.existsSync(zipFilePath)) {
                        fs.unlinkSync(zipFilePath);
                        console.log(chalk.gray('Removed existing ZIP file.'));
                    }
                } catch (e) {
                    console.log(chalk.yellow(`Warning: Could not remove existing ZIP: ${e.message}`));
                }

                await createZipWithFiles({
                    distDir: DIST_DIR,
                    setupPath,
                    readmePath: README_PATH,
                    outputZipPath: zipFilePath
                });

                console.log(chalk.green(`✅ Zip created: ${zipFilePath}`));

                megaLinkGenerated = await handleMegaUpload(version, zipFilePath, zipFilename);

                if (megaLinkGenerated) {
                    await pruneMegaZips(process.env.MEGA_REMOTE_PATH || '/LyricDisplay');

                    const { cleanupLocal } = await prompts({
                        type: 'confirm',
                        name: 'cleanupLocal',
                        message: `Remove local ZIP file (${zipFilename}) after successful upload?`,
                        initial: false
                    });

                    if (cleanupLocal) {
                        try {
                            fs.unlinkSync(zipFilePath);
                            console.log(chalk.green(`✅ Local ZIP removed: ${zipFilename}`));
                        } catch (e) {
                            console.log(chalk.yellow(`Warning: Could not remove local ZIP: ${e.message}`));
                        }
                    }
                }
            }
        } catch (e) {
            console.log(chalk.red('\n⚠️ MEGA upload step failed or was skipped:'), e.message);
            console.log(chalk.gray('The release was still created successfully on GitHub.'));
        }

        if (megaLinkGenerated) {
            console.log(chalk.blue('\n📝 Updating documentation with new MEGA link...'));

            const updated = updateMegaLinks(megaLinkGenerated, false);

            if (updated) {
                console.log(chalk.green('✅ Documentation files updated with new MEGA link'));

                let hasChanges = false;
                try {
                    const status = safeExec('git status --porcelain');
                    hasChanges = status.trim().length > 0;
                } catch (e) {
                    console.log(chalk.yellow('Could not check git status'));
                }

                if (hasChanges) {
                    const { shouldCommit } = await prompts({
                        type: 'confirm',
                        name: 'shouldCommit',
                        message: 'Commit and push the updated MEGA links to repository?',
                        initial: true
                    });

                    if (shouldCommit) {
                        try {
                            execSync('git add README.md "LyricDisplay Installation & Integration Guide.md"', { stdio: 'inherit' });
                            execSync(`git commit -m "chore: update MEGA download links for v${version}"`, { stdio: 'inherit' });
                            execSync('git push', { stdio: 'inherit' });
                            console.log(chalk.green('✅ MEGA link updates committed and pushed to GitHub'));
                        } catch (e) {
                            console.error(chalk.yellow('⚠️ Failed to commit/push link updates:'), e.message);
                            console.log(chalk.gray('You can manually commit these changes later'));
                        }
                    } else {
                        console.log(chalk.gray('📋 MEGA link updates staged but not committed. Run git status to review.'));
                    }
                }
            } else {
                console.log(chalk.yellow('⚠️ No MEGA links were updated in documentation'));
            }
        } else {
            console.log(chalk.gray('\n📝 No MEGA link generated, skipping documentation update'));
        }

        if (notes?.trim()) {
            console.log(chalk.gray(`\n📝 Release notes: ${notes.trim()}`));
        }

        console.log(chalk.green('\n✨ All done! You can close this window or verify the release on GitHub.\n'));
    } catch (err) {
        console.error(chalk.red.bold('\n❌ Release failed:'), err.message);
        console.log(chalk.yellow('\nTroubleshooting tips:'));
        console.log(chalk.gray('- Check if a version tag already exists: git tag -l'));
        console.log(chalk.gray('- Delete remote tag if needed: git push --delete origin v{version}'));
        console.log(chalk.gray('- Check MEGA connection: mega-whoami'));
        console.log(chalk.gray('- Re-run the script and select "MEGA-only" mode if GitHub release succeeded\n'));
        process.exit(1);
    }
}

main();