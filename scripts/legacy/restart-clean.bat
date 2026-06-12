@echo off
chcp 65001 >nul
title GardenPin — Restart
color 2F
cd /d "%~dp0"

echo.
echo  ============================================
echo   GARDENPIN — Kill port 3000 + Restart
echo  ============================================
echo.

echo  [1/3] Killing process on port 3000...
wsl -e bash -c "fuser -k 3000/tcp 2>/dev/null; echo done"

echo  [2/3] Sync public/ to WSL...
for /f "usebackq delims=" %%i in (`wsl -e wslpath -u "%~dp0backend"`) do set "WSL_SRC_BACKEND=%%i"
wsl -e bash -c "cp -r '%WSL_SRC_BACKEND%/public' ~/zahradni-tracker/"

echo  [3/3] Starting server...
echo.
echo  ============================================
echo   App running at: http://localhost:3000
echo   Close this window to stop.
echo  ============================================
echo.

wsl -e bash -c "cd ~/zahradni-tracker && node --no-warnings server.js"

echo.
echo Server stopped.
pause
