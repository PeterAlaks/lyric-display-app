# LyricDisplay Contribution Guide

Thank you for helping build LyricDisplay. This guide captures the conventions the codebase already follows and how to work productively across the Electron shell, Express/socket backend, and React control/output UIs.

**IMPORTANT NOTE:** A significant portion of this project was developed with the assistance of AI coding tools and large language models. Contributions that refactor, improve maintainability, and align the codebase with established best practices and development standards are highly encouraged and welcome.

## Getting Started
- Use Node 18+ and npm. Install deps with `npm install`.
- **NDI Broadcasting (optional):** The NDI companion is a separate repo. To work on NDI features locally, clone it into the project root: `git clone https://github.com/PeterAlaks/lyricdisplay-ndi.git` then `cd lyricdisplay-ndi && npm install`. The app detects it automatically in dev mode. Without it, the NDI feature simply shows "Not Installed" — everything else works normally.
- Development: `npm run electron-dev` (spins up Vite + Electron + backend). Frontend only: `npm run dev`. Backend only: `npm run server`.
- Production build: `npm run build` (Vite) and `npm run electron-pack` for installers.
- Do not commit artifacts from `dist/`, `build/`, `release/`, or `uploads/`.

## Architecture Snapshot
- **Frontend (`src/`)**: React 19 + Vite + Tailwind. Zustand (`context/LyricsStore.js`) persists control state (lyrics, selections, styling). Routing uses HashRouter in production. Reusable UI lives in `components/ui`, modals/toasts are provided via `ModalProvider` and `ToastProvider`.
- **Output views (`pages/Output1|Output2|Stage.jsx`)**: Socket-driven displays that render a single current line with styling/autosizing/background media, using framer-motion for transitions.
- **Control panel (`components/LyricDisplayApp.jsx`)**: Desktop-first controller with setlists, online lyrics search, autoplay (interval and timestamp-driven), intelligent search, and styling panels for each output.
- **Backend (`server/`)**: Express + Socket.IO with JWT auth, join-code guard for controllers, media upload endpoints (200 MB max, limited MIME types), and secret rotation support. Socket events live in `server/events.js` and enforce permissions.
- **Electron main process (`main/`)**: Window creation, IPC bridges, updater, display assignments, EasyWorship import, secure token storage, and menu integration. Shared parsing lives in `shared/`.

## Code Style and Patterns
- Use modern ESM, functional React components, and hooks. Keep JSX readable and prefer small composable pieces.
- Styling: Tailwind utility classes and the small UI kit in `components/ui`. Reuse shared components (e.g., `Switch`, `Tabs`, tooltip) instead of ad-hoc DOM.
- State: Pull selectors from `hooks/useStoreSelectors` to avoid redundant subscription logic. Keep persistence-friendly shapes (avoid storing transient DOM data).
- Sockets: Use `useSocket` / `useControlSocket` emitters. Never bypass permission checks on the server—mirror existing event names/payload shapes in `server/events.js`.
- Parsing: Use `shared/lyricsParsing.js`/`shared/lineSplitting.js` helpers for TXT/LRC handling to keep desktop, backend, and renderer in sync.
- File I/O and dialogs: Go through IPC handlers in `main/ipc.js`; avoid accessing Node APIs directly from the renderer.
- Logging: Use `utils/logger.js` helpers. Avoid logging tokens, admin keys, or raw JWTs.

## Feature-Specific Guidelines
- **Setlists**: Max 50 items enforced in server and UI—preserve this unless you also update guardrails and UX. Keep metadata (`fileType`, `addedBy`, `sections`) intact when emitting events.
- **Outputs**: When changing styling logic, update both control panel writers and output readers. `maxLines` autosizing is calculated client-side and mirrored to the control panel via `emitOutputMetrics`.
- **Background media**: Uploads go to `/api/media/backgrounds` with strict MIME/size filters; cleanup code prunes old files per output. Respect these constraints if adjusting limits.
- **Authentication**: Desktop tokens require admin key in production; controller tokens require the 6-digit join code plus rate limiting. Maintain these flows when altering auth.
- **Shortcuts and menus**: Keyboard/menu integrations live in `hooks/LyricDisplayApp/useMenuShortcuts.js` and Electron menu templates. Add new actions in both places.

## Testing and Verification
- Quick smoke before PRs: load a `.txt` and `.lrc`, verify translation grouping, toggle outputs on/off, open Output1/Output2 windows, and ensure lines sync across outputs and stage.
- Check setlist flows: add/remove/reorder up to 50 items, load from `.ldset`, and confirm server reflects changes (watch Socket.IO logs).
- Autoplay: test interval-based and timestamp-based modes, including stopping/starting while connected clients remain synced.
- Backgrounds: upload an image and a short video, confirm rendering on outputs and cleanup of older assets.
- Run `npm run build` to catch Vite/Electron build breaks; for backend changes, start `npm run server` and hit `/api/health`.

## Pull Request Expectations
- Keep changes focused; include rationale and screenshots/GIFs for UI-affecting work.
- Update docs/tooltips/modals when altering user-facing flows (e.g., shortcuts, output settings).
- Maintain accessibility: meaningful button labels, avoid text-only indicators for critical state (output toggles, auth indicators).
- Consider cross-platform impacts (Windows/macOS/Linux) for filesystem paths, display handling, and packaging.

## Decision Log (lightweight)
- When introducing a new protocol, event, or settings shape, document it briefly in the PR description and update relevant helpers (`useSocketEvents`, `server/events.js`, `shared/lyricsParsing.js`) to keep surfaces aligned.