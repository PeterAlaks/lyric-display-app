<p align="center">
  <img src="public/logos/LyricDisplay%20logo.png" alt="LyricDisplay" width="360">
</p>

# LyricDisplay

Real-time lyric control and multi-output display for live events, worship services, streaming, and production environments.

**Version:** 6.7.0 · **License:** GPL-3.0-or-later

[Download LyricDisplay](https://github.com/PeterAlaks/lyric-display-app/releases/latest) · [Installation guide](INSTALLATION.md) · [Contributing](CONTRIBUTING.md) · [Architecture map](docs/PROJECT_STRUCTURE.md)

## What LyricDisplay Does

LyricDisplay combines an Electron control application with browser-based output views and a realtime local backend. Operators can prepare lyrics, cue lines, and style independent outputs while OBS, vMix, Wirecast, projectors, stage displays, mobile controllers, and optional NDI receivers stay synchronized.

Key capabilities include:

- Two default lyric outputs, up to four custom outputs, a stage display, and a timer display.
- Independent typography, positioning, transitions, backgrounds, media, and full-screen styling per output.
- Text, LRC, Markdown, RTF, and DOCX lyric imports, plus `.ldset` setlists.
- Built-in song editing, translation grouping, timestamps, search, autoplay, and lyric video export.
- Online lyric providers and EasyWorship/presentation import workflows.
- OBS Browser Source creation, a compact OBS Dock mode, and generic browser URLs for other production software.
- Join-code-protected mobile/web controllers and remote lyric draft approval.
- Optional NDI output through the separately installed LyricDisplay NDI companion.
- MIDI and OSC control, production-readiness checks, diagnostics, and automatic application updates.

## Install

Download the appropriate package from the [GitHub releases page](https://github.com/PeterAlaks/lyric-display-app/releases/latest):

- Windows: x64 setup executable
- macOS: Apple Silicon or Intel DMG
- Linux: x64 AppImage

The [installation and integration guide](INSTALLATION.md) covers platform trust prompts, OBS/vMix setup, networked browser sources, LyricDisplay Dock, NDI, mobile controllers, and troubleshooting.

## Quick Start

1. Launch LyricDisplay and load a supported lyric file, drag one into the control panel, or create a song in the canvas.
2. Configure Output 1, Output 2, Stage, or a custom output.
3. Open **Output > Preview Outputs** to verify the result.
4. Enable **Display Output**, then click a lyric line to send it live.
5. In OBS, use **Output > OBS Source Creator** or add a Browser Source manually:

```text
http://localhost:4000/#/output1
```

LyricDisplay must remain running while browser sources or remote controllers are in use. See the [integration guide](INSTALLATION.md#browser-output-urls) for all output routes.

## Development

### Prerequisites

- Node.js 22
- npm
- Platform build tools when native modules must be compiled

Install both the root and backend dependency sets:

```bash
git clone https://github.com/PeterAlaks/lyric-display-app.git
cd lyric-display-app
npm install
npm --prefix server install
npm run electron-dev
```

The full development command starts Vite and Electron; Electron starts and monitors the backend. The backend uses port `4000`, and Vite uses port `5173`.

### Common Commands

| Command | Purpose |
| --- | --- |
| `npm run electron-dev` | Full desktop development session |
| `npm run electron-dev:headless` | Development OBS Dock/Headless session |
| `npm run dev` | Vite renderer only; full functionality still needs the backend |
| `npm run server` | Backend only |
| `npm run build` | Production renderer build and build metadata |
| `npm run electron-pack` | Build and package the desktop application |
| `npm run check:static` | Syntax, conflict-marker, and API contract checks |
| `npm run test:unit` | Unit test suite |

NDI development uses the separate [lyricdisplay-ndi](https://github.com/PeterAlaks/lyricdisplay-ndi) repository. Clone it as `lyricdisplay-ndi/` inside this project only when working on the companion integration; that directory is intentionally ignored here.

## Documentation

| Document | Use it for |
| --- | --- |
| [Installation and integration](INSTALLATION.md) | End-user installation, outputs, OBS/vMix, Dock mode, NDI, networking, troubleshooting |
| [Contribution guide](CONTRIBUTING.md) | Setup expectations, conventions, verification, and pull requests |
| [Repository and architecture map](docs/PROJECT_STRUCTURE.md) | Process boundaries, file ownership, runtime flows, and feature-to-file lookup |
| [HTTP API](docs/openapi.yaml) | REST routes and schemas |
| [Realtime API](docs/asyncapi.yaml) | Socket.IO events and payloads |
| [Cross-platform builds](docs/crossplatformbuilds.md) | Platform packaging notes |
| [Release recovery](docs/RELEASE_RECOVERY.md) | Update rehearsal, schema compatibility, and rollback |

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md) before making changes and follow the [Code of Conduct](CODE_OF_CONDUCT.md). The architecture map identifies the owning files and cross-layer contracts for each feature area.

Issues and focused pull requests are welcome. For UI changes, include screenshots or a short recording and describe the platforms and output routes you tested.

## License and Attribution

LyricDisplay is free software licensed under the [GNU General Public License, version 3 or later](LICENSE).

Developed by Peter Alakembi with contributions from David Okaliwe and the LyricDisplay community.

Lyric provider content and metadata remain the property of their respective rights holders. NDI is a trademark of Vizrt NDI AB; LyricDisplay is not affiliated with or endorsed by Vizrt NDI AB. See [TRADEMARK](TRADEMARK) for project trademark terms.

## Support

- [Report a bug or request a feature](https://github.com/PeterAlaks/lyric-display-app/issues)
- [Project website](https://lyricdisplay.app)
- [Support development](https://lyricdisplay.app/donate)
