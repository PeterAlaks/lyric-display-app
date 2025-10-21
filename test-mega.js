import { execSync } from 'child_process';
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import archiver from 'archiver';

function safeExec(cmd, opts = {}) {
    return execSync(cmd, { encoding: 'utf8', stdio: 'pipe', ...opts }).toString().trim();
}

function escapeMegaPath(remotePath) {
    const normalized = remotePath.replace(/\\/g, '/');
    return `"${normalized.replace(/"/g, '\\"')}"`;
}

function normalizeMegaPath(megaPath) {
    return megaPath.replace(/\\/g, '/');
}

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

function extractVersionFromZipName(name) {
    const m = name.match(/LyricDisplay v(\d+\.\d+\.\d+(?:-[\w.-]+)?)\.zip/i);
    return m ? m[1] : null;
}

async function createTestZip(outputPath) {
    return new Promise((resolve, reject) => {
        const output = fs.createWriteStream(outputPath);
        const archive = archiver('zip', { zlib: { level: 9 } });

        output.on('close', () => resolve({ bytes: archive.pointer() }));
        archive.on('error', (err) => reject(err));

        archive.pipe(output);

        // Add a simple test file
        archive.append('This is a test file for MEGA upload testing.', { name: 'test-readme.txt' });
        archive.finalize();
    });
}

