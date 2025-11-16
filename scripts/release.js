import { execSync } from 'child_process';
import prompts from 'prompts';
import chalk from 'chalk';
import fs from 'fs';
import { updateGitHubReleaseLinks } from './update-version.js';
import { waitForGitHubActions } from './release-manager.js';

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

async function main() {
    const pkg = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
    let currentVersion = pkg.version;
    const next = getNextVersions(currentVersion);

    console.log(chalk.cyan.bold('\n🚀 LyricDisplay Release Assistant\n'));
    console.log(chalk.gray(`Current version: v${currentVersion}\n`));

    const currentTagExists = checkRemoteTagExists(`v${currentVersion}`);

    if (currentTagExists) {
        console.log(chalk.yellow(`\n⚠️ Tag v${currentVersion} already exists on remote repository.`));
        console.log(chalk.gray('This usually means a release was already created for this version.\n'));

        const { resumeAction } = await prompts({
            type: 'select',
            name: 'resumeAction',
            message: 'What would you like to do?',
            choices: [
                { title: '📝 Update documentation links only', value: 'update-docs' },
                { title: '🔄 Start fresh release (will create new version)', value: 'new-release' },
                { title: '❌ Cancel', value: 'cancel' }
            ]
        });

        if (resumeAction === 'cancel' || !resumeAction) {
            console.log(chalk.yellow('Release cancelled.'));
            process.exit(0);
        }

        if (resumeAction === 'update-docs') {
            console.log(chalk.blue('\n📝 Updating Installation Guide with GitHub release links...\n'));

            try {
                const updated = updateGitHubReleaseLinks(currentVersion, false);

                if (updated) {
                    console.log(chalk.green('\n✅ Installation Guide updated with GitHub release links'));

                    const { shouldCommit } = await prompts({
                        type: 'confirm',
                        name: 'shouldCommit',
                        message: 'Commit and push the updated documentation to repository?',
                        initial: true
                    });

                    if (shouldCommit) {
                        try {
                            execSync('git add "LyricDisplay Installation & Integration Guide.md"', { stdio: 'inherit' });
                            execSync(`git commit -m "docs: update download links for v${currentVersion}"`, { stdio: 'inherit' });
                            execSync('git push', { stdio: 'inherit' });
                            console.log(chalk.green('✅ Documentation updates committed and pushed to GitHub'));
                        } catch (e) {
                            console.error(chalk.yellow('⚠️ Failed to commit/push updates:'), e.message);
                            console.log(chalk.gray('You can manually commit these changes later'));
                        }
                    }
                }

                console.log(chalk.green('\n✨ Documentation update complete!\n'));
                process.exit(0);
            } catch (e) {
                console.error(chalk.red('\n❌ Documentation update failed:'), e.message);
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
        console.log(chalk.gray('This will build Windows installer and upload to GitHub Release'));
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

        console.log(chalk.green.bold('\n✅ Windows build uploaded to GitHub Release!'));
        console.log(chalk.cyan(`\n🎉 Version ${chalk.bold(`v${version}`)} release created.`));
        console.log(chalk.yellow(`\n🔗 View it here:`));
        console.log(chalk.underline.cyan(releaseUrl));

        console.log(chalk.blue('\n⏳ GitHub Actions is now building macOS and Linux versions...'));
        console.log(chalk.gray('This may take 10-15 minutes.\n'));

        const { waitForBuilds } = await prompts({
            type: 'confirm',
            name: 'waitForBuilds',
            message: 'Wait for GitHub Actions to complete and update documentation?',
            initial: true
        });

        if (waitForBuilds) {
            const success = await waitForGitHubActions(version);

            if (success) {
                console.log(chalk.blue('\n📝 Updating Installation Guide with GitHub release links...'));

                const updated = updateGitHubReleaseLinks(version, false);

                if (updated) {
                    const { shouldCommit } = await prompts({
                        type: 'confirm',
                        name: 'shouldCommit',
                        message: 'Commit and push the updated download links?',
                        initial: true
                    });

                    if (shouldCommit) {
                        try {
                            execSync('git add "LyricDisplay Installation & Integration Guide.md"', { stdio: 'inherit' });
                            execSync(`git commit -m "docs: update download links for v${version}"`, { stdio: 'inherit' });
                            execSync('git push', { stdio: 'inherit' });
                            console.log(chalk.green('✅ Documentation updates pushed to GitHub'));
                        } catch (e) {
                            console.error(chalk.yellow('⚠️ Failed to commit/push:', e.message));
                            console.log(chalk.gray('You can manually commit these changes later'));
                        }
                    }
                }
            } else {
                console.log(chalk.yellow('\n⚠️ GitHub Actions did not complete successfully.'));
                console.log(chalk.gray('You can update documentation later by re-running this script.'));
            }
        } else {
            console.log(chalk.gray('\nℹ️  Skipping wait for GitHub Actions.'));
            console.log(chalk.gray('GitHub Actions will continue building in the background.'));
            console.log(chalk.gray('You can update documentation later by re-running this script.'));
        }

        if (notes?.trim()) {
            console.log(chalk.gray(`\n📝 Release notes: ${notes.trim()}`));
        }

        console.log(chalk.green('\n✨ Release process complete!'));
        console.log(chalk.gray('\nAll platform installers will be available at:'));
        console.log(chalk.underline.cyan(releaseUrl));
        console.log();

    } catch (err) {
        console.error(chalk.red.bold('\n❌ Release failed:'), err.message);
        console.log(chalk.yellow('\nTroubleshooting tips:'));
        console.log(chalk.gray('- Check if a version tag already exists: git tag -l'));
        console.log(chalk.gray('- Delete remote tag if needed: git push --delete origin v{version}'));
        console.log(chalk.gray('- Check GitHub Actions: https://github.com/PeterAlaks/lyric-display-app/actions'));
        console.log(chalk.gray('- Re-run the script and select "Update documentation links only" if release succeeded\n'));
        process.exit(1);
    }
}

main();