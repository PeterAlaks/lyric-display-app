!include "LogicLib.nsh"
!include "MUI2.nsh"
!include "nsDialogs.nsh"

!ifndef BUILD_UNINSTALLER
  Var /GLOBAL FirewallCheckbox
  Var /GLOBAL FirewallSelection
!endif

!macro customInit
  StrCpy $FirewallSelection ${BST_CHECKED}
!macroend

; Emit functions after electron-builder has registered its NSIS plugins.
!macro customPageAfterChangeDir
  Function FirewallPage
    ${If} ${isUpdated}
      Abort
    ${EndIf}
    !insertmacro MUI_HEADER_TEXT "Network access" "Allow other devices to connect to LyricDisplay."
    nsDialogs::Create 1018
    Pop $0
    ${If} $0 == error
      Abort
    ${EndIf}
    ${NSD_CreateCheckbox} 0 8u 100% 20u "Allow LyricDisplay through Windows Firewall (recommended)"
    Pop $FirewallCheckbox
    ${NSD_SetState} $FirewallCheckbox $FirewallSelection
    ${NSD_CreateLabel} 0 36u 100% 40u "Allows remote controls and displays to connect on private, public and domain networks. Only LyricDisplay is allowed through the firewall."
    Pop $0
    ${NSD_CreateLabel} 0 84u 100% 30u "Windows may ask for administrator approval during installation. If you skip this, you may need to allow access when the app starts."
    Pop $0
    nsDialogs::Show
  FunctionEnd

  Function FirewallPageLeave
    ${NSD_GetState} $FirewallCheckbox $FirewallSelection
  FunctionEnd
  Page custom FirewallPage FirewallPageLeave
!macroend

!macro ConfigureFirewall Action
  InitPluginsDir
  File /oname=$PLUGINSDIR\configure-firewall.ps1 "${BUILD_RESOURCES_DIR}\configure-firewall.ps1"
  StrCpy $1 ""
  ${If} ${Silent}
    StrCpy $1 "-NoElevation"
  ${EndIf}
  DetailPrint "Windows Firewall: ${Action} LyricDisplay rules..."
  nsExec::ExecToLog '"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "$PLUGINSDIR\configure-firewall.ps1" -Action ${Action} -Program "$INSTDIR\${APP_EXECUTABLE_FILENAME}" $1'
  Pop $0
  ${If} $0 != 0
    DetailPrint "Windows Firewall configuration failed (exit code $0)."
    ${IfNot} ${Silent}
      MessageBox MB_OK|MB_ICONEXCLAMATION "Windows Firewall could not be updated. Setup will continue. You may need to allow LyricDisplay manually in Windows Firewall settings."
    ${EndIf}
  ${EndIf}
!macroend

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

    ${NSD_CreateCheckbox} 0 8u 100% 12u "Delete LyricDisplay settings, saved files and credentials"
    Pop $DeleteUserDataCheckbox
    ${NSD_Uncheck} $DeleteUserDataCheckbox

    ${NSD_CreateLabel} 0 28u 100% 30u "This also removes lyrics, imported songs and setlists. Files saved elsewhere are not removed."
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
  ; Keep existing rules and avoid new UAC prompts during unattended updates.
  ${IfNot} ${Silent}
    ${IfNot} ${isUpdated}
      ${If} $FirewallSelection == ${BST_CHECKED}
        !insertmacro ConfigureFirewall "Add"
      ${EndIf}
    ${EndIf}
  ${EndIf}
!macroend

!macro customUnInstall
  Delete "$SMPROGRAMS\LyricDisplay Dock Mode.lnk"
  ${IfNot} ${isUpdated}
    !insertmacro ConfigureFirewall "Remove"
  ${EndIf}

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
    RMDir /r "$DOCUMENTS\LyricDisplay"

    ${If} $installMode == "all"
      SetShellVarContext all
    ${EndIf}
  ${EndIf}
!macroend
