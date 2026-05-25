#!/usr/bin/env bash
# Deploy GardenPin to PM2 → live na https://gardenpin.tailcec1ab.ts.net/
#
# Použití (z Windows host přes Claude / Bash tool):
#   wsl -e bash /mnt/c/Users/Dell\ 5090/Documents/Claude/Projects/Patrik\ The\ Gardener/zahradni-tracker/deploy.sh
#
# Nebo z WSL:
#   bash /mnt/c/.../zahradni-tracker/deploy.sh
#
# Co dělá:
#   1. Buildne frontend (Vite → backend/public/)
#   2. Rsync backend/ → ~/zahradni-tracker/  (PM2 servíruje odtud)
#   3. PM2 restart gardenpin
#   4. Otestuje Funnel URL

set -euo pipefail

# Najdi repo (skript může být volán odkudkoli)
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_DIR="$REPO_DIR/frontend"
BACKEND_DIR="$REPO_DIR/backend"
WSL_TARGET="$HOME/zahradni-tracker"
PM2="/home/dell_5090/.npm-global/bin/pm2"
FUNNEL_URL="https://gardenpin.tailcec1ab.ts.net/"

echo "============================================"
echo "  DEPLOY GardenPin → $FUNNEL_URL"
echo "============================================"
echo

echo "[1/4] Frontend build..."
cd "$FRONTEND_DIR"
npm run build
echo

echo "[2/4] Rsync backend → $WSL_TARGET ..."
mkdir -p "$WSL_TARGET"
rsync -a --delete \
  --exclude=node_modules \
  --exclude=data \
  --exclude=uploads \
  "$BACKEND_DIR/" "$WSL_TARGET/"
echo

echo "[3/4] npm install (deps update)..."
cd "$WSL_TARGET"
npm install --no-audit --no-fund --silent
echo

echo "[4/4] PM2 restart gardenpin..."
"$PM2" restart gardenpin --update-env
"$PM2" save
echo

echo "Test Funnel..."
sleep 2
HTTP_CODE=$(curl -sS -o /dev/null -w "%{http_code}" -L "$FUNNEL_URL" || echo "000")
echo "→ Funnel response: $HTTP_CODE"

if [ "$HTTP_CODE" = "200" ]; then
  echo
  echo "============================================"
  echo "  HOTOVO. Live: $FUNNEL_URL"
  echo "============================================"
else
  echo
  echo "[!] Funnel vrátil $HTTP_CODE (očekáváno 200)."
  echo "    Zkontroluj 'pm2 logs gardenpin' a 'tailscale funnel status'."
  exit 1
fi
