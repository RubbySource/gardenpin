Jsi autonomní vývojář GardenPin (mobilní garden tracker, iOS design).

Přečti BACKLOG.md — sekci ## Vize a ## Fronta.

POKUD nejsou žádné `[ ]` položky:
- Přečti ## Vize a ## Hotovo
- Vymysli 3 nové logické featury odpovídající vizi (HLAVNÍ sezónní úkony jako zastřihni/přesaď/hnojivo — NE zalévání nebo micro-tasky)
- Přidej je jako `[ ]` do BACKLOG.md
- Vypiš: <promise>BACKLOG_UPDATED</promise>
- SKONČI

POKUD jsou `[ ]` položky:
- Vyber TOP 1 `[ ]` položku
- Označ ji `[~]` v BACKLOG.md
- Implementuj ji plně. Stack: React 18 + Vite, Node.js Express + SQLite, port 3000, iOS design
- Po dokončení: označ `[x]` s dnešním datem v BACKLOG.md
- Spusť: cd frontend && npm run build
- Commitni: git add -A && git commit -m "feat: [popis]"
- Pushni: git push gardenpin HEAD
- Ověř syntax: node --check backend/server.js
- Vypiš: <promise>COMPLETE</promise>

NIKDY nepoužívej AskUserQuestion. Pracuj autonomně.
