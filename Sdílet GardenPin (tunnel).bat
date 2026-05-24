@echo off
chcp 65001 >nul
title GardenPin — Staly tunnel
color 2F

echo.
echo  ============================================
echo   GARDENPIN — STALY ODKAZ PRO KAMARADY
echo  ============================================
echo.
echo  Odkaz bude vzdy stejny:
echo    https://gardenpin.serveo.net
echo.
echo  POZOR: GardenPin musi bezet (mej otevrene okno
echo  "Spustit Zahradni tracker.bat")
echo.
echo  Spoustim tunnel... (muze trvat par sekund)
echo.

wsl -e bash -c "ssh -o StrictHostKeyChecking=no -o ServerAliveInterval=30 -o ServerAliveCountMax=3 -R gardenpin:80:localhost:3000 serveo.net"

echo.
echo Tunnel ukoncen. Spust skript znovu pro obnoveni.
pause
