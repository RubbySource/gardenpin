@echo off
chcp 65001 >nul
title GardenPin pm2 Setup
echo.
echo === GardenPin: Nastaveni pm2 ===
echo.
echo [1/5] Zastaveni node procesu...
wsl -e bash -c "pkill -9 -f 'node.*server' 2>/dev/null; sleep 1; echo done"
echo [2/5] Kontrola pm2...
wsl -e bash -c "export PATH=/home/dell_5090/.npm-global/bin:$PATH; pm2 --version && echo pm2 ok"
echo [3/5] Spusteni serveru pres pm2...
wsl -e bash -c "export PATH=/home/dell_5090/.npm-global/bin:$PATH; cd ~/zahradni-tracker/backend && pm2 delete gardenpin 2>/dev/null; pm2 start server.js --name gardenpin --restart-delay=2000 && echo pm2 started"
echo [4/5] Ulozeni pm2 konfigurace...
wsl -e bash -c "export PATH=/home/dell_5090/.npm-global/bin:$PATH; pm2 save && echo saved"
echo [5/5] Nastaveni pm2 startup...
wsl -e bash -c "export PATH=/home/dell_5090/.npm-global/bin:$PATH; pm2 startup systemd -u dell_5090 --hp /home/dell_5090 2>&1 | tail -5"
echo.
echo Hotovo! pm2 status:
wsl -e bash -c "export PATH=/home/dell_5090/.npm-global/bin:$PATH; pm2 status"
pause
