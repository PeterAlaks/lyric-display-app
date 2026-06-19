@echo off
set "LYRICDISPLAY_HEADLESS=1"
set "LYRICDISPLAY_OBS_DOCK_LOCAL_AUTH=1"
start "" "%~dp0LyricDisplay.exe" --headless --obs-dock
