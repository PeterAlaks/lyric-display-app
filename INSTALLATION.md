# LyricDisplay Installation and Integration Guide

Professional real-time lyric display for streaming, church services, worship services, and live events.

Version: 6.6.2

## What Is LyricDisplay?

LyricDisplay is a free desktop app for clear, sharp lyric overlays and full-screen lyric displays. It is designed for OBS Studio, vMix, NDI workflows, projectors, stage displays, and other production software that accepts browser sources.

Best fit:

- Church worship services
- Live concerts and events
- Livestream lyric overlays
- Karaoke and sing-along streams
- Multi-language lyric presentations

Key features:

- TXT and LRC lyric file support
- Multiple independent outputs, including Output 1, Output 2, Stage, and optional Output 3-6
- Transparent browser-source friendly lyric overlays
- Real-time sync across displays
- Built-in lyric creation and editing
- Translation line support
- Per-output styling controls
- Keyboard-supported operation
- Secondary mobile/web controllers with join-code security
- Auto-updates through GitHub releases
- EasyWorship song import and conversion to text files

## Download

Download LyricDisplay only from the official website or GitHub releases:

- Website: https://lyricdisplay.app
- GitHub releases: https://github.com/PeterAlaks/lyric-display-app/releases/latest
- Source code: https://github.com/PeterAlaks/lyric-display-app

Direct downloads for version 6.6.0:

- Windows: https://github.com/PeterAlaks/lyric-display-app/releases/download/v6.6.2/LyricDisplay-6.6.2-Windows-Setup.exe
- macOS Apple Silicon: https://github.com/PeterAlaks/lyric-display-app/releases/download/v6.6.2/LyricDisplay-6.6.2-macOS-arm64.dmg
- macOS Intel: https://github.com/PeterAlaks/lyric-display-app/releases/download/v6.6.2/LyricDisplay-6.6.2-macOS-x64.dmg
- Linux: https://github.com/PeterAlaks/lyric-display-app/releases/download/v6.6.2/LyricDisplay-6.6.2-Linux.AppImage

## Security and Trust Notes

LyricDisplay is open source and its release files are hosted on GitHub. The app is free to download and does not require an account.

Current signing status:

- Windows builds may show a Microsoft Defender SmartScreen warning because the app is distributed independently.
- macOS builds are not currently signed with an Apple Developer certificate. macOS may show an "unidentified developer", "can't be verified", or "damaged" warning.
- Linux AppImage builds may need executable permission before launch.

These warnings are expected for the current release channel. To reduce risk:

- Download only from `lyricdisplay.app` or `github.com/PeterAlaks/lyric-display-app`.
- Avoid installers shared through messaging apps, mirrors, or shortened links.
- Check that the version number in the downloaded filename matches the release page.
- If your browser or operating system reports a different publisher, filename, or source than expected, delete the file and download again from GitHub.

## System Requirements

Minimum:

- Windows 10/11 64-bit, macOS 11 or newer, or a modern 64-bit Linux distribution
- 8 GB RAM
- Dual-display capable GPU
- 500 MB free disk space

Recommended:

- 16 GB RAM
- Dedicated GPU
- Dual monitors for control and preview
- Wired Ethernet for networked OBS, vMix, NDI, or controller workflows

## Install on Windows

1. Download the Windows installer from the official release page.
2. Open the installer.
3. If Microsoft Defender SmartScreen appears, choose `More info`, then `Run anyway`.
4. Follow the installer wizard.
5. Keep the desktop shortcut option enabled if you want quick access.
6. Launch LyricDisplay from the desktop shortcut or Start menu.

Administrator access is usually only needed if Windows asks for permission during installation.

## Install on macOS

1. Download the correct `.dmg` file for your Mac:
   - Apple Silicon for M1, M2, M3, or newer Apple chips.
   - Intel for older Intel-based Macs.
2. Open the `.dmg` file.
3. Drag `LyricDisplay.app` into the Applications folder.
4. Before opening the app for the first time, open Terminal and run:

```bash
xattr -cr /Applications/LyricDisplay.app
```

5. Open LyricDisplay from Applications.
6. If macOS still shows a warning, right-click `LyricDisplay.app`, choose `Open`, then confirm `Open`.

Why this is needed: LyricDisplay is not currently code-signed with an Apple Developer certificate, so macOS Gatekeeper blocks or quarantines the app by default. The command above removes the download quarantine flag for this app.

You only need to do this once after installing or replacing the app.

## Install on Linux

1. Download the Linux AppImage from the official release page.
2. Open a terminal in the download folder.
3. Make the file executable:

```bash
chmod +x LyricDisplay-*.AppImage
```

4. Run the app:

