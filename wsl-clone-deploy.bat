@echo off
chcp 65001 >nul
title GardenPin WSL Clone + Start
echo.
echo === GardenPin: Clone from GitHub + Build + Start ===
echo.

echo [1/5] Kill server...
wsl -e bash -c "pkill -9 -f 'node.*server' 2>/dev/null; sleep 1; echo done"

echo [2/5] Backup existing database...
wsl -e bash -c "mkdir -p ~/zahrada-backup && cp ~/zahradni-tracker/data/zahrada.db ~/zahrada-backup/ 2>/dev/null && echo backed up || echo no db to backup"

echo [3/5] Clone gardenpin from GitHub...
wsl -e bash -c "rm -rf ~/zahradni-tracker && git clone https://github.com/RubbySource/gardenpin.git ~/zahradni-tracker && echo cloned"

echo [4/5] Restore database + npm install + build...
wsl -e bash -c "mkdir -p ~/zahradni-tracker/data && cp ~/zahrada-backup/zahrada.db ~/zahradni-tracker/data/ 2>/dev/null || true; cd ~/zahradni-tracker && npm install --silent && cd frontend && npm install --silent && npm run build && echo build done"

echo [5/5] Start server...
wsl -e bash -c "cd ~/zahradni-tracker && node --no-warnings server.js"

pause
