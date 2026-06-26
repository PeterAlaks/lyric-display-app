!macro customInstall
  CreateShortCut "$SMPROGRAMS\LyricDisplay Dock Mode.lnk" "$INSTDIR\LyricDisplay.exe" "--headless --obs-dock" "$INSTDIR\LyricDisplay.exe" 0
!macroend

!macro customUnInstall
  Delete "$SMPROGRAMS\LyricDisplay Dock Mode.lnk"
!macroend
