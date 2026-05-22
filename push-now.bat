@echo off
cd /d "%~dp0"
echo Pushing to GitHub...
git push origin HEAD
echo Done!
pause
