#!/bin/bash
cd ~/zahradni-tracker
pm2 start ecosystem.config.js
pm2 save
echo "GardenPin running on http://localhost:3000"
