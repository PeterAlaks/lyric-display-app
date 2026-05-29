# Project Structure

This document summarizes the main directories and entry points in the LyricDisplay repository.

```text
lyric-display-app/
|-- .github/                 # GitHub workflows and repository metadata
|-- .husky/                  # Git hooks
|-- build/                   # Build resources
|-- dist/                    # Generated production frontend build
|-- docs/                    # Additional project documentation
|-- lyricdisplay-ndi/        # NDI companion project used during development
|-- main/                    # Electron main-process modules
|-- public/                  # Static assets
|-- scripts/                 # Release and maintenance scripts
|-- server/                  # Express and Socket.IO backend
|-- shared/                  # Shared parsing and data modules
|-- src/                     # React renderer application
|-- uploads/                 # Local uploaded media during runtime
|-- index.html               # Vite HTML entry point
|-- main.js                  # Electron main-process entry point
|-- preload.js               # Electron preload script
|-- package.json             # Root package, scripts, dependencies, and build config
|-- tailwind.config.js       # Tailwind configuration
`-- vite.config.js           # Vite configuration
```

## Main Process

```text
main/
|-- ipc/                     # IPC handler registration and domain handlers
|-- lyricsProviders/         # Online lyrics provider integrations
|-- ndi/                     # NDI companion lifecycle and output settings
|-- backend.js               # Backend server startup helper
|-- displayManager.js        # External display assignment and management
|-- externalControl.js       # MIDI and OSC control integration
|-- logging.js               # Production logging and diagnostics
|-- startup.js               # App startup flow
|-- updater.js               # App update handling
`-- windows.js               # Main and output window creation
```

## Backend

```text
server/
|-- auth/                    # Token, permission, socket, and join-code helpers
|-- config/                  # Backend configuration constants
|-- media/                   # Uploaded media handling
|-- middleware/              # Express middleware
|-- realtime/                # Socket.IO state and event handlers
|-- routes/                  # HTTP API routes
|-- security/                # Secret management
|-- events.js                # Socket event registration
|-- index.js                 # Backend bootstrap
`-- package.json             # Backend dependencies
```

## Renderer

```text
src/
|-- components/              # React UI components
|-- constants/               # Renderer constants
|-- context/                 # Zustand stores and socket providers
|-- hooks/                   # Shared and feature-specific React hooks
|-- integrations/            # OBS and source URL helpers
|-- lib/                     # UI utility helpers
|-- pages/                   # Route-level pages and output displays
|-- styles/                  # Font and style imports
|-- utils/                   # Renderer utilities
|-- workers/                 # Web workers
|-- App.jsx                  # Main React app component
|-- index.css                # Global styles
`-- main.jsx                 # React entry point
```

## Shared Modules

```text
shared/
|-- data/                    # Bundled lyric search data
`-- lyricsParsing/           # Shared lyric parsing logic
```

## Supporting Documentation

```text
docs/
|-- asyncapi.yaml            # Socket/API event documentation
|-- crossplatformbuilds.md   # Cross-platform build notes
|-- openapi.yaml             # HTTP API documentation
`-- PROJECT_STRUCTURE.md     # This file
```
