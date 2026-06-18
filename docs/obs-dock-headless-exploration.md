# OBS Dock Headless Exploration

## Purpose

This document captures the current state of the LyricDisplay OBS custom dock and headless startup exploration. It is intended as a handoff for future AI agents, engineers, and maintainers.

The original request was to support users who want LyricDisplay available inside OBS without opening the normal desktop UI. The ideal target was:

- start LyricDisplay in a headless/background mode,
- use an OBS Custom Browser Dock as the control surface,
- keep privileged desktop-only capabilities secure,
- avoid disrupting existing desktop, web, mobile, and output flows.

## Current Technical Direction

The implementation now separates two concerns:

1. **Headless backend runtime**
   LyricDisplay can start Electron without creating normal renderer windows. In this mode, the backend server, display manager, NDI manager, and related service infrastructure can initialize without the main desktop UI.

2. **OBS dock controller**
   OBS loads a compact browser UI that connects as a limited `obsDock` controller client. It does not receive desktop/admin authority.

This is intentionally not a full desktop replacement. It is a focused controller optimized for OBS dock constraints.

## Important Finding

OBS Custom Browser Docks do not reliably hand custom app protocols such as `lyricdisplay://start-headless` to the operating system.

In testing, OBS attempted to load the custom protocol as a page and showed:

```text
ERR_UNKNOWN_URL_SCHEME
URL: lyricdisplay://start-headless?obsPairingToken=...
```

The launcher was updated to attempt protocol launch off-page, but OBS may still block or ignore the handoff. Therefore, the OBS dock cannot be treated as a reliable native app launcher.

The practical design is now:

- The dock landing page starts LyricDisplay through the registered app protocol, then opens the controller when the backend is ready.
- The OS-level helper command remains a fallback/debug tool, not the primary user flow.

## New Files

- `public/obs-dock.html`
  Static launcher page intended for OBS Custom Browser Docks. It checks the local backend, attempts optional protocol startup, and redirects to the dock controller route when ready.

- `obs-dock-dev.html`
  Root-level static development launcher page intended for OBS Custom Browser Docks or a browser opened from the repo. It uses the dev-only `lyricdisplay-dev://` protocol and can ask Electron to start Vite for the dock UI.

- `src/components/ObsDockLayout.jsx`
  Compact OBS dock controller UI.

- `src/utils/clientType.js`
  Resolves controller client type from URL params or route. `/obs-dock` maps to `obsDock`.

- `server/auth/obsDockPairing.js`
  Short-lived, one-time pairing token registry for protocol-based OBS dock pairing attempts.

- `build/Start LyricDisplay Headless.cmd`
  Windows fallback helper copied beside `LyricDisplay.exe`. It starts LyricDisplay in headless mode with local OBS dock authentication enabled.

## Packaging Changes

`package.json` now packages the following as root-level installed files using `build.extraFiles`:

- `obs-dock.html`
- `LyricDisplay-icon.png`
- `Start LyricDisplay Headless.cmd`

On Windows, after install, these should appear beside `LyricDisplay.exe`, for example:

```text
C:\Program Files\LyricDisplay\obs-dock.html
C:\Program Files\LyricDisplay\Start LyricDisplay Headless.cmd
C:\Program Files\LyricDisplay\LyricDisplay-icon.png
```

The launcher may still also exist inside `resources/app.asar.unpacked/dist/` because Vite copies public assets into `dist`. Users should not need that nested path.

## Runtime Modes

### Normal Desktop Mode

The existing Electron startup still creates the desktop UI.

Desktop clients authenticate through existing privileged desktop auth. Existing web/mobile controllers continue to use join-code auth.

### Headless Mode

Headless mode can be triggered by:

```text
--headless
LYRICDISPLAY_HEADLESS=1
lyricdisplay://start-headless
```

In headless mode:

- no normal renderer window is created,
- the backend is started,
- the admin key is loaded,
- resources are prewarmed,
- display and NDI infrastructure are initialized,
- app activation does not automatically open a window,
- `lyricdisplay://open` can still open the main desktop window explicitly.

## Authentication Model

### Existing Join Code

`web`, `mobile`, and `obsDock` clients still require a join code through the normal `/api/auth/token` path unless another approved OBS dock path applies.

This preserves the existing trust boundary for network/browser controllers.

### Protocol Pairing Token

The static OBS launcher generates a random `obsPairingToken` and attempts:

```text
lyricdisplay://start-headless?obsPairingToken=...
```

If the OS receives this protocol call, Electron passes the token into the backend. The OBS dock then exchanges it through:

```text
POST /api/auth/obs-dock/token
```

The token is short-lived and consumed once.

This flow is technically implemented but not reliable in OBS because OBS may block custom protocol handoff.

### Local Headless OBS Dock Auth

Because OBS blocks protocol launch in practice, headless startup can enable a local-only fallback:

