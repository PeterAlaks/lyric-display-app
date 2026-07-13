# LyricDisplay Installation and Integration Guide

Install LyricDisplay, connect production outputs, and resolve common setup problems.

Version: 6.7.0

## Contents

- [Download and platform support](#download-and-platform-support)
- [Install on Windows](#install-on-windows)
- [Install on macOS](#install-on-macos)
- [Install on Linux](#install-on-linux)
- [First launch checklist](#first-launch-checklist)
- [Browser output URLs](#browser-output-urls)
- [OBS Studio](#obs-studio)
- [vMix, Wirecast, and other browser inputs](#vmix-wirecast-and-other-browser-inputs)
- [Networked outputs](#networked-outputs)
- [LyricDisplay Dock for OBS](#lyricdisplay-dock-for-obs)
- [NDI output](#ndi-output)
- [Mobile and web controllers](#mobile-and-web-controllers)
- [Loading and operating lyrics](#loading-and-operating-lyrics)
- [Troubleshooting](#troubleshooting)

## Download and Platform Support

Download LyricDisplay only from the [official website](https://lyricdisplay.app) or the [GitHub releases page](https://github.com/PeterAlaks/lyric-display-app/releases/latest). The application is free and does not require an account.

Current packages:

| Platform | Package |
| --- | --- |
| Windows 10/11, x64 | NSIS setup executable |
| macOS, Apple Silicon | ARM64 DMG |
| macOS, Intel | x64 DMG |
| Linux, x64 | AppImage |

Direct assets for this version:

- [Windows x64 installer](https://github.com/PeterAlaks/lyric-display-app/releases/download/v6.7.0/LyricDisplay-6.7.0-Windows-Setup.exe)
- [macOS Apple Silicon DMG](https://github.com/PeterAlaks/lyric-display-app/releases/download/v6.7.0/LyricDisplay-6.7.0-macOS-arm64.dmg)
- [macOS Intel DMG](https://github.com/PeterAlaks/lyric-display-app/releases/download/v6.7.0/LyricDisplay-6.7.0-macOS-x64.dmg)
- [Linux x64 AppImage](https://github.com/PeterAlaks/lyric-display-app/releases/download/v6.7.0/LyricDisplay-6.7.0-Linux.AppImage)

For a typical production workflow, 8 GB of RAM and a 1920×1080-capable display are a practical baseline. Multiple high-resolution video backgrounds, several browser sources, lyric video export, or NDI output benefit from more memory and GPU capacity. Wired Ethernet is strongly recommended when outputs or controllers run on other devices.

### Security and trust notes

Current release packages are distributed independently:

- Windows may show Microsoft Defender SmartScreen.
- macOS packages are not currently signed with an Apple Developer certificate and may be quarantined by Gatekeeper.
- Linux AppImages need executable permission before launch.

Only bypass a platform warning after confirming that the file came from `lyricdisplay.app` or `github.com/PeterAlaks/lyric-display-app` and that its name matches the selected release.

## Install on Windows

1. Download the Windows setup executable.
2. Open it.
3. If SmartScreen appears, select **More info**, verify the filename, then select **Run anyway**.
4. Complete the installer wizard and launch LyricDisplay from the Start menu or desktop shortcut.

The package requests normal user-level execution. Windows may still request approval when writing to the selected installation directory.

## Install on macOS

1. Download the DMG for Apple Silicon or Intel.
2. Open the DMG and drag `LyricDisplay.app` into **Applications**.
3. Try opening LyricDisplay from Applications.
4. If macOS reports that the app is damaged or cannot be verified, confirm the download source, open Terminal, and run:

```bash
xattr -cr /Applications/LyricDisplay.app
```

5. Open the app again. If necessary, Control-click or right-click it, select **Open**, then confirm.

The command removes the download quarantine attribute from this app. Repeat it after replacing LyricDisplay with a newly downloaded unsigned build if Gatekeeper quarantines the new copy.

## Install on Linux

1. Download the AppImage.
2. In a terminal, make it executable:

```bash
chmod +x LyricDisplay-*.AppImage
```

3. Run it:

```bash
./LyricDisplay-*.AppImage
```

Desktop integration varies by distribution. Keep the AppImage in a stable location before creating a launcher or menu entry.

## First Launch Checklist

1. Let LyricDisplay finish opening before adding browser sources; the local backend listens on port `4000`.
2. If the operating system asks about network access, allow private-network access only when using another computer, mobile controllers, or network integrations.
3. Load a lyric file or create a song.
4. Configure an output and open **Output > Preview Outputs**.
5. Enable **Display Output** and select a lyric line.
6. Before a live event, open **Tools > Production Readiness** and resolve any missing or stale output warnings.

LyricDisplay must remain running while browser sources, controllers, or NDI outputs are active.

## Browser Output URLs

Use these routes in software that accepts a web/browser source:

| View | Local URL | Notes |
| --- | --- | --- |
| Output 1 | `http://localhost:4000/#/output1` | Default lyric output |
| Output 2 | `http://localhost:4000/#/output2` | Default lyric output |
| Output 3–6 | `http://localhost:4000/#/output3` ... `output6` | Add the custom output in LyricDisplay first |
| Stage | `http://localhost:4000/#/stage` | Confidence/stage display |
| Timer | `http://localhost:4000/#/time` | Dedicated timer/clock display |

Replace `localhost` with the LyricDisplay computer's LAN address when the receiving software runs on another device. Output and Stage views support transparent production layouts; the Timer view is intended as a full display.

## OBS Studio

### Recommended: OBS Source Creator

LyricDisplay can create or update the Browser Source through OBS WebSocket:

1. In OBS, open **Tools > WebSocket Server Settings**.
2. Enable the WebSocket server. The default port is `4455`; copy the password if authentication is enabled.
3. In LyricDisplay, open **Output > OBS Source Creator**.
4. Enter the OBS host, port, and password, then connect.
5. Select the scene and LyricDisplay output.
6. Choose transparent or full-screen mode, confirm the dimensions/transform, and select **Create or Update OBS Source**.

For OBS on the same computer, use host `127.0.0.1`. For OBS on another computer, use that computer's LAN address and allow OBS WebSocket through its private-network firewall.

### Manual Browser Source

1. In OBS, select the target scene and add a **Browser** source.
2. Enter an output URL, for example:

```text
http://localhost:4000/#/output1
```

3. Match the width and height to the OBS canvas, commonly `1920 × 1080`.
4. Use `30` FPS for normal lyric output unless the production requires otherwise.
5. Place the source above the video layers that it should overlay.

If **Shutdown source when not visible** is enabled, OBS reconnects the source when it becomes visible again. LyricDisplay sends the current state after reconnection, but verify this transition before a live event.

## vMix, Wirecast, and Other Browser Inputs

Add a Web Browser/Web Page input and use one of the [browser output URLs](#browser-output-urls). Match the input dimensions to the production canvas and use the application's overlay/layer controls to position it.

The in-app **Help > Integration Guide** provides platform-specific OBS, vMix, and Wirecast instructions and shows a detected network address. vMix integration is shown on Windows; Wirecast integration is shown on Windows and macOS.

## Networked Outputs

Use this setup when LyricDisplay and the receiving browser, OBS, or vMix instance are on different computers.

1. Connect both devices to the same trusted local network. Prefer wired Ethernet.
2. In LyricDisplay, open **Help > Integration Guide** to see the detected LAN address, or check the network settings on the LyricDisplay computer.
3. From the receiving computer, test backend health in a browser:

```text
http://<LYRICDISPLAY-IP>:4000/api/health
```

4. Use that address in the output URL:

```text
http://<LYRICDISPLAY-IP>:4000/#/output1
```

5. If the address changes after a restart, reserve the address in the router's DHCP settings or ask the network administrator for a stable address. This is safer than guessing and manually assigning an address that may conflict with another device.

### Firewall guidance

- Allow LyricDisplay on **private/trusted networks** when prompted.
- On Windows, use **Windows Defender Firewall > Allow an app through firewall** and select the installed LyricDisplay executable.
- Do not enable public-network access unless the production network and exposure are understood.
- Port `4000` must be reachable from devices that load LyricDisplay browser views or controllers.
- Client isolation/guest Wi-Fi can prevent devices on the same network name from communicating.

Do not expose port `4000` directly to the public internet. Use LyricDisplay on a trusted LAN or through a deliberately secured network tunnel.

## LyricDisplay Dock for OBS

LyricDisplay Dock is a compact OBS Custom Browser Dock. Dock Mode keeps the backend/controller available without the full desktop window and is currently marked Beta.

### Packaged application

1. Open **Tools > LyricDisplay Dock Setup** in LyricDisplay.
2. Copy the exact **LyricDisplay Dock URL** shown by the app.
3. In OBS, open **Docks > Custom Browser Docks** and paste that URL into one dock entry.
4. If Dock Mode is not running, select **Switch to Dock** in LyricDisplay or use the Windows Start menu shortcut where available.
5. In the OBS dock, select **Open Controller** after the readiness message appears.
6. In **Preferences > Advanced**, enable **Start at Sign In** if Dock Mode should be available automatically after login.

Use the generated local file URL rather than typing an installation path; custom installation directories and non-Windows platforms can differ. Use the tray menu to return to the desktop application or quit Dock Mode.

### Development

1. Stop the normal Electron development session.
2. Run:

```bash
npm run electron-dev:headless
```

3. In OBS, open **Docks > Custom Browser Docks** and add the repository's `obs-dock.html` as a local file URL with `?mode=dev`, for example `file:///D:/path/to/lyric-display-app/obs-dock.html?mode=dev` on Windows.
4. Select **Open Controller** when the dock reports that the development Dock Mode is ready.

Do not run the normal and headless Electron development sessions at the same time; the single-instance/backend port protections will prevent a second runtime.

## NDI Output

NDI support uses a separately downloaded LyricDisplay companion rather than bundling it into the desktop installer.

1. In LyricDisplay, open **Output > NDI Preferences**.
2. Select **Download NDI Companion** and wait for download and extraction to complete.
3. Launch the companion, or enable **Start with LyricDisplay**.
4. Open the NDI settings for each output or Stage view that should broadcast.
5. Enable the output, choose a unique source name, resolution, and frame rate. `1080p` at `30 fps` is a sensible starting point for lyrics.
6. Select that source in the NDI receiver, such as an NDI-enabled OBS or vMix input.

The companion status should progress through Installed, Running, and Ready. Higher resolutions and frame rates require more CPU/GPU/network capacity. If no compatible companion asset is available for the current platform, the in-app download will report that condition.

NDI discovery normally expects devices to be on the same LAN. Firewall rules, VLAN boundaries, Wi-Fi client isolation, or blocked discovery traffic can prevent a receiver from seeing a source.

NDI is a trademark of Vizrt NDI AB. LyricDisplay is not affiliated with or endorsed by Vizrt NDI AB.

## Mobile and Web Controllers

1. Connect the phone/tablet and LyricDisplay computer to the same trusted local network.
2. In LyricDisplay, open **Tools > Connect Mobile Controller**.
3. Scan the QR code or open the displayed network URL.
4. Enter the six-digit join code.

The join code resets when LyricDisplay restarts. Controller permissions depend on the client role; remote lyric drafts still require desktop approval. If pairing fails, follow the [networked output](#networked-outputs) health and firewall checks first.

## Loading and Operating Lyrics

Supported lyric inputs:

| Format | Extension |
| --- | --- |
| Plain text | `.txt` |
| Timestamped LRC | `.lrc` |
| Markdown | `.md`, `.markdown` |
| Rich Text | `.rtf` |
| Word document | `.docx` |
| LyricDisplay setlist | `.ldset` |

Load a file with **File > Load Lyrics File**, `Ctrl/Cmd + O`, or drag and drop. Create a song with **File > New Lyrics File** or `Ctrl/Cmd + N`.

Lines wrapped in `[ ]`, `( )`, `< >`, or `{ }` can be recognized as translation/alternate lines and grouped with the preceding lyric line. Parsing, cleanup, capitalization, splitting, and grouping behavior can be adjusted in Preferences.

For live operation:

- Select a line to send it to connected outputs.
- Use Up/Down for lyric navigation and `Ctrl/Cmd + F` for search.
- Use **Display Output** or Spacebar to show/hide the master lyric output.
- Use **Output > Sync Outputs** when a connected display needs the full current state resent.
- Open **Help > Keyboard Shortcuts** for the current complete shortcut list.
- Save a `.ldset` when the running order and song collection should be reused.

## Troubleshooting

### LyricDisplay reports that port 4000 is in use

Only one LyricDisplay backend can use the default port. Close other desktop/headless LyricDisplay processes, then start the intended mode. Do not run a packaged instance and development instance simultaneously unless one is configured to use a different backend port.

### Browser source is black, blank, or unavailable

- Confirm LyricDisplay is running and fully initialized.
- Open the exact output URL in a normal browser on the receiving computer.
- Confirm **Display Output** is enabled and a lyric line is selected.
- For Output 3–6, add/register the custom output in the control panel first.
- Refresh the browser source and confirm its dimensions.
- For a remote receiver, test `/api/health` and review private-network firewall access.

### Lyrics or styles are not updating

- Check the connection/shield indicator in LyricDisplay.
- Use **Output > Sync Outputs**.
- Refresh or recreate the browser source if it no longer reconnects.
- Open **Tools > Connection Diagnostics** to inspect client and socket state.
- Confirm that the settings are being changed on the same output route used by the receiver.

### OBS Source Creator cannot connect

- In OBS, enable **Tools > WebSocket Server Settings**.
- Confirm the host, port (normally `4455`), and password.
- Use `127.0.0.1` only when OBS is on the same computer.
- For remote OBS, allow OBS WebSocket through its private-network firewall.

### Mobile controller cannot pair

- Confirm both devices are on the same trusted LAN and not a guest/client-isolated network.
- Verify `http://<LYRICDISPLAY-IP>:4000/api/health` loads on the mobile device.
- Request a fresh QR URL/join code after restarting LyricDisplay.
- Check the LyricDisplay computer's firewall access.

### NDI source is missing or stale

- Open **Output > NDI Preferences** and confirm Installed, Running, and Ready states.
- Confirm the intended output's NDI toggle is enabled and its source name is unique.
- Start with `1080p`/`30 fps` and reduce resolution/frame rate if telemetry reports dropped frames.
- Keep sender and receiver on the same LAN and check firewall/VLAN discovery restrictions.
- Update the companion from the NDI Preferences page when an update is offered.

### macOS blocks the app

Confirm the download source, then repeat the [`xattr` installation step](#install-on-macos). Replacing the app with a new unsigned download can reapply quarantine.

### Performance issues

- Close unused preview/projection windows and browser sources.
- Avoid unnecessary high-resolution video backgrounds.
- Use 30 FPS for lyric sources unless higher motion fidelity is needed.
- Reduce NDI resolution/frame rate and review its telemetry.
- Use **Tools > Production Readiness** before the event.

### Collect diagnostics

- Open **Tools > Connection Diagnostics** for realtime client state.
- Open **Tools > Production Readiness** for output, projection, and NDI health.
- Enable **Preferences > Advanced > Debug Logging** only while reproducing a problem; logs can grow faster in this mode.
- Include the LyricDisplay version, operating system, output route, and exact reproduction steps in a [GitHub issue](https://github.com/PeterAlaks/lyric-display-app/issues).

For update rehearsal, schema compatibility, and known-good rollback procedures, see [Release migration and recovery](docs/RELEASE_RECOVERY.md).

## Support and Resources

- [Project website](https://lyricdisplay.app)
- [GitHub releases](https://github.com/PeterAlaks/lyric-display-app/releases)
- [Issues and feature requests](https://github.com/PeterAlaks/lyric-display-app/issues)
- [Source and contribution guide](https://github.com/PeterAlaks/lyric-display-app)
- [Video tutorial](https://drive.google.com/file/d/1fP4fSSWSNvSocI8fK7hktdJ7dY6xnCM-/view?usp=sharing)

Developed by Peter Alakembi with contributions from David Okaliwe and the LyricDisplay community.
