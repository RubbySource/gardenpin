@echo off
chcp 65001 >nul
title Port Check
cd /d "%~dp0"

echo === Checking what's on port 3000 in WSL ===
wsl -e bash -c "ss -tlnp | grep 3000; echo ---; lsof -i :3000 2>/dev/null; echo ---; ps aux | grep node"

echo.
echo === Killing ALL node processes in WSL ===
wsl -e bash -c "pkill -9 node 2>/dev/null; echo done"
timeout /t 2 /nobreak >nul

echo.
echo === Verifying port 3000 is free ===
wsl -e bash -c "ss -tlnp | grep 3000 || echo 'Port 3000 is free!'"

pause
