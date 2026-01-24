##### **LyricDisplay - Installation and Integration Guide**

Professional real-time lyric display for streaming, church services and other live events

Version: 6.2.0 | Windows 10/11 (64-bit)


###### **What is LyricDisplay?**

LyricDisplay is a free desktop app that provides perfectly clear, sharp and transparent lyric overlays for OBS Studio, VMix or any broadcast/production software that accepts browser input sources.

**Ideal for:**

\- Church worship services
\- Live concerts \& events
\- Karaoke streaming
\- Multi-language presentations

**Key Features:**

\- TXT and LRC file upload and display system
\- Dual independent outputs with pure transparent background support
\- Real-time sync across displays
\- Quick lyric content create and edit with translation display support
\- Comprehensive lyric styling controls with 10 featured fonts
\- Keyboard-supported workflow
\- Secondary mobile/web controllers with join-code security
\- Auto-updates via GitHub releases
\- EasyWorship song import and conversion to txt file for easy use
\- Many more features


###### **System Requirements**

**Minimum:**

\- Windows 10/11 (64-bit)
\- 8 GB RAM
\- Dual-display capable GPU
\- 500 MB disk space

**Recommended:**

\- 16 GB RAM
\- Dedicated GPU
\- Dual monitors for control + preview


###### **Installation**

**1. Download Latest Release**

