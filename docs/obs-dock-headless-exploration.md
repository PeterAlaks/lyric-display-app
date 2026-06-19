# OBS Dock Headless Exploration

## Purpose

LyricDisplay supports users who want basic control inside OBS without keeping the normal desktop window open. The target flow is:

- start LyricDisplay in a headless/background mode,
- use an OBS Custom Browser Dock as the control surface,
- keep desktop/admin capabilities out of the dock,
- let the user open the main app window only when needed.

## Important Finding

OBS Custom Browser Docks do not reliably hand custom app protocols such as `lyricdisplay://start-headless` to the operating system. In testing, OBS attempted to load the custom protocol as a page and showed `ERR_UNKNOWN_URL_SCHEME`.

The production design therefore does not depend on OBS starting LyricDisplay. LyricDisplay is started outside OBS, preferably through an app-managed login item, and the OBS dock only connects to the already-running local background runtime.

## Runtime Modes

### Normal Desktop Mode

The existing Electron startup creates the desktop UI. Desktop clients keep their existing privileged desktop authentication, while web/mobile controllers continue to use join-code auth.

### Headless OBS Mode

Headless OBS mode can be triggered by:

```text
--headless
--obs-dock
LYRICDISPLAY_HEADLESS=1
```

In headless mode:

- no normal renderer window is created,
- the backend is started,
- local OBS dock auth is enabled,
- display, NDI, and related service infrastructure are initialized,
- app activation does not automatically open a window,
- the local backend can ask Electron to open the main desktop window through `/api/app/open-main-window`.

## Primary Production Flow

1. Install LyricDisplay.
2. Open LyricDisplay once.
3. In Advanced Settings, open `OBS Dock Setup` to copy the exact local HTML URL for this install. This is the only URL users should add as an OBS Custom Browser Dock.
4. To avoid starting headless at every sign-in, click `Start Headless Now`. LyricDisplay warns that current app windows will close, then relaunches with:

```text
--headless --obs-dock
```

5. If automatic startup is preferred, enable `Start at Sign In` in the same `OBS Dock / Headless Mode` section. LyricDisplay registers a login item that starts the app with:

```text
--headless --obs-dock
```

6. In OBS, add a Custom Browser Dock pointing to the installed local file:

```text
file:///C:/Program Files/LyricDisplay/obs-dock.html
```

7. The dock home screen checks:

```text
http://127.0.0.1:4000/api/health/ready
```

8. If the background runtime is ready, the same OBS dock navigates itself to:

```text
http://127.0.0.1:4000/#/obs-dock
```

9. The dock obtains a limited local `obsDock` token and connects as the OBS dock controller.

The packaged `Start LyricDisplay Headless.cmd` remains a fallback/debug tool, but it is no longer the intended primary user flow.

## Development Flow

Use the local development launcher file as the OBS custom dock URL:

```text
file:///D:/path/to/lyric-display-app/obs-dock-dev.html
```

Start the dev headless runtime explicitly:

```text
npm run electron-dev:headless
```

Then click `Start OBS Dock` in the dock home screen. The launcher checks the backend and Vite, then the same OBS dock redirects to:

```text
http://localhost:5173/obs-dock
```

This avoids relying on custom protocol handoff from OBS during development.

## Authentication Model

`web`, `mobile`, and ordinary controller clients still use the existing join-code path.

Headless OBS mode enables local OBS dock auth. `/api/auth/obs-dock/token` can mint a limited `obsDock` JWT when all of the following are true:

- the request is loopback-only,
- the browser origin is local, including `file://`/`null`, `localhost`, or `127.0.0.1`,
- headless local OBS dock auth is enabled,
- the token is for the `obsDock` client type, not desktop/admin.

Protocol pairing tokens still exist as a fallback for browsers that can hand off `lyricdisplay://`, but OBS dock startup must not depend on them.

## Local App Control

The OBS dock can ask a running headless Electron process to open the main app window:

```text
POST http://127.0.0.1:4000/api/app/open-main-window
```

The backend route is loopback/local-origin constrained, then sends an IPC message to Electron. Electron creates or focuses the main window.

## Packaged Files

`package.json` packages these root-level installed files using `build.extraFiles`:

- `obs-dock.html`
- `LyricDisplay-icon.png`
- `Start LyricDisplay Headless.cmd`

On Windows, they should appear beside `LyricDisplay.exe`, for example:

```text
C:\Program Files\LyricDisplay\obs-dock.html
C:\Program Files\LyricDisplay\Start LyricDisplay Headless.cmd
C:\Program Files\LyricDisplay\LyricDisplay-icon.png
```

## Known Limitations

- A web-only OBS dock cannot reliably start a native desktop process by itself.
- The background runtime must be started by the login item, normal app startup, or the fallback helper command.
- The OBS dock is not a full desktop replacement.
- The local headless auth path must remain limited to `obsDock`.

## Verification Checklist

1. Rebuild and reinstall the Windows package.
2. Confirm `obs-dock.html`, `LyricDisplay-icon.png`, and `Start LyricDisplay Headless.cmd` appear beside `LyricDisplay.exe`.
3. Open `OBS Dock Setup` from Advanced Settings and from Tools.
4. Confirm it shows only the copyable installed `obs-dock.html` file URL as the OBS dock URL.
5. Click `Start Headless Now`, confirm the warning, and verify the app relaunches without the main window.
6. Enable `Start at Sign In` and confirm the login item is registered with `--headless --obs-dock`.
7. Test the production OBS dock using the installed `obs-dock.html`.
8. Confirm `Start OBS Dock` connects without creating the main window and loads the controller in the same OBS dock.
9. Confirm the OBS dock `Open desktop app` action opens/focuses the main window.

## Security Notes

- Desktop/admin privileges stay inside Electron.
- OBS dock receives only `obsDock` permissions.
- Local headless auth is loopback/local-origin constrained.
- Local app-control routes are loopback/local-origin constrained.
- Join-code auth remains available for ordinary web/mobile controllers.