```bash
./LyricDisplay-*.AppImage
```

## First Launch

When LyricDisplay opens, the control panel appears. From there you can load lyrics, create lyrics, configure outputs, open preview windows, and connect secondary controllers.

If Windows Firewall asks for network access, allow LyricDisplay on private networks when you plan to use OBS/vMix on another computer, mobile controllers, NDI, or browser outputs from another device.

## OBS Studio Setup

Use this when LyricDisplay and OBS are running on the same computer.

### 1. Add a Browser Source

1. In OBS, open your scene.
2. Click `+` in the Sources panel.
3. Select `Browser`.
4. Name it `Lyrics - Output 1`.
5. Click `OK`.

### 2. Configure the Browser Source

Use these settings:

```text
URL: http://localhost:4000/#/output1
Width: 1920
Height: 1080
FPS: 30
```

Recommended OBS options:

- Enable `Shutdown source when not visible`.
- Enable `Refresh browser when scene becomes active`.
- Match width and height to your OBS canvas.

### 3. Configure LyricDisplay

1. In LyricDisplay, open the Output 1 settings tab.
2. Start with these settings:
   - Position: Lower Third
   - Font: Montserrat or Open Sans
   - Font Size: 48-60 px
   - Font Color: `#FFFFFF`
   - Drop Shadow: 5-7 opacity
3. Load a supported lyric file (`.txt`, `.lrc`, `.md`, `.markdown`, `.rtf`, or `.docx`).
4. Click a lyric line.
5. Confirm the lyric appears in OBS.

### Additional Outputs

Use these URLs for additional browser sources:

```text
http://localhost:4000/#/output2
http://localhost:4000/#/output3
http://localhost:4000/#/output4
http://localhost:4000/#/output5
http://localhost:4000/#/output6
http://localhost:4000/#/stage
```

## vMix Setup

1. In vMix, add a `Web Browser` input.
2. Use the output URL you need:

```text
http://localhost:4000/#/output1
```

3. Set the browser input size to match your production canvas.
4. Use vMix overlay channels as needed.

For networked setup, replace `localhost` with the IP address of the computer running LyricDisplay.

## Network Setup for OBS or vMix on Another Computer

Use this when LyricDisplay runs on one computer and OBS/vMix runs on another.

Requirements:

- Both computers must be on the same local network.
- Wired Ethernet is recommended.
- LyricDisplay must be allowed through the firewall on the control computer.

### 1. Find Your Router Gateway

On Windows:

1. Press `Win + R`.
2. Type `cmd` and press Enter.
3. Run:

```cmd
ipconfig
```

4. Find `Default Gateway`. Common examples are `192.168.0.1`, `192.168.1.1`, or `192.168.8.1`.

### 2. Set a Static IP on the LyricDisplay Computer

On Windows:

1. Press `Win + R`.
2. Type `ncpa.cpl` and press Enter.
3. Right-click your active network adapter.
4. Select `Properties`.
5. Double-click `Internet Protocol Version 4 (TCP/IPv4)`.
6. Select `Use the following IP address`.
7. Enter settings that match your network.

Example for a `192.168.1.1` gateway:

```text
IP address: 192.168.1.100
Subnet mask: 255.255.255.0
Default gateway: 192.168.1.1
Preferred DNS: 8.8.8.8
```

Example for a `192.168.0.1` gateway:

```text
IP address: 192.168.0.100
Subnet mask: 255.255.255.0
Default gateway: 192.168.0.1
Preferred DNS: 8.8.8.8
```

The first three numbers of the IP address should match your router gateway.

### 3. Test the Connection

On the OBS/vMix computer, open a browser and visit:

```text
http://192.168.1.100:4000
```

Replace `192.168.1.100` with the IP address of the LyricDisplay computer.

If the page loads and asks for a join code, the network connection is working.

### 4. Use Network Output URLs

In OBS or vMix, use URLs like:

```text
http://192.168.1.100:4000/#/output1
http://192.168.1.100:4000/#/output2
http://192.168.1.100:4000/#/stage
```

Replace `192.168.1.100` with your actual LyricDisplay computer IP address.

## Windows Firewall Fix

If network browser sources or mobile controllers cannot connect:

1. Open `Windows Defender Firewall`.
2. Click `Allow an app through firewall`.
3. Click `Change settings`.
4. Click `Allow another app`.
5. Browse to:

```text
C:\Program Files\LyricDisplay\LyricDisplay.exe
```

6. Check `Private`.
7. Check `Public` only if you understand the network you are using.
8. Click `OK`.

## Secondary Mobile or Web Controllers

