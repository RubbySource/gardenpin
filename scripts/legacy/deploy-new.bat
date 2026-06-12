@echo off
chcp 65001 >nul
title GardenPin New Design Start
cd /d "%~dp0"
echo.
echo === GardenPin: Deploy new design ===
echo.
echo [1/4] Kill server...
wsl -e bash -c "pkill -9 -f node 2>/dev/null || true; sleep 1; echo killed"
echo.
echo [2/4] Copy built frontend to WSL...
wsl -e bash -c "mkdir -p ~/zahradni-tracker/public && cp -r /tmp/gardenpin-merge/backend/public/. ~/zahradni-tracker/public/ && echo done"
echo.
echo [3/4] Sync backend source to WSL...
for /f "usebackq delims=" %%i in () do set "WSL_BACKEND=%%i"
wsl -e bash -c "mkdir -p ~/zahradni-tracker && rsync -a --delete --exclude=node_modules --exclude=data --exclude=uploads --exclude=public '%WSL_BACKEND%/' ~/zahradni-tracker/ && echo synced"
echo.
echo [4/4] Starting server...
echo.
echo  App: http://localhost:3000
echo.
wsl -e bash -c "cd ~/zahradni-tracker && node_modules/.bin/test -d node_modules 2>/dev/null || npm install --silent 2>/dev/null; node --no-warnings server.js"
echo.
echo Server stopped.
pause
