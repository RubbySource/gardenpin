@echo off
chcp 65001 >/dev/null
title GardenPin — Build + Deploy design
cd /d "%~dp0"

echo.
echo === GardenPin: Build a deploy noveho designu ===
echo.

echo [1/4] Build frontendu v WSL...
for /f "usebackq delims=" %%i in (`wsl -e wslpath -u "%~dp0frontend"`) do set "WSL_FRONTEND=%%i"
wsl -e bash -c "cd '%WSL_FRONTEND%' && npm run build && echo BUILD_OK"
if errorlevel 1 (
  echo [!] Build selhal
  pause
  exit /b 1
)

echo.
echo [2/4] Sync backend/public do WSL...
for /f "usebackq delims=" %%i in (`wsl -e wslpath -u "%~dp0backend"`) do set "WSL_BACKEND=%%i"
wsl -e bash -c "rm -rf ~/zahradni-tracker/backend/public && cp -r '%WSL_BACKEND%/public' ~/zahradni-tracker/backend/ && echo SYNC_OK"

echo.
echo [3/4] Restart pres pm2...
wsl -e bash -c "export PATH=/home/dell_5090/.npm-global/bin:$PATH; pm2 restart gardenpin && pm2 status"

echo.
echo [4/4] Hotovo!
echo  App bezi na: http://localhost:3000
echo.
pause
