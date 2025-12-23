# Cross-Platform Build System

This reflects the current release flow (tag-driven builds on GitHub Actions).

## What happens when you run `npm run release`
1) Preconditions: clean git tree, GitHub CLI (`gh`) installed and authenticated, deps installed (`npm ci` + `cd server && npm ci` once), and Windows build tools available.
2) Script prompts for version bump (patch/minor/major/custom), updates docs (README, Installation Guide, OpenAPI/AsyncAPI specs), and rewrites download links.
3) Builds Windows locally via `npm run electron-pack` (Vite build + electron-builder for Windows).
4) Commits and tags `vX.Y.Z`, then pushes tag/commit to origin.
5) GitHub Actions workflow (`.github/workflows/build-release.yml`) builds Windows, macOS, and Linux installers and publishes a GitHub Release with artifacts.

## CI artifact outputs
- Windows: `LyricDisplay-${version}-Windows-Setup.exe` (+ `latest.yml`)
- macOS: `LyricDisplay-${version}-macOS-arm64.dmg`, `LyricDisplay-${version}-macOS-x64.dmg`, plus `.zip` exports and `latest-mac.yml`
- Linux: `LyricDisplay-${version}-Linux.AppImage`, `LyricDisplay-${version}.deb`, `LyricDisplay-${version}.rpm`, plus `latest-linux.yml`
Artifacts are attached to the GitHub Release; no MEGA upload step remains.

## Manual builds (per-OS)
- Windows/macOS/Linux (on that OS): `npm run electron-pack`
  - Installs/uses electron-builder targets defined in `package.json`.
  - For Linux you need `build-essential`, `libsecret-1-dev`, `rpm` (mirrors the CI setup).

## Troubleshooting
- CI failed: check Actions logs. Fix and rerun the workflow for the failed job or retag.
- Artifacts missing: download from the GitHub Release or rerun the workflow; `gh run download` can pull artifacts by run ID.
- Version mismatch: rerun `npm run release` with the correct bump or adjust `package.json` and rerun the script.
- Code signing: workflows set `CSC_IDENTITY_AUTO_DISCOVERY=false`. No signing is configured by default. Add `CSC_LINK`/`CSC_KEY_PASSWORD` (macOS) and `WIN_CSC_LINK`/`WIN_CSC_KEY_PASSWORD` (Windows) secrets if you want signed builds.

## Key files
- Workflow: `.github/workflows/build-release.yml`
- Release script: `scripts/release.js`
- Builder config: `package.json` (`build` section) and `build/entitlements.mac.plist` for macOS