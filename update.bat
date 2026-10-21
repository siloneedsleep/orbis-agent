@echo off
chcp 65001 >nul
title Orbis Agent - Auto Updater
echo ============================================================
echo   Orbis Agent - Auto Update Tool
echo ============================================================
echo Dang tai va cap nhat ban moi nhat tu GitHub...
echo.

if exist "%~dp0scripts\update-app.ps1" (
    powershell -ExecutionPolicy Bypass -NoProfile -File "%~dp0scripts\update-app.ps1"
) else (
    powershell -ExecutionPolicy Bypass -NoProfile -Command "irm https://raw.githubusercontent.com/siloneedsleep/orbis-agent/main/scripts/update-app.ps1 | iex"
)

echo.
echo Hoan tat! Tep nay se tu dong bien mat sau giay lat.
ping 127.0.0.1 -n 3 >nul
(goto) 2>nul & del "%~f0"
