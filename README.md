# LyricDisplay

> Professional real-time lyric display application for live events, church services, and multimedia presentations.

**Version:** 6.3.16
**Author:** Peter Alakembi
**Co-Contributor:** David Okaliwe

## Overview

LyricDisplay is a comprehensive Electron-based application designed for use in professional live production environments alongside streaming/recording software. It provides real-time lyric synchronization across multiple transparent output displays, making it ideal for church services, concerts, and live streaming setups where lyrics need to be displayed in distinct display points.

## Key Features

### Multi-Output Display System
- **Multi-Output Display System**: Two default output pages plus user-created outputs (`output3`-`output6`) and a dedicated stage output, each with independent styling controls
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
- **NDI® Output**: Broadcast lyrics over NDI for use in OBS, vMix, and other production software — with transparency and per-output resolution control
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

> **macOS Users:** Because the app is not code-signed, macOS will show a "damaged" error. Before opening, run `xattr -cr /Applications/LyricDisplay.app` in Terminal. See the [Installation Guide](INSTALLATION.md) for detailed instructions.

### Development Setup
```bash
# Clone the repository
git clone https://github.com/PeterAlaks/lyric-display-app.git
cd lyric-display-app

# Install client dependencies
npm install

# Install server dependencies
cd server
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
1. Configure **Output 1/2**, **Stage**, and any enabled custom outputs (**Output 3-6**) independently
2. Use **File Menu → Preview Outputs** to open and preview available outputs in windows (Ctrl/Cmd+1 and Ctrl/Cmd+2 still quick-open the default outputs)
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
2. Set URL to: `http://localhost:4000/#/output1`, `http://localhost:4000/#/output2`, or any enabled custom output route like `http://localhost:4000/#/output3` through `#/output6`
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
├── lyricdisplay-ndi/                       # LyricDisplay NDI Companion (Separate repo but needed here for development)
├── main/                                   # Electron main script modules
|   ├── ipc/                                # IPC handlers
|   |   ├── index.js                        # Main registration point
|   |   ├── app.js                          # App-level handlers (version, dark mode)
|   |   ├── window.js                       # Window controls (minimize, maximize, close, etc.)
|   |   ├── files.js                        # File operations (load, save, parse lyrics)
|   |   ├── recents.js                      # Recent files management
|   |   ├── auth.js                         # Authentication (admin key, JWT, join code, tokens)
|   |   ├── security.js                     # Security token key status and rotation handlers
|   |   ├── lyrics.js                       # Lyrics providers (search, fetch, API keys)
|   |   ├── easyworship.js                  # EasyWorship import handlers
|   |   ├── setlist.js                      # Setlist operations (save, load, browse, export)
|   |   ├── display.js                      # Display management (assignments, output windows)
|   |   ├── updater.js                      # App updater controls
|   |   ├── templates.js                    # User templates handlers
|   |   ├── preferences.js                  # User preferences handlers
|   |   └── misc.js                         # Miscellaneous (fonts, IP address, browser)
│   ├── lyricsProviders/
|   |   ├── providers/
|   |   |   ├── chartlyrics.js              # ChartLyrics lyrics provider definitions
|   |   |   ├── lrclib.js                   # LRCLIB lyrics provider definitions
|   |   |   ├── lyricsOvh.js                # Lyrics.ovh lyrics provider definitions
|   |   |   └── openHymnal.js               # Open Hymnal lyrics provider definitions
|   |   ├── cache.js                        # Online lyrics search data cache
|   |   ├── fetchWithTimeout.js             # Fetch lyric data timeout moderator for providers
|   |   ├── index.js                        # Main online lyrics search initializer and aggregator
|   |   ├── userAgent.js                    # Shared User-Agent metadata for external lyrics providers
|   |   └── searchAlgorithm.js              # Online lyrics search algorithm
|   ├── ndi/                                # NDI feature modules for main process
|   |   ├── installer.js                    # NDI installer/update/download lifecycle helpers
|   |   ├── ipcClient.js                    # Persistent/one-shot TCP IPC client for NDI companion
|   |   └── outputSettings.js               # NDI output defaults, settings, and registry sync helpers
|   ├── adminKey.js                         # Admin access key module
|   ├── backend.js                          # Backend server starter
|   ├── cleanup.js                          # Cleanup utility for windows and other processes upon exit
|   ├── displayDetection.js                 # External display detection in main process
|   ├── displayManager.js                   # External assignment and management module
|   ├── easyWorship.js                      # EasyWorship song lyric files conversion module
|   ├── externalControl.js                  # External control module for MIDI and OSC
|   ├── fileHandler.js                      # Main process file processing handler
|   ├── inAppBrowser.js                     # In-App browser window configuration and styling
|   ├── ipc.js                              # IPC handlers import (Backward compatibility)
|   ├── loadingWindow.js                    # Loading process window
|   ├── menuBridge.js                       # Renderer/menu bridge (dark mode, undo/redo state)
|   ├── midiController.js                   # MIDI main controller module
|   ├── modalBridge.js                      # Global modal bridge for electron main process
|   ├── modalBridge.js                      # Global modal bridge for electron main process
|   ├── ndiManager.js                       # NDI orchestrator for companion lifecycle and IPC handlers
|   ├── paths.js                            # Production paths resolver
|   ├── presentation.js                     # Presentation file import and conversion engine
|   ├── progressWindow.js                   # App updater dialog window configuration and styling
|   ├── providerCredentials.js              # Secure storage utility for online lyrics provider credentials
|   ├── recents.js                          # Module for token storage
|   ├── secureTokenStore.js                 # Main token storage for desktop 
|   ├── setlistExport.js                    # Backend process for setlist export operations
|   ├── singleInstance.js                   # Single app instance lock process
|   ├── startup.js                          # Main app startup processes
|   ├── systemFonts.js                      # Helper module for loading system installed fonts
|   ├── themePreferences.js                 # Theme manager for main process dark mode sync
|   ├── updater.js                          # Module to manage app updates
|   ├── userPreferences.js                  # User preferences and app settings manager
|   ├── userTemplates.js                    # Backend manager for user-stored output settings template system
|   ├── utils.js                            # Utility file to get local IP address
|   └── windows.js                          # Main window builder
├── public/                                 # Static assets
├── scripts/                                # Custom npm scripts
|   ├── release.js                          # Release assistant main script
|   └── update-version.js                   # Helper script for updating current version in readme and install guide
├── server/                                 # Express.js backend
|   ├── auth/                               # Backend authentication and permission helpers
|   |   ├── httpAuth.js                     # Express bearer-token authentication middleware factory
|   |   ├── joinCodeGuard.js                # Guard/limiter for join code attempts by secondary controllers
|   |   ├── permissions.js                  # Backend client permission mapping and permission checks
|   |   ├── socketAuth.js                   # Socket.io JWT authentication middleware factory
|   |   └── tokens.js                       # JWT generation, validation, expiry, and rotation grace helpers
|   ├── config/
|   |   └── clientTypes.js                  # Shared backend client type constants and helpers
|   ├── media/                              # Upload paths, media typing, and media management services
|   |   ├── backgroundMedia.js              # Background media cleanup service
|   |   ├── mediaTypes.js                   # Allowed media MIME types and filename MIME inference
|   |   ├── paths.js                        # Backend upload directory resolution and initialization
|   |   ├── uploads.js                      # Multer upload middleware configuration
|   |   └── userMedia.js                    # User media listing, payload, and delete service
|   ├── middleware/
|   |   ├── cors.js                         # Development CORS middleware
|   |   └── localhostOnly.js                # Loopback-only route guard
|   ├── realtime/                           # Socket.io state and domain-specific event handlers
|   |   ├── handlers/
|   |   |   ├── connectionHandlers.js       # Connection lifecycle, state sync, heartbeat, and stats events
|   |   |   ├── draftHandlers.js            # Mobile/web lyric draft submission and desktop approval events
|   |   |   ├── lyricsHandlers.js           # Lyric load, line selection, filename, timestamp, and split events
|   |   |   ├── outputHandlers.js           # Output toggle, style, registry, removal, and metrics events
|   |   |   ├── setlistHandlers.js          # Setlist add, remove, load, clear, and reorder events
|   |   |   └── stageHandlers.js            # Stage timer and stage message events
|   |   ├── state.js                        # Shared realtime state, output registry, and current-state builder
|   |   └── utils.js                        # Realtime validation and output instance helpers
|   ├── routes/                             # Express API route registration modules
|   |   ├── adminSecrets.js                 # Local-only secret status and rotation endpoints
|   |   ├── auth.js                         # Token, refresh, validation, and join-code endpoints
|   |   ├── connection.js                   # Connected-client API endpoint
|   |   ├── health.js                       # Health and readiness endpoints
|   |   ├── media.js                        # Background and user media API endpoints
|   |   └── outputs.js                      # Output registry API endpoints
|   ├── security/
|   |   └── secretManager.js                # Module handling the secure management of app secrets
|   ├── events.js                           # Socket event registration entrypoint
|   ├── index.js                            # Main backend server bootstrap
|   └── package.json                        # Backend dependencies
├── shared/
│   ├── data/
|   |   ├── knownArtists.json               # Popular artists name database for enhanced lyric search logic
|   |   ├── openhymnal-bundle.json          # Open Hymnal hymn lyrics bundle from public website
|   |   └── openhymnal-sample.json          # Open Hymnal hymn lyrics sample format for search discoverability
|   ├── lyricsParsing/
|   |   ├── constants.js                    # Shared parser constants (patterns, defaults, tags)
|   |   ├── grouping.js                     # Cluster flattening and cross-blank grouping logic
|   |   ├── helpers.js                      # Shared parser helper builders (group objects)
|   |   ├── index.js                        # Main exports for shared parsing modules
|   |   ├── lineSplitting.js                # Core line splitting implementation
|   |   ├── lrcParser.js                    # LRC parser orchestrator
|   |   ├── normalGroupCandidates.js        # Candidate checks for normal line grouping
|   |   ├── onlineParser.js                 # Online-lyrics-specific TXT parsing defaults
|   |   ├── repeatableSections.js           # Chorus/Refrain reference expansion logic
|   |   ├── runtimeConfig.js                # Runtime grouping config state and helpers
|   |   ├── sections.js                     # Derived section metadata and line mappings
|   |   ├── separators.js                   # Song-separator detection helpers
|   |   ├── structureTags.js                # Structure-tag detection/extraction and labeling
|   |   ├── textCleanup.js                  # Timestamp-like cleanup for TXT parsing
|   |   ├── translation.js                  # Translation-line detection logic
|   |   ├── txtParser.js                    # TXT parser orchestrator
|   |   └── txtProcessor.js                 # TXT preprocessing and grouping pipeline
|   ├── lineSplitting.js                    # Compatibility re-export to shared/lyricsParsing/lineSplitting.js
|   └── lyricsParsing.js                    # Compatibility re-export to shared/lyricsParsing/index.js
├── src/                                    # React frontend source
│   ├── assets/                             # Fonts, etc.
│   ├── components/
|   |   ├── bridges/                        # Bridge components connecting Electron main process events to React UI
|   |   |   ├── ElectronModalBridge.jsx     # In-app listener for global modal usage in Electron
|   |   |   ├── JoinCodePromptBridge.jsx    # Bridge and component for join code user flow
|   |   |   ├── NdiBridge.jsx               # Global NDI store initiator and main-process NDI events sync
|   |   |   ├── NdiUpdaterBridge.jsx        # NDI companion update notification and installation bridge
|   |   |   ├── PreferencesLoaderBridge.jsx # Loads user preferences into the store on startup
|   |   |   ├── QRCodeDialogBridge.jsx      # Bridge component for QR Code Dialog
|   |   |   ├── ShortcutsHelpBridge.jsx     # Shortcuts help modal and bridge
|   |   |   ├── SupportDevelopmentBridge.jsx # Support development modal bridge
|   |   |   ├── UpdaterBridge.jsx           # App update notification, download and install bridge
|   |   |   ├── WelcomeSplashBridge.jsx     # Welcome splash trigger bridge for first time install
|   |   |   └── index.js                    # Barrel export for all bridge components
|   |   ├── modal/
|   |   |   └── ModalProvider.jsx           # Global modal component
|   |   ├── toast/
|   |   |   └── ToastProvider.jsx           # Toast notifications component
|   |   ├── ui/                             # Reusable UI components
|   |   ├── WindowChrome/
|   |   |   ├── DesktopShell.jsx            # Desktop app wrapper component
|   |   |   └── TopMenuBar.jsx              # Custom renderer-based native top menu bar
|   |   ├── AboutAppModal.jsx               # About the app modal
|   |   ├── AppErrorBoundary.jsx            # Top-level React error boundary component
|   |   ├── AuthStatusIndicator.jsx         # Authentication status component
|   |   ├── AutoplaySettings.jsx            # Autoplay settings modal
|   |   ├── ConnectionBackoffBanner.jsx     # Global connection backoff modal component
|   |   ├── ConnectionDiagnosticsModal.jsx  # Connection diagnostics modal component
|   |   ├── DraftApprovalModal.jsx          # Approval modal component for lyric drafts submitted from secondary controllers
|   |   ├── EasyWorshipImportModal.jsx      # Song import from local EasyWorship store wizard
|   |   ├── FontSelect.jsx                  # Custom font selection overlay
|   |   ├── HelpContent.jsx                 # Help and operation tips modal
|   |   ├── IntegrationInstructions.jsx     # Integration help modal for OBS, VMix and Wirecast
|   |   ├── IntelligentAutoplayInfo.jsx     # Intelligent Autoplay info modal
|   |   ├── LyricDisplayApp.jsx             # Main control panel UI
|   |   ├── LyricDisplayApp/                # Presentational pieces for the main control panel
|   |   |   ├── ControlPanelHeaderActions.jsx # Control panel top action grid
|   |   |   ├── ControlPanelModals.jsx      # Control panel modal mount points
|   |   |   ├── LyricsDragOverlay.jsx       # Drag-and-drop overlay for lyrics and setlists
|   |   |   ├── LyricsWorkspace.jsx         # Main lyrics header, search, autoplay, setlist, and lyrics list workspace
|   |   |   └── QuickParserPopover.jsx      # Quick parser controls popover
|   |   ├── LyricsList.jsx                  # Control panel lyrics list UI
|   |   ├── LyricsList/                     # Presentational pieces for the control panel lyrics list
|   |   |   ├── layout.js                   # Shared lyrics list row layout constants
|   |   |   ├── LyricLineContent.jsx        # Lyric line/group text renderer with search highlighting
|   |   |   ├── LyricRow.jsx                # Shared virtualized and non-virtualized lyric row component
|   |   |   ├── LyricsListContextMenu.jsx   # Lyrics list context menu component
|   |   |   ├── SectionChips.jsx            # Section jump chips for parsed song sections
|   |   |   └── TutorialLineAnchor.jsx      # Stage-only marker tutorial anchor wrapper
|   |   ├── MobileLayout.jsx                # Minified control panel UI for secondary connected clients
|   |   ├── NdiOutputSettingsModal.jsx      # NDI output settings modal for each output
|   |   ├── NewSongCanvas.jsx               # New/edit song text editor
|   |   ├── NewSongCanvas/                  # Presentational pieces for the song canvas editor
|   |   |   ├── CanvasContextMenu.jsx       # Canvas context menu and submenus
|   |   |   ├── CanvasFloatingToolbar.jsx   # Floating selected-line action toolbar
|   |   |   ├── CanvasMeasurementLayer.jsx  # Hidden text measurement layer for canvas line metrics
|   |   |   ├── CanvasSearchPanel.jsx       # Canvas search and replace popover
|   |   |   └── SongCanvasHeader.jsx        # Song canvas header, title input, and toolbars
|   |   ├── OnlineLyricsSearchModal.jsx     # Online Lyrics Search modal
|   |   ├── OnlineLyricsSearchModal/         # Presentational pieces for online lyrics search
|   |   |   ├── LyricsSearchResults.jsx   # Suggestion and full-result list renderers
|   |   |   └── ProviderAdvancedPanel.jsx # Featured providers, key management, and provider status
|   |   ├── OnlineLyricsWelcomeSplash.jsx   # Online Lyrics Search welcome and help modal component
|   |   ├── OutputSettingsPanel.jsx         # Settings panel interface
|   |   ├── OutputSettingsPanel/            # Presentational pieces for output settings
|   |   |   ├── BackgroundBandSettingsSection.jsx # Background band height and padding controls
|   |   |   ├── DropShadowSettingsSection.jsx # Drop shadow color, opacity, offset, and blur controls
|   |   |   ├── FontSizeSettingsSection.jsx # Font size, max lines, and translation-size controls
|   |   |   ├── FullscreenSettingsSection.jsx # Fullscreen background and image element controls
|   |   |   ├── PanelHeaderActions.jsx      # Output enable, template, NDI, and help action buttons
|   |   |   ├── TransitionSettingsSection.jsx # Transition animation and speed controls
|   |   |   └── TypographySpacingSection.jsx # Letter spacing, line spacing, and text border controls
|   |   ├── OutputSettingsShared.jsx        # Shared UI components for output and stage settings panel
|   |   ├── OutputTemplatesModal.jsx        # Output settings templates modal
|   |   ├── PresentationImportModal.jsx     # Presentation file import/conversion modal
|   |   ├── PreviewOutputsModal.jsx         # Display outputs preview modal
|   |   ├── ProjectOutputModal.jsx          # Projector/stage output creation and management modal
|   |   ├── QRCodeDialog.jsx                # QR Code Dialog UI for mobile controller connection
|   |   ├── SaveTemplateModal.jsx           # Save settings combo as template modal
|   |   ├── SearchBar.jsx                   # Search bar component for control panel
|   |   ├── SetlistExportModal.jsx          # Setlist export modal
|   |   ├── SetlistModal.jsx                # Setlist modal
|   |   ├── SongInfoModal.jsx               # Info modal for loaded lyrics
|   |   ├── StageSettingsPanel.jsx          # Stage settings interface
|   |   ├── StageTemplatesModal.jsx         # Stage settings templates modal
|   |   ├── SupportDevelopmentModal.jsx     # Support development modal
|   |   ├── TimerControlModule.jsx          # Dedicated timer control window module
|   |   ├── UserMediaModal.jsx              # Reusable user media library picker and upload modal
|   |   ├── UserPreferencesModal.jsx        # User preferences UI
|   |   ├── UserPreferencesModal/           # Presentational pieces for user preferences
|   |   |   ├── AdvancedPreferencesSection.jsx # Advanced settings and security-token controls
|   |   |   ├── ExternalControlPreferencesSection.jsx # MIDI and OSC settings controls
|   |   |   ├── NdiPreferencesSection.jsx    # NDI companion status, download, and auto-launch controls
|   |   |   └── UserPreferencesLayout.jsx    # Two-pane preferences modal shell, sidebar, header actions, and footer
|   |   └── WelcomeSplash.jsx               # Welcome splash modal for first time install
│   ├── constants/
|   |   ├── easyWorship.js                  # Some EasyWorship constants
|   |   ├── fonts.js                        # Featured fonts dropdown store
|   |   ├── lyricsFormat.js                 # Constants used in lyrics formatting/cleanup utility
|   |   ├── modalEvents.js                  # Shared modal event constants for global close handling
|   |   ├── presentationImport.js           # Presentation file import constants
|   |   ├── shortcuts.js                    # Keyboard shortcut definitions used for shortcuts help modal
|   |   └── songCanvas.js                   # Some constants used in canvas editor
│   ├── context/
|   |   ├── ControlSocketProvider.jsx       # Control socket provider
|   |   ├── LyricsStore.js                  # Global Zustand store definitions
|   |   └── NdiStore.js                     # NDI Zustand store definitions
│   ├── hooks/
|   |   ├── LyricDisplayApp/
|   |   |   ├── useControlPanelFileActions.js # Control panel file, editor, setlist, and modal open actions
|   |   |   ├── useCustomOutputActions.js   # Custom output add/delete actions for the control panel
|   |   |   ├── useDragAndDrop.js           # Drag and drop operations for control panel
|   |   |   ├── useElectronListeners.js     # Hook for listening to main process events and broadcasts for control panel
|   |   |   ├── useKeyboardShortcuts.js     # Keyboard entry listener for control panel
|   |   |   ├── useLineCounterText.js       # Loaded lyric line counter text calculation
|   |   |   ├── useLyricsLoader.js          # Multi-source lyrics load processor for control panel 
|   |   |   ├── useLrcTimestampHydration.js # Stored LRC timestamp and section restoration
|   |   |   ├── useQuickParserControls.js   # Quick parser state, preferences sync and reload handling
|   |   |   ├── useMenuShortcuts.js         # Hook for handling menu navigation/shortcuts
|   |   |   ├── useOutputControlActions.js  # Display output toggle, clear, and settings tab actions
|   |   |   ├── useOutputSettings.js        # Hook for output settings tab switcher
|   |   |   ├── usePendingLyricsLoad.js     # Startup pending lyrics load handoff
|   |   |   ├── usePendingSavedVersionPrompt.js # Prompt for loading recently saved lyrics
|   |   |   ├── useRegisterCustomOutputs.js # NDI custom output registration effect
|   |   |   ├── useResetLyricsScroll.js     # Lyrics list reset-scroll event listener
|   |   |   ├── useResponsiveWidth.js       # Window resize observer hook for control panel button responsiveness
|   |   |   ├── useSetlistActions.js        # Hook for setlist action functionality
|   |   |   ├── useSetlistNavigation.js     # Previous/next setlist navigation actions
|   |   |   └── useSupportDevModal.js       # Hook for processing show time and parameters for support development modal
|   |   ├── LyricsList/
|   |   |   ├── useElectronListeners.js     # Hook for listening to main process events and broadcasts for lyrics list
|   |   |   ├── useLyricsListGrouping.js    # Lyrics list grouping and ungrouping operations
|   |   |   ├── useLyricsListHistory.js     # Lyrics list undo/redo history state and Electron menu integration
|   |   |   ├── useLyricsListRows.js        # Lyrics list row metadata, row height, and class-name logic
|   |   |   ├── useLyricsListSelection.js   # Lyrics list selection, context-menu, copy, and send-to-output behavior
|   |   |   ├── useSectionNavigation.js     # Lyrics section chips and scroll-to-line behavior
|   |   |   └── useStageOnlyTutorial.js     # Stage-only marker tutorial state and preference handling
|   |   ├── NewSongCanvas/
|   |   |   ├── useCanvasDismissalEffects.js # Canvas escape-key and outside-click dismissal effects
|   |   |   ├── useCanvasEditorInteractions.js # Canvas textarea, context-menu, touch, metadata, and section interactions
|   |   |   ├── useCanvasEditorLayout.js    # Canvas layout measurements, scroll restore, and line offsets
|   |   |   ├── useCanvasLoadLifecycle.js   # Canvas initial load, edit-mode load, and Electron load handoff lifecycle
|   |   |   ├── useCanvasNavigationActions.js # Canvas back, new-song, open-file, and preferences actions
|   |   |   ├── useCanvasSearch.js          # Content search hook for editing area/canvas
|   |   |   ├── useCanvasSearchHighlight.js # Search match highlight positioning and scroll behavior
|   |   |   ├── useDraftEvents.js           # Secondary-controller draft submission event handlers
|   |   |   ├── useDraftLoader.js           # Compose-mode draft formatting and submit action
|   |   |   ├── useEditorClipboard.js       # Hook for cut, copy and paste handlers
|   |   |   ├── useEditorHistory.js         # Hook for history state management of lyrics editor canvas
|   |   |   ├── useEditorUndoRedoShortcuts.js # Undo/redo metadata restore and keyboard shortcuts
|   |   |   ├── useElectronListeners.js     # Hook for listening to main process events and broadcasts for new song canvas
|   |   |   ├── useFileSave.js              # Canvas file operations hook
|   |   |   ├── useKeyboardShortcuts.js     # Keyboard entry listener for canvas
|   |   |   ├── useLineMeasurements.js      # Hook for measuring and calculating line dimensions in canvas
|   |   |   ├── useLineOperations.js        # Hook for line manipulation operations in canvas
|   |   |   ├── useLrcEligibility.js        # Hook for determining LRC format eligibility
|   |   |   ├── usePendingCanvasFocus.js    # Deferred textarea focus and selection restoration
|   |   |   ├── useTimestampOperations.js   # Hook for timestamp handling and operations
|   |   |   └── useTitlePrefill.js          # Hook for auto-prefilling song title in canvas
|   |   ├── OnlineLyricsSearchModal/
|   |   |   ├── useKeyboardShortcuts.js     # Keyboard entry listener for online lyrics search modal
|   |   |   ├── useLyricsProviderKeys.js    # Provider key loading, editing, saving, and deletion
|   |   |   └── useNetworkStatus.js         # Internet connection status hook
|   |   ├── OutputSettingsPanel/
|   |   |   ├── useAdvancedSectionPersistence.js # Hook for advanced sections visibility states
|   |   |   ├── useFullscreenAdvancedAutoExpand.js # Fullscreen advanced section auto-expand and reveal behavior
|   |   |   ├── useFullscreenBackground.js  # Hook for handling fullscreen background controls
|   |   |   ├── useFullscreenElementMedia.js # Fullscreen overlay image selection and defaults
|   |   |   ├── useFullscreenModeState.js   # Fullscreen mode and settings visibility state hook
|   |   |   ├── useOutputToggle.js          # Individual output switch manager
|   |   |   ├── useStageDisplayControls.js  # Hook for stage display controls
|   |   |   └── useTypographyAndBands.js    # Background band and related logic hook
|   |   ├── SetlistModal/
|   |   |   └── useSetlistLoader.js         # Hook for setlist file loading functionality
|   |   ├── UserPreferencesModal/
|   |   |   ├── useMidiPreferences.js       # MIDI status, learning, mapping, and port actions
|   |   |   ├── useNdiPreferences.js        # NDI companion store selectors and companion actions
|   |   |   ├── useNumberPreferenceDrafts.js # Numeric preference draft and commit helpers
|   |   |   ├── useOscPreferences.js        # OSC enable, port, and feedback actions
|   |   |   ├── usePreferencesPersistence.js # Preferences load, save, browse, and category reset lifecycle
|   |   |   └── useSecurityPreferences.js    # Security token key status and rotation actions
|   |   ├── WindowChrome/
|   |   |   ├── useMenuHandlers.js          # Menu operations hook for top menu bar
|   |   |   ├── useSubMenuListNav.js        # Hook for handling top menu bar sub-menu navigation
|   |   |   └── useTopMenuState.js          # Top menu bar state definitions
|   |   ├── useAuth.js                      # Authenticator hook for socket connections
|   |   ├── useAutoplayManager.js           # Autoplay engine and logic
|   |   ├── useContextMenuPosition.js       # Hook for space-aware context menu positioning
|   |   ├── useContextSubmenus.js           # Context submenus definitions and logic
|   |   ├── useDarkModeSync.js              # Hook for global dark mode sync
|   |   ├── useExternalControl.js           # Hook for external control (MIDI, OSC, etc.)
|   |   ├── useFileUpload.js                # Custom React hook for file uploads
|   |   ├── useModal.js                     # Global modal hook
|   |   ├── useMultipleFileUpload.js        # Multiple file upload handler
|   |   ├── useSearch.js                    # Hook for search bar functionality
|   |   ├── useSharedTimer.js               # Shared timer state, persistence, and sync hook
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
|   |   ├── Stage.jsx                       # Stage output display
|   |   └── TimeDisplay.jsx                 # Dedicated full-screen timer and clock display
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
|   |   ├── outputLabels.js                 # Output label builder utility for settings panel, etc.
|   |   ├── outputTemplates.js              # Output templates for settings panel
|   |   ├── parseLrc.js                     # LRC file parser
|   |   ├── parseLyrics.js                  # Text file parser
|   |   ├── secureTokenStore.js             # Secure token storage utility
|   |   ├── stageMessages.js                # Stage display helper messages and fallback text constants
|   |   ├── timerUtils.js                   # Shared timer defaults, normalization, and formatting helpers
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

