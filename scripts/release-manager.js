import { execSync } from 'child_process';
import chalk from 'chalk';

function safeExec(cmd, opts = {}) {
    const defaultTimeout = 30000;
    return execSync(cmd, {
        encoding: 'utf8',
        stdio: 'pipe',
        timeout: defaultTimeout,
        ...opts
    }).toString().trim();
}

/**
 * Wait for GitHub Actions to complete and verify artifacts are uploaded
 * @param {string} version - Version number (e.g., "5.7.0")
 * @returns {Promise<boolean>} - True if successful, false otherwise
 */
async function waitForGitHubActions(version) {
    console.log(chalk.blue('\n⏳ Waiting for GitHub Actions to complete...'));
    console.log(chalk.gray('This may take 10-15 minutes for macOS and Linux builds.\n'));

    const tagName = `v${version}`;
    let attempts = 0;
    const maxAttempts = 60;

    while (attempts < maxAttempts) {
        try {
            const runs = safeExec(
                `gh run list --workflow=build-release.yml --json conclusion,status,headBranch --limit 1`,
                { timeout: 15000 }
            );

            const runData = JSON.parse(runs);
            if (runData.length > 0 && runData[0].conclusion === 'success') {
                console.log(chalk.green('✅ GitHub Actions build completed successfully!'));
                console.log(chalk.green('✅ All platform installers uploaded to GitHub Release!'));
                return true;
            } else if (runData.length > 0 && runData[0].conclusion === 'failure') {
                console.log(chalk.red('❌ GitHub Actions build failed!'));
                console.log(chalk.gray('Check the Actions tab on GitHub for details.'));
                return false;
            } else {
                attempts++;
                if (attempts % 6 === 0) {
                    console.log(chalk.gray(`⏳ Still building... (${attempts * 30}s elapsed)`));
                }
                await new Promise(resolve => setTimeout(resolve, 30000));
            }
        } catch (e) {
            console.log(chalk.yellow('⚠️ Could not check GitHub Actions status:', e.message));
            console.log(chalk.gray('You can manually check: https://github.com/PeterAlaks/lyric-display-app/actions'));
            return false;
        }
    }

    console.log(chalk.red('❌ Timed out waiting for GitHub Actions build.'));
    console.log(chalk.gray('The build may still be running. Check: https://github.com/PeterAlaks/lyric-display-app/actions'));
    return false;
}

export { waitForGitHubActions };