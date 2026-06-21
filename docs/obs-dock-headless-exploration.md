# LyricDisplay Dock Headless Exploration

## Purpose

LyricDisplay supports users who want basic control inside OBS without keeping the normal desktop window open. The target flow is:

- start LyricDisplay in a headless/background mode,
- use an OBS Custom Browser Dock as the control surface,
- keep desktop/admin capabilities out of the dock,
- let the user open the main app window only when needed.

## Important Finding

OBS Custom Browser Docks may not reliably hand custom app protocols such as `lyricdisplay://start-headless` to the operating system. In testing, some OBS/browser paths attempted to load the custom protocol as a page and showed `ERR_UNKNOWN_URL_SCHEME`.

The static dock launcher must therefore be treated as a browser-only client. It checks whether LyricDisplay Dock Mode is ready and then navigates to the controller. If the normal desktop app is already running, it can request a Dock Mode switch through the local backend. If LyricDisplay is not running at all, it must direct the user to the installed Dock Mode shortcut, the desktop app, or Start at Sign-In.

## Runtime Modes

### Normal Desktop Mode

The existing Electron startup creates the desktop UI. Desktop clients keep their existing privileged desktop authentication, while web/mobile controllers continue to use join-code auth.

### LyricDisplay Dock Headless Mode

LyricDisplay Dock headless mode can be triggered by:

```text
--headless
--obs-dock
LYRICDISPLAY_HEADLESS=1
```

In headless mode:

- no normal renderer window is created,
- the backend is started,
- local LyricDisplay Dock auth is enabled,
- display, NDI, and related service infrastructure are initialized,
- app activation does not automatically open a window,
- the local backend can ask Electron to open the main desktop window through `/api/app/open-main-window`,
- the local backend can ask Electron to switch a running desktop session to Dock Mode through `/api/app/switch-to-dock-mode`.

## Primary Production Flow

1. Install LyricDisplay.
2. Open LyricDisplay once.
3. In Advanced Settings, open `LyricDisplay Dock Setup` to copy the exact local HTML URL for this install. This is the only URL users should add as an OBS Custom Browser Dock.
4. In OBS, add a Custom Browser Dock pointing to the installed local file:

```text
file:///C:/Program Files/LyricDisplay/obs-dock.html
```

5. Start Dock Mode from the app with `Switch to Dock Mode`, enable `Start at Sign-In`, or use the packaged `LyricDisplay Dock Mode` Start Menu shortcut.
6. Click `Open Controller` in the dock launcher. The launcher checks:

```text
http://127.0.0.1:4000/api/health/ready
```

7. When Dock Mode is ready, the same LyricDisplay Dock page navigates itself to:

```text
http://127.0.0.1:4000/#/obs-dock
```

8. `Switch to Dock Mode` relaunches the installed app with:

```text
--headless --obs-dock
```

9. If automatic startup is preferred, enable `Start at Sign-In` in the same `LyricDisplay Dock` section. LyricDisplay registers a login item that starts the app with:

```text
--headless --obs-dock
```

10. LyricDisplay Dock obtains a limited local `obsDock` token and connects as the dock controller.

The packaged `Start LyricDisplay Dock Mode.cmd` remains a manual fallback/debug tool. The Start Menu `LyricDisplay Dock Mode` shortcut is the intended user-facing cold-start option when Start at Sign-In is disabled.

## Development Flow

Use the local development launcher file as the OBS custom dock URL:

```text
file:///D:/path/to/lyric-display-app/obs-dock.html?mode=dev
```

Development has two separate lifecycles:

```text
npm run electron-dev
```

This starts Vite and a normal Electron desktop window. Electron starts the backend as its child process. When the desktop Electron process quits, its cleanup stops the backend. The Vite process is owned by the terminal/concurrently session.

```text
npm run electron-dev:headless
```

This is the supported dev headless flow. The script owns the lifecycle:

- it registers the dev protocol as a convenience, but the dock does not depend on it,
- it starts Vite only if `http://127.0.0.1:5173/?dock=obs&clientType=obsDock` is not already reachable,
- it starts Electron with `LYRICDISPLAY_HEADLESS=1` and `--headless`,
- Electron starts the backend on `127.0.0.1:4000`,
- stopping the script stops the Electron process and any Vite process that the script started.

The in-app `Switch to Dock Mode` and `Start at Sign In` controls are hidden in development. Relaunching from a normal `npm run electron-dev` desktop session crosses process owners and is not treated as a reliable dev path.

