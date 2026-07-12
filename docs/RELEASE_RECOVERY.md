# Release migration and recovery

LyricDisplay updates require operator confirmation. When Live Safety is enabled, automatic checks and update notifications are deferred, and a downloaded update cannot restart the application until Live Safety is disabled.

## Before updating

1. End the live session and turn off Live Safety.
2. Save any reusable setlist as an `.ldset` file and back up the LyricDisplay user-data directory.
3. Record the currently installed version from **Help > About** and keep its installer, DMG, or AppImage as the known-good release.
4. Install updates during rehearsal time, then verify the control window, every configured output, Browser Sources, external controls, and NDI before production use.

Preferences, realtime recovery snapshots, and saved setlists carry explicit schema versions. LyricDisplay migrates recognized legacy formats and refuses unknown future formats instead of guessing. Live setlists remain limited to the current Electron application session by design.

## Restore a known-good release

1. Quit LyricDisplay completely. Do not downgrade while any LyricDisplay process is running.
2. Copy the current user-data directory to a separate diagnostic backup. Preserve logs before replacing anything.
3. Reinstall or reopen the previously verified artifact from the project’s GitHub release. On Windows, uninstall the current build only if the older installer requires it. On macOS, replace the application in **Applications** with the retained DMG copy. On Linux, restore the retained AppImage.
4. Start the known-good version without a live audience and verify its outputs.
5. Restore user data only when that release supports its schema. If it reports a newer unsupported schema, keep the backup and return to the newer release; do not hand-edit schema version fields.

An application rollback does not roll back user data automatically. The pre-update user-data copy is the last-known-good data source. Saved `.ldset` files also retain one adjacent `.bak` generation and can recover it through the normal loader when the primary file is damaged.
