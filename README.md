# LyricDisplay

> Professional real-time lyric display application for live events, church services, and multimedia presentations.

**Version:** 5.10.8
**Author:** Peter Alakembi
**Co-Contributor:** David Okaliwe

## Overview

LyricDisplay is a comprehensive Electron-based application designed for use in professional live production environments alongside streaming/recording software. It provides real-time lyric synchronization across multiple transparent output displays, making it ideal for church services, concerts, and live streaming setups where lyrics need to be displayed in distinct display points.

## Key Features

### Multi-Output Display System
- **Dual Independent Outputs**: Two separate output pages plus stage output page with individual styling controls
- **Transparent Backgrounds**: Perfect for OBS/VMIX browser source capture
- **Real-time Synchronization**: Instant updates across all connected displays
- **Browser Source Compatible**: Works seamlessly with popular streaming software

### Advanced Lyric Management
- **Smart Text Processing**: Automatic formatting for cleaning up lyric files
- **Translation Support**: Displays translation lines where available (lines wrapped in brackets below main lyric line) 
- **Live Editing Canvas**: Built-in editor with formatting tools and auto-cleanup
- **Search & Navigation**: Advanced search with match highlighting and keyboard navigation

### Comprehensive Styling Engine
- **10 Professional Featured Fonts**: 10 pro fonts from Google Fonts in addition to locally installed fonts
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
1. Download the latest release [from the releases page](https://github.com/PeterAlaks/lyric-display-app/releases/latest)
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
- **Online Lyrics Search**: Quickly search for and load lyrics from featured online providers (Icon in top bar)

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

LyricDisplay accepts plain text (.txt) and lyrics (.lrc) files

**Formatting Rules:**

- Bracketed lines `[like this]`, `(this)` or `{this}` are treated as translation lines
- Two consecutive lines where the second is bracketed will be grouped
- Auto cleanup removes periods and other special characters, capitalizes first letter of words like God, Jesus, etc.

## Technical Architecture

### Frontend Stack
- **React** with Hash Router for SPA navigation
- **Tailwind CSS** for responsive styling
- **Radix/ShadCN UI** components for accessibility
- **Zustand** for state management with persistence
- **Lucide React** for modern iconography

### Backend Infrastructure
- **Express.js** server for static file serving
- **Socket.io** for real-time WebSocket communication
- **Node.js** child processes for backend management

### Desktop Integration
- **Electron** for cross-platform desktop application
- **Auto-updater** with GitHub releases integration
- **Native menus** with keyboard shortcuts
- **System theme** synchronization

### Storage & Persistence
- Settings automatically saved using Zustand persistence
- Cross-session state restoration
- Electron-store integration for native preferences

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

### vMix Integration
- Add **Web Browser** input
- Use same URL format as OBS
- Configure as overlay for professional broadcast mixing

## Development

### Project Structure
```
lyric-display-app/
├── main/                                   # Electron main script modules
│   ├── lyricsProviders/
|   |   ├── providers/
|   |   |   ├── chartlyrics.js              # ChartLyrics lyrics provider definitions
|   |   |   ├── hymnary.js                  # Hymnary.org lyrics provider definitions
|   |   |   ├── lrclib.js                   # LRCLIB lyrics provider definitions
|   |   |   ├── lyricsOvh.js                # Lyrics.ovh lyrics provider definitions
|   |   |   ├── openHymnal.js               # Open Hymnal lyrics provider definitions
|   |   |   └── vagalume.js                 # Vagalume lyrics provider definitions
|   |   ├── cache.js                        # Online lyrics search data cache
|   |   ├── fetchWithTimeout.js             # Fetch lyric data timeout moderator for providers
|   |   ├── index.js                        # Main online lyrics search initializer and aggregator
|   |   └── searchAlgorithm.js              # Online lyrics search algorithm
|   ├── adminKey.js                         # Admin access key module
|   ├── backend.js                          # Backend server starter
|   ├── cleanup.js                          # Cleanup utility for windows and other processes upon exit
|   ├── displayDetection.js                 # External display detection in main process
|   ├── displayManager.js                   # External assignment and management module
|   ├── easyWorship.js                      # EasyWorship song lyric files conversion module
|   ├── fileHandler.js                      # Main process file processing handler
|   ├── inAppBrowser.js                     # In-App browser window configuration and styling
|   ├── ipc.js                              # IPC handlers
|   ├── loadingWindow.js                    # Loading process window
|   ├── menuBridge.js                       # Renderer/menu bridge (dark mode, undo/redo state)
|   ├── modalBridge.js                      # Global modal bridge for electron main process
|   ├── paths.js                            # Production paths resolver
|   ├── progressWindow.js                   # App updater dialog window configuration and styling
|   ├── providerCredentials.js              # secure storage utility for online lyrics provider credentials
|   ├── recents.js                          # Module for token storage
|   ├── secureTokenStore.js                 # Main token storage for desktop 
|   ├── singleInstance.js                   # Single app instance lock process
|   ├── startup.js                          # Main app startup processes
|   ├── systemFonts.js                      # Helper module for loading system installed fonts
|   ├── themePreferences.js                 # Theme manager for main process dark mode sync
|   ├── updater.js                          # Module to manage app updates
|   ├── utils.js                            # Utility file to get local IP address
|   └── windows.js                          # Main window builder
├── public/                                 # Static assets
├── scripts/                                # Custom npm scripts
|   ├── release.js                          # Release assistant main script
|   └── update-version.js                   # Helper script for updating current version in readme and install guide
├── server/                                 # Express.js backend
|   ├── events.js                           # Backend communication events
|   ├── index.js                            # Main backend server
|   ├── joinCodeGuard.js                    # Guard/limiter for join code attempts by secondary controllers
|   ├── package.json                        # Backend dependencies
|   └── secretManager.js                    # Module handling the secure management of app secrets
├── shared/
│   ├── data/
|   |   ├── knownArtists.json               # Popular artists name database for enhanced lyric search logic
|   |   ├── openhymnal-bundle.json          # Open Hymnal hymn lyrics bundle from public website
|   |   └── openhymnal-sample.json          # Open Hymnal hymn lyrics sample format for search discoverability
|   ├── lineSplitting.js                    # Intelligent line splitting utility for smarter lyrics parsing 
|   └── lyricsParsing.js                    # Shared TXT/LRC parsing helpers.
├── src/                                    # React frontend source
│   ├── assets/                             # Fonts, etc.
│   ├── components/
|   |   ├── modal/
|   |   |   └── ModalProvider.jsx           # Global modal component
|   |   ├── toast/
|   |   |   └── ToastProvider.jsx           # Toast notifications component
|   |   ├── ui/                             # Reusable UI components
|   |   ├── AboutAppModal.jsx               # About the app modal
|   |   ├── AuthStatusIndicator.jsx         # Authentication status component
|   |   ├── AutoplaySettings.jsx            # Autoplay settings modal
|   |   ├── ConnectionBackoffBanner.jsx     # Global connection backoff modal component
|   |   ├── ConnectionDiagnosticsModal.jsx  # Connection diagnostics modal component
|   |   ├── DisplayDetectionModal.jsx       # Display detection modal component
|   |   ├── DraftApprovalModal.jsx          # Approval modal component for lyric drafts submitted from secondary controllers
|   |   ├── EasyWorshipImportModal.jsx      # Song import from local EasyWorship store wizard
|   |   ├── ElectronModalBridge.jsx         # In-app listener for global modal usage in Electron
|   |   ├── FontSelect.jsx                  # Custom font selection overlay
|   |   ├── HelpContent.jsx                 # Help and operation tips modal
|   |   ├── IntegrationInstructions.jsx     # Integration help modal for OBS, VMix and Wirecast
|   |   ├── IntelligentAutoplayInfo.jsx     # Intelligent Autoplay info modal
|   |   ├── JoinCodePromptBridge.jsx        # Bridge component for join code user flow
|   |   ├── LyricDisplayApp.jsx             # Main control panel UI
|   |   ├── LyricsList.jsx                  # Control panel lyrics list UI
|   |   ├── MobileLayout.jsx                # Minified control panel UI for secondary connected clients
|   |   ├── NewSongCanvas.jsx               # New/edit song text editor
|   |   ├── OnlineLyricsSearchModal.jsx     # Online Lyrics Search modal
|   |   ├── OnlineLyricsWelcomeSplash.jsx   # Online Lyrics Search welcome and help modal component
|   |   ├── OutputSettingsPanel.jsx         # Settings panel interface
|   |   ├── OutputSettingsShared.jsx        # Shared UI components for output and stage settings panel
|   |   ├── OutputTemplatesModal.jsx        # Output settings templates modal
|   |   ├── PreviewOutputsModal.jsx         # Display outputs preview modal
|   |   ├── QRCodeDialog.jsx                # QR Code Dialog UI for mobile controller connection
|   |   ├── QRCodeDialogBridge.jsx          # Bridge component for QR Code Dialog
|   |   ├── SearchBar.jsx                   # Search bar component for control panel
|   |   ├── SetlistModal.jsx                # Setlist Modal
|   |   ├── ShortcutsHelpBridge.jsx         # Shortcuts help modal and bridge
|   |   ├── SongInfoModal.jsx               # Info modal for loaded lyrics
|   |   ├── StageSettingsPanel.jsx          # Stage settings interface
|   |   ├── StageTemplatesModal.jsx         # Stage settings templates modal
|   |   ├── SupportDevelopmentModal.jsx     # Support development modal
|   |   └── WelcomeSplash.jsx               # Welcome splash modal for first time install
│   ├── constants/
|   |   └── fonts.js                        # Featured fonts dropdown store
│   ├── context/
|   |   ├── ControlSocketProvider.jsx       # Control socket provider
|   |   └── LyricsStore.js                  # Zustand store definitions
│   ├── hooks/
|   |   ├── LyricDisplayApp/
|   |   |   ├── useElectronListeners.js     # Hook for listening to main process events and broadcasts for control panel
|   |   |   ├── useKeyboardShortcuts.js     # Keyboard entry listener for control panel
|   |   |   ├── useLyricsLoader.js          # Multi-source lyrics load processor for control panel 
|   |   |   ├── useMenuShortcuts.js         # Hook for handling menu navigation/shortcuts
|   |   |   ├── useOutputSettings.js        # Hook for output settings tab switcher
|   |   |   ├── useResponsiveWidth.js       # Window resize observer hook for control panel button responsiveness
|   |   |   ├── useSetlistActions.js        # Hook for setlist action functionality
|   |   |   └── useSupportDevModal.js       # Hook for processing show time and parameters for support development modal
|   |   ├── LyricsList/
|   |   |   └── useElectronListeners.js     # Hook for listening to main process events and broadcasts for lyrics list
|   |   ├── NewSongCanvas/
|   |   |   ├── useCanvasSearch.js          # Content search hook for editing area/canvas
|   |   |   ├── useEditorClipboard.js       # Hook for cut, copy and paste handlers
|   |   |   ├── useEditorHistory.js         # Hook for history state management of lyrics editor canvas
|   |   |   ├── useElectronListeners.js     # Hook for listening to main process events and broadcasts for new song canvas
|   |   |   ├── useFileSave.js              # Canvas file operations hook
|   |   |   ├── useKeyboardShortcuts.js     # Keyboard entry listener for canvas
|   |   |   ├── useLineMeasurements.js      # Hook for measuring and calculating line dimensions in canvas
|   |   |   ├── useLineOperations.js        # Hook for line manipulation operations in canvas
|   |   |   ├── useLrcEligibility.js        # Hook for determining LRC format eligibility
|   |   |   ├── useTimestampOperations.js   # Hook for timestamp handling and operations
|   |   |   └── useTitlePrefill.js          # Hook for auto-prefilling song title in canvas
|   |   ├── OnlineLyricsSearchModal/
|   |   |   ├── useKeyboardShortcuts.js     # Keyboard entry listener for online lyrics search modal
|   |   |   └── useNetworkStatus.js         # Internet connection status hook
|   |   ├── OutputSettingsPanel/
|   |   |   ├── useAdvancedSectio....js     # Hook for advanced sections visibility states
|   |   |   ├── useFullscreenBackground.js  # Hook for handling fullscreen background controls
|   |   |   ├── useFullscreenModeState.js   # Fullscreen mode and settings visibility state hook
|   |   |   ├── useOutputToggle.js          # Individual output switch manager
|   |   |   ├── useStageDisplayControls.js  # Hook for stage display controls
|   |   |   └── useTypographyAndBands.js    # Background band and related logic hook
|   |   ├── SetlistModal/
|   |   |   └── useSetlistLoader.js         # Hook for setlist file loading functionality
|   |   ├── useAuth.js                      # Authenticator hook for socket connections
|   |   ├── useAutoplayManager.js           # Autoplay engine and logic
|   |   ├── useContextMenuPosition.js       # Hook for space-aware context menu positioning
|   |   ├── useContextSubmenus.js           # Context submenus definitions and logic
|   |   ├── useDarkModeSync.js              # Hook for global dark mode sync
|   |   ├── useFileUpload.js                # Custom React hook for file uploads
|   |   ├── useModal.js                     # Global modal hook
|   |   ├── useSearch.js                    # Hook for search bar functionality
|   |   ├── useSocket.js                    # Main React hook for Socket.IO client
|   |   ├── useSocketEvents.js              # Socket events hook
|   |   ├── useStoreSelectors.js            # Centralized collection of Zustand selectors
|   |   ├── useSyncOutputs.js               # Outputs sync manager for control panel
|   |   ├── useSyncTimer.js                 # Last synced timer hook
|   |   └── useToast.js                     # Toast notifications hook
│   ├── lib/
|   |   └── utils.js                        # UI library utility functions
│   ├── pages/                              # Route-based page components
|   |   ├── ControlPanel.jsx                # Control panel page wrapper
|   |   ├── Output1.jsx                     # Output 1 display
|   |   ├── Output2.jsx                     # Output 2 display
|   |   └── Stage.jsx                       # Stage output display
│   ├── styles/
|   |   └── fonts.css                       # Display font styles import and definitions
│   ├── utils/
|   |   ├── artistDetection.js              # Scans Known Artists database for various uses around the app
|   |   ├── asyncLyricsParser.js            # Picks worker/IPC/sync parsing strategy
|   |   ├── connectionManager.js            # Socket connection management utility
|   |   ├── errorClassification.js          # Network error detection and description utility
|   |   ├── logger.js                       # Simple event and error logger utility
|   |   ├── lyricsFormat.js                 # Format lyrics utility for new/edit song canvas
|   |   ├── markdownParser.js               # Helper utility for converting markdown to HTML
|   |   ├── maxLinesCalculator.js           # Calculator for maximum lines feature in outputs display
|   |   ├── network.js                      # Network utility for backend URL resolution
|   |   ├── numberInput.js                  # Integer value sanitization utility for settings panel
|   |   ├── outputTemplates.js              # Output templates for settings panel
|   |   ├── parseLrc.js                     # LRC file parser
|   |   ├── parseLyrics.js                  # Text file parser
|   |   ├── secureTokenStore.js             # Secure token storage utility
|   |   ├── timestampHelpers.js             # Timestamp helper utility for intelligent autoplay feature
|   |   ├── titlePrefill.js                 # Title prefill utility for song canvas
|   |   └── toastSounds.js                  # Toast notifications tones utility
│   ├── workers/
|   |   └── lyricsParser.worker.js          # Web worker that parses lyrics off the UI thread.
|   ├── App.jsx                             # React app main component
|   ├── index.css                           # Global CSS and custom style definitions
|   └── main.jsx                            # App entry point
├── components.json                         # Shadcn UI config
├── CONTRIBUTING.md                         # Contribution guides for project
├── index.html                              # Web app entry point
├── jsconfig.json                           # Path and settings configurations for JS
├── main.js                                 # Electron main process
├── package.json                            # Dependencies and scripts
├── postcss.config.js                       # PostCSS configurations
├── preload.js                              # Electron preload script
├── README.md                               # App documentation
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
- Verify backend server is running (Port 4000 active)
- Ensure Socket.io connection is established (Connected status in top bar)
- Try refreshing browser sources in OBS/vMix/Wirecast

## License & Credits

## Lyrics Provider Credits & Copyright Disclaimer

LyricDisplay integrates optional online lyrics search features powered by free and publicly available lyrics providers.  
All lyrics, metadata, and related content displayed through these services remain the property of their respective copyright holders.

### Integrated Providers
- **LRCLIB** — Free synced lyrics database with nearly 3 million lyrics. No API key required. Provides both plain and timestamped (LRC format) lyrics.
- **ChartLyrics** — Free public lyrics API with good coverage of popular songs. No API key required.
- **Lyrics.ovh** — Free lyrics API (public domain and licensed material) provided for educational and non-commercial use.  
- **Vagalume** — © Vagalume Media Group. Lyrics and artist data are provided through the official Vagalume API.  
- **Hymnary.org** — © Hymnary.org / Christian Classics Ethereal Library (CCEL). Content is provided for educational and liturgical purposes.  
- **Open Hymnal Project** — Public domain hymn texts and music as compiled by the Open Hymnal Project.

### Logos & Trademarks
Logos and brand marks of the above providers are displayed in LyricDisplay **for identification and attribution purposes only**.  
All trademarks, service marks, and logos are the property of their respective owners.  
Their inclusion does **not imply endorsement, partnership, or affiliation** with LyricDisplay or its developers.

### Usage Notice
- LyricDisplay does **not store**, redistribute, or claim ownership of any lyrics obtained through these sources.  
- Lyrics are fetched on demand from publicly accessible APIs and displayed **solely for personal, church, and non-commercial use**.  
- If you are a copyright holder and wish to request content removal or modification, please contact the original provider directly.

> **Disclaimer:** LyricDisplay and its developers are not affiliated with or endorsed by any of the above content providers.  
> This feature is offered “as is” for convenience and educational purposes only.

**Copyright © 2025. All Rights Reserved.**

**Developers:**
- Peter Alakembi (Lead Designer and Developer)
- David Okaliwe (Co-Developer)

**Links:**
- [Our Website](https://lyricdisplay.app)
- [Developer Portfolio](https://linktr.ee/peteralaks)
- [Support Development](https://paystack.shop/pay/lyricdisplay-support)

## Support

For technical support, feature requests, or bug reports:
- Open an issue on the issues tab
- Check existing documentation
- Review troubleshooting section

---

*LyricDisplay - Powering worship experiences worldwide*