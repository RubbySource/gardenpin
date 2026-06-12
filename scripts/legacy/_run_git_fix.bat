@echo off
cd /d "C:\Users\Dell 5090\Documents\Claude\Projects\Patrik The Gardener\zahradni-tracker"

echo === STEP 1: Remove git lock ===
del /f ".git\index.lock" 2>nul
if exist ".git\index.lock" (
    echo WARN: lock still exists, trying force...
    attrib -r ".git\index.lock"
    del /f ".git\index.lock" 2>nul
)
echo Lock removed (or was not present).

echo === STEP 2: Git add ===
"C:\Program Files\Git\mingw64\bin\git.exe" add frontend/src/styles.css
"C:\Program Files\Git\mingw64\bin\git.exe" add -f backend/public/assets/ backend/public/index.html
if %errorlevel% neq 0 (
    echo ERROR: git add failed
    pause
    exit /b 1
)
echo Git add OK.

echo === STEP 3: Git commit ===
"C:\Program Files\Git\mingw64\bin\git.exe" commit -m "fix: remove duplicate .home-hero CSS block, strip null bytes from styles.css"
if %errorlevel% neq 0 (
    echo ERROR: git commit failed
    pause
    exit /b 1
)
echo Git commit OK.

echo === STEP 4: Git push ===
"C:\Program Files\Git\mingw64\bin\git.exe" push
if %errorlevel% neq 0 (
    echo ERROR: git push failed
    pause
    exit /b 1
)
echo Git push OK.

echo === STEP 5: pm2 restart ===
wsl -e bash -c "pm2 restart zahradni-tracker && pm2 status"
echo pm2 restart done.

echo === STEP 6: Verify server on port 3000 ===
wsl -e bash -c "curl -s http://localhost:3000 | head -5"

echo === STEP 7: Cleanup apply-css-fix.bat ===
if exist "apply-css-fix.bat" (
    del /f "apply-css-fix.bat"
    echo Deleted apply-css-fix.bat
) else (
    echo apply-css-fix.bat not found, skipping.
)

echo === ALL DONE ===
pause
