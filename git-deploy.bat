@echo off
chcp 65001 >nul
title GardenPin Git Deploy
echo.
echo === GardenPin: Git Pull + Build + Start ===
echo.

echo [1/4] Kill server...
wsl -e bash -c "pkill -9 -f 'node.*server' 2>/dev/null; sleep 1; echo killed"

echo [2/4] Git pull latest from gardenpin/master...
wsl -e bash -c "cd ~/zahradni-tracker && git remote get-url gardenpin 2>/dev/null || git remote add gardenpin https://github.com/RubbySource/gardenpin.git; git fetch gardenpin; git reset --hard gardenpin/master; echo done"

echo [3/4] Build frontend in WSL...
wsl -e bash -c "cd ~/zahradni-tracker/frontend && npm install --silent && npm run build && echo built"

echo [4/4] Start server...
wsl -e bash -c "cd ~/zahradni-tracker && npm install --silent 2>/dev/null; node --no-warnings server.js"

pause