The static dock launcher checks both the backend and Vite, then `Open Controller` redirects to:

```text
http://127.0.0.1:5173/?dock=obs&clientType=obsDock
```

If either service is missing, the launcher reports the missing side and tells the developer to run `npm run electron-dev:headless` from the app folder.

## Authentication Model

`web`, `mobile`, and ordinary controller clients still use the existing join-code path.

LyricDisplay Dock headless mode enables local dock auth. `/api/auth/obs-dock/token` can mint a limited `obsDock` JWT when all of the following are true:

- the request is loopback-only,
- the browser origin is local, including `file://`/`null`, `localhost`, or `127.0.0.1`,
- headless local LyricDisplay Dock auth is enabled,
- the token is for the `obsDock` client type, not desktop/admin.

Protocol pairing tokens still exist as a fallback for browsers that can hand off `lyricdisplay://`, but LyricDisplay Dock startup must not depend on them.

## Local App Control

LyricDisplay Dock can ask a running Dock Mode Electron process to open the main app window:

```text
POST http://127.0.0.1:4000/api/app/open-main-window
```

The backend route is loopback/local-origin constrained, then sends an IPC message to Electron. Electron creates or focuses the main window.

LyricDisplay Dock can also ask a normal running desktop Electron process to switch to Dock Mode:

```text
POST http://127.0.0.1:4000/api/app/switch-to-dock-mode
```

The backend route is loopback/local-origin constrained, then sends an IPC message to Electron. Electron focuses the desktop window, asks the user to confirm, and relaunches with `--headless --obs-dock` only after confirmation.

## Packaged Files

`package.json` packages these root-level installed files using `build.extraFiles`:

- `obs-dock.html`
- `LyricDisplay-icon.png`
- `Start LyricDisplay Dock Mode.cmd`

On Windows, they should appear beside `LyricDisplay.exe`, for example:

```text
C:\Program Files\LyricDisplay\obs-dock.html
C:\Program Files\LyricDisplay\Start LyricDisplay Dock Mode.cmd
C:\Program Files\LyricDisplay\LyricDisplay-icon.png
```

The Windows installer also creates a Start Menu shortcut named `LyricDisplay Dock Mode` that starts `LyricDisplay.exe --headless --obs-dock`.

## Known Limitations

- A web-only OBS Custom Browser Dock cannot guarantee native process launch.
- The launcher reports readiness and relies on explicit app, Start Menu shortcut, login-item, helper-command, or terminal startup flows.
- Dev headless startup is terminal-owned. The app does not offer dev relaunch controls.
- LyricDisplay Dock is not a full desktop replacement.
- The local headless auth path must remain limited to `obsDock`.

## Verification Checklist

1. Rebuild and reinstall the Windows package.
2. Confirm `obs-dock.html`, `LyricDisplay-icon.png`, and `Start LyricDisplay Dock Mode.cmd` appear beside `LyricDisplay.exe`.
3. Confirm the Start Menu includes both `LyricDisplay` and `LyricDisplay Dock Mode`.
4. Open `LyricDisplay Dock Setup` from Advanced Settings and from Tools.
5. Confirm it shows only the copyable installed `obs-dock.html` file URL as the LyricDisplay Dock URL.
6. Click `Switch to Dock Mode`, confirm the warning, and verify the app relaunches without the main window.
7. Enable `Start at Sign-In` and confirm the login item is registered with `--headless --obs-dock`.
8. Test the production LyricDisplay Dock using the installed `obs-dock.html`.
9. With LyricDisplay closed, confirm the launcher does not navigate to `lyricdisplay://` and instead tells the user to start `LyricDisplay Dock Mode`.
10. With LyricDisplay open normally, confirm `Switch to Dock Mode` requests confirmation in LyricDisplay and then relaunches into Dock Mode.
11. Confirm `Open Controller` connects to Dock Mode and loads the controller in the same dock.
12. Confirm the LyricDisplay Dock `Open LyricDisplay` action opens/focuses the main window.
13. In dev, confirm the normal preferences UI hides `Switch to Dock Mode` and `Start at Sign-In`.
14. In dev, run `npm run electron-dev:headless`, load `obs-dock.html?mode=dev`, and confirm `Open Controller` opens only after the backend and Vite are ready.

## Security Notes

- Desktop/admin privileges stay inside Electron.
- LyricDisplay Dock receives only `obsDock` permissions.
- Local headless auth is loopback/local-origin constrained.
- Local app-control routes are loopback/local-origin constrained.
- Join-code auth remains available for ordinary web/mobile controllers.
