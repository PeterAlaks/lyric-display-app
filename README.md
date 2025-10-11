# LyricDisplay

> Professional real-time lyric display application for live events, church services, and multimedia presentations.

**Author:** Peter Alakembi
**Co-Contributor:** David Okaliwe

## Overview

LyricDisplay is a comprehensive Electron-based application designed for use in professional live production environments alongside streaming/recording software. It provides real-time lyric synchronization across multiple transparent output displays, making it ideal for church services, concerts, and live streaming setups where lyrics need to be displayed both in-house and for broadcast.

## Key Features

### Multi-Output Display System
- **Dual Independent Outputs**: Two separate output pages with individual styling controls
- **Transparent Backgrounds**: Perfect for OBS/VMIX browser source capture
- **Real-time Synchronization**: Instant updates across all connected displays
- **Browser Source Compatible**: Works seamlessly with popular streaming software

### Advanced Lyric Management
- **Smart Text Processing**: Automatic formatting for cleaning up lyric files
- **Translation Support**: Displays translation lines where available (lines wrapped in brackets below main lyric line) 
- **Live Editing Canvas**: Built-in editor with formatting tools and auto-cleanup
- **Search & Navigation**: Advanced search with match highlighting and keyboard navigation

### Comprehensive Styling Engine
- **13 Professional Fonts**: 13 pro fonts from Google Fonts
- **Typography Controls**: Bold, italic, underline, and all-caps options
- **Color Customization**: Independent font and drop shadow colors
- **Background Controls**: Adjustable opacity and color settings
- **Padding Adjustments**: X/Y margin controls for proper padding control
- **Full Screen Mode**:    Fill colour/media background options for full screen lyrics display

### Professional Features
- **Auto-Updates**: Seamless background updates via GitHub releases
- **Dark Mode**: System-integrated dark/light theme switching
- **Keyboard Shortcuts**: Full menu-driven workflow
- **Secondary Controllers**: Authorize mobile/web devices with a 6-digit join code so remote operators can trigger lines and submit lyric drafts (desktop approval required)
- **Cross-Platform**: Windows, macOS, and Linux support
- **Socket.io Backend**: Secure and reliable real-time communication

## Installation

