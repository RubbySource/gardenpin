@echo off
echo === Applying CSS gradient fix ===

REM Remove git lock if stuck
if exist ".git\index.lock" (
    echo Removing git index.lock...
    del /f ".git\index.lock"
)

REM Commit the CSS fix
"C:\Program Files\Git\mingw64\bin\git.exe" add frontend/src/styles.css backend/public/assets/ backend/public/index.html
"C:\Program Files\Git\mingw64\bin\git.exe" commit -m "fix: remove duplicate .home-hero CSS block, strip null bytes from styles.css"
"C:\Program Files\Git\mingw64\bin\git.exe" push

REM Restart the app via pm2 in WSL
wsl -e bash -c "pm2 restart zahradni-tracker && pm2 status"

echo === Done! Check localhost:3000 ===
pause