Please read the [Contribution Guide](CONTRIBUTING.md) and follow the [Code of Conduct](CODE_OF_CONDUCT.md) when participating in the project.

## Troubleshooting

### Common Issues

**Output windows not displaying:**
- Verify backend server is running (Port 4000 active)
- Ensure Socket.io connection is established (Connected status in top bar)
- Try refreshing browser sources in OBS/vMix/Wirecast

## License & Credits

LyricDisplay is free software licensed under the GNU General Public License,
version 3 or later. See [LICENSE](LICENSE) for the full license text.

## Lyrics Provider Credits & Copyright Disclaimer

LyricDisplay integrates optional online lyrics search features powered by free and publicly available lyrics providers.  
All lyrics, metadata, and related content displayed through these services remain the property of their respective copyright holders.

### Integrated Providers
- **LRCLIB** — Free synced lyrics database with nearly 3 million lyrics. No API key required. Provides both plain and timestamped (LRC format) lyrics.
- **ChartLyrics** — Free public lyrics API with good coverage of popular songs. No API key required.
- **Lyrics.ovh** — Free lyrics API (public domain and licensed material) provided for educational and non-commercial use.  
- **Open Hymnal Project** — Public domain hymn texts and music as compiled by the Open Hymnal Project.

### NDI® Trademark Notice
NDI® is a registered trademark of Vizrt NDI AB. LyricDisplay uses the NDI SDK via the open-source [grandi](https://www.npmjs.com/package/grandi) module for video output over IP networks. This project is not affiliated with or endorsed by Vizrt NDI AB. For more information about NDI, visit [ndi.video](https://ndi.video).

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

**Copyright (C) 2026 Peter Alakembi and contributors.**

**Developers:**
- Peter Alakembi (Lead Designer and Developer)
- David Okaliwe (Co-Developer)

**Links:**
- [Our Website](https://lyricdisplay.app)
- [Developer Portfolio](https://linktr.ee/peteralaks)
- [Support Development](https://buymeacoffee.com/lyricdisplay)

## Support

For technical support, feature requests, or bug reports:
- Open an issue on the issues tab
- Check existing documentation
- Review troubleshooting section

---

*LyricDisplay - Powering worship experiences worldwide*
