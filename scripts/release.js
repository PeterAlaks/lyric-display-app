import { execSync } from 'child_process';
import prompts from 'prompts';
import chalk from 'chalk';
import fs from 'fs';

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

function checkLocalTagExists(tagName) {
    try {
        const tags = safeExec('git tag -l');
        return tags.split('\n').includes(tagName);
    } catch (e) {
        return false;
    }
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

async function waitForGitHubActions(version) {
    console.log(chalk.blue('\nWaiting for GitHub Actions to complete...'));
    console.log(chalk.gray('Checking build status every 30 seconds...\n'));

    const maxAttempts = 60;
    let attempts = 0;

    while (attempts < maxAttempts) {
        try {
            const runs = safeExec(
                `gh run list --workflow=build-release.yml --json conclusion,status --limit 1`,
                { timeout: 15000 }
            );

            const runData = JSON.parse(runs);
            if (runData.length > 0) {
                const run = runData[0];

                if (run.conclusion === 'success') {
                    console.log(chalk.green('\nSUCCESS: GitHub Actions build completed!'));
                    return true;
                } else if (run.conclusion === 'failure') {
                    console.log(chalk.red('\nERROR: GitHub Actions build failed!'));
                    console.log(chalk.gray('Check: https://github.com/PeterAlaks/lyric-display-app/actions\n'));

                    const { actionOnFailure } = await prompts({
                        type: 'select',
                        name: 'actionOnFailure',
                        message: 'What would you like to do?',
                        choices: [
                            { title: 'Wait and retry (builds might succeed on retry)', value: 'retry' },
                            { title: 'Skip documentation update (fix manually later)', value: 'skip' },
                            { title: 'Abort release (will need manual cleanup)', value: 'abort' }
                        ]
                    });

                    if (actionOnFailure === 'retry') {
                        console.log(chalk.blue('\nContinuing to wait for builds...'));
                        attempts = 0;
                        await new Promise(resolve => setTimeout(resolve, 30000));
                        continue;
                    } else if (actionOnFailure === 'skip') {
                        console.log(chalk.yellow('\nSkipping documentation update.'));
                        console.log(chalk.gray('Update manually later with: node scripts/update-version.js --update-links-only ' + version));
                        return false;
                    } else {
                        console.log(chalk.red('\nAborting. Release and tag exist on GitHub but builds failed.'));
                        console.log(chalk.gray('Manual cleanup may be required.'));
                        return false;
                    }
                } else if (run.status === 'in_progress' || run.status === 'queued') {
                    attempts++;
                    if (attempts % 4 === 0) {
                        console.log(chalk.gray(`Still building... (${attempts * 30}s elapsed)`));
                    }
                    await new Promise(resolve => setTimeout(resolve, 30000));
                } else {
                    attempts++;
                    await new Promise(resolve => setTimeout(resolve, 30000));
                }
            } else {
                attempts++;
                await new Promise(resolve => setTimeout(resolve, 30000));
            }
        } catch (e) {
            console.log(chalk.yellow('\nWARNING: Could not check GitHub Actions status'));
            console.log(chalk.gray('Error: ' + e.message));

            const { continueWaiting } = await prompts({
                type: 'confirm',
                name: 'continueWaiting',
                message: 'Continue waiting for GitHub Actions?',
                initial: true
            });

            if (!continueWaiting) {
                return false;
            }

            attempts++;
            await new Promise(resolve => setTimeout(resolve, 30000));
        }
    }

    console.log(chalk.red('\nERROR: Timed out waiting for GitHub Actions (30 minutes elapsed)'));

    const { actionOnTimeout } = await prompts({
        type: 'select',
        name: 'actionOnTimeout',
        message: 'What would you like to do?',
        choices: [
            { title: 'Continue waiting', value: 'continue' },
            { title: 'Check manually and proceed if done', value: 'manual' },
            { title: 'Exit (update docs manually later)', value: 'exit' }
        ]
    });

    if (actionOnTimeout === 'continue') {
        console.log(chalk.blue('\nContinuing to wait...'));
        return await waitForGitHubActions(version);
    } else if (actionOnTimeout === 'manual') {
        const { buildsComplete } = await prompts({
            type: 'confirm',
            name: 'buildsComplete',
            message: 'Have you verified that GitHub Actions completed successfully?',
            initial: false
        });
        return buildsComplete;
    } else {
        console.log(chalk.yellow('\nExiting. Builds may still be running.'));
        console.log(chalk.gray('Update docs later with: node scripts/update-version.js --update-links-only ' + version));
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
                    `WARNING: The version you entered (v${entered}) is LOWER than the current version (v${currentVersion}). Continue anyway?`
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
        console.log(chalk.redBright('\nERROR: A Git merge or rebase is currently in progress.'));
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
        console.log(chalk.redBright('\nERROR: You are in a detached HEAD state (not on a branch).'));
        console.log(chalk.yellow('Please checkout a branch before running a release (e.g. git checkout main).\n'));
        return { ok: false };
    }

    try {
        const count = safeExec('git rev-list --count HEAD');
        if (parseInt(count, 10) === 0) {
            console.log(chalk.redBright('\nERROR: This repository has no commits yet.'));
            console.log(chalk.yellow('Please make an initial commit before running the release script.\n'));
            return { ok: false };
        }
    } catch (e) {
        console.log(chalk.redBright('\nERROR: Unable to determine commit history.'));
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
        console.log(chalk.yellow('\nWARNING: You have unstaged changes (no staged files).'));
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
            console.log(chalk.green('SUCCESS: All changes staged.'));
            status = safeExec('git status --porcelain');
        } catch (e) {
            console.error(chalk.red('ERROR: Failed to stage changes:'), e.message);
            return { ok: false };
        }
    }

    const refreshedLines = status ? status.split('\n').filter(Boolean) : [];
    const nowHasStaged = refreshedLines.some(line => line[0] !== ' ' && line[0] !== '?');
    const nowHasUnstaged = refreshedLines.some(line => line.startsWith('??') || line[1] !== ' ');

    if (nowHasStaged) {
        console.log(chalk.yellow('\nNOTE: You have staged but uncommitted changes that will be included in this release.'));
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
            console.log(chalk.green('SUCCESS: Changes committed.'));
        } catch (e) {
            console.error(chalk.red('ERROR: Failed to commit changes:'), e.message);
            return { ok: false };
        }
    } else if (nowHasUnstaged) {
        console.log(chalk.yellow('\nWARNING: There are unstaged changes that will NOT be included in this release.'));
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

async function handleTagConflicts(appliedVersion) {
    const localTagExists = checkLocalTagExists(`v${appliedVersion}`);
    const remoteTagExists = checkRemoteTagExists(`v${appliedVersion}`);

    if (localTagExists) {
        console.log(chalk.yellow(`\nWARNING: Local tag v${appliedVersion} already exists.`));

        const { handleLocal } = await prompts({
            type: 'select',
            name: 'handleLocal',
            message: 'What would you like to do?',
            choices: [
                { title: 'Delete local tag and continue', value: 'delete' },
                { title: 'Abort release', value: 'abort' }
            ]
        });

        if (handleLocal === 'abort' || !handleLocal) {
            console.log(chalk.red('Aborting release.'));
            console.log(chalk.gray(`To delete manually: git tag -d v${appliedVersion}`));
            return false;
        }

        try {
            execSync(`git tag -d v${appliedVersion}`, { stdio: 'inherit' });
            console.log(chalk.green('SUCCESS: Local tag deleted.'));
        } catch (e) {
            console.error(chalk.red('ERROR: Failed to delete local tag:'), e.message);
            return false;
        }
    }

    if (remoteTagExists) {
        console.log(chalk.yellow(`\nWARNING: Remote tag v${appliedVersion} already exists.`));
        console.log(chalk.gray('This usually means a release was already created for this version.\n'));

        const { handleRemote } = await prompts({
            type: 'select',
            name: 'handleRemote',
            message: 'What would you like to do?',
            choices: [
                { title: 'Force push tag (overwrites existing)', value: 'force' },
                { title: 'Skip tag push and check if release exists', value: 'skip' },
                { title: 'Abort release', value: 'abort' }
            ]
        });

        if (handleRemote === 'abort' || !handleRemote) {
            console.log(chalk.red('Aborting release.'));
            console.log(chalk.gray(`To delete remote tag: git push --delete origin v${appliedVersion}`));
            return false;
        }

        return handleRemote;
    }

    return 'normal';
}

async function handlePushFailure(appliedVersion, error) {
    console.error(chalk.red('\nERROR: Failed to push to GitHub:'), error.message);
    console.log(chalk.gray('This could be due to network issues or authentication problems.\n'));

    const { pushAction } = await prompts({
        type: 'select',
        name: 'pushAction',
        message: 'What would you like to do?',
        choices: [
            { title: 'Retry push', value: 'retry' },
            { title: 'Undo version bump and abort', value: 'undo' },
            { title: 'Exit (fix manually)', value: 'exit' }
        ]
    });

    if (pushAction === 'retry') {
        return 'retry';
    } else if (pushAction === 'undo') {
        console.log(chalk.blue('\nUndoing version bump...'));
        try {
            execSync('git reset --hard HEAD~1', { stdio: 'inherit' });
            execSync(`git tag -d v${appliedVersion}`, { stdio: 'inherit' });
            console.log(chalk.green('SUCCESS: Version bump undone.'));
            console.log(chalk.gray('Repository restored to previous state.'));
        } catch (undoErr) {
            console.error(chalk.red('ERROR: Failed to undo:'), undoErr.message);
            console.log(chalk.gray('Manual cleanup required:'));
            console.log(chalk.gray(`  git reset --hard HEAD~1`));
            console.log(chalk.gray(`  git tag -d v${appliedVersion}`));
        }
        return 'abort';
    } else {
        console.log(chalk.yellow('\nExiting. Fix the issue and run:'));
        console.log(chalk.gray('  git push'));
        console.log(chalk.gray(`  git push origin v${appliedVersion}`));
        return 'abort';
    }
}

async function main() {
    const pkg = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
    let currentVersion = pkg.version;
    const next = getNextVersions(currentVersion);

    console.log(chalk.cyan.bold('\nLyricDisplay Release Assistant\n'));
    console.log(chalk.gray(`Current version: v${currentVersion}\n`));

    const { bumpType } = await prompts({
        type: 'select',
        name: 'bumpType',
        message: 'Select version bump type:',
        choices: [
            { title: `Patch (v${currentVersion} -> v${next.patch})`, value: 'patch' },
            { title: `Minor (v${currentVersion} -> v${next.minor})`, value: 'minor' },
            { title: `Major (v${currentVersion} -> v${next.major})`, value: 'major' },
            { title: 'Custom (enter a specific version manually)', value: 'custom' },
            { title: 'Cancel', value: null }
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
        message: 'Add release notes (optional, will appear in GitHub release):',
        initial: ''
    });

    const gitCheck = await checkGitStateInteractive();
    if (!gitCheck.ok) process.exit(1);

    let pkgAfterPrep = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
    currentVersion = pkgAfterPrep.version;

    if (bumpType === 'custom' && customVersion === currentVersion) {
        console.log(chalk.redBright(`\nERROR: The requested version (v${customVersion}) matches package.json (v${currentVersion}).`));
        console.log(chalk.yellow('Please choose a different version and re-run the release script.\n'));
        process.exit(1);
    }

    try {
        let versionToUse = bumpType === 'custom' ? customVersion : bumpType;
        const targetVersion = bumpType === 'custom' ? customVersion : next[bumpType];

        console.log(chalk.blue(`\nBumping version to v${targetVersion}...`));

        let commitMessage = `chore: release v${targetVersion}`;
        if (notes?.trim()) {
            commitMessage += `\n\nRelease notes:\n${notes.trim()}`;
        }

        execSync(`npm version ${versionToUse} -m "${commitMessage}"`, { stdio: 'inherit' });

        const updatedPkg = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
        const appliedVersion = updatedPkg.version;
        console.log(chalk.green(`\nSUCCESS: Version bumped to v${appliedVersion}`));

        console.log(chalk.blue('\nBuilding Windows installer locally...'));
        console.log(chalk.gray('This may take a few minutes...\n'));

        execSync('npm run electron-pack', { stdio: 'inherit' });
        console.log(chalk.green('\nSUCCESS: Windows installer built locally'));

        const tagStatus = await handleTagConflicts(appliedVersion);
        if (!tagStatus) {
            process.exit(1);
        }

        console.log(chalk.blue('\nPushing commit and tag to GitHub...'));

        let pushSuccess = false;
        while (!pushSuccess) {
            try {
                execSync('git push', { stdio: 'inherit' });

                if (tagStatus === 'force') {
                    execSync(`git push origin v${appliedVersion} --force`, { stdio: 'inherit' });
                    console.log(chalk.yellow('WARNING: Force-pushed tag to remote.'));
                } else if (tagStatus === 'skip') {
                    console.log(chalk.gray('Skipped tag push (already exists on remote).'));
                } else {
                    execSync(`git push origin v${appliedVersion}`, { stdio: 'inherit' });
                }

                console.log(chalk.green('SUCCESS: Commit and tag pushed to GitHub'));
                pushSuccess = true;

            } catch (pushErr) {
                const action = await handlePushFailure(appliedVersion, pushErr);

                if (action === 'retry') {
                    console.log(chalk.blue('\nRetrying push...'));
                    continue;
                } else {
                    process.exit(1);
                }
            }
        }

        console.log(chalk.blue('\nGitHub Actions is now building Windows, macOS, and Linux installers...'));
        console.log(chalk.gray('This typically takes 15-20 minutes.\n'));

        const actionsSuccess = await waitForGitHubActions(appliedVersion);

        if (!actionsSuccess) {
            console.log(chalk.yellow('\nRelease created but builds incomplete or documentation not updated.'));
            console.log(chalk.gray('Check GitHub Actions and update docs manually if needed.'));
            process.exit(0);
        }

        console.log(chalk.blue('\nUpdating documentation with download links...'));

        execSync(`node scripts/update-version.js --update-links-only ${appliedVersion}`, { stdio: 'inherit' });
        execSync('git add README.md "LyricDisplay Installation & Integration Guide.md"', { stdio: 'inherit' });
        execSync(`git commit -m "docs: update download links for v${appliedVersion}"`, { stdio: 'inherit' });
        execSync('git push', { stdio: 'inherit' });

        console.log(chalk.green('\nSUCCESS: Documentation updated and pushed'));

        const releaseUrl = `https://github.com/PeterAlaks/lyric-display-app/releases/tag/v${appliedVersion}`;

        console.log(chalk.green.bold('\n========================================'));
        console.log(chalk.green.bold('RELEASE COMPLETE'));
        console.log(chalk.green.bold('========================================\n'));

        console.log(chalk.cyan(`Version: v${appliedVersion}`));
        console.log(chalk.cyan(`Release URL: ${releaseUrl}\n`));

        console.log(chalk.white('Download Links:'));
        console.log(chalk.gray(`  Windows: https://github.com/PeterAlaks/lyric-display-app/releases/download/v${appliedVersion}/LyricDisplay-${appliedVersion}-Windows-Setup.exe`));
        console.log(chalk.gray(`  macOS (Apple Silicon): https://github.com/PeterAlaks/lyric-display-app/releases/download/v${appliedVersion}/LyricDisplay-${appliedVersion}-macOS-arm64.dmg`));
        console.log(chalk.gray(`  macOS (Intel): https://github.com/PeterAlaks/lyric-display-app/releases/download/v${appliedVersion}/LyricDisplay-${appliedVersion}-macOS-x64.dmg`));
        console.log(chalk.gray(`  Linux: https://github.com/PeterAlaks/lyric-display-app/releases/download/v${appliedVersion}/LyricDisplay-${appliedVersion}-Linux.AppImage\n`));

    } catch (err) {
        console.error(chalk.red.bold('\nERROR: Release failed:'), err.message);
        console.log(chalk.yellow('\nTroubleshooting tips:'));
        console.log(chalk.gray('- Check if a version tag already exists: git tag -l'));
        console.log(chalk.gray('- Delete remote tag if needed: git push --delete origin v{version}'));
        console.log(chalk.gray('- Verify git remote is configured: git remote -v'));
        console.log(chalk.gray('- Check GitHub Actions: https://github.com/PeterAlaks/lyric-display-app/actions\n'));
        process.exit(1);
    }
}

main();