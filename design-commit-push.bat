@echo off
chcp 65001 >/dev/null
title GardenPin — Design Fix Commit
cd /d "%~dp0"

echo.
echo  === GardenPin: Commit design fixes (merge conflicts resolved) ===
echo.

if exist ".git\index.lock" del ".git\index.lock"

git add frontend\src\styles.css frontend\src\App.jsx frontend\src\api.js frontend\src\pages\SettingsPage.jsx frontend\src\plantDatabase.js

git commit -m "fix: resolve merge conflicts in styles.css, repair truncated files

- Resolved 14 CSS merge conflicts — kept Claude Design (master) side
- Forest+sand palette, glassmorphism hero stats, CSS variables
- Repaired truncated App.jsx, api.js, SettingsPage.jsx from previous session
- Restored GardenDetailPage, GardensPage, HomePage, TasksPage from git"

echo.
echo  Push na GitHub...
git push origin HEAD

echo.
echo  Hotovo! 
pause
