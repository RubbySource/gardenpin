#!/bin/bash
# GardenPin — Spustit veřejný tunel pro testery
# Spusť tento skript v WSL: bash spustit-tunnel.sh
#
# Předpoklady:
#   1. Backend server musí běžet (pm2 start server.js nebo npm start)
#   2. npx musí být dostupné v WSL (node/npm nainstalované)

echo "🌿 GardenPin — Spouštím tunel pro sdílení s testery..."
echo ""

# Zkontroluj jestli server běží
if ! curl -s http://localhost:3000/api/stats > /dev/null 2>&1; then
  echo "⚠️  POZOR: Server na portu 3000 neodpovídá."
  echo "   Spusť nejprve: npm start (v backend/ složce)"
  echo "   nebo:          pm2 start"
  echo ""
fi

echo "📡 Spouštím localtunnel na portu 3000..."
echo "   Po spuštění ti vypíše veřejnou URL - tu pošli testerům."
echo "   Tunel funguje dokud nezavřeš tento terminál."
echo ""

# Spusť localtunnel
npx localtunnel --port 3000 --subdomain gardenpin-test 2>/dev/null || \
npx localtunnel --port 3000

echo ""
echo "Tunel ukončen."
