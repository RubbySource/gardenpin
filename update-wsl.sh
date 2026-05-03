#!/bin/bash
# GardenPin — Aktualizuj závislosti v WSL (spusť po přidání nových npm balíčků)
# Spusť z WSL: bash /mnt/c/Users/Dell\ 5090/Documents/Claude/Projects/Patrik\ The\ Gardener/zahradni-tracker/update-wsl.sh

echo "🌿 GardenPin — Aktualizace závislostí"
echo ""

WSL_DIR="$HOME/zahradni-tracker"

if [ ! -d "$WSL_DIR" ]; then
  echo "⚠️  Složka $WSL_DIR neexistuje. Nejprve spusť 'Spustit Zahradní tracker.bat'."
  exit 1
fi

echo "📦 Instaluji npm závislosti (better-sqlite3 + ostatní)..."
cd "$WSL_DIR" && npm install --no-audit --no-fund

if [ $? -eq 0 ]; then
  echo ""
  echo "✅ Hotovo! Restartuj server:"
  echo "   pm2 restart gardenpin"
  echo "   nebo zavři a otevři znovu 'Spustit Zahradní tracker.bat'"
else
  echo ""
  echo "❌ npm install selhalo."
fi
