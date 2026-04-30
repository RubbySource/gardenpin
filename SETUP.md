# Spuštění GardenPin po restartu PC

## Jednorázové nastavení (nutné jen poprvé)
1. Otevři PowerShell jako admin
2. wsl -u root
3. passwd dell_5090   ← zadej nové heslo
4. exit
5. Otevři WSL normálně
6. sudo apt-get install -y build-essential python3
7. cd ~/zahradni-tracker && npm install (v backend/ složce)
8. sudo npm install -g pm2
9. bash start-gardenpin.sh
10. pm2 startup   ← zkopíruj a spusť výstupní příkaz
11. pm2 save

## Každodenní použití
- Server startuje automaticky s Windows/WSL
- Otevři prohlížeč: http://localhost:3000
- Pokud neběží: wsl → cd ~/zahradni-tracker → pm2 start ecosystem.config.js
