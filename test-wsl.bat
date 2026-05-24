@echo off
echo TEST OK
echo WSL check:
wsl -e bash -c "echo WSL works"
echo Node check:
wsl -e bash -c "node --version"
echo Server dir:
wsl -e bash -c "ls ~/zahradni-tracker/backend/server.js 2>&1"
pause
