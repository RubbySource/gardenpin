@echo off
chcp 65001 >nul
title GardenPin Update + Restart
cd /d "%~dp0"
echo.
echo === GardenPin: Pull + Build + Restart ===
echo.
echo [1/4] Removing lock files...
if exist .git\index.lock del .git\index.lock
if exist .git\objects\maintenance.lock del .git\objects\maintenance.lock
echo.
echo [2/4] Git pull from gardenpin/master...
git fetch gardenpin
git reset --hard gardenpin/master
if errorlevel 1 (
    echo [!] Git pull failed
    pause
    exit /b 1
)
echo.
echo [3/4] Building frontend...
cd frontend
call npm run build
if errorlevel 1 (
    echo [!] Build failed
    pause
    exit /b 1
)
cd ..
echo.
echo [4/4] Restarting server...
taskkill /F /IM node.exe >/dev/null 2>&1
timeout /t 2 /nobreak >nul
start "GardenPin Server" cmd /k "node --no-warnings backend/server.js"
echo.
echo Done! Server restarted on localhost:3000
pause
