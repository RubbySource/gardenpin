@echo off
chcp 65001 >nul
title GardenPin Start
echo.
echo === GardenPin: Start server ===
echo.
echo [1/3] Kill server...
wsl -e bash -c "pkill -9 -f 'node.*server' 2>/dev/null; sleep 1; echo done"
echo [2/3] Install backend deps...
wsl -e bash -c "cd ~/zahradni-tracker/backend && npm install --silent && echo ready"
echo [3/3] Start server...
wsl -e bash -c "cd ~/zahradni-tracker/backend && node --no-warnings server.js"
pause
