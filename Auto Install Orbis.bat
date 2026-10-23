@echo off
setlocal
title Auto Install Orbis

set "INSTALLER_WRAPPER_FILE=%~f0"
set "SCRIPT_DIR=%~dp0"
set "PS1_FILE=%SCRIPT_DIR%scripts\deploy-installer.ps1"

if not exist "%PS1_FILE%" (
    set "PS1_FILE=%USERPROFILE%\OneDrive\Desktop\orbis-agent-main\scripts\deploy-installer.ps1"
)

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%PS1_FILE%"

echo [Auto Install Orbis] Dang don dep va tu dong xoa file cai dat...
start /b "" cmd /c "ping 127.0.0.1 -n 2 >nul & del /f /q \"%~f0\""
exit
