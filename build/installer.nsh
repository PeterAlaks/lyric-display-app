!include "LogicLib.nsh"
!include "MUI2.nsh"
!include "nsDialogs.nsh"

!ifdef BUILD_UNINSTALLER
  Var /GLOBAL DeleteUserDataCheckbox
  Var /GLOBAL DeleteUserDataSelection

  Function un.UserDataPage
    !insertmacro MUI_HEADER_TEXT "User data" "Choose whether to remove your LyricDisplay data."

    nsDialogs::Create 1018
    Pop $0
    ${If} $0 == error
      Abort
    ${EndIf}

    ${NSD_CreateCheckbox} 0 8u 100% 12u "Delete LyricDisplay settings, cached media, templates, and credentials"
    Pop $DeleteUserDataCheckbox
    ${NSD_Uncheck} $DeleteUserDataCheckbox

    ${NSD_CreateLabel} 0 28u 100% 30u "Leave this unchecked if you plan to reinstall LyricDisplay. Files you saved outside LyricDisplay's application data folders will not be removed."
    Pop $0

    ${NSD_CreateLabel} 0 66u 100% 20u "Deleting this data cannot be undone."
    Pop $0

    nsDialogs::Show
  FunctionEnd

  Function un.UserDataPageLeave
    ${NSD_GetState} $DeleteUserDataCheckbox $DeleteUserDataSelection
  FunctionEnd
!endif

!macro customUnInit
  StrCpy $DeleteUserDataSelection ${BST_UNCHECKED}
!macroend

!macro customUnWelcomePage
  !insertmacro MUI_UNPAGE_WELCOME
  UninstPage custom un.UserDataPage un.UserDataPageLeave
!macroend

!macro customInstall
  CreateShortCut "$SMPROGRAMS\LyricDisplay Dock Mode.lnk" "$INSTDIR\LyricDisplay.exe" "--headless --obs-dock" "$INSTDIR\LyricDisplay.exe" 0
!macroend

!macro customUnInstall
  Delete "$SMPROGRAMS\LyricDisplay Dock Mode.lnk"

  ${If} $DeleteUserDataSelection == ${BST_CHECKED}
    ${If} $installMode == "all"
      SetShellVarContext current
    ${EndIf}

    DetailPrint "Removing LyricDisplay credentials..."
    InitPluginsDir
    File /oname=$PLUGINSDIR\remove-lyricdisplay-credentials.ps1 "${BUILD_RESOURCES_DIR}\remove-lyricdisplay-credentials.ps1"
    nsExec::ExecToLog '"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "$PLUGINSDIR\remove-lyricdisplay-credentials.ps1"'
    Pop $0
    ${If} $0 != 0
      DetailPrint "Credential cleanup returned exit code $0."
    ${EndIf}

    DetailPrint "Removing LyricDisplay user data..."
    RMDir /r "$APPDATA\LyricDisplay"
    RMDir /r "$APPDATA\lyric-display-app"
    RMDir /r "$APPDATA\lyricdisplay-ndi"
    RMDir /r "$LOCALAPPDATA\LyricDisplay"

    ${If} $installMode == "all"
      SetShellVarContext all
    ${EndIf}
  ${EndIf}
!macroend
