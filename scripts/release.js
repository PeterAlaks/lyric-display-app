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

async function main() {
    const pkg = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
    const currentVersion = pkg.version;
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
            console.log(chalk.yellow('No version entered. Release cancelled.'));
            process.exit(0);
        }

        const cmp = compareVersions(response.version, currentVersion);
        if (cmp < 0) {
            const { confirm } = await prompts({
                type: 'confirm',
                name: 'confirm',
                message: chalk.redBright(
                    `⚠️  The version you entered (v${response.version}) is LOWER than the current version (v${currentVersion}). Continue anyway?`
                ),
                initial: false
            });
            if (!confirm) {
                console.log(chalk.yellow('Release cancelled.'));
                process.exit(0);
            }
        }

        customVersion = response.version;
    }

    const { notes } = await prompts({
        type: 'text',
        name: 'notes',
        message: 'Add a short changelog or release note (optional):'
    });

    try {
        if (
            fs.existsSync('.git/MERGE_HEAD') ||
            fs.existsSync('.git/rebase-apply') ||
            fs.existsSync('.git/rebase-merge')
        ) {
            console.log(chalk.redBright('\n🚫 A Git merge or rebase is currently in progress.'));
            console.log(chalk.yellow('Please resolve all conflicts and complete the merge/rebase before releasing.\n'));
            process.exit(1);
        }

        const status = execSync('git status --porcelain', { encoding: 'utf8' }).trim();

        if (status) {
            const lines = status.split('\n');
            const hasUnstaged = lines.some(line => line.startsWith('??') || line.startsWith(' M'));
            const hasStaged = lines.some(line => line.startsWith('M ') || line.startsWith('A ') || line.startsWith('D '));

            if (hasUnstaged && !hasStaged) {
                console.log(chalk.yellow('\n⚠️  You have unstaged changes.'));
                console.log(chalk.gray('Please review and stage files (git add .) before continuing.\n'));
                const { proceed } = await prompts({
                    type: 'confirm',
                    name: 'proceed',
                    message: 'Do you want to automatically stage all changes now?',
                    initial: false
                });

                if (!proceed) {
                    console.log(chalk.red('Aborting release.'));
                    process.exit(0);
                }

                execSync('git add .', { stdio: 'inherit' });
                console.log(chalk.green('✅ All changes staged.'));
            }

            const hasPendingCommit = hasStaged || (!hasUnstaged && status);
            if (hasPendingCommit) {
                console.log(chalk.yellow('\n📝 You have staged but uncommitted changes.'));
                const { message } = await prompts({
                    type: 'text',
                    name: 'message',
                    message: 'Enter a commit message before release:',
                    validate: val => val.trim().length > 0 ? true : 'Commit message cannot be empty.'
                });

                execSync(`git commit -m "${message.trim()}"`, { stdio: 'inherit' });
                console.log(chalk.green('✅ Changes committed.'));
            }
        } else {
            console.log(chalk.gray('✔️  Working directory clean.'));
        }
    } catch (err) {
        console.error(chalk.red('❌ Failed to check Git status:'), err.message);
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

        console.log(chalk.blue('\n🛠️  Building and publishing release...'));
        execSync(`npm run electron-publish`, { stdio: 'inherit' });

        console.log(chalk.blue('\n☁️  Pushing commit and tags to GitHub...'));
        execSync('git push && git push --tags', { stdio: 'inherit' });

        const updatedPkg = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
        const version = updatedPkg.version;
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