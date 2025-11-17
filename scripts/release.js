import { execSync } from 'child_process';
import prompts from 'prompts';
import chalk from 'chalk';
import fs from 'fs';
import { updateVersionNumbers, updateGitHubReleaseLinks } from './update-version.js';

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
        safeExec('gh auth status');
        return true;
    } catch (e) {
        return false;
    }
}

async function waitForGitHubActions(commitSha) {
    console.log(chalk.blue('\nWaiting for GitHub Actions to complete...'));
    console.log(chalk.gray(`Tracking commit: ${commitSha.substring(0, 7)} (Polling every 30s)`));
    console.log(chalk.gray('The release process will pause here until the CI build succeeds on GitHub.'));

    const maxAttempts = 60;
    let attempts = 0;
    const runsCmd = `gh run list --workflow=build-release.yml --commit=${commitSha} --json conclusion,status --limit 1`;

    while (attempts < maxAttempts) {
        try {
            const runs = JSON.parse(safeExec(runsCmd));

            if (runs.length > 0) {
                const run = runs[0];
                if (run.conclusion === 'success') {
                    console.log(chalk.green('\n✅ GitHub Actions build completed successfully!'));
                    return true;
                } else if (run.conclusion === 'failure' || run.conclusion === 'cancelled') {
                    console.log(chalk.red('\n❌ GitHub Actions build failed or was cancelled!'));
                    console.log(chalk.yellow('Check the build log: https://github.com/PeterAlaks/lyric-display-app/actions'));
                    return false;
                } else {
                    attempts++;
                    process.stdout.write('.');
                    await new Promise(resolve => setTimeout(resolve, 30000));
                }
            } else {
                attempts++;
                if (attempts === 1) {
                    console.log(chalk.gray('Workflow run not yet visible by commit SHA. Waiting for GitHub registration.'));
                }
                process.stdout.write('.');
                await new Promise(resolve => setTimeout(resolve, 30000));
            }
        } catch (e) {
            console.log(chalk.yellow(`\n⚠️  Error checking status (Attempt ${attempts + 1}/${maxAttempts}), retrying in 30s...`));
            attempts++;
            await new Promise(resolve => setTimeout(resolve, 30000));
        }
    }

    console.log(chalk.red('\n❌ Timed out waiting for GitHub Actions.'));
    console.log(chalk.yellow('This usually means the build is stuck or took longer than 30 minutes. Check the Actions tab manually.'));
    return false;
}

async function main() {
    console.log(chalk.cyan.bold('\n🚀 LyricDisplay Release Assistant\n'));

    if (!checkGhCli()) {
        console.log(chalk.red('ERROR: GitHub CLI (gh) is not installed or not authenticated.'));
        console.log(chalk.gray('Please install it and run "gh auth login" to authenticate.'));
        process.exit(1);
    }

    try {
        const status = safeExec('git status --porcelain');
        if (status) {
            console.log(chalk.red('ERROR: Git working directory is not clean.'));
            console.log(chalk.yellow('Please commit or stash all changes before releasing.'));
            process.exit(1);
        }
    } catch (e) {
        console.log(chalk.red('ERROR: Not a valid git repository or git not found.'));
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

    if (!bumpType) {
        console.log(chalk.yellow('Release cancelled.'));
        process.exit(0);
    }

    const targetVersion = next[bumpType];
    const tagName = `v${targetVersion}`;

    const conflict = checkTagExists(tagName);
    if (conflict) {
        console.log(chalk.redBright(`\nERROR: Tag ${tagName} already exists (${conflict}).`));
        console.log(chalk.yellow('Please delete the tag or choose a different version.'));
        process.exit(1);
    }

    const { notes = '' } = await prompts({
        type: 'text',
        name: 'notes',
        message: 'Release notes (describe what changed in this version):',
        initial: ''
    });

    console.log(chalk.blue(`\n🚀 Starting release process for ${tagName}...`));

    try {
        console.log(chalk.gray('Updating package.json...'));
        execSync(`npm version ${targetVersion} --no-git-tag-version`, { stdio: 'ignore' });

        console.log(chalk.gray('Updating documentation and download links...'));
        updateVersionNumbers(targetVersion);
        updateGitHubReleaseLinks(targetVersion);

        console.log(chalk.blue('\n🔨 Building Windows installer locally...'));
        execSync('npm run electron-pack', { stdio: 'inherit' });
        console.log(chalk.green('✅ Local Windows build complete.'));

        console.log(chalk.gray('Creating release body file...'));
        const releaseBodyContent = notes || 'No release notes provided for this version.';
        fs.writeFileSync('RELEASE_BODY.md', releaseBodyContent);

        console.log(chalk.blue('\n📦 Committing changes and creating tag...'));

        execSync('git add package.json package-lock.json README.md "LyricDisplay Installation & Integration Guide.md" RELEASE_BODY.md');

        const commitMsg = `chore: release ${tagName}`;

        execSync(`git commit -m "${commitMsg}"`);
        execSync(`git tag ${tagName}`);
        console.log(chalk.green('✅ Commit and tag created locally.'));

        console.log(chalk.blue('\n⬆️  Pushing to GitHub...'));
        execSync('git push');
        execSync(`git push origin ${tagName}`);
        console.log(chalk.green('✅ Commit and tag pushed to origin.'));

        const commitSha = safeExec('git rev-parse HEAD');
        const ciSuccess = await waitForGitHubActions(commitSha);

        if (!ciSuccess) {
            console.log(chalk.red.bold('\n❌ CI FAILED.'));
            console.log(chalk.yellow(`The release ${tagName} exists on GitHub, but the builds failed.`));
            console.log(chalk.yellow('You will need to manually check the Actions tab and possibly create a new release.'));
            process.exit(1);
        }

        console.log(chalk.green.bold('\n✨ Release Complete! ✨'));
        console.log(chalk.cyan(`Tag: ${tagName}`));
        console.log(chalk.cyan(`Release URL: https://github.com/PeterAlaks/lyric-display-app/releases/tag/${tagName}`));
        console.log(chalk.gray('All installers (Windows, macOS, Linux) have been built and published.'));
        console.log(chalk.gray('Auto-updater metadata (latest.yml) has been generated.'));

    } catch (e) {
        console.error(chalk.red.bold('\n❌ RELEASE FAILED'));
        console.error(chalk.gray(e.message));
        console.log(chalk.yellow('\nState Check:'));
        console.log('Your local files are likely modified.');
        console.log(chalk.yellow('Run "git reset --hard HEAD" to clean your directory before trying again.'));
        process.exit(1);
    }
}

main();