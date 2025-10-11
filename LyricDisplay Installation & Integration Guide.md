# LyricDisplay Installation & Integration Guide

> Complete setup instructions for Windows, OBS Studio, and VMix integration

**Version:** 2.1.1  
**Last Updated:** October 2025

---

## Table of Contents

1. [System Requirements](#system-requirements)
2. [Installing LyricDisplay](#installing-lyricdisplay)
3. [First Launch Setup](#first-launch-setup)
4. [OBS Studio Integration](#obs-studio-integration)
5. [VMix Integration](#vmix-integration)
6. [Network Setup (Multi-PC)](#network-setup-multi-pc)
7. [Loading and Managing Lyrics](#loading-and-managing-lyrics)
8. [Troubleshooting](#troubleshooting)

---

## System Requirements

### Minimum Requirements
- **Operating System:** Windows 10/11 (64-bit)
- **RAM:** 8 GB
- **Processor:** Intel Core i5 or equivalent
- **Graphics:** Dual-display capable GPU
- **Network:** Ethernet/Wi-Fi for multi-PC setups
- **Disk Space:** 500 MB free space

### Recommended Setup
- **RAM:** 16 GB or higher
- **Processor:** Intel Core i7 or AMD Ryzen 7
- **Network:** Gigabit Ethernet for network streaming
- **Display:** Dual monitor setup for control panel + preview

---

## Installing LyricDisplay

### Step 1: Download the Installer

1. Visit the official releases page:  
   **[https://github.com/PeterAlaks/lyric-display-updates/releases/latest](https://github.com/PeterAlaks/lyric-display-updates/releases/latest)**

2. Under **Assets**, download the Windows installer:
   - File name: `LyricDisplay-Setup-2.1.1.exe` (or latest version)
   - File size: ~150-200 MB

### Step 2: Run the Installer

1. **Locate the downloaded file** in your Downloads folder
2. **Right-click** the installer → **Run as Administrator**
3. If Windows SmartScreen appears, click **More info** → **Run anyway**
4. Follow the installation wizard:
   - Accept the license agreement
   - Choose installation location (default: `C:\Program Files\LyricDisplay`)
   - Select **Create desktop shortcut** (recommended)
   - Click **Install**

### Step 3: Complete Installation

1. Wait for the installation to complete (30-60 seconds)
2. Click **Finish** to exit the installer
3. **Launch LyricDisplay** from the desktop shortcut or Start menu

> **Note:** Your existing settings are preserved when updating to a newer version.

---

## First Launch Setup

### Initial Configuration

When you first launch LyricDisplay, you'll see the **Control Panel** interface:

1. **Main Lyric Panel** (right) - Your lyrics will appear here
2. **Settings Panel** (left) - Configure Output 1 and Output 2
3. **Menu Bar** (top) - File operations and shortcuts

### Configure Your First Output

1. In the **Settings Panel**, click **Output 1**
2. Adjust these basic settings:
   - **Font Style:** Choose a readable font (e.g., "Montserrat" or "Open Sans")
   - **Font Size:** Start with 48-60 px
   - **Font Color:** White (#FFFFFF) for dark backgrounds
   - **Drop Shadow:** Enable with 5-7 opacity for better readability
   - **Lyrics Position:** Lower Third (most common for live streams)

3. Click **Preview Output 1** to see your settings in a window

> **Pro Tip:** Keep Output 1 for your main broadcast and Output 2 for in-house displays or alternate languages.

---

## OBS Studio Integration

### Single Computer Setup (Recommended for Beginners)

This setup runs LyricDisplay and OBS on the same computer.

#### Step 1: Add Browser Source

1. In OBS, go to your scene
2. Click the **+** button in Sources panel
3. Select **Browser**
4. Name it "Lyrics - Output 1"
5. Click **OK**

#### Step 2: Configure Browser Source

Enter these settings in the Browser Source properties:

| Setting | Value |
|---------|-------|
| **URL** | `http://localhost:4000/#/output1` |
| **Width** | `1920` (match your canvas width) |
| **Height** | `1080` (match your canvas height) |
| **FPS** | `30` |
| **Shutdown source when not visible** | ✅ Checked (improves performance) |
| **Refresh browser when scene becomes active** | ✅ Checked (ensures reliability) |

Click **OK** to save.

#### Step 3: Test the Connection

1. In LyricDisplay, load a test lyric file
2. Click any lyric line
3. Switch to OBS - you should see the lyrics appear
4. Toggle the **Display Output** switch in LyricDisplay to hide/show lyrics

#### Adding Output 2 (Optional)

Repeat Steps 1-3, but use:
- Source name: "Lyrics - Output 2"
- URL: `http://localhost:4000/#/output2`

### Advanced: Positioning and Styling in OBS

1. **Right-click** the browser source in your scene
2. Select **Transform** → **Edit Transform**
3. Adjust position if needed (though LyricDisplay handles positioning internally)
4. Use **Filters** to add:
   - **Color Correction** for fine-tuning
   - **Sharpen** for crisp text on scaled outputs

---

## VMix Integration

### Adding LyricDisplay as Web Browser Input

#### Step 1: Add Input

1. Click **Add Input** in VMix
2. Select **Web Browser**
3. Enter these settings:

| Setting | Value |
|---------|-------|
| **URL** | `http://localhost:4000/#/output1` |
| **Width** | `1920` |
| **Height** | `1080` |
| **Frame Rate** | `30` |

4. Click **OK**

#### Step 2: Position as Overlay

1. Drag the Web Browser input to an **Overlay** channel (1-4)
2. This makes the transparent background work correctly
3. Lyrics will appear over your main video

#### Step 3: Test and Adjust

1. Load lyrics in LyricDisplay
2. Select a line to display
3. Check VMix preview - lyrics should overlay cleanly
4. Adjust opacity in LyricDisplay settings if needed

> **VMix Pro Tip:** Use different overlay channels for Output 1 and Output 2 to quickly switch between language displays.

---

## Network Setup (Multi-PC)

Use this setup when running LyricDisplay on one computer and OBS/VMix on another.

### Prerequisites

- Both computers on the **same network** (LAN or Wi-Fi)
- Ethernet cable connection recommended for stability
- Administrator access to configure IP settings

### Step 1: Assign Static IP to LyricDisplay Computer

#### On Windows:

1. Press **Win + R**, type `ncpa.cpl`, press **Enter**
2. **Right-click** your active network adapter → **Properties**
3. Double-click **Internet Protocol Version 4 (TCP/IPv4)**
4. Select **Use the following IP address**
5. Enter these values (adjust to your network):

   ```
   IP address: 192.168.1.100
   Subnet mask: 255.255.255.0
   Default gateway: 192.168.1.1
   Preferred DNS: 8.8.8.8
   ```

6. Click **OK** → **OK** → **Close**

> **Important:** Choose an IP address that's not used by other devices. Check your router's DHCP range to avoid conflicts (typically 192.168.1.100-200 is safe).

### Step 2: Verify Connection

On the **LyricDisplay computer**, press **Win + R**, type `cmd`, press **Enter**, then run:

```cmd
ipconfig
```

Confirm your static IP appears under your network adapter.

### Step 3: Configure OBS/VMix on Second Computer

#### For OBS:

In Browser Source properties, change the URL:

```
http://192.168.1.100:4000/#/output1
```

Replace `192.168.1.100` with your LyricDisplay computer's static IP.

#### For VMix:

In Web Browser input, use the same URL format:

```
http://192.168.1.100:4000/#/output2
```

### Step 4: Test Network Connection

1. On the OBS/VMix computer, open a web browser
2. Navigate to `http://192.168.1.100:4000`
3. You should see a connection or the LyricDisplay interface
4. If you get an error, check:
   - Both computers are on the same network
   - Windows Firewall isn't blocking port 4000
   - LyricDisplay is running on the first computer

### Firewall Configuration (If Needed)

If the connection fails, allow LyricDisplay through Windows Firewall:

1. On the **LyricDisplay computer**:
2. Search for **Windows Defender Firewall**
3. Click **Allow an app through firewall**
4. Click **Change settings** → **Allow another app**
5. Browse to `C:\Program Files\LyricDisplay\LyricDisplay.exe`
6. Ensure both **Private** and **Public** are checked
7. Click **OK**

---

## Loading and Managing Lyrics

### Method 1: Load Existing File

1. Click **File** → **Load Lyrics File** (or press `Ctrl+O`)
2. Browse to your `.txt` or `.lrc` file
3. Select the file and click **Open**
4. Lyrics appear in the control panel

### Method 2: Drag and Drop

1. Open File Explorer with your lyrics folder
2. Drag a `.txt` file into the LyricDisplay main panel
3. Release to load instantly

### Method 3: Create New Song

1. Click **File** → **New Song** (or press `Ctrl+N`)
2. The **New Song Canvas** opens
3. Type or paste your lyrics
4. Use formatting tools:
   - `Ctrl+T` - Add translation line
   - `Ctrl+D` - Duplicate current line
   - `Ctrl+L` - Select current line
5. Click **Save and Load** when finished

### Lyric File Format

LyricDisplay accepts plain text with optional translations:

```
First verse line
[Translation or alternative text]

Second verse line
Another line without translation

Chorus line one
[Chorus translation]
```

**Formatting Tips:**
- Lines in brackets `[like this]`, `(this)`, or `{this}` are translations
- Blank lines separate sections
- Auto-cleanup removes periods and capitalizes key words

### Operating Live

1. **Click any line** to display it instantly on active outputs
2. **Use the search bar** to find specific lyrics quickly
3. **Navigate** search results with `Shift+Up` and `Shift+Down`
4. **Toggle Display Output** switch to show/hide all lyrics

---

## Troubleshooting

### LyricDisplay Won't Launch

**Issue:** Application doesn't open after installation

**Solutions:**
- Right-click → Run as Administrator
- Check Windows Event Viewer for error details
- Reinstall the application
- Ensure .NET Framework 4.8+ is installed

### OBS/VMix Browser Source Shows Nothing

**Issue:** Browser source is black or shows "Unable to connect"

**Solutions:**
- Confirm LyricDisplay is running
- Check the URL is exactly `http://localhost:4000/#/output1`
- Refresh the browser source (right-click → Refresh)
- Restart both LyricDisplay and OBS/VMix
- Check Windows Firewall settings

### Network Setup Not Working

**Issue:** Can't connect from second computer

**Solutions:**
- Verify both computers are on same network
- Ping the LyricDisplay computer: `ping 192.168.1.100`
- Disable Windows Firewall temporarily to test
- Check router settings aren't blocking local traffic
- Use `http://` not `https://` in the URL

### Lyrics Not Updating in Real-Time

**Issue:** Changes in LyricDisplay don't appear in OBS/VMix

**Solutions:**
- Click **Sync Outputs** button in LyricDisplay settings
- Refresh the browser source in OBS/VMix
- Check Socket.io connection status (green indicator)
- Restart the backend server via LyricDisplay menu

### Styling Changes Not Applying

**Issue:** Font color or size changes don't show

**Solutions:**
- Use the **Sync Outputs** control in settings panel
- Refresh browser source in your streaming software
- Check browser console (F12) for JavaScript errors
- Clear browser cache in OBS/VMix settings

### Performance Issues

**Issue:** Lag or stuttering in lyrics display

**Solutions:**
- Enable "Shutdown source when not visible" in OBS
- Lower browser source FPS to 30
- Close unused output preview windows
- Check CPU usage - move to dedicated PC if needed
- Use hardware acceleration in streaming software

### Auto-Updates Not Working

**Issue:** "No updates available" when newer version exists

**Solutions:**
- Check internet connection
- Verify GitHub releases page is accessible
- Run as Administrator to allow update download
- Check Windows Defender isn't blocking downloads
- Manually download and install latest version

---

## Quick Reference: Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+O` | Load lyrics file |
| `Ctrl+N` | New song canvas |
| `Ctrl+T` | Add translation line (in editor) |
| `Ctrl+D` | Duplicate line (in editor) |
| `Ctrl+L` | Select line (in editor) |
| `Ctrl+1` | Preview Output 1 |
| `Ctrl+2` | Preview Output 2 |
| `Shift+↑/↓` | Navigate search results |

---

## Support & Resources

- **Latest Release:** [GitHub Releases](https://github.com/PeterAlaks/lyric-display-updates/releases/latest)
- **Video Tutorial:** [Watch on Google Drive](https://drive.google.com/file/d/1fP4fSSWSNvSocI8fK7hktdJ7dY6xnCM-/view?usp=sharing)
- **Developer Contact:** [linktr.ee/peteralaks](https://linktr.ee/peteralaks)
- **Issue Tracker:** [GitHub Issues](https://github.com/PeterAlaks/lyric-display-updates/issues)

---

**Developed by Peter Alakembi & David Okaliwe**  
*LyricDisplay - Powering worship experiences worldwide*

© 2025 All Rights Reserved