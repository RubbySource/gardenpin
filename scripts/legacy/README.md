# scripts/legacy/

Archiv historických spouštěcích skriptů z období před stabilizací deploy workflow
(do 2026-06-12). Nejsou volány z produkčního kódu, dokumentace ani aktivních
skriptů — jsou tu jen pro git historii a případnou referenci.

## Kanonický workflow (aktuální)

- **Lokální start:** `Spustit Zahradní tracker.bat` v rootu projektu
- **Deploy do produkce:** `wsl -e bash deploy.sh` v rootu projektu
- **Firewall:** `Firewall - Povoleni portu 3000 (spustit jako Admin).bat` v rootu

## Co je tady (26 souborů)

Většina jsou jednorázové ad-hoc skripty z různých fází vývoje:

- **deploy-* / git-* / push-now:** Zastaralé deploy varianty, nahrazeno `deploy.sh`
- **build-* / restart-* / start-new / update-*:** Lokální restart helpers,
  nahrazeno `Spustit Zahradní tracker.bat`
- **pm2-*:** Lokální PM2 management, dnes řešeno přímo na produkci přes
  `pm2 restart gardenpin` ve WSL
- **design-* / new-design / apply-css-fix:** Jednorázové redesign deploy skripty
- **fix-a-spustit / kill-a-spustit / _run_git_fix:** Recovery helpers po crashích
- **deploy-pr16.{bat,sh}:** Deploy konkrétního PR, dávno mergnutý
- **check-port / test-wsl / gardenpin-start / wsl-clone-deploy:** Diagnostika

## Mazat?

Můžeš. `git rm scripts/legacy/*` je bezpečné — historie zůstane v gitu.
Tento adresář existuje jako "soft delete" pro postupný cleanup bez paniky.
