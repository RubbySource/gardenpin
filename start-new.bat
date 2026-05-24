@echo off
chcp 65001 >nul
title GardenPin Build + Run
cd /d "%~dp0"
echo.
echo === GardenPin: Build frontend + Restart (via WSL) ===
echo.
wsl -e bash build-and-run.sh
echo.
echo Server stopped.
pause
