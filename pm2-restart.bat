@echo off
chcp 65001 >nul
title GardenPin pm2 Restart
wsl -e bash -c "export PATH=/home/dell_5090/.npm-global/bin:$PATH; pm2 restart gardenpin && pm2 status"
pause
