@echo off
chcp 65001 >nul
title Zahradni Tracker - Povoleni portu 3000

:: Zkontroluj admin prava
NET SESSION >nul 2>&1
if %errorLevel% neq 0 (
    echo.
    echo  Tento skript potrebuje administratorska prava.
    echo  Spoustime znovu jako administrator...
    echo.
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)

echo.
echo  ============================================
echo   POVOLENI PORTU 3000 VE FIREWALLU
echo  ============================================
echo.

:: Smazat stare pravidlo pokud existuje
netsh advfirewall firewall delete rule name="Zahradni Tracker Port 3000" >nul 2>&1

:: Pridat nove pravidlo
netsh advfirewall firewall add rule name="Zahradni Tracker Port 3000" dir=in action=allow protocol=TCP localport=3000

if %errorLevel% == 0 (
    echo.
    echo  [OK] Pravidlo firewallu pridano uspesne.
    echo.
    echo  Telefon nyni muze pristoupit na:
    echo    http://192.168.1.132:3000
    echo.
) else (
    echo.
    echo  [X] Pridani pravidla selhalo.
    echo.
)

pause