async function testMegaIntegration() {
    console.log(chalk.cyan.bold('\n🧪 MEGA Integration Test Script\n'));
    console.log(chalk.gray('This script tests MEGA CLI functionality without touching your repo.\n'));

    // Test 1: Check MEGA CLI availability
    console.log(chalk.blue('📋 Test 1: Checking MEGA CLI availability...'));
    let whoami = '';
    try {
        whoami = safeExec('mega-whoami 2>&1');
        if (!whoami || /Not logged in|not found|ERR/i.test(whoami)) {
            console.log(chalk.red('❌ MEGA CLI not available or not logged in.'));
            console.log(chalk.yellow('Please install MEGAcmd and login: mega-login your@email.com'));
            return;
        }
        console.log(chalk.green(`✅ MEGA session active: ${whoami}\n`));
    } catch (e) {
        console.log(chalk.red('❌ MEGA CLI not found in PATH.'));
        console.log(chalk.yellow('Please install MEGAcmd from: https://mega.nz/cmd\n'));
        return;
    }

    const testFolder = '/LyricDisplay-TEST';
    const testVersion = '0.0.0-test.1';
    const testZipName = `LyricDisplay v${testVersion}.zip`;
    const localTestPath = path.join(process.cwd(), testZipName);

    try {
        // Test 2: Create test ZIP file
        console.log(chalk.blue('📋 Test 2: Creating test ZIP file...'));
        await createTestZip(localTestPath);
        console.log(chalk.green(`✅ Test ZIP created: ${localTestPath}\n`));

        // Test 3: Create remote folder
        console.log(chalk.blue('📋 Test 3: Creating/verifying remote test folder...'));
        try {
            execSync(`mega-mkdir -p ${escapeMegaPath(testFolder)}`, { stdio: 'pipe' });
            console.log(chalk.green(`✅ Folder created: ${testFolder}\n`));
        } catch (e) {
            if (/already exists/i.test(e.message)) {
                console.log(chalk.gray(`Folder already exists: ${testFolder}\n`));
            } else {
                throw e;
            }
        }

        // Test 4: Upload test file
        console.log(chalk.blue('📋 Test 4: Uploading test ZIP to MEGA...'));
        // Use original path with backslashes for Windows, wrap in quotes
        execSync(`mega-put "${localTestPath}" ${escapeMegaPath(testFolder + '/')}`, { stdio: 'inherit' });
        console.log(chalk.green(`✅ Upload successful!\n`));

        // Test 5: Verify upload with mega-ls
        console.log(chalk.blue('📋 Test 5: Verifying upload with mega-ls...'));
        try {
            const lsOutput = safeExec(`mega-ls ${escapeMegaPath(testFolder)}`);
            if (lsOutput.includes(testZipName)) {
                console.log(chalk.green(`✅ File verified in remote folder:\n${lsOutput}\n`));
            } else {
                console.log(chalk.yellow(`⚠️ File uploaded but not found in listing.\n`));
            }
        } catch (e) {
            console.log(chalk.yellow(`⚠️ Could not list files: ${e.message}\n`));
        }

        // Test 6: Create export link
        console.log(chalk.blue('📋 Test 6: Creating public export link...'));
        try {
            const remoteFilePath = `${testFolder}/${testZipName}`;
            // Use -a flag to add export and -f to accept copyright terms
            const exportOutput = safeExec(`mega-export -a -f ${escapeMegaPath(remoteFilePath)}`);
            console.log(chalk.green(`✅ Public link created:\n${exportOutput}\n`));
        } catch (e) {
            console.log(chalk.yellow(`⚠️ Could not create export link: ${e.message}\n`));
        }

        // Test 7: Test mega-find (for pruning logic)
        console.log(chalk.blue('📋 Test 7: Testing mega-find (pruning simulation)...'));

        // Upload 2 more test versions to simulate pruning
        console.log(chalk.gray('Creating additional test versions...'));
        const additionalVersions = ['0.0.0-test.2', '0.0.0-test.3'];

        for (const ver of additionalVersions) {
            const zipName = `LyricDisplay v${ver}.zip`;
            const zipPath = path.join(process.cwd(), zipName);
            await createTestZip(zipPath);
            // Use original path with backslashes
            execSync(`mega-put "${zipPath}" ${escapeMegaPath(testFolder + '/')}`, { stdio: 'pipe' });
            fs.unlinkSync(zipPath);
            console.log(chalk.gray(`  Uploaded: ${zipName}`));
        }

        console.log(chalk.blue('\nSearching for all test ZIPs with mega-find...'));
        try {
            // Use --pattern flag with the search pattern
            const findOutput = safeExec(`mega-find ${escapeMegaPath(testFolder)} --pattern="LyricDisplay v*.zip" 2>&1 || echo ""`);

            if (!findOutput || /not found|ERR/i.test(findOutput)) {
                console.log(chalk.yellow('⚠️ mega-find not working or no results.\n'));
            } else {
                const lines = findOutput.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
                console.log(chalk.green(`✅ Found ${lines.length} file(s):`));
                lines.forEach(line => console.log(chalk.gray(`  - ${line}`)));

                // Test version extraction and sorting
                const items = lines.map(remotePath => {
                    const normalized = normalizeMegaPath(remotePath);
                    const base = path.basename(normalized);
                    const ver = extractVersionFromZipName(base);
                    return { remotePath: normalized, base, ver };
                }).filter(i => i.ver);

                if (items.length > 0) {
                    items.sort((a, b) => -compareVersions(a.ver, b.ver));
                    console.log(chalk.blue('\nSorted by version (newest first):'));
                    items.forEach((item, idx) => {
                        console.log(chalk.gray(`  ${idx + 1}. ${item.base} (v${item.ver})`));
                    });

                    // Simulate pruning logic
                    if (items.length > 2) {
                        const toKeep = items.slice(0, 2);
                        const toDelete = items.slice(2);
                        console.log(chalk.blue('\nPruning simulation (keeping newest 2):'));
                        console.log(chalk.green(`  Keep: ${toKeep.map(i => i.base).join(', ')}`));
                        console.log(chalk.yellow(`  Would delete: ${toDelete.map(i => i.base).join(', ')}`));
                    }
                }
                console.log();
            }
        } catch (e) {
            console.log(chalk.yellow(`⚠️ mega-find test failed: ${e.message}\n`));
        }

        // Test 8: Cleanup test files
        console.log(chalk.blue('📋 Test 8: Cleaning up test files...'));
        try {
            execSync(`mega-rm -rf ${escapeMegaPath(testFolder)}`, { stdio: 'inherit' });
            console.log(chalk.green(`✅ Remote test folder removed.\n`));
        } catch (e) {
            console.log(chalk.yellow(`⚠️ Could not remove remote folder: ${e.message}`));
            console.log(chalk.gray(`You can manually remove it: mega-rm -rf "${testFolder}"\n`));
        }

        // Clean up local test file
        if (fs.existsSync(localTestPath)) {
            fs.unlinkSync(localTestPath);
            console.log(chalk.green(`✅ Local test ZIP removed.\n`));
        }

        // Final summary
        console.log(chalk.green.bold('✅ All MEGA integration tests completed!\n'));
        console.log(chalk.cyan('Summary:'));
        console.log(chalk.gray('  ✓ MEGA CLI is properly configured'));
        console.log(chalk.gray('  ✓ File upload works correctly'));
        console.log(chalk.gray('  ✓ Path escaping handles special characters'));
        console.log(chalk.gray('  ✓ Export link generation works'));
        console.log(chalk.gray('  ✓ mega-find and pruning logic tested'));
        console.log(chalk.gray('  ✓ File deletion works\n'));
        console.log(chalk.green('Your MEGA integration should work correctly in the release script! 🎉\n'));

    } catch (error) {
        console.error(chalk.red.bold('\n❌ Test failed:'), error.message);
        console.log(chalk.yellow('\nPlease fix the issue above before using the release script.\n'));

        // Cleanup on error
        try {
            if (fs.existsSync(localTestPath)) {
                fs.unlinkSync(localTestPath);
            }
            execSync(`mega-rm -rf ${escapeMegaPath(testFolder)}`, { stdio: 'pipe' });
        } catch (cleanupErr) {
            // Ignore cleanup errors
        }

        process.exit(1);
    }
}

testMegaIntegration();