1. In LyricDisplay, open `File > Connect Mobile Controller`, or click the shield icon.
2. Scan the QR code from a phone or tablet on the same local network.
3. Enter the 6-digit join code.
4. After pairing, the controller can trigger lyric lines, load setlist items, toggle outputs, sync state, or submit lyric drafts for approval on the desktop.

The join code resets when the app restarts.

## Loading Lyrics

### Load an Existing File

1. Click `Load Lyrics File`, or use `File > Load Lyrics File`.
2. Select a supported lyric file (`.txt`, `.lrc`, `.md`, `.markdown`, `.rtf`, or `.docx`).
3. Click `Open`.

Shortcut: `Ctrl/Cmd + O`

### Drag and Drop

Drag a lyric file (`.txt`, `.lrc`, `.md`, `.markdown`, `.rtf`, `.docx`) or `.ldset` file into the LyricDisplay control panel.

### Create a New Lyrics File

1. Click the new song button beside `Load Lyrics File`, or use `File > New Lyrics File`.
2. Type or paste lyrics.
3. Use `Ctrl/Cmd + T` to add a translation line under a lyric line.
4. Enter a song title.
5. Click `Save` or `Save and Load`.

Shortcut: `Ctrl/Cmd + N`

## Lyric File Format

LyricDisplay accepts plain text and LRC files.

Example:

```text
First verse line
(Translation in brackets)

Second line

Another line
```

Lines wrapped in `[ ]`, `( )`, `< >`, or `{ }` are treated as translation lines.

## Live Operation

- Click any lyric line to display it on enabled outputs.
- Use the search bar to find lines quickly.
- Use `Shift + Up/Down` to move through search results.
- Toggle `Display Output` to show or hide lyrics.
- Use `Sync Outputs` if a browser source or output window needs a manual refresh.

## Keyboard Shortcuts

```text
Ctrl/Cmd + O       Load lyrics file
Ctrl/Cmd + N       New song canvas
Ctrl/Cmd + P       Toggle autoplay
Ctrl/Cmd + 1       Preview Output 1
Ctrl/Cmd + 2       Preview Output 2
Up                 Previous lyric line
Down               Next lyric line
Spacebar           Toggle output display on/off
Ctrl/Cmd + F       Search lyrics
Ctrl/Cmd + T       Add translation line in editor
Ctrl/Cmd + D       Duplicate line in editor
Ctrl/Cmd + L       Select line in editor
Shift + Up/Down    Navigate search results
```

## Troubleshooting

### Browser Source Is Black or Empty

- Confirm LyricDisplay is running.
- Confirm the browser source URL is correct.
- Refresh the OBS/vMix browser source.
- Restart LyricDisplay and OBS/vMix.
- Check Windows Firewall if using another computer.

### Network Connection Is Not Working

- Confirm both computers are on the same network.
- Confirm the URL uses `http://`, not `https://`.
- Confirm the IP address belongs to the LyricDisplay computer.
- Temporarily test with firewall disabled, then add a proper firewall exception.
- Check whether the router blocks local device-to-device traffic.

### Lyrics Are Not Updating in Real Time

- Click `Sync Outputs` in LyricDisplay.
- Refresh the browser source.
- Confirm the shield/connection indicator is healthy.
- Restart LyricDisplay if the socket connection does not recover.

### OBS Performance Issues

- Enable `Shutdown source when not visible`.
- Close unused preview windows.
- Monitor CPU and GPU usage.
- Use a dedicated computer for LyricDisplay when running complex livestream setups.

### Styling Changes Are Not Applying

- Click `Sync Outputs`.
- Refresh the browser source.
- Confirm you are editing the correct output tab.
- Check browser source dimensions match your canvas.

### macOS Says the App Is Damaged or Cannot Be Verified

This is expected for unsigned builds.

Run:

```bash
xattr -cr /Applications/LyricDisplay.app
```

Then open the app again. If needed, right-click the app, choose `Open`, then confirm.

## OBS Tips

- Place the LyricDisplay browser source above your camera/video layers.
- Use transparent output styles for lower-third lyrics.
- Use Output 1 for broadcast and Output 2 for in-house display.
- Use Stage for confidence monitors.
- Keep a dedicated lyrics folder for quick access during services.
- Test outputs before going live.

## Video Tutorial

Quick setup and usage guide:

https://drive.google.com/file/d/1fP4fSSWSNvSocI8fK7hktdJ7dY6xnCM-/view?usp=sharing

## Support and Resources

- Website: https://lyricdisplay.app
- Issues: https://github.com/PeterAlaks/lyric-display-app/issues
- Source code: https://github.com/PeterAlaks/lyric-display-app
- Contact: https://linktr.ee/peteralaks

Developed by Peter Alakembi and David Okaliwe.

Copyright (C) 2026 Peter Alakembi and contributors.
