@echo off
chcp 65001 >nul
title GardenPin Build + Restart
cd /d "%~dp0"
echo.
echo === GardenPin: Build frontend + Restart server ===
echo.
echo [1/4] Kill existing server in WSL...
wsl -e bash -c "pkill -9 -f 'node.*server.js' 2>/dev/null; pkill -9 -f 'node --no-warnings' 2>/dev/null; sleep 1; echo killed"
echo.
echo [2/4] Build frontend in WSL...
for /f "usebackq delims=" %%i in () do set "WSL_FRONTEND=%%i"
wsl -e bash -c "cd '%WSL_FRONTEND%' && npm run build"
if errorlevel 1 (
    echo [!] Frontend build failed
    pause
    exit /b 1
)
echo.
echo [3/4] Sync backend to WSL...
for /f "usebackq delims=" %%i in () do set "WSL_BACKEND=%%i"
wsl -e bash -c "mkdir -p ~/zahradni-tracker && rsync -a --delete --exclude=node_modules --exclude=data --exclude=uploads '%WSL_BACKEND%/' ~/zahradni-tracker/"
echo.
echo [4/4] Starting server in WSL...
echo.
echo  App running at: http://localhost:3000
echo  Close this window to stop.
echo.
wsl -e bash -c "cd ~/zahradni-tracker && npm install --silent && node --no-warnings server.js"
echo.
echo Server stopped.
pause
