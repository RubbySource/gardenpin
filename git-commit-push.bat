@echo off
chcp 65001 >nul
title GardenPin — Git Commit + Push
cd /d "%~dp0"

echo.
echo  === GardenPin: Commit all design + node:sqlite changes ===
echo.

if exist ".git\index.lock" (
    echo  Removing stale lock file...
    del ".git\index.lock"
)

REM Stage all modified tracked files (design changes + node:sqlite fix)
git add -u
REM Also add new bat helpers and docs
git add check-port.bat kill-a-spustit.bat restart-clean.bat fix-a-spustit.bat BACKLOG.md PITCH.md 2>nul

git commit -m "feat: Claude Design redesign + node:sqlite migration

- Complete UI redesign with Claude Design palette (FOREST/SAND/CHARCOAL)
- Replace better-sqlite3 with built-in node:sqlite (no compilation needed)
- New landing page, updated all pages with new color system
- Add helper .bat files for easier server management
- Add BACKLOG and PITCH docs"

git push origin landing-page

echo.
echo  Done!
pause
