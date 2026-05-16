@echo off
cd /d "%~dp0"
echo GardenPin Cloudflare Tunnel
echo Starting tunnel on http://localhost:3000...
cloudflared.exe tunnel --url http://localhost:3000
pause
