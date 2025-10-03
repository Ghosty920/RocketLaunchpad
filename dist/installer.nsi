!include nsDialogs.nsh
!include LogicLib.nsh
!include MUI2.nsh

Name "Rocket Launchpad"
OutFile "RocketLaunchpad-$(VERSION)-Setup.exe"
Unicode True
InstallDir "$LOCALAPPDATA\RocketLaunchpad"
RequestExecutionLevel user
InstallDirRegKey HKCU "Software\RocketLaunchpad" "InstallDir"
SetCompressor /SOLID lzma

; --------------------
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_LICENSE "../LICENSE"

!insertmacro MUI_PAGE_COMPONENTS
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES

!define MUI_FINISHPAGE_RUN "$INSTDIR\RocketLaunchpad.exe"
!define MUI_FINISHPAGE_RUN_TEXT "Launch Rocket Launchpad"
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_UNPAGE_FINISH

!insertmacro MUI_LANGUAGE "English"

; --------------------
; Uninstaller check

Function .onInit
    ReadRegStr $0 HKCU "Software\RocketLaunchpad" "InstallDir"
    StrCmp $0 "" 0 installed
    Return
installed:
    StrCpy $1 "Rocket Launchpad is already installed at $0.$\r$\nDo you want to uninstall it ?"
    MessageBox MB_YESNO|MB_ICONQUESTION $1 IDYES uninstall IDNO abort
uninstall:
    ExecWait '"$0\uninstall.exe"'
abort:
    Abort
FunctionEnd

; --------------------
; Sections
Section "Rocket Launchpad (required)" SecRocket
    SectionIn RO
    
    SetOutPath "$INSTDIR"
    File /r "out\*"

    WriteRegStr HKCU "Software\RocketLaunchpad" "InstallDir" "$INSTDIR"

    WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\RocketLaunchpad" "DisplayName" "Rocket Launchpad"
    WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\RocketLaunchpad" "UninstallString" '"$INSTDIR\uninstall.exe"'
    WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\RocketLaunchpad" "Publisher" "Ghosty"
    WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\RocketLaunchpad" "DisplayVersion" "$(VERSION)"
    WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\RocketLaunchpad" "DisplayIcon" "$INSTDIR\RocketLaunchpad.exe"
    WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\RocketLaunchpad" "NoModify" 1
    WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\RocketLaunchpad" "NoRepair" 1
    WriteUninstaller "$INSTDIR\uninstall.exe"
SectionEnd

Section "Start Menu Shortcuts" SecShortcuts
    CreateDirectory "$SMPROGRAMS\RocketLaunchpad"
    CreateShortcut "$SMPROGRAMS\RocketLaunchpad\Uninstall.lnk" "$INSTDIR\uninstall.exe"
    CreateShortcut "$SMPROGRAMS\RocketLaunchpad\Rocket Launchpad.lnk" "$INSTDIR\RocketLaunchpad.exe"
SectionEnd

Section "Uninstall" SecUninstall
    DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\RocketLaunchpad"
    DeleteRegKey HKCU "Software\RocketLaunchpad"

    RMDir /r "$INSTDIR"
    RMDir /r "$SMPROGRAMS\RocketLaunchpad"
SectionEnd
