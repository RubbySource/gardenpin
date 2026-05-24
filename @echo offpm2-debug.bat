@echo off
chcp 65001 >nul
title pm2 Debug
echo === which npm ===
wsl -e bash -i -c "which npm 2>/dev/null || echo npm not found"
echo === npm bin -g ===
wsl -e bash -i -c "npm bin -g 2>/dev/null || echo npm bin -g failed"
echo === find pm2 ===
wsl -e bash -i -c "find $HOME/.nvm -name pm2 2>/dev/null | head -5; find /usr/local -name pm2 2>/dev/null | head -3"
echo === PATH (first 10) ===
wsl -e bash -i -c "echo $PATH | tr ':' '\n' | head -10"
pause
