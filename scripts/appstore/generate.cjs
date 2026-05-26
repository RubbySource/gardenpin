// Generuje lokalizované App Store screenshoty (1290 x 2796, 6.7"/6.5" třída).
//
// Pipeline per jazyk:
//   1. seedne izolovanou SQLite DB lokalizovaným demo obsahem (demo-data.cjs)
//   2. nastartuje backend/server.js na izolovaném portu nad tou DB
//   3. Playwright (393x852 @3x) projde 5 hlavních obrazovek a vyfotí je
//   4. každý screen vsadí do marketingového rámce (gradient + titulek + iPhone)
//      vykresleného přímo v prohlížeči -> finální 1290x2796 PNG
//
// Spuštění:  cd scripts/appstore && npm install && node generate.cjs
// Výstup:    appstore/screenshots/<lang>/<NN-screen>.png

const path = require('path');
const fs = require('fs');
const os = require('os');
const http = require('http');
const { spawn } = require('child_process');
const { chromium } = require('playwright');
const { LANGS, USER_NAME, seedDatabase, mapSvg } = require('./demo-data.cjs');

const ROOT = path.resolve(__dirname, '..', '..');
const BACKEND = path.join(ROOT, 'backend');
const UPLOADS = path.join(BACKEND, 'uploads');
const OUT = path.join(ROOT, 'appstore', 'screenshots');
const MAP_REL = '/uploads/_appstore_map.svg';
const MAP_FILE = path.join(UPLOADS, '_appstore_map.svg');
const MAP_W = 1000, MAP_H = 1300;

// Hlavní obrazovky + best-effort selektor, na který počkat.
// Slot 4 se liší podle jazyka: čeština ukazuje katalog rostlin (databáze je
// zatím jen v CZ — viz docs/APP_STORE.md „Známá omezení"), ostatní jazyky
// místo něj ukazují Nastavení (plně lokalizované + přepínač jazyka).
const BASE = {
  home: { file: '01-home', route: '/', wait: '.hm-card, .ios-large-title' },
  tasks: { file: '02-tasks', route: '/ukoly', wait: '.ios-segmented, .task-month-group' },
  garden: { file: '03-garden', route: '/zahrada/1', wait: '.gd-map-card, .map-container' },
  catalog: { file: '04-catalog', route: '/katalog', wait: '.plant-catalog, .cat-grid, main' },
  settings: { file: '04-settings', route: '/nastaveni', wait: '.settings-group, .settings-sep, main' },
  gardens: { file: '05-gardens', route: '/zahrady', wait: '.gl-card' },
};
function screensFor(lang) {
  return [BASE.home, BASE.tasks, BASE.garden, lang === 'cs' ? BASE.catalog : BASE.settings, BASE.gardens];
}

