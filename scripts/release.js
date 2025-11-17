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

function checkRemoteTagExists(tagName) {
    try {
        const tags = safeExec('git ls-remote --tags origin');
        return tags.includes(`refs/tags/${tagName}`);
    } catch (e) {
        console.log(chalk.yellow('Warning: Could not check remote tags'));
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

async function main() {
    const pkg = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
    let currentVersion = pkg.version;
    const next = getNextVersions(currentVersion);

    console.log(chalk.cyan.bold('\nLyricDisplay Release Assistant\n'));
    console.log(chalk.gray(`Current version: v${currentVersion}\n`));

    const currentTagExists = checkRemoteTagExists(`v${currentVersion}`);

    if (currentTagExists) {
        console.log(chalk.yellow(`\nWARNING: Tag v${currentVersion} already exists on remote repository.`));
        console.log(chalk.gray('This usually means a release was already created for this version.\n'));
        console.log(chalk.red('Please create a new version bump to proceed with a release.\n'));
        process.exit(1);
    }

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

        console.log(chalk.blue(`\nBumping version to v${bumpType === 'custom' ? customVersion : next[bumpType]}...`));

        let commitMessage = `chore: release v${bumpType === 'custom' ? customVersion : next[bumpType]}`;
        if (notes?.trim()) {
            commitMessage += `\n\nRelease notes:\n${notes.trim()}`;
        }

        execSync(`npm version ${versionToUse} -m "${commitMessage}"`, { stdio: 'inherit' });

        const updatedPkg = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
        const appliedVersion = updatedPkg.version;
        console.log(chalk.green(`\nSUCCESS: Version bumped to v${appliedVersion}`));

        console.log(chalk.blue('\nPushing commit and tag to GitHub...'));

        const remoteTagExists = checkRemoteTagExists(`v${appliedVersion}`);

        if (remoteTagExists) {
            console.log(chalk.yellow(`\nWARNING: Tag v${appliedVersion} already exists on remote.`));
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
                console.log(chalk.yellow('WARNING: Force-pushed tag to remote.'));
            } else {
                execSync(`git push origin v${appliedVersion}`, { stdio: 'inherit' });
            }

        } catch (pushErr) {
            console.error(chalk.red('\nERROR: Push failed:'), pushErr.message);
            console.log(chalk.yellow('\nTip: Ensure you have a remote set (git remote -v) and correct permissions.'));
            console.log(chalk.gray('You can manually run: git push && git push --tags\n'));
            process.exit(1);
        }

        const version = appliedVersion;
        const releaseUrl = `https://github.com/PeterAlaks/lyric-display-app/releases/tag/v${version}`;

        console.log(chalk.green.bold('\nSUCCESS: Version tag pushed to GitHub!'));
        console.log(chalk.cyan(`\nRelease v${version} initiated`));

        console.log(chalk.blue('\nGitHub Actions is now building all platform installers...'));
        console.log(chalk.gray('This may take 15-20 minutes to complete all builds.\n'));

        console.log(chalk.cyan('What happens next:'));
        console.log(chalk.gray('  1. Windows build (5-7 minutes)'));
        console.log(chalk.gray('  2. macOS build (5-7 minutes)'));
        console.log(chalk.gray('  3. Linux build (5-7 minutes)'));
        console.log(chalk.gray('  4. Release creation with all installers'));
        console.log(chalk.gray('  5. Documentation auto-update with download links\n'));

        console.log(chalk.yellow('Monitor build progress:'));
        console.log(chalk.underline.cyan('https://github.com/PeterAlaks/lyric-display-app/actions'));

        console.log(chalk.yellow('\nRelease will be available at:'));
        console.log(chalk.underline.cyan(releaseUrl));

        if (notes?.trim()) {
            console.log(chalk.gray(`\nRelease notes included in commit`));
        }

        console.log(chalk.green('\nRelease process initiated successfully!'));
        console.log(chalk.gray('GitHub Actions will handle the rest automatically.\n'));

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