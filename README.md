# LyricDisplay

> Professional real-time lyric display application for live events, church services, and multimedia presentations.

**Version:** 2.1.1  
**Author:** Peter Alakembi  
**Built for:** Victory City Media  

## Overview

LyricDisplay is a comprehensive Electron-based application designed for professional live production environments. It provides real-time lyric synchronization across multiple transparent output displays, making it ideal for church services, concerts, and live streaming setups where lyrics need to be displayed both in-house and for broadcast.

## Key Features

### 🎯 Multi-Output Display System
- **Dual Independent Outputs**: Two separate output windows with individual styling controls
- **Transparent Backgrounds**: Perfect for OBS/VMIX browser source capture
- **Real-time Synchronization**: Instant updates across all connected displays
- **Browser Source Compatible**: Works seamlessly with popular streaming software

### 📝 Advanced Lyric Management
- **Smart Text Processing**: Automatic formatting with religious word capitalization
- **Translation Support**: Groups main lyrics with bracketed translations `[Like this]`
- **Live Editing Canvas**: Built-in editor with formatting tools and auto-cleanup
- **Search & Navigation**: Advanced search with match highlighting and keyboard navigation

### 🎨 Comprehensive Styling Engine
- **13 Professional Fonts**: Including custom GarnetCapitals font
- **Typography Controls**: Bold, italic, underline, and all-caps options
- **Color Customization**: Independent font and drop shadow colors
- **Background Controls**: Adjustable opacity and color settings
- **Precise Positioning**: X/Y margin controls for pixel-perfect placement

### 🔧 Professional Features
- **Auto-Updates**: Seamless background updates via GitHub releases
- **Dark Mode**: System-integrated dark/light theme switching
- **Keyboard Shortcuts**: Full menu-driven workflow
- **Cross-Platform**: Windows, macOS, and Linux support
- **Socket.io Backend**: Reliable real-time communication

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

## File Format

LyricDisplay accepts plain text (.txt) files with the following format:

```
First verse line
[Translation or alternative text]

Second verse line
Another line without translation

Chorus line one
[Chorus translation]
```

**Formatting Rules:**
- Empty lines separate verse sections
- Bracketed lines `[like this]` are treated as translations
- Two consecutive lines where the second is bracketed will be grouped
- Automatic cleanup removes periods, capitalizes religious terms

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

| Setting | Description | Range |
|---------|-------------|-------|
| Font Style | Typography selection | 13 available fonts |
| Font Size | Text size in pixels | 24-100px |
| Font Color | Text color picker | Full spectrum |
| Drop Shadow | Shadow color and intensity | 0-10 opacity |
| Background | Background color and opacity | 0-10 opacity |
| Margins | X/Y positioning offsets | Decimal values |
| Emphasis | Bold, italic, underline, caps | Toggle options |

### Storage & Persistence
- Settings automatically saved using Zustand persistence
- Cross-session state restoration
- Electron-store integration for native preferences

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| Ctrl/Cmd+O | Load lyrics file |
| Ctrl/Cmd+N | New song canvas |
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
3. Set dimensions to match your canvas (1920 x <=300 pixels recommended)
4. Enable **Shutdown source when not visible** for performance
5. **Refresh browser when scene becomes active** for reliability

### VMIX Integration
- Add **Web Browser** input
- Use same URL format as OBS
- Configure as overlay for professional broadcast mixing

## Development

### Project Structure
```
lyric-display-app/
├── public/                                 # Static assets
|   └── index.html                          # Browser web app entry point
├── server/                                 # Express.js backend
|   ├── index.js                            # Main backend server
|   ├── events.js                           # Backend communication events
|   └── package.json                        # Backend dependencies
├── src/                                    # React frontend source
│   ├── assets/                             # Fonts, etc.
│   ├── components/                         # Reusable UI components
|   |   ├── ui/
|   |   ├── LyricDisplayApp.jsx             # Main control panel UI
|   |   ├── LyricsList.jsx                  # Control panel lyrics list UI
|   |   ├── NewSongCanvas.jsx               # New/edit song text editor
|   |   └── OutputSettingsPanel.jsx         # Settings panel interface
│   ├── context/
|   |   └── LyricsStore.js                  # Zustand store definitions
│   ├── hooks/
|   |   ├── useFileUpload.js                # Custom React hook for file uploads
|   |   └── useSocket.js                    # Custom React hook for Socket.IO client
│   ├── lib/
|   |   └── utils.js                        # Utility functions
│   ├── pages/                              # Route-based page components
|   |   ├── ControlPanel.jsx                # Control panel page wrapper
|   |   ├── Output1.jsx                     # Output 1 display
|   |   └── Output2.jsx                     # Output 2 display
│   ├── utils/
|   |   └── parseLyrics.js                  # Text file parser
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

**Copyright © 2025 Victory City Media. All Rights Reserved.**

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

## Version History

**v2.1.1** - Current Release
- Enhanced stability and performance
- Improved Socket.io reliability
- Advanced search and navigation features
- Professional styling engine
- Auto-update functionality

---

*LyricDisplay - Powering worship experiences worldwide*