**Windows:**
&nbsp;  [​Click here to download for Windows​](https://github.com/PeterAlaks/lyric-display-app/releases/download/v6.2.0/LyricDisplay-6.2.0-Windows-Setup.exe)

**MacOS:**
&nbsp;  [​Click here to download for Apple Silicon (M1/M2/M3)​](https://github.com/PeterAlaks/lyric-display-app/releases/download/v6.2.0/LyricDisplay-6.2.0-macOS-arm64.dmg)
&nbsp;  [​Click here to download for Intel Mac​](https://github.com/PeterAlaks/lyric-display-app/releases/download/v6.2.0/LyricDisplay-6.2.0-macOS-x64.dmg)

**Linux:**
&nbsp;  [​Click here to download for Linux​](https://github.com/PeterAlaks/lyric-display-app/releases/download/v6.2.0/LyricDisplay-6.2.0-Linux.AppImage)

**2. Run Installer**

&nbsp;  - Right-click installer → Run as Administrator
&nbsp;  - If SmartScreen appears: More info → Run anyway
&nbsp;  - Follow wizard, accept defaults

&nbsp;  - Create desktop shortcut (recommended)

**3. Launch Application**

&nbsp;  - Open from desktop shortcut or Start menu

&nbsp;  - Control panel interface will appear


###### **OBS Studio Integration (For running LyricDisplay on same computer as OBS)**

**STEP 1: Add Browser Source**

1\. In your OBS scene, click \[+] in Sources panel
2\. Select "Browser Source"
3\. Name it "Lyrics - Output 1 or whichever you like"
4\. Click OK

**STEP 2: Configure Browser Source**

Enter these exact settings:

URL: http://localhost:4000/#/output1
Width: 1920
Height: 1080
FPS: 30
☑ Shutdown source when not visible
☑ Refresh browser when scene becomes active

Click OK to save.
*Note: Adjust width and height to directly match your broadcast resolution/canvas.*

**STEP 3: Configure LyricDisplay settings (there are default values anyway)**

1\. In LyricDisplay Settings Panel on the right side of the control panel, select "Output 1 from the tab switcher"
2\. Basic settings to start:
&nbsp;  - Position: Lower Third
&nbsp;  - Font: Montserrat or Open Sans
&nbsp;  - Font Size: 48-60 px
&nbsp;  - Font Color: #FFFFFF (white)
&nbsp;  - Drop Shadow: Opacity 5-7

**STEP 3: Test Connection**

1\. Load a test lyric file (.txt or .lrc) in LyricDisplay through the Load Lyrics button or by pressing Ctrl/Cmd + O on your keyboard.
2\. The app will display the lyric lines from the file on the control panel showing individual lines.
3\. Click on any lyric line to select
4\. Check OBS - lyrics should appear instantly for any line clicked.
5\. Toggle "Display Output" switch to hide/show lyrics.

**FOR A SECOND OUTPUT (OPTIONAL):**

Repeat steps above but use:

\- Source name: "Lyrics - Output 2"
\- URL: http://localhost:4000/#/output2


###### **Network Setup (For running LyricDisplay on a separate computer)**

Use this when running LyricDisplay on one computer and OBS on another.

**REQUIREMENTS:**

Both PCs must be on the same local network (LAN/Wi-Fi)
Ethernet connection is strongly recommended for better stability

**STEP 1: Identify Your Router’s Gateway (Important)**

Routers don’t always use the same address — some use 192.168.0.1, others 192.168.1.1, 192.168.8.1, etc. You need to confirm yours before setting a static IP.

To find it:
Press Win + R then type: cmd, and press Enter
Type: ipconfig
Look for the line labelled “Default Gateway” — this is your router’s IP (for example 192.168.0.1 or 192.168.1.1).
Use that exact address in the next step as your Default Gateway.

**STEP 2: Set a Static IP on the LyricDisplay Computer (Recommended)**

Press Win + R then type: ncpa.cpl, and press Enter
Right-click your active network adapter → Properties
Double-click “Internet Protocol Version 4 (TCP/IPv4)”
Select “Use the following IP address”
Enter the details (adjust to match your network):

*If your gateway is 192.168.1.1:*
**IP address: 192.168.1.100**
**Subnet mask: 255.255.255.0**
**Default gateway: 192.168.1.1**
**Preferred DNS: 8.8.8.8**

*If your gateway is 192.168.0.1:*
**IP address: 192.168.0.100**
**Subnet mask: 255.255.255.0**
**Default gateway: 192.168.0.1**
**Preferred DNS: 8.8.8.8**

The first three numbers of the IP address must always match your router’s gateway (e.g. 192.168.0 or 192.168.1). You can decide to change the number after those first three numbers to whichever you want from 100 - 199.

Click OK → OK → Close

**STEP 3: Verify the Static IP**

Press Win + R then type: cmd, and press Enter
Type: ipconfig
Confirm your static IP shows correctly under your active network adapter.

**STEP 4: Configure OBS Browser Source**

On the computer running OBS, use this URL in Browser Source:
http://192.168.1.100:4000/#/output1
*Replace 192.168.1.100 with the static IP you set in the previous step for the computer running LyricDisplay.*

**STEP 5: Test Connection**

On OBS computer:

1\. Open web browser
2\. Navigate to: http://192.168.1.100:4000
3\. It should load up a secondary version of the control panel asking you for a join code. That's how you know it has worked. You can close that tab because the main control is done from the desktop app.
4\. If error, check firewall settings below

*Replace 192.168.1.100 with the static IP you set.*
To connect a second output display (output2), simply change the URL to:

http://192.168.1.100:4000/#/output2

On the computer you're running your second instance of OBS or on the second browser source.
*Again, don't forget to replace 192.168.1.100 with the static IP you set for the computer running LyricDisplay.*

**FIREWALL FIX (If connection fails):**

On LyricDisplay computer:

1\. Search for "Windows Defender Firewall"
2\. Click "Allow an app through firewall"
3\. Click "Change settings" → "Allow another app"
4\. Browse to: C:\\Program Files\\LyricDisplay\\LyricDisplay.exe
5\. Check both "Private" and "Public"
6\. Click OK


###### **Secondary Controllers (Optional Mobile/Web Controllers)**

1\. In LyricDisplay go to File > Connect Mobile Controller to show the QR code and current 6-digit join code. The code resets when the app restarts.
2\. On the secondary device (connected on the same network), scan the QR code or visit: 
http://192.168.0.100:4000/
*Replace 192.168.0.100 with the static IP you set for the computer running LyricDisplay*
3\. The control panel should load up with a prompt to enter the join code. You can also find the join code from the desktop app by clicking on the shield icon on the left top bar.
4\. After pairing, you can now access the control panel and trigger lyric lines, load files added to setlist, toggle the display, run manual sync, and send lyric drafts for approval on the desktop.


###### **Loading Lyrics**

**METHOD 1: Load File**

\- Click on Load Lyrics File Button
\- Alternatively, go to File in top menu → Load Lyrics File (Ctrl/Cmd + O)
\- Browse and select a .txt or .lrc file
\- Click Open

**METHOD 2: Drag \& Drop**

\- Drag .txt or .lrc file from the File Explorer
\- Drop into LyricDisplay app

**METHOD 3: Create New Lyrics File**

\- Click on the button beside Load Lyrics File button
\- Alternatively, go to File in top menu → New Lyrics File (Ctrl/Cmd + N)
\- Type or paste in your lyrics
\- Ctrl/Cmd + T to add a translation line underneath a line
\- Enter a title for your lyrics
\- Click 'Save" to save your lyrics file as .txt document or click "Save and Load" to save the file and automatically load into the app.

**LYRIC FILE FORMAT:**

First verse line
(Translation in brackets)

Second line

Another line

*Lines in brackets \[], (), <> or {} are treated as translations.*


###### **Live Operation**

\- Click any line to display on both outputs instantly
\- Use search bar to search through loaded lyrics quickly
\- Navigate search with Shift + Up/Down arrows
\- Toggle "Display Output" switch to show/hide lyrics displayed on outputs
\- Click "Sync Outputs" to manually force refresh if changes don't appear immediately


###### **Troubleshooting**

**PROBLEM: Browser Source is Black/Empty**

Solutions:
→ Confirm LyricDisplay is running
→ Verify URL of browser source is set to exactly: http://localhost:4000/#/output1 or /output2
→ Click on the browser source from your sources tab on OBS then click on Refresh on the properties pane
→ Restart both LyricDisplay and OBS
→ Check Windows Firewall isn't blocking port 4000

**PROBLEM: Network Connection Not Working**

Solutions:
→ Verify both PCs on same network
→ Confirm that URL of browser source is http://static-ip-configured:4000/#/output1 or /output2
→ Temporarily disable firewall to test
→ Confirm that you used http:// not https:// in URL
→ Check router isn't blocking local traffic

**PROBLEM: Lyrics Not Updating in Real-Time**

Solutions:
→ Click "Sync Outputs" in LyricDisplay settings
→ Refresh browser source in OBS
→ Check socket connection (Shield icon in desktop control panel must be green)
→ Restart LyricDisplay

**PROBLEM: OBS Performance Issues**

Solutions:
→ Enable "Shutdown source when not visible"
→ Close unused preview windows in LyricDisplay
→ Check CPU usage
→ Move LyricDisplay to dedicated PC

**PROBLEM: Styling Changes Not Applying**

Solutions:
→ Use "Sync Outputs" button in settings
→ Refresh browser source in OBS
→ Check browser console (F12) for errors


###### **Keyboard Shortcuts**

Ctrl/Cmd + O - Load lyrics file
Ctrl/Cmd + N - New song canvas
Ctrl/Cmd + P - Toggle autoplay
Ctrl/Cmd + 1 - Preview Output 1
Ctrl/Cmd + 2 - Preview Output 2
↑ Arrow / Numpad ↑ - Navigate to previous lyric line
↓ Arrow / Numpad ↓ - Navigate to next lyric line
Spacebar - Toggle output display on/off
Ctrl/Cmd + F - Jump to search lyrics from lyrics list
Ctrl/Cmd + T - Add translation line (in editor)
Ctrl/Cmd + D - Duplicate line (in editor)
Ctrl/Cmd + L - Select line (in editor)
Shift + ↑/↓ - Navigate through search results


###### **OBS Tips and Tricks**

**1. POSITIONING**

&nbsp;  LyricDisplay handles positioning internally via settings panel.
&nbsp;  No need to transform in OBS unless you have specific needs.

**2. LAYERING**

&nbsp;  Place browser source above your main video/camera layers.
&nbsp;  Transparency automatically works.

**3. SCENE TRANSITIONS**

&nbsp;  Use OBS scene transitions normally.
&nbsp;  Enable "Shutdown source when not visible" for better performance.

**4. MULTIPLE OUTPUTS**

&nbsp;  Use Output 1 for main broadcast/stream
&nbsp;  Use Output 2 for alternate or in-house display
&nbsp;  Both can run simultaneously with different stylings

**5. BACKUP/RECOMMENDED STRATEGY**

&nbsp;  Keep a dedicated lyrics folder on your LyricDisplay system for easy access to .txt and .lrc lyric files
&nbsp;  Test connection before going live

**6. PERFORMANCE**

&nbsp;  Browser sources use CPU - monitor usage
&nbsp;  Consider dedicated GPU for encoding
&nbsp;  Close preview windows when not needed


###### **Vmix Integration**

Generally, follow same steps from OBS Integration but tailor the app setup to Vmix

1\. Add Input → Web Browser
2\. URL: http://localhost:4000/#/output1 or /output2
3\. URL for network setup: http://192.168.0.100:4000/#/output1 or /output2
*Make sure the IP address matches the configured static IP address of the system*
4\. Width: 1920, Height: 1080 (or your exact broadcast resolution)
5\. Drag to Overlay channel (1-4)
6\. Transparent background works automatically


###### **Video Tutorial**

[Click here to watch quick setup and usage guide](https://drive.google.com/file/d/1fP4fSSWSNvSocI8fK7hktdJ7dY6xnCM-/view?usp=sharing)


###### **Support and Resources**

[Visit our website​​​](https://lyricdisplay.app)
[​Click here to log issues or complaints​​​](https://github.com/PeterAlaks/lyric-display-app/issues)
​[Click here to contact the developer for technical support or lodge further complaints/improvement suggestions](https://linktr.ee/peteralaks)
[​Click here to see app source code​​​](https://github.com/PeterAlaks/lyric-display-app)


Developed by Peter Alakembi \& David Okaliwe
© 2025 All Rights Reserved


LyricDisplay - Powering worship experiences worldwide