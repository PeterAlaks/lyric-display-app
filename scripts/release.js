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
    return execSync(cmd, { encoding: 'utf8', ...opts }).toString().trim();
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

    const { bumpType } = await prompts({
        type: 'select',
        name: 'bumpType',
        message: 'Select version bump type:',
        choices: [
            { title: `🐛 Patch (v${currentVersion} → v${next.patch})`, value: 'patch' },
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

        console.log(chalk.blue('\n🛠️  Building and publishing release...'));
        execSync(`npm run electron-publish`, { stdio: 'inherit' });

        console.log(chalk.blue('\n☁️  Pushing commit and tags to GitHub...'));
        try {
            execSync('git push', { stdio: 'inherit' });
            execSync('git push --tags', { stdio: 'inherit' });
        } catch (pushErr) {
            console.error(chalk.red('\n⚠️ Push failed:'), pushErr.message);
            console.log(chalk.yellow('\nTip: Ensure you have a remote set (git remote -v) and correct permissions.'));
            console.log(chalk.gray('You can manually run: git push && git push --tags\n'));
            process.exit(1);
        }

        const version = appliedVersion;
        const releaseUrl = `https://github.com/PeterAlaks/lyric-display-updates/releases/tag/v${version}`;

        console.log(chalk.green.bold('\n✅ Release complete!'));
        console.log(chalk.cyan(`\n🎉 Version ${chalk.bold(`v${version}`)} has been successfully published.`));
        console.log(chalk.yellow(`\n🔗 View it here:`));
        console.log(chalk.underline.cyan(releaseUrl));

        if (notes?.trim()) {
            console.log(chalk.gray(`\n📝 Release notes: ${notes.trim()}`));
        }

        console.log(chalk.green('\n✨ All done! You can close this window or verify the release on GitHub.\n'));
    } catch (err) {
        console.error(chalk.red.bold('\n❌ Release failed:'), err.message);
        process.exit(1);
    }
}

main();