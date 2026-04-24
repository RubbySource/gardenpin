@echo off
chcp 65001 >nul
title Zahradni tracker
color 2F
cd /d "%~dp0"

echo.
echo  ============================================
echo   ZAHRADNI TRACKER
echo  ============================================
echo.

REM Prefer WSL (user has Node.js in Ubuntu/WSL)
where wsl >nul 2>nul
if not errorlevel 1 (
    wsl -e node -v >nul 2>nul
    if not errorlevel 1 goto :use_wsl
)

REM Fallback: native Windows Node.js
where node >nul 2>nul
if not errorlevel 1 goto :use_native

color 4F
echo  [X] Nenalezen Node.js.
echo.
echo  Nainstalujte jej z https://nodejs.org/ (verze LTS 22+).
pause
exit /b 1

:use_wsl
echo  Pouzivam Node.js z WSL (Ubuntu)...
echo.

REM WSL cannot chmod files on /mnt/c (Windows filesystem).
REM Solution: copy backend to WSL home directory, run from there.
REM Backend source stays on Windows (readable in File Explorer);
REM node_modules and runtime data live in ~/zahradni-tracker in WSL.

REM Convert Windows backend path to WSL path
for /f "usebackq delims=" %%i in (`wsl -e wslpath -u "%~dp0backend"`) do set "WSL_SRC_BACKEND=%%i"

echo  [1/3] Priprava pracovni slozky ve WSL (pro npm install)...
echo.

REM Sync backend source (excluding node_modules/data/uploads) to WSL home
wsl -e bash -c "mkdir -p ~/zahradni-tracker && rsync -a --delete --exclude=node_modules --exclude=data --exclude=uploads --exclude=public '%WSL_SRC_BACKEND%/' ~/zahradni-tracker/ && cp -r '%WSL_SRC_BACKEND%/public' ~/zahradni-tracker/ 2>/dev/null || true"
if errorlevel 1 (
    color 4F
    echo.
    echo  [X] Selhala priprava pracovni slozky.
    pause
    exit /b 1
)

REM Install dependencies on first run
wsl -e bash -c "test -d ~/zahradni-tracker/node_modules"
if errorlevel 1 (
    echo  [2/3] Instaluji zavislosti ^(jen poprve, chvili to potrva^)...
    echo.
    wsl -e bash -c "cd ~/zahradni-tracker && npm install --no-audit --no-fund"
    if errorlevel 1 (
        color 4F
        echo.
        echo  [X] Instalace zavislosti selhala.
        pause
        exit /b 1
    )
    echo.
)

echo  [3/3] Spoustim server...
echo.
echo  ============================================
echo   Aplikace pobezi na:  http://localhost:3000
echo   Pro vypnuti zavrete toto okno.
echo  ============================================
echo.

REM Open browser after a short delay
start "" /min cmd /c "timeout /t 4 /nobreak >nul & start http://localhost:3000"

REM Run the server in WSL (data and uploads persist in ~/zahradni-tracker)
wsl -e bash -c "cd ~/zahradni-tracker && node --no-warnings server.js"

echo.
echo Server ukoncen.
pause
exit /b 0

:use_native
echo  Pouzivam nativni Node.js pro Windows...
echo.
cd backend
if not exist node_modules (
    echo  [1/2] Instaluji zavislosti...
    call npm install
    if errorlevel 1 (
        color 4F
        echo [X] Instalace selhala.
        pause
        exit /b 1
    )
)
echo  [2/2] Spoustim server...
echo.
echo  ============================================
echo   Aplikace pobezi na:  http://localhost:3000
echo   Pro vypnuti zavrete toto okno.
echo  ============================================
echo.
start "" /min cmd /c "timeout /t 3 /nobreak >nul & start http://localhost:3000"
node --no-warnings server.js
pause
exit /b 0
