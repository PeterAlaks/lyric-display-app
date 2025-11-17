import { execSync } from 'child_process';
import prompts from 'prompts';
import chalk from 'chalk';
import fs from 'fs';
import { updateVersionNumbers, updateGitHubReleaseLinks } from './update-version.js';


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

function getNextVersions(version) {
    const [major, minor, patch] = version.split('.').map(Number);
    return {
        patch: `${major}.${minor}.${patch + 1}`,
        minor: `${major}.${minor + 1}.0`,
        major: `${major + 1}.0.0`
    };
}

function safeExec(cmd, opts = {}) {
    return execSync(cmd, {
        encoding: 'utf8',
        stdio: 'pipe',
        timeout: 30000,
        ...opts
    }).toString().trim();
}

function checkTagExists(tagName) {
    try {
        const localTags = safeExec('git tag -l');
        if (localTags.split('\n').includes(tagName)) return 'local';
    } catch (e) { }

    try {
        const remoteTags = safeExec('git ls-remote --tags origin');
        if (remoteTags.includes(`refs/tags/${tagName}`)) return 'remote';
    } catch (e) {
        console.log(chalk.yellow('⚠️  Could not check remote tags (connection issue?)'));
    }
    return false;
}

function checkGhCli() {
    try {
        safeExec('gh --version');
        const status = safeExec('gh auth status');
        return true;
    } catch (e) {
        return false;
    }
}

async function waitForGitHubActions(commitSha) {
    console.log(chalk.blue('\nWaiting for GitHub Actions to complete...'));
    console.log(chalk.gray(`Tracking commit: ${commitSha.substring(0, 7)}`));

    const maxAttempts = 60;
    let attempts = 0;

    while (attempts < maxAttempts) {
        try {
            const runsCmd = `gh run list --workflow=build-release.yml --commit=${commitSha} --json conclusion,status --limit 1`;
            const runs = JSON.parse(safeExec(runsCmd));

            if (runs.length > 0) {
                const run = runs[0];
                if (run.conclusion === 'success') {
                    console.log(chalk.green('\n✅ GitHub Actions build completed successfully!'));
                    return true;
                } else if (run.conclusion === 'failure') {
                    console.log(chalk.red('\n❌ GitHub Actions build failed!'));
                    return false;
                } else {
                    attempts++;
                    if (attempts % 2 === 0) process.stdout.write('.');
                    await new Promise(resolve => setTimeout(resolve, 30000));
                }
            } else {
                console.log(chalk.gray('\nWaiting for workflow to start...'));
                attempts++;
                await new Promise(resolve => setTimeout(resolve, 30000));
            }
        } catch (e) {
            console.log(chalk.yellow('\n⚠️  Error checking status, retrying...'));
            attempts++;
            await new Promise(resolve => setTimeout(resolve, 30000));
        }
    }
    return false;
}

async function main() {
    console.log(chalk.cyan.bold('\nLyricDisplay Release Assistant\n'));

    if (!checkGhCli()) {
        console.log(chalk.red('ERROR: GitHub CLI (gh) is not installed or not authenticated.'));
        console.log(chalk.gray('Run "gh auth login" to authenticate.'));
        process.exit(1);
    }

    try {
        const status = safeExec('git status --porcelain');
        if (status) {
            console.log(chalk.red('ERROR: Git working directory is not clean.'));
            console.log(chalk.yellow('Please commit or stash changes before releasing.'));
            process.exit(1);
        }
    } catch (e) {
        console.log(chalk.red('ERROR: Not a valid git repository.'));
        process.exit(1);
    }

    const pkg = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
    const currentVersion = pkg.version;
    const next = getNextVersions(currentVersion);

    console.log(chalk.gray(`Current version: v${currentVersion}\n`));

    const { bumpType } = await prompts({
        type: 'select',
        name: 'bumpType',
        message: 'Select version bump type:',
        choices: [
            { title: `Patch (v${currentVersion} -> v${next.patch})`, value: 'patch' },
            { title: `Minor (v${currentVersion} -> v${next.minor})`, value: 'minor' },
            { title: `Major (v${currentVersion} -> v${next.major})`, value: 'major' },
            { title: 'Cancel', value: null }
        ]
    });

    if (!bumpType) process.exit(0);

    const targetVersion = next[bumpType];
    const tagName = `v${targetVersion}`;

    const conflict = checkTagExists(tagName);
    if (conflict) {
        console.log(chalk.redBright(`\nERROR: Tag ${tagName} already exists (${conflict}).`));
        console.log(chalk.yellow('Please delete the tag or choose a different version.'));
        process.exit(1);
    }

    const { notes } = await prompts({
        type: 'text',
        name: 'notes',
        message: 'Release notes (optional):',
        initial: ''
    });

    console.log(chalk.blue(`\n🚀 Starting release process for ${tagName}...`));

    try {
        console.log(chalk.gray('Updating package.json...'));
        execSync(`npm version ${targetVersion} --no-git-tag-version`, { stdio: 'ignore' });

        console.log(chalk.gray('Updating documentation and download links...'));
        updateVersionNumbers(targetVersion);
        updateGitHubReleaseLinks(targetVersion);

        console.log(chalk.blue('\n🔨 Building Windows installer locally (as requested)...'));
        execSync('npm run electron-pack', { stdio: 'inherit' });

        console.log(chalk.blue('\n📦 Committing and Tagging...'));

        execSync('git add package.json package-lock.json README.md "LyricDisplay Installation & Integration Guide.md"');

        const safeNotes = notes.replace(/"/g, '\\"');
        const commitMsg = `chore: release ${tagName}\n\nRelease notes:\n${safeNotes}`;

        execSync(`git commit -m "${commitMsg}"`);
        execSync(`git tag ${tagName}`);

        console.log(chalk.blue('\n⬆️  Pushing to GitHub...'));
        execSync('git push');
        execSync(`git push origin ${tagName}`);

        const commitSha = safeExec('git rev-parse HEAD');
        await waitForGitHubActions(commitSha);

        console.log(chalk.green.bold('\n✨ Release Complete! ✨'));
        console.log(chalk.cyan(`Tag: ${tagName}`));
        console.log(chalk.gray('Documentation and links were updated before the tag was created.'));

    } catch (e) {
        console.error(chalk.red('\n❌ RELEASE FAILED'));
        console.error(e.message);
        console.log(chalk.yellow('\nState Check:'));
        console.log('Your local files might be modified (version bumped).');
        console.log('You may need to: git reset --hard HEAD (if commit wasn\'t made)');
        process.exit(1);
    }
}

main();