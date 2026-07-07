# LyricDisplay

> Professional real-time lyric display application for live events, church services, and multimedia presentations.

**Version:** 6.6.2
**Author:** Peter Alakembi
**Co-Contributor:** David Okaliwe

## Overview

LyricDisplay is an Electron-based desktop app for displaying lyrics across multiple live output screens. It is designed for production environments that use OBS, vMix, NDI, projectors, stage displays, or browser sources.

The app provides a control panel for loading, editing, styling, and triggering lyrics in real time while keeping each output independently configurable.

## Key Features

- Multiple lyric outputs, including Output 1, Output 2, Stage, and optional custom outputs.
- Transparent browser-source friendly displays for OBS and vMix.
- Real-time lyric synchronization through Socket.IO.
- Built-in lyric editor with cleanup, formatting, search, and navigation tools.
- Plain text and LRC lyric file support.
- Translation line grouping for bracketed lyric lines.
- Per-output typography, colors, shadows, padding, backgrounds, and full-screen styling.
- Optional NDI output support for production video workflows.
- Secondary mobile/web controllers using QR code and join-code pairing.
- Auto-updates through GitHub releases.
- Cross-platform packaging for Windows, macOS, and Linux.

## Installation

### Pre-built Releases

1. Download the latest release from the [releases page](https://github.com/PeterAlaks/lyric-display-app/releases/latest).
2. Run the installer for your platform.
3. Launch LyricDisplay.

On macOS, the app may show a damaged-app warning because it is not code-signed. Run this before opening it:

```bash
xattr -cr /Applications/LyricDisplay.app
```

See the [installation guide](INSTALLATION.md) for more details.

### Development Setup

```bash
git clone https://github.com/PeterAlaks/lyric-display-app.git
cd lyric-display-app

npm install

cd server
npm install
cd ..

npm run electron-dev
```

## Quick Start

### Load Lyrics

- Use `File > Load Lyrics File`.
- Drag and drop `.txt`, `.lrc`, `.md`, `.markdown`, `.rtf`, or `.docx` files into the main panel.
- Use the new song canvas to create lyrics from scratch.
- Use online lyric search where available.

### Configure Outputs

1. Configure Output 1, Output 2, Stage, and any custom outputs independently.
2. Use `File > Preview Outputs` to open available output windows.
3. Toggle `Display Output` to control whether lyrics are visible.

### Run a Live Session

- Click a lyric line to send it to the active outputs.
- Use search to find lyric lines quickly.
- Navigate matches with keyboard shortcuts.
- Clear or hide outputs from the control panel when needed.

### Secondary Controllers

1. In the desktop app, open `File > Connect Mobile Controller` or use the shield icon.
2. Scan the QR code from a phone or tablet on the same network.
3. Enter the 6-digit join code.
4. Use the paired controller to trigger lines, toggle outputs, sync state, or submit lyric drafts for approval.

## Lyric File Format

LyricDisplay accepts plain text (`.txt`), LRC (`.lrc`), Markdown (`.md`, `.markdown`), Rich Text (`.rtf`), and Word (`.docx`) files.

Formatting behavior:

- Bracketed lines such as `[translation]`, `(translation)`, or `{translation}` are treated as translation lines.
- A normal lyric line followed by a bracketed line is grouped together.
- Cleanup tools can remove unwanted punctuation and apply capitalization rules.

## Browser Source Setup

### OBS Studio

1. Add a Browser Source to your scene.
2. Use one of these URLs:

```text
http://localhost:4000/#/output1
http://localhost:4000/#/output2
http://localhost:4000/#/stage
http://localhost:4000/#/output3
```

3. Replace `localhost` with the control computer's local IP address when capturing from another machine.
4. Set the browser source dimensions to match your production canvas.
5. Enable refresh/shutdown options in OBS as needed for your workflow.

### vMix

Add a Web Browser input and use the same output URL format as OBS.

### LyricDisplay Dock

LyricDisplay also includes a compact OBS custom dock for basic control on lower-powered streaming machines.

On Windows packaged installs, add `obs-dock.html` from the LyricDisplay install folder as an OBS Custom Browser Dock:

```text
file:///C:/Program Files/LyricDisplay/obs-dock.html
```

For the most reliable LyricDisplay Dock flow in OBS, open LyricDisplay once and use `LyricDisplay Dock / Headless Mode` in Advanced Settings. `LyricDisplay Dock Setup` shows the one local HTML URL to paste into OBS. Use `Launch Headless Mode` for the current session, or enable `Start at Sign In` if you want LyricDisplay to start headless automatically. When you click `Start LyricDisplay Dock` inside OBS, that same dock loads the controller.

During development, add the same local launcher file as an OBS dock:

```text
file:///D:/path/to/lyric-display-app/obs-dock.html?mode=dev
```

Run `npm run electron-dev:headless`, then click `Start LyricDisplay Dock` in the local dev launcher. The controller loads in that same dock.

## Development

### Tech Stack

- Electron
- React
- Vite
- Tailwind CSS
- Zustand
- Express
- Socket.IO

### Available Scripts

```bash
npm run dev              # Vite development server
npm run server           # Backend server only
npm run electron-dev     # Full Electron development
npm run electron-dev:headless # Electron development without the main app window
npm run build            # Production build
npm run electron-pack    # Package Electron app
```

### Repository Layout

The detailed repository layout lives in [docs/PROJECT_STRUCTURE.md](docs/PROJECT_STRUCTURE.md).

### NDI Companion

NDI output support is powered by a separate companion repository: [lyricdisplay-ndi](https://github.com/PeterAlaks/lyricdisplay-ndi). Contributors who want to work on NDI features can clone that repository into the app project root and follow the setup notes in [CONTRIBUTING.md](CONTRIBUTING.md).

### Contributing

Please read the [contribution guide](CONTRIBUTING.md) and follow the [code of conduct](CODE_OF_CONDUCT.md) when participating in the project.

## Troubleshooting

### Output Windows Are Not Displaying

- Confirm that the backend server is running on port `4000`.
- Check that Socket.IO shows as connected in the app.
- Refresh browser sources in OBS or vMix.
- Confirm the output URL matches the output you want to capture.

## License

LyricDisplay is free software licensed under the GNU General Public License, version 3 or later. See [LICENSE](LICENSE) for the full license text.

## Credits

LyricDisplay includes optional integrations with public lyric providers such as LRCLIB, ChartLyrics, Lyrics.ovh, and Open Hymnal Project. Lyrics and metadata remain the property of their respective copyright holders.

NDI is a trademark of Vizrt NDI AB. This project is not affiliated with or endorsed by Vizrt NDI AB.

## Support

For technical support, feature requests, or bug reports:

- Open an issue on GitHub.
- Check the [installation guide](INSTALLATION.md).
- Review the troubleshooting section above.

**Links:**

- [Website](https://lyricdisplay.app)
- [Developer Portfolio](https://linktr.ee/peteralaks)
- [Support Development](https://lyricdisplay.app/donate)
