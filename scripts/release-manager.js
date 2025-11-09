import { execSync } from 'child_process';
import prompts from 'prompts';
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import archiver from 'archiver';
import { updateMegaLinks } from './update-version.js';

function safeExec(cmd, opts = {}) {
    const defaultTimeout = 30000;
    return execSync(cmd, {
        encoding: 'utf8',
        stdio: 'pipe',
        timeout: defaultTimeout,
        ...opts
    }).toString().trim();
}

async function createZipWithFiles({ setupPath, readmePath, outputZipPath, platform }) {
    return new Promise((resolve, reject) => {
        const output = fs.createWriteStream(outputZipPath);
        const archive = archiver('zip', { zlib: { level: 9 } });

        output.on('close', () => {
            resolve({ bytes: archive.pointer() });
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
        }

        archive.finalize();
    });
}

function escapeMegaPath(remotePath) {
    const normalized = remotePath.replace(/\\/g, '/');
    return `"${normalized.replace(/"/g, '\\"')}"`;
}

async function uploadToMega(zipPath, version, platform) {
    console.log(chalk.blue(`\n☁️ Uploading ${platform} build to MEGA...`));

    let whoami = '';
    try {
        whoami = safeExec('mega-whoami 2>&1', { timeout: 10000 });
    } catch (e) {
        console.log(chalk.yellow('⚠️ MEGA check failed. Skipping upload.'));
        return null;
    }

    if (!whoami || /Not logged in|not found|ERR/i.test(whoami)) {
        console.log(chalk.yellow('⚠️ MEGAcmd not logged in. Skipping upload.'));
        return null;
    }

    const remoteFolder = process.env.MEGA_REMOTE_PATH || '/LyricDisplay';
    const zipFilename = path.basename(zipPath);

    try {
        execSync(`mega-mkdir -p ${escapeMegaPath(remoteFolder)}`, {
            stdio: 'pipe',
            timeout: 15000
        });
    } catch (e) {
        // Folder might already exist
    }

    try {
        execSync(`mega-put "${zipPath}" ${escapeMegaPath(remoteFolder + '/')}`, {
            stdio: 'inherit',
            timeout: 300000
        });
        console.log(chalk.green(`✅ ${platform} upload completed.`));
    } catch (e) {
        console.error(chalk.red(`❌ ${platform} upload failed:`, e.message));
        return null;
    }

    try {
        const remoteFilePath = `${remoteFolder}/${zipFilename}`;
        const exportOutput = safeExec(`mega-export -a -f ${escapeMegaPath(remoteFilePath)}`, { timeout: 20000 });
        const linkMatch = exportOutput.match(/(https:\/\/mega\.nz\/[^\s]+)/);

        if (linkMatch) {
            console.log(chalk.green(`🔗 ${platform} MEGA link: ${linkMatch[1]}`));
            return linkMatch[1];
        }
    } catch (e) {
        console.log(chalk.yellow(`⚠️ Could not create ${platform} public link.`));
    }

    return null;
}

async function downloadGitHubArtifacts(version) {
    console.log(chalk.blue('\n📦 Checking GitHub Actions artifacts...'));

    const tagName = `v${version}`;
    let attempts = 0;
    const maxAttempts = 60; // Wait up to 30 minutes

    while (attempts < maxAttempts) {
        try {
            // Check if workflow has completed
            const runs = safeExec(
                `gh run list --workflow=build-release.yml --json conclusion,status,headBranch --limit 1`,
                { timeout: 15000 }
            );

            const runData = JSON.parse(runs);
            if (runData.length > 0 && runData[0].conclusion === 'success') {
                console.log(chalk.green('✅ GitHub Actions build completed successfully!'));

                // Download artifacts
                const DIST_DIR = path.resolve('./dist');
                const ARTIFACTS_DIR = path.join(DIST_DIR, 'artifacts');

                if (!fs.existsSync(ARTIFACTS_DIR)) {
                    fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
                }

                console.log(chalk.blue('📥 Downloading artifacts...'));

                try {
                    execSync(`gh run download --dir "${ARTIFACTS_DIR}"`, {
                        stdio: 'inherit',
                        timeout: 120000
                    });
                    console.log(chalk.green('✅ Artifacts downloaded successfully!'));
                    return ARTIFACTS_DIR;
                } catch (e) {
                    console.log(chalk.yellow('⚠️ Failed to download artifacts:', e.message));
                    return null;
                }
            } else if (runData.length > 0 && runData[0].conclusion === 'failure') {
                console.log(chalk.red('❌ GitHub Actions build failed!'));
                console.log(chalk.gray('Check the Actions tab on GitHub for details.'));
                return null;
            } else {
                // Still running
                attempts++;
                if (attempts % 6 === 0) { // Every minute
                    console.log(chalk.gray(`⏳ Waiting for GitHub Actions build... (${attempts * 30}s elapsed)`));
                }
                await new Promise(resolve => setTimeout(resolve, 30000)); // Wait 30 seconds
            }
        } catch (e) {
            console.log(chalk.yellow('⚠️ Could not check GitHub Actions status:', e.message));
            return null;
        }
    }

    console.log(chalk.red('❌ Timed out waiting for GitHub Actions build.'));
    return null;
}

async function packageAllPlatforms(version) {
    console.log(chalk.blue('\n📦 Packaging installers for all platforms...'));

    const DIST_DIR = path.resolve('./dist');
    const README_PATH = path.resolve('./LyricDisplay Installation & Integration Guide.md');

    const megaLinks = {};

    // Wait for and download GitHub artifacts
    const artifactsDir = await downloadGitHubArtifacts(version);

    if (!artifactsDir) {
        console.log(chalk.yellow('\n⚠️ Could not download GitHub artifacts. Will only package local Windows build.'));
    }

    // Package Windows (local build)
    console.log(chalk.blue('\n📦 Packaging Windows build...'));
    const windowsFiles = fs.readdirSync(DIST_DIR).filter(f => /setup.*\.exe$/i.test(f) || /\.exe$/i.test(f));

    if (windowsFiles.length > 0) {
        const windowsSetup = path.join(DIST_DIR, windowsFiles[0]);
        const windowsZip = path.join(DIST_DIR, `LyricDisplay-v${version}-Windows.zip`);

        await createZipWithFiles({
            setupPath: windowsSetup,
            readmePath: README_PATH,
            outputZipPath: windowsZip,
            platform: 'Windows'
        });

        console.log(chalk.green(`✅ Windows package created: ${path.basename(windowsZip)}`));
        megaLinks.windows = await uploadToMega(windowsZip, version, 'Windows');
    }

    if (artifactsDir) {
        // Package macOS
        const macosDir = path.join(artifactsDir, 'macos-installer');
        if (fs.existsSync(macosDir)) {
            console.log(chalk.blue('\n📦 Packaging macOS build...'));
            const macosFiles = fs.readdirSync(macosDir).filter(f => /\.dmg$/i.test(f));

            if (macosFiles.length > 0) {
                const macosDmg = path.join(macosDir, macosFiles[0]);
                const macosZip = path.join(DIST_DIR, `LyricDisplay-v${version}-macOS.zip`);

                await createZipWithFiles({
                    setupPath: macosDmg,
                    readmePath: README_PATH,
                    outputZipPath: macosZip,
                    platform: 'macOS'
                });

                console.log(chalk.green(`✅ macOS package created: ${path.basename(macosZip)}`));
                megaLinks.macos = await uploadToMega(macosZip, version, 'macOS');
            }
        }

        // Package Linux
        const linuxDir = path.join(artifactsDir, 'linux-installer');
        if (fs.existsSync(linuxDir)) {
            console.log(chalk.blue('\n📦 Packaging Linux build...'));
            const linuxFiles = fs.readdirSync(linuxDir).filter(f => /\.AppImage$/i.test(f));

            if (linuxFiles.length > 0) {
                const linuxAppImage = path.join(linuxDir, linuxFiles[0]);
                const linuxZip = path.join(DIST_DIR, `LyricDisplay-v${version}-Linux.zip`);

                await createZipWithFiles({
                    setupPath: linuxAppImage,
                    readmePath: README_PATH,
                    outputZipPath: linuxZip,
                    platform: 'Linux'
                });

                console.log(chalk.green(`✅ Linux package created: ${path.basename(linuxZip)}`));
                megaLinks.linux = await uploadToMega(linuxZip, version, 'Linux');
            }
        }
    }

    return megaLinks;
}

export { packageAllPlatforms, uploadToMega };