```text
LYRICDISPLAY_OBS_DOCK_LOCAL_AUTH=1
```

The packaged helper command does this automatically:

```cmd
set "LYRICDISPLAY_HEADLESS=1"
set "LYRICDISPLAY_OBS_DOCK_LOCAL_AUTH=1"
start "" "%~dp0LyricDisplay.exe" --headless
```

When this flag is enabled, `/api/auth/obs-dock/token` can mint a limited `obsDock` JWT for local OBS docks without requiring the desktop join code or a protocol pairing token.

This endpoint is protected by:

- loopback-only request checks,
- allowed local origins including `file://`/`null`, `localhost`, and `127.0.0.1`,
- `obsDock` limited permissions rather than desktop/admin permissions.

## OBS Dock Permissions

`obsDock` is a controller client type. It currently receives controller permissions for:

- reading/writing lyrics,
- reading/writing setlist,
- output control,
- reading/writing settings.

It is intentionally not a desktop/admin client.

## Production User Flow

The production flow is:

1. Install LyricDisplay.
2. In OBS, open:

```text
Docks > Custom Browser Docks
```

3. Add a dock pointing to the installed local launcher file:

```text
file:///C:/Program Files/LyricDisplay/obs-dock.html
```

Adjust the path if LyricDisplay was installed elsewhere.

4. The launcher opens as the dock home screen.
5. Click:

```text
Start Headless and Open Dock
```

6. The launcher requests:

```text
lyricdisplay://start-headless?obsPairingToken=...
```

7. Electron starts the backend without creating the main app window, registers the short-lived OBS dock pairing token, and initializes the headless runtime.
8. The launcher checks:

```text
http://127.0.0.1:4000/api/health/ready
```

9. If ready, it redirects to:

```text
http://127.0.0.1:4000/#/obs-dock
```

10. The dock exchanges the pairing token for a limited `obsDock` JWT and connects as `obsDock`.

No desktop window or join code should be required when the app protocol handoff succeeds. If OBS or the OS blocks protocol handoff, `Start LyricDisplay Headless.cmd` remains a fallback startup tool.

## Dev Testing Flow

Use the local development launcher file as the OBS custom dock URL:

```text
file:///D:/path/to/lyric-display-app/obs-dock-dev.html
```

Click:

```text
Start Dev Headless and Open Dock
```

The dev launcher requests:

```text
lyricdisplay-dev://start-headless?startDevServer=1&obsPairingToken=...
```

When handled by Electron in dev, this starts the backend headlessly and starts Vite if it is not already running. The launcher then redirects to:

```text
http://localhost:5173/obs-dock?obsPairingToken=...
```

If the dev protocol has not been registered on the machine yet, run `npm run electron-dev:headless` once, quit it, then retry the local `obs-dock-dev.html` launcher.

Do not assume custom protocol handoff will work in every OBS/browser environment. The launcher is the intended user flow, but protocol handoff is still an OS/browser capability.

## UI State

The OBS dock UI currently includes:

- compact header actions,
- refresh/reconnect,
- open desktop app trigger,
- file loading,
- setlist access through a header button and overlay,
- output toggle and output selection,
- output settings through an overlay,
- scrollable lyrics list.

The setlist was moved out of the main dock surface into an overlay to preserve vertical space in OBS.

## Known Limitations

- OBS may block or ignore `lyricdisplay://` custom protocol links.
- A web-only OBS dock cannot reliably start a native desktop process by itself.
- If OBS or the OS blocks custom protocol handoff, the fallback production startup is `Start LyricDisplay Headless.cmd`.
- The OBS dock is not yet a full desktop replacement. Some workflows may still require opening the full desktop app.
- The local headless auth path should remain limited to `obsDock`; it must not grant desktop/admin permissions.

## Recommended Next Steps

1. Rebuild and reinstall the Windows package.
2. Confirm `obs-dock.html`, `LyricDisplay-icon.png`, and `Start LyricDisplay Headless.cmd` appear beside `LyricDisplay.exe`.
3. Test the production flow from OBS using the root installed `obs-dock.html`.
4. Confirm that clicking `Start Headless and Open Dock` launches the backend without creating the main window.
5. Decide whether to add installer-created shortcuts for:

```text
Start LyricDisplay Headless
Open LyricDisplay OBS Dock
```

6. Consider adding an in-app preference such as:

```text
Start LyricDisplay in background for OBS dock
```

That would reduce the need for users to manually run the helper command.

## Security Notes

The current security posture is:

- desktop/admin privileges stay inside Electron,
- OBS dock receives only `obsDock` permissions,
- local headless auth is loopback/local-origin constrained,
- protocol pairing tokens are short-lived and one-time use,
- join-code auth remains available for ordinary web/mobile controllers.

Future work should preserve this boundary. Do not give OBS dock desktop tokens, admin keys, or unrestricted IPC-equivalent authority.
