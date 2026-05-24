@echo off
chcp 65001 >nul
title GardenPin pm2 Status
wsl -e bash -c "export PATH=/home/dell_5090/.npm-global/bin:$PATH; pm2 status && echo --- && pm2 logs gardenpin --lines 20 --nostream"
pause
