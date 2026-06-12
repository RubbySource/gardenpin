@echo off
chcp 65001 >nul
title GardenPin — Kill + Start
color 2F
cd /d "%~dp0"

echo.
echo  [1/3] Killing all node processes in WSL...
wsl -e bash -c "pkill -9 -f 'node.*server.js' 2>/dev/null; pkill -9 -f 'node --no-warnings' 2>/dev/null; sleep 1; echo killed"

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
