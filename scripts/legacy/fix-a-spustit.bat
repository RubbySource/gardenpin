@echo off
chcp 65001 >nul
title GardenPin — Fix & Start
color 2F
cd /d "%~dp0"

echo.
echo  ============================================
echo   GARDENPIN — Fix + Start (node:sqlite)
echo  ============================================
echo.

REM Sync backend source to WSL (exclude node_modules)
for /f "usebackq delims=" %%i in (`wsl -e wslpath -u "%~dp0backend"`) do set "WSL_SRC_BACKEND=%%i"

echo  [1/4] Sync backend source to WSL...
wsl -e bash -c "mkdir -p ~/zahradni-tracker && rsync -a --delete --exclude=node_modules --exclude=data --exclude=uploads '%WSL_SRC_BACKEND%/' ~/zahradni-tracker/"

echo  [2/4] npm install (no native modules needed)...
wsl -e bash -c "cd ~/zahradni-tracker && npm install"
if errorlevel 1 (
    color 4F
    echo  [X] npm install failed!
    pause
    exit /b 1
)

echo  [3/4] Sync public/ folder...
wsl -e bash -c "cp -r '%WSL_SRC_BACKEND%/public' ~/zahradni-tracker/ 2>/dev/null || true"

echo  [4/4] Starting server...
echo.
echo  ============================================
echo   App running at: http://localhost:3000
echo   Close this window to stop.
echo  ============================================
echo.

start "" /min cmd /c "timeout /t 4 /nobreak >nul & start http://localhost:3000"
wsl -e bash -c "cd ~/zahradni-tracker && node --no-warnings server.js"

echo.
echo Server stopped.
pause