// Marketingové titulky (\n = explicitní zalomení). Zrcadlí docs/APP_STORE.md.
const CAPTIONS = {
  '01-home': {
    cs: { t: 'Celá vaše zahrada\nv jedné aplikaci', s: 'Přehled úkonů, počasí i pokroku' },
    en: { t: 'Your whole garden\nin one app', s: 'Tasks, weather and progress at a glance' },
    de: { t: 'Ihr ganzer Garten\nin einer App', s: 'Aufgaben, Wetter und Fortschritt im Blick' },
    pl: { t: 'Cały ogród\nw jednej aplikacji', s: 'Zadania, pogoda i postępy w jednym miejscu' },
    sk: { t: 'Celá vaša záhrada\nv jednej aplikácii', s: 'Úkony, počasie aj pokrok prehľadne' },
  },
  '02-tasks': {
    cs: { t: 'Nezapomenete\nna žádný úkon', s: 'Sezónní péče pro každou rostlinu' },
    en: { t: 'Never miss\na seasonal task', s: 'Care reminders for every plant' },
    de: { t: 'Verpassen Sie\nkeine Pflege', s: 'Saisonale Aufgaben für jede Pflanze' },
    pl: { t: 'Nie przegapisz\nżadnej pracy', s: 'Sezonowa pielęgnacja każdej rośliny' },
    sk: { t: 'Nezabudnete\nna žiadny úkon', s: 'Sezónna starostlivosť pre každú rastlinu' },
  },
  '03-garden': {
    cs: { t: 'Interaktivní mapa\nvaší zahrady', s: 'Umístěte rostliny přesně tam, kde rostou' },
    en: { t: 'An interactive map\nof your garden', s: 'Place plants exactly where they grow' },
    de: { t: 'Interaktive Karte\nIhres Gartens', s: 'Pflanzen genau dort platzieren, wo sie wachsen' },
    pl: { t: 'Interaktywna mapa\nTwojego ogrodu', s: 'Umieść rośliny tam, gdzie naprawdę rosną' },
    sk: { t: 'Interaktívna mapa\nvašej záhrady', s: 'Umiestnite rastliny presne tam, kde rastú' },
  },
  '04-catalog': {
    cs: { t: 'Více než 400 rostlin\npro střední Evropu', s: 'Zelenina, ovoce, byliny i okrasné' },
    en: { t: 'Over 400 plants\nfor Central Europe', s: 'Vegetables, fruit, herbs and ornamentals' },
    de: { t: 'Über 400 Pflanzen\nfür Mitteleuropa', s: 'Gemüse, Obst, Kräuter und Zierpflanzen' },
    pl: { t: 'Ponad 400 roślin\ndla Europy Środkowej', s: 'Warzywa, owoce, zioła i rośliny ozdobne' },
    sk: { t: 'Viac než 400 rastlín\npre strednú Európu', s: 'Zelenina, ovocie, bylinky aj okrasné' },
  },
  '04-settings': {
    cs: { t: 'Vše podle vás\nve vašem jazyce', s: 'Tmavý režim, připomínky, kalendář' },
    en: { t: 'Make it yours\nin your language', s: 'Dark mode, reminders and calendar sync' },
    de: { t: 'Ganz nach\nIhrem Geschmack', s: 'Dunkelmodus, Erinnerungen, Kalender-Sync' },
    pl: { t: 'Dostosuj aplikację\ndo siebie', s: 'Tryb ciemny, przypomnienia i kalendarz' },
    sk: { t: 'Prispôsobte si to\npodľa seba', s: 'Tmavý režim, pripomienky a kalendár' },
  },
  '05-gardens': {
    cs: { t: 'Všechny zahrady\npřehledně', s: 'Sledujte každý záhon i balkon' },
    en: { t: 'All your gardens\nin one place', s: 'Track every bed and balcony' },
    de: { t: 'Alle Gärten\nauf einen Blick', s: 'Jedes Beet und jeder Balkon im Griff' },
    pl: { t: 'Wszystkie ogrody\nw jednym miejscu', s: 'Śledź każdą grządkę i balkon' },
    sk: { t: 'Všetky záhrady\nprehľadne', s: 'Sledujte každý záhon aj balkón' },
  },
};

const FLAG = { cs: '🇨🇿', en: '🇬🇧', de: '🇩🇪', pl: '🇵🇱', sk: '🇸🇰' };

function frameHtml(title, sub, dataUri) {
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  return `<!doctype html><html><head><meta charset="utf-8"><style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:1290px;height:2796px;overflow:hidden}
body{font-family:'Ubuntu','DejaVu Sans',sans-serif;-webkit-font-smoothing:antialiased;
  background:linear-gradient(165deg,#84b291 0%,#5f8c6e 48%,#43654d 100%);
  display:flex;flex-direction:column;align-items:center}
.cap{padding:132px 92px 0;text-align:center;color:#fff}
.cap h1{font-size:76px;line-height:1.07;font-weight:800;letter-spacing:-0.02em;white-space:pre-line;
  text-shadow:0 2px 18px rgba(0,0,0,0.12)}
.cap p{margin-top:28px;font-size:35px;line-height:1.32;font-weight:500;color:rgba(255,255,255,0.88)}
.device{margin-top:90px;width:1028px;background:#0c0e0c;border-radius:108px;padding:20px;
  box-shadow:0 54px 100px rgba(0,0,0,0.34),0 12px 26px rgba(0,0,0,0.22)}
.device img{display:block;width:100%;border-radius:90px}
</style></head><body>
<div class="cap"><h1>${esc(title)}</h1><p>${esc(sub)}</p></div>
<div class="device"><img src="${dataUri}"></div>
</body></html>`;
}

