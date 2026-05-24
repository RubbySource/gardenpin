@echo off
cd /d "%~dp0"
powershell -ExecutionPolicy Bypass -Command "if (-not (Get-Command cloudflared -ErrorAction SilentlyContinue)) { if (-not (Test-Path cloudflared.exe)) { Write-Host Downloading cloudflared...; Invoke-WebRequest -Uri https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe -OutFile cloudflared.exe } }; $cf = if (Get-Command cloudflared -ErrorAction SilentlyContinue) { cloudflared } else { .\cloudflared.exe }; Write-Host Starting tunnel...; & $cf tunnel --url http://localhost:3000"
pause
