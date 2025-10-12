import { execSync } from 'child_process';
import prompts from 'prompts';
import chalk from 'chalk';
import fs from 'fs';

async function main() {
    console.log(chalk.cyan.bold('\n🚀 LyricDisplay Release Assistant\n'));

    const { bumpType } = await prompts({
        type: 'select',
        name: 'bumpType',
        message: 'Select version bump type:',
        choices: [
            { title: '🐛 Patch (bug fixes, small updates)', value: 'patch' },
            { title: '✨ Minor (new features, no breaking changes)', value: 'minor' },
            { title: '💥 Major (breaking changes, big release)', value: 'major' },
            { title: '❌ Cancel', value: null }
        ]
    });

    if (!bumpType) {
        console.log(chalk.yellow('Release cancelled.'));
        process.exit(0);
    }

    const { notes } = await prompts({
        type: 'text',
        name: 'notes',
        message: 'Add a short changelog or release note (optional):'
    });

    try {
        console.log(chalk.blue(`\n📦 Bumping version (${bumpType})...`));
        execSync(`npm version ${bumpType}`, { stdio: 'inherit' });

        console.log(chalk.blue('\n🛠️  Building and publishing release...'));
        execSync(`npm run electron-publish`, { stdio: 'inherit' });

        console.log(chalk.blue('\n☁️  Pushing commit and tags to GitHub...'));
        execSync('git push && git push --tags', { stdio: 'inherit' });

        const pkg = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
        const version = pkg.version;
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