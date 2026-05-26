# App Store screenshot tooling

Generuje lokalizované App Store screenshoty (1290 × 2796) z **živé aplikace** přes
Playwright. Build-time nástroj — není součástí runtime appky a nepatří do jejích závislostí.

## Použití

```bash
cd scripts/appstore
npm install                          # nainstaluje playwright (npm balík)
npx playwright install chromium      # stáhne prohlížeč (jednorázově)
node generate.cjs                    # vyrobí 25 PNG do ../../appstore/screenshots/
```

Na Linuxu/WSL bez rootu, kde chybí systémové knihovny chromia (`libnspr4`, `libnss3`,
`libasound2`), je lze stáhnout bez `sudo` a nasměrovat na ně linker:

```bash
cd /tmp && apt-get download libnspr4 libnss3 libasound2t64
for d in *.deb; do dpkg -x "$d" ~/pw-libs-extract; done
mkdir -p ~/pw-libs && find ~/pw-libs-extract -name '*.so*' -exec cp -P {} ~/pw-libs/ \;
LD_LIBRARY_PATH=~/pw-libs node generate.cjs
```

(S rootem stačí `npx playwright install-deps chromium`.) Pro emoji v UI je potřeba
emoji font, např. `~/.local/share/fonts/NotoColorEmoji.ttf` + `fc-cache -f`.

## Jak to funguje

Per jazyk (`cs, en, de, pl, sk`):
1. `demo-data.cjs` naseeduje izolovanou SQLite DB (`$TMPDIR/appstore-<lang>.db`)
   lokalizovaným demo obsahem — 2 zahrady, 8 rostlin (piny na ilustrované mapě), ~9
   sezónních úkonů rozprostřených „po termínu / dnes / tento týden" + streak.
2. nastartuje `backend/server.js` na izolovaném portu (3100+) nad tou DB,
3. Playwright (viewport 393×852 @3×) projde 5 obrazovek a vyfotí je,
4. každý snímek vsadí do marketingového rámce (gradient + titulek + iPhone) vykresleného
   přímo v prohlížeči → finální 1290×2796 PNG.

Produkční DB ani PM2 instance se to nedotýká. Mapová ilustrace se zapisuje dočasně do
`backend/uploads/_appstore_map.svg` a po běhu se maže.

## Soubory
- `demo-data.cjs` — lokalizovaný seed + SVG ilustrace zahrady
- `generate.cjs` — orchestrace + marketingové titulky (`CAPTIONS`) + rámec

Titulky a kompletní App Store metadata (názvy, popisy, klíčová slova v 5 jazycích) jsou
v `docs/APP_STORE.md`, včetně sekce **Známá omezení** (proč slot 4 ukazuje v CZ katalog a
jinde Nastavení).