### Pre-built Releases (Recommended)
1. Download the latest release from [GitHub Releases](https://github.com/PeterAlaks/lyric-display-updates/releases)
2. Run the installer for your platform
3. Launch LyricDisplay

### Development Setup
```bash
# Clone the repository
git clone https://github.com/PeterAlaks/lyric-display-app.git
cd lyric-display-app

# Install dependencies
npm install

# Development mode
npm run electron-dev

# Build for production
npm run electron-pack
```

## Quick Start Guide

### 1. Loading Lyrics
- **File Menu → Load Lyrics File** (Ctrl/Cmd+O)
- **Drag & Drop**: Drop .txt files directly into the main panel
- **New Song Canvas**: Create and format lyrics from scratch (Ctrl/Cmd+N)

### 2. Setting Up Outputs
1. Configure **Output 1** and **Output 2** settings independently
2. Use **File Menu → Preview Output 1/2** (Ctrl/Cmd+1/2) to open and preview display outputs in windows
3. Toggle **Display Output** switch to control visibility

### 3. Live Operation
- Click lyric lines to select and display them
- Use search bar to quickly find specific lyrics
- Navigate matches with Shift+Up/Down arrows
- Toggle output on/off with the main switch

### 4. Secondary Controllers (Optional)
- In the desktop app, open `File > Connect Mobile Controller` or tap the shield icon to view the QR code and current 6-digit join code (the code refreshes when the app restarts)
- On a phone or tablet on the same network, scan the QR code or visit `http://<control-pc-ip>:4000/?client=mobile`, then enter the join code to pair
- Paired controllers load the mobile layout where they can trigger lyric lines, toggle outputs, run manual sync, and submit lyric drafts for approval

## File Format

LyricDisplay accepts plain text (.txt) and lyrics (.lrc) files with the following format:

```
First verse line
[Translation or alternative text]

Second verse line
Another line without translation

Chorus line one
[Chorus translation]
```

**Formatting Rules:**

- Bracketed lines `[like this]`, `(this)` or `{this}` are treated as translation lines
- Two consecutive lines where the second is bracketed will be grouped
- Auto cleanup removes periods and other special characters, capitalizes first letter of words like God, Jesus, etc.

## Technical Architecture

### Frontend Stack
- **React 18** with React Router for SPA navigation
- **Tailwind CSS** for responsive styling
- **Radix UI** components for accessibility
- **Zustand** for state management with persistence
- **Lucide React** for modern iconography

### Backend Infrastructure
- **Express.js** server for static file serving
- **Socket.io** for real-time WebSocket communication
- **Node.js** child processes for backend management

### Desktop Integration
- **Electron 37** for cross-platform desktop application
- **Auto-updater** with GitHub releases integration
- **Native menus** with keyboard shortcuts
- **System theme** synchronization

## Configuration

### Output Settings
Each output can be independently configured:

| Setting | Description | Range / Options |
|---------|-------------|-----------------|
| Lyrics Position | Choose where lyrics sit vertically | Upper Third, Centre, Lower Third (centre enforced in full screen) |
| Font Style | Typography selection with live preview | 13 curated fonts |
| Emphasis | Toggle text emphasis states | Bold, Italic, Underline, All Caps |
| Font Size | Adjust displayed text size | 24–100 px |
| Font Colour | Apply precise text colour | Hex colour picker |
| Text Border | Outline lyrics for legibility | Colour picker + 0–10 px thickness |
| Drop Shadow | Add depth behind text | Colour picker + 0–10 opacity |
| Background | Panel fill behind lyrics | Colour picker + 0–10 opacity (disabled in full screen) |
| X & Y Margins | Fine-tune screen position | Decimal offsets |
| Full Screen Mode | Expand lyrics and manage full-screen backgrounds | Toggle + solid colour or uploaded image/video (≤200 MB) |

### Storage & Persistence
- Settings automatically saved using Zustand persistence
- Cross-session state restoration
- Electron-store integration for native preferences

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| Ctrl/Cmd+O | Load lyrics file |
| Ctrl/Cmd+N | New song canvas |
| Ctrl/Cmd+T | In New song canvas - adds translation line |
| Ctrl/Cmd+D | In New song canvas - duplicates current line |
| Ctrl/Cmd+L | In New song canvas - selects current line |
| Ctrl/Cmd+1 | Preview Output 1 |
| Ctrl/Cmd+2 | Preview Output 2 |
| Shift+↑/↓ | Navigate search results |

## Use Cases

### Church Services
- Display hymns and worship songs simultaneously in-house and online
- Support for multiple languages with translation grouping
- Quick song switching during live services

### Live Streaming
- OBS/VMIX browser source integration
- Transparent overlays for professional broadcasts
- Real-time lyric synchronization for worship leaders

### Concerts & Events
- Multi-screen lyric coordination
- Custom styling to match event branding
- Reliable real-time performance

## Browser Source Setup

### OBS Studio Integration
1. Add **Browser Source** to your scene
2. Set URL to: `http://localhost:4000/#/output1` or `http://localhost:4000/#/output2`
3. Replace `localhost` with the control panel PC's local IP if capturing display from another system across a network
4. Set dimensions of browser source to match your canvas (for example, 1920 x 1080 pixels)
5. Enable **Shutdown source when not visible** for performance
6. **Refresh browser when scene becomes active** for reliability

### VMIX Integration
- Add **Web Browser** input
- Use same URL format as OBS
- Configure as overlay for professional broadcast mixing

## Development

### Project Structure
```
lyric-display-app/
├── main/                                   # Electron main script modules
|   ├── adminKey.js                         # Admin access key module
|   ├── backend.js                          # Backend server starter
|   ├── inAppBrowser.js                     # In-App browser window configuration and styling
|   ├── ipc.js                              # IPC handlers
|   ├── menu.js                             # Window menu builder
|   ├── modalBridge.js                      # Global modal bridge for electron main process
|   ├── paths.js                            # Production paths resolver
|   ├── progressWindow.js                   # App updater dialog window configuration and styling
|   ├── recents.js                          # Module for token storage
|   ├── secureTokenStore.js                 # Main token storage for desktop app
|   ├── updater.js                          # Module to manage app updates
|   ├── utils.js                            # Utility file to get local IP address
|   └── windows.js                          # Main window builder
├── public/                                 # Static assets
|   └── index.html                          # Browser web app entry point
├── server/                                 # Express.js backend
|   ├── events.js                           # Backend communication events
|   ├── index.js                            # Main backend server
|   ├── joinCodeGuard.js                    # Guard/limiter for join code attempts by secondary controllers
|   ├── package.json                        # Backend dependencies
|   └── secretManager.js                    # Module handling the secure management of app secrets
├── shared/
|   └── lyricsParsing.js                    # Shared TXT/LRC parsing helpers.
├── src/                                    # React frontend source
│   ├── assets/                             # Fonts, etc.
│   ├── components/
|   |   ├── modal/
|   |   |   └── ModalProvider.jsx           # Global modal component
|   |   ├── toast/
|   |   |   └── ToastProvider.jsx           # Toast notifications component
|   |   ├── ui/                             # Shadcn UI components
|   |   ├── AuthStatusIndicator.jsx         # Authentication status component
|   |   ├── ConnectionBackoffBanner.jsx     # Global connection backoff modal component
|   |   ├── DraftApprovalModal.jsx          # Approval modal component for lyric drafts submitted from secondary controllers
|   |   ├── ElectronModalBridge.jsx         # In-app listener for global modal usage in Electron
|   |   ├── JoinCodePromptBridge.jsx        # Bridge component for join code user flow
|   |   ├── LyricDisplayApp.jsx             # Main control panel UI
|   |   ├── LyricsList.jsx                  # Control panel lyrics list UI
|   |   ├── MobileLayout.jsx                # Minified control panel UI for secondary connected clients
|   |   ├── NewSongCanvas.jsx               # New/edit song text editor
|   |   ├── OnlineLyricsSearchModal.jsx     # Online Lyrics Search modal
|   |   ├── OutputSettingsPanel.jsx         # Settings panel interface
|   |   ├── QRCodeDialog.jsx                # QR Code Dialog UI for mobile controller connection
|   |   ├── QRCodeDialogBridge.jsx          # Bridge component for QR Code Dialog
|   |   ├── SearchBar.jsx                   # Search bar component for control panel
|   |   ├── SetlistModal.jsx                # Setlist Modal
|   |   └── ShortcutsHelpBridge.jsx         # Shortcuts help modal and bridge
│   ├── context/
|   |   ├── ControlSocketProvider.jsx       # Control socket provider
|   |   └── LyricsStore.js                  # Zustand store definitions
│   ├── hooks/
|   |   ├── useAuth.js                      # Authenticator hook for socket connections
|   |   ├── useDarkModeSync.js              # Hook for global dark mode sync
|   |   ├── useEditorClipboard.js           # Hook for cut, copy and paste handlers
|   |   ├── useFileUpload.js                # Custom React hook for file uploads
|   |   ├── useMenuShortcuts.js             # Hook for handling menu navigation/shortcuts
|   |   ├── useModal.js                     # Global modal hook
|   |   ├── useOutputSettings.js            # Hook for output settings tab switcher
|   |   ├── useSearch.js                    # Hook for search bar functionality
|   |   ├── useSetlistActions.js            # Hook for setlist action functionality
|   |   ├── useSocket.js                    # Main React hook for Socket.IO client
|   |   ├── useSocketEvents.js              # Socket events hook
|   |   ├── useStoreSelectors.js            # Centralized collection of Zustand selectors
|   |   ├── useSyncTimer.js                 # Last synced timer hook
|   |   └── useToast.js                     # Toast notifications hook
│   ├── lib/
|   |   └── utils.js                        # UI library utility functions
│   ├── pages/                              # Route-based page components
|   |   ├── ControlPanel.jsx                # Control panel page wrapper
|   |   ├── Output1.jsx                     # Output 1 display
|   |   └── Output2.jsx                     # Output 2 display
│   ├── utils/
|   |   ├── asyncLyricsParser.js            # Picks worker/IPC/sync parsing strategy.
|   |   ├── connectionManager.js            # Socket connection management hook
|   |   ├── logger.js                       # Simple event and error logger utility
|   |   ├── lyricsFormat.js                 # Format lyrics utility for new/edit song canvas
|   |   ├── network.js                      # Network utility for backend URL resolution
|   |   ├── parseLrc.js                     # LRC file parser
|   |   ├── parseLyrics.js                  # Text file parser
|   |   ├── secureTokenStore.js             # Secure token storage utility
|   |   └── toastSounds.js                  # Toast notifications tones utility
│   ├── workers/
|   |   └── lyricsParser.worker.js          # Web worker that parses lyrics off the UI thread.
|   ├── App.jsx                             # React app main component
|   ├── main.jsx                            # App entry point
|   └── index.css                           # Global CSS
├── .env                                    # Environment variables file
├── index.html                              # Alternative browser web app entry point
├── main.js                                 # Electron main process
├── package.json                            # Dependencies and scripts
├── postcss.config.js                       # PostCSS configurations
├── preload.js                              # Electron preload script
├── tailwind.config.js                      # Tailwind configurations
└── vite.config.js                          # Vite configurations
```

### Available Scripts
```bash
npm run dev              # Vite development server
npm run server           # Backend server only
npm run electron-dev     # Full Electron development
npm run build            # Production build
npm run electron-pack    # Package Electron app
```

### Contributing
1. Fork the repository
2. Create a feature branch
3. Implement changes with proper testing
4. Submit pull request with detailed description

## Troubleshooting

### Common Issues

**Output windows not displaying:**
- Verify backend server is running (check console logs)
- Ensure Socket.io connection is established
- Try refreshing browser sources in OBS/VMIX

**Auto-updater not working:**
- Check internet connection
- Verify GitHub repository access
- Review console logs for specific errors

**Styling not applying:**
- Confirm Socket.io communication
- Use "Sync Outputs" button to force state refresh
- Check browser console for JavaScript errors

### Performance Optimization
- Close unused output windows when not needed
- Use hardware acceleration in streaming software
- Monitor CPU usage during extended sessions

## License & Credits

**Copyright © 2025. All Rights Reserved.**

**Developers:**
- Peter Alakembi (Lead Designer and Developer)
- David Okaliwe (Co-Developer)

**Links:**
- [GitHub Repository](https://github.com/PeterAlaks/lyric-display-updates)
- [Developer Portfolio](https://linktr.ee/peteralaks)
- [Documentation](https://github.com/PeterAlaks/lyric-display-app#readme)

## Support

For technical support, feature requests, or bug reports:
- Open an issue on GitHub
- Check existing documentation
- Review troubleshooting section

---

*LyricDisplay - Powering worship experiences worldwide*