function waitForServer(port, timeoutMs = 20000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      const req = http.get({ host: 'localhost', port, path: '/api/gardens', timeout: 2000 }, (res) => {
        res.resume();
        if (res.statusCode === 200) return resolve();
        retry();
      });
      req.on('error', retry);
      req.on('timeout', () => { req.destroy(); retry(); });
    };
    const retry = () => {
      if (Date.now() - start > timeoutMs) return reject(new Error('server boot timeout on port ' + port));
      setTimeout(tick, 300);
    };
    tick();
  });
}

async function settle(page) {
  await page.addStyleTag({ content: '*{animation:none!important;transition:none!important;scroll-behavior:auto!important}' }).catch(() => {});
  // počkej na načtení všech obrázků (mapa apod.)
  await page.evaluate(() => Promise.all(
    Array.from(document.images).map((img) => (img.complete ? null : new Promise((r) => { img.onload = img.onerror = r; }))),
  )).catch(() => {});
  await page.waitForTimeout(1100);
}

async function main() {
  fs.mkdirSync(UPLOADS, { recursive: true });
  fs.writeFileSync(MAP_FILE, mapSvg());

  const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage', '--font-render-hinting=none'] });
  const frameCtx = await browser.newContext({ viewport: { width: 1290, height: 2796 }, deviceScaleFactor: 1 });
  const framePage = await frameCtx.newPage();

  let total = 0;
  try {
    for (let i = 0; i < LANGS.length; i++) {
      const lang = LANGS[i];
      const port = 3100 + i;
      const dbPath = path.join(os.tmpdir(), `appstore-${lang}.db`);
      seedDatabase(dbPath, lang, { mapImagePath: MAP_REL, mapW: MAP_W, mapH: MAP_H });

      const srv = spawn('node', ['server.js'], {
        cwd: BACKEND,
        env: { ...process.env, DATABASE_PATH: dbPath, PORT: String(port), NODE_ENV: 'production' },
        stdio: 'ignore',
      });
      try {
        await waitForServer(port);

        const ctx = await browser.newContext({
          viewport: { width: 393, height: 852 },
          deviceScaleFactor: 3,
          locale: lang === 'en' ? 'en-GB' : lang,
          reducedMotion: 'reduce',
        });
        await ctx.addInitScript(([lng, name]) => {
          localStorage.setItem('gardenpin.lang', lng);
          localStorage.setItem('gp_onboarded', '1');
          localStorage.setItem('gardenpin.userName', name);
          localStorage.setItem('gardenpin.theme', 'light');
        }, [lang, USER_NAME[lang]]);

        const page = await ctx.newPage();
        const outDir = path.join(OUT, lang);
        fs.mkdirSync(outDir, { recursive: true });

        for (const sc of screensFor(lang)) {
          await page.goto(`http://localhost:${port}${sc.route}`, { waitUntil: 'networkidle' }).catch(() => {});
          await page.waitForSelector(sc.wait, { timeout: 5000 }).catch(() => {});
          await settle(page);
          const shot = await page.screenshot({ type: 'png' });

          const cap = CAPTIONS[sc.file][lang];
          const dataUri = 'data:image/png;base64,' + shot.toString('base64');
          await framePage.setContent(frameHtml(cap.t, cap.s, dataUri), { waitUntil: 'load' });
          await framePage.evaluate(() => Promise.all(
            Array.from(document.images).map((img) => (img.complete ? null : new Promise((r) => { img.onload = img.onerror = r; }))),
          ));
          await framePage.waitForTimeout(120);
          await framePage.screenshot({ path: path.join(outDir, sc.file + '.png'), type: 'png' });
          total++;
          console.log(`${FLAG[lang]} ${lang}/${sc.file}.png`);
        }
        await ctx.close();
      } finally {
        srv.kill('SIGKILL');
        for (const ext of ['', '-wal', '-shm']) { try { fs.rmSync(dbPath + ext); } catch {} }
      }
    }
  } finally {
    await browser.close();
    try { fs.rmSync(MAP_FILE); } catch {}
  }
  console.log(`\nHotovo: ${total} screenshotů -> ${path.relative(ROOT, OUT)}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
