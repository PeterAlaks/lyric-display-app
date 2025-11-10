# Cross-Platform Build System

## Overview

LyricDisplay now supports automated builds for Windows, macOS, and Linux through GitHub Actions. This allows you to create releases from your Windows development machine while still producing native installers for all platforms.

## How It Works

1. **Local Windows Build**: When you run `npm run release`, it builds the Windows installer locally
2. **GitHub Actions**: Automatically triggered by the version tag, builds macOS and Linux versions
3. **Artifact Collection**: The release script waits for GitHub Actions to complete and downloads all artifacts
4. **MEGA Upload**: All platform packages are automatically uploaded to MEGA
5. **Documentation Update**: Download links are updated in README and Installation Guide

## Build Artifacts

### Windows
- **LyricDisplay-Setup-{version}.exe** - NSIS installer
- Creates: `LyricDisplay-v{version}-Windows.zip`

### macOS
- **LyricDisplay-{version}.dmg** - macOS disk image
- Universal binary supporting Intel and Apple Silicon
- Creates: `LyricDisplay-v{version}-macOS.zip`

### Linux
- **LyricDisplay-{version}.AppImage** - Universal Linux binary
- **LyricDisplay-{version}.deb** - Debian/Ubuntu package
- **LyricDisplay-{version}.rpm** - Fedora/RHEL package
- Creates: `LyricDisplay-v{version}-Linux.zip`

## Release Workflow

```bash
# 1. Run release script
npm run release

# 2. Select version bump type
# 3. Enter release notes
# 4. Script commits, tags, and pushes to GitHub
# 5. GitHub Actions builds all platforms (10-15 minutes)
# 6. Script downloads artifacts and packages them
# 7. All packages uploaded to MEGA
# 8. Documentation updated with download links
```

## Manual Build Process

If you need to build manually:

### Windows (Local)
```bash
npm run electron-pack
```

### macOS (Requires macOS machine)
```bash
npm run electron-pack
```

### Linux (Requires Linux machine)
```bash
npm run electron-pack
```

## Troubleshooting

### GitHub Actions Failed
- Check the Actions tab: https://github.com/PeterAlaks/lyric-display-app/actions
- Common issues: dependency installation, build errors
- Fix and manually re-run the workflow

### Artifact Download Failed
- Ensure GitHub CLI is installed and authenticated: `gh auth status`
- Manually download from Actions tab and place in `dist/artifacts/`

### MEGA Upload Failed
- Check MEGAcmd is logged in: `mega-whoami`
- Verify network connection
- Check MEGA storage quota

### Missing Platform Build
- Check if GitHub Actions workflow completed successfully
- Verify artifact was uploaded (check Actions workflow logs)
- Manually download and package if needed

## Environment Variables

Set these in your `.env` file:

```env
MEGA_REMOTE_PATH=/LyricDisplay
```

## Code Signing

### macOS
For distribution outside the Mac App Store, you'll need:
- Apple Developer ID certificate
- Set `CSC_LINK` and `CSC_KEY_PASSWORD` environment variables in GitHub Secrets

### Windows
- Optional: Get a code signing certificate from a CA
- Set `WIN_CSC_LINK` and `WIN_CSC_KEY_PASSWORD` in GitHub Secrets

Current builds are unsigned but fully functional.

## GitHub Actions Setup

No additional setup required! The workflow is automatically triggered when you:
1. Push a tag starting with `v` (e.g., `v5.2.0`)
2. The release script handles this automatically

## File Locations

- **Workflow**: `.github/workflows/build-release.yml`
- **Release Manager**: `scripts/release-manager.js`
- **Main Release Script**: `scripts/release.js`
- **Build Config**: `package.json` (build section)
- **macOS Entitlements**: `build/entitlements.mac.plist`