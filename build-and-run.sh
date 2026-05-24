#!/bin/bash
set -e
WPATH="/mnt/c/Users/Dell 5090/Documents/Claude/Projects/Patrik The Gardener/zahradni-tracker"
FRONTEND="$WPATH/frontend"
BACKEND_PUBLIC="$WPATH/backend/public"

echo "[1] Killing server..."
pkill -9 -f "node.*server.js" 2>/dev/null || true
pkill -9 -f "node --no-warnings" 2>/dev/null || true
sleep 1
echo "killed"

echo "[2] Building frontend..."
cd "$FRONTEND"
npm run build
echo "Build done."

echo "[3] Copying dist to backend/public..."
rm -rf "$BACKEND_PUBLIC"
cp -r "$FRONTEND/dist" "$BACKEND_PUBLIC"
echo "Copied."

echo "[4] Syncing backend to WSL..."
mkdir -p ~/zahradni-tracker
rsync -a --delete --exclude=node_modules --exclude=data --exclude=uploads --exclude=public "$WPATH/backend/" ~/zahradni-tracker/
cp -r "$BACKEND_PUBLIC" ~/zahradni-tracker/
echo "Synced."

echo "[5] Starting server..."
cd ~/zahradni-tracker
node --no-warnings server.js
