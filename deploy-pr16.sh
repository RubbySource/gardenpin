#!/bin/bash
# Deploy PR #16 — GardenPin design
# Spusť z WSL: bash /mnt/c/Users/Dell\ 5090/Documents/Claude/Projects/Patrik\ The\ Gardener/zahradni-tracker/deploy-pr16.sh

set -e

WIN_BACKEND="/mnt/c/Users/Dell 5090/Documents/Claude/Projects/Patrik The Gardener/zahradni-tracker/backend"
WSL_DIR="$HOME/zahradni-tracker"

echo "🌿 Deploy PR #16 — GardenPin design polish"
echo ""

echo "[1/3] Sync backend/public → ~/zahradni-tracker/public ..."
rsync -a --delete "$WIN_BACKEND/public/" "$WSL_DIR/public/"

echo "[2/3] PM2 restart ..."
# Zkus oba možné názvy procesu
pm2 restart gardenpin 2>/dev/null || pm2 restart zahradni-tracker 2>/dev/null || {
  echo "⚠️  PM2 proces nenalezen. Zkouším pm2 list:"
  pm2 list
  exit 1
}

echo "[3/3] Ověření ..."
sleep 2
curl -s -o /dev/null -w "HTTP %{http_code}" http://localhost:3000
echo ""

echo ""
echo "✅ Deploy hotov — PR #16 je živý na http://localhost:3000"
