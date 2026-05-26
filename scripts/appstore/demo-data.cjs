// Lokalizovaná demo data pro App Store screenshoty.
//
// Seeduje izolovanou SQLite DB (node:sqlite) plnou ukázkovou zahradou tak, aby
// hlavní obrazovky vypadaly živě v každém jazyce: zahrady, rostliny (piny na mapě),
// sezónní úkony rozprostřené přes "po termínu / dnes / tento týden" a streak.
//
// Schéma se drží 1:1 s backend/db.js (včetně migrovaných sloupců) — server poté
// při startu jen no-op `CREATE TABLE IF NOT EXISTS` + try/catch ALTERy.

const { DatabaseSync } = require('node:sqlite');
const fs = require('fs');

const LANGS = ['cs', 'en', 'de', 'pl', 'sk'];

// Jméno uživatele do pozdravu na Home (lokalizovaný "feel").
const USER_NAME = { cs: 'Patrik', en: 'Alex', de: 'Lena', pl: 'Kasia', sk: 'Janka' };

// --- Zahrady -----------------------------------------------------------------
const GARDENS = [
  {
    name: { cs: 'Zahrada za domem', en: 'Backyard Garden', de: 'Garten hinterm Haus', pl: 'Ogród za domem', sk: 'Záhrada za domom' },
    location: 'Brno',
    climate_zone: 'JHM',
    withMap: true,
  },
  {
    name: { cs: 'Předzahrádka', en: 'Front Garden', de: 'Vorgarten', pl: 'Ogródek przed domem', sk: 'Predzáhradka' },
    location: 'Brno',
    climate_zone: 'JHM',
    withMap: false,
  },
];

// --- Rostliny (piny). g = index zahrady (0/1), x/y v % mapy --------------------
const PLANTS = [
  { g: 0, x: 30, y: 40, color: '#E5484D', name: { cs: 'Rajče', en: 'Tomato', de: 'Tomate', pl: 'Pomidor', sk: 'Paradajka' } },
  { g: 0, x: 62, y: 27, color: '#8E6FD8', name: { cs: 'Levandule', en: 'Lavender', de: 'Lavendel', pl: 'Lawenda', sk: 'Levanduľa' } },
  { g: 0, x: 45, y: 60, color: '#E5484D', name: { cs: 'Jahodník', en: 'Strawberry', de: 'Erdbeere', pl: 'Truskawka', sk: 'Jahoda' } },
  { g: 0, x: 78, y: 66, color: '#46934E', name: { cs: 'Jabloň', en: 'Apple tree', de: 'Apfelbaum', pl: 'Jabłoń', sk: 'Jabloň' } },
  { g: 0, x: 21, y: 70, color: '#46934E', name: { cs: 'Bazalka', en: 'Basil', de: 'Basilikum', pl: 'Bazylia', sk: 'Bazalka' } },
  { g: 0, x: 68, y: 50, color: '#D6409F', name: { cs: 'Růže', en: 'Rose', de: 'Rose', pl: 'Róża', sk: 'Ruža' } },
  { g: 1, x: 38, y: 45, color: '#46934E', name: { cs: 'Tymián', en: 'Thyme', de: 'Thymian', pl: 'Tymianek', sk: 'Tymián' } },
  { g: 1, x: 64, y: 55, color: '#3E63DD', name: { cs: 'Hortenzie', en: 'Hydrangea', de: 'Hortensie', pl: 'Hortensja', sk: 'Hortenzia' } },
];

// --- Úkony (p = index pinu, due = offset dnů od dneška, neg = po termínu) ------
const TASKS = [
  { p: 1, type: 'strihani', due: -2, title: { cs: 'Zastřihni levanduli po odkvětu', en: 'Prune lavender after blooming', de: 'Lavendel nach der Blüte zurückschneiden', pl: 'Przytnij lawendę po przekwitnięciu', sk: 'Zastrihni levanduľu po odkvete' } },
  { p: 5, type: 'presazeni', due: 0, title: { cs: 'Přesaď růži na slunné místo', en: 'Move the rose to a sunny spot', de: 'Rose an einen sonnigen Platz umpflanzen', pl: 'Przesadź różę w słoneczne miejsce', sk: 'Presaď ružu na slnečné miesto' } },
  { p: 2, type: 'hnojeni', due: 0, title: { cs: 'Přihnoj jahodník', en: 'Fertilize the strawberries', de: 'Erdbeeren düngen', pl: 'Nawieź truskawki', sk: 'Prihnoj jahody' } },
  { p: 0, type: 'kontrola', due: 1, title: { cs: 'Zkontroluj rajče (plíseň)', en: 'Check the tomato for blight', de: 'Tomate auf Mehltau prüfen', pl: 'Sprawdź pomidora (zaraza)', sk: 'Skontroluj paradajku (pleseň)' } },
  { p: 4, type: 'sklizen', due: 2, title: { cs: 'Sklizeň bazalky', en: 'Harvest the basil', de: 'Basilikum ernten', pl: 'Zbierz bazylię', sk: 'Zber bazalky' } },
  { p: 3, type: 'strihani', due: 3, title: { cs: 'Proveď letní řez jabloně', en: 'Summer-prune the apple tree', de: 'Sommerschnitt am Apfelbaum', pl: 'Wykonaj letnie cięcie jabłoni', sk: 'Urob letný rez jablone' } },
  { p: 7, type: 'strihani', due: 4, title: { cs: 'Zastřihni hortenzii', en: 'Prune the hydrangea', de: 'Hortensie zurückschneiden', pl: 'Przytnij hortensję', sk: 'Zastrihni hortenziu' } },
  { p: 5, type: 'hnojeni', due: 5, title: { cs: 'Přihnoj růže před květem', en: 'Fertilize roses before flowering', de: 'Rosen vor der Blüte düngen', pl: 'Nawieź róże przed kwitnieniem', sk: 'Prihnoj ruže pred kvetom' } },
  { p: 6, type: 'presazeni', due: 6, title: { cs: 'Přesaď tymián do truhlíku', en: 'Repot the thyme into a planter', de: 'Thymian in den Kasten umpflanzen', pl: 'Przesadź tymianek do skrzynki', sk: 'Presaď tymián do debny' } },
];

// Hotové úkony do historie péče (powering "Hotovo" + streak).
const DONE = [
  { p: 3, type: 'hnojeni', ago: 3, title: { cs: 'Přihnojena jabloň', en: 'Apple tree fertilized', de: 'Apfelbaum gedüngt', pl: 'Jabłoń nawieziona', sk: 'Jabloň prihnojená' } },
  { p: 0, type: 'presazeni', ago: 6, title: { cs: 'Vysazeno rajče na záhon', en: 'Tomato planted out', de: 'Tomate ausgepflanzt', pl: 'Pomidor wysadzony', sk: 'Paradajka vysadená' } },
  { p: 2, type: 'kontrola', ago: 9, title: { cs: 'Zkontrolován jahodník', en: 'Strawberries checked', de: 'Erdbeeren kontrolliert', pl: 'Truskawki sprawdzone', sk: 'Jahody skontrolované' } },
];

function isoOffset(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// Top-down ilustrace zahrady jako SVG (renderuje se v <img>). Sage/cream paleta.
function mapSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1300" width="1000" height="1300">
  <defs>
    <linearGradient id="grass" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#cfe3c4"/><stop offset="1" stop-color="#b7d4a8"/>
    </linearGradient>
    <linearGradient id="soil" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#a9805a"/><stop offset="1" stop-color="#8a6442"/>
    </linearGradient>
    <radialGradient id="canopy" cx="0.4" cy="0.35" r="0.7">
      <stop offset="0" stop-color="#6fae6a"/><stop offset="1" stop-color="#4a7d49"/>
    </radialGradient>
  </defs>
  <rect width="1000" height="1300" fill="url(#grass)"/>
  <!-- subtle lawn patches -->
  <g fill="#c6dcb8" opacity="0.5">
    <ellipse cx="200" cy="240" rx="150" ry="90"/>
    <ellipse cx="820" cy="980" rx="180" ry="110"/>
    <ellipse cx="520" cy="1180" rx="220" ry="80"/>
  </g>
  <!-- winding path -->
  <path d="M -40 760 C 260 700 300 560 540 540 C 760 522 820 360 1060 360" fill="none" stroke="#e4d8b8" stroke-width="86" stroke-linecap="round"/>
  <path d="M -40 760 C 260 700 300 560 540 540 C 760 522 820 360 1060 360" fill="none" stroke="#efe6cd" stroke-width="62" stroke-linecap="round"/>
  <!-- raised beds -->
  <g stroke="#6f4f33" stroke-width="6">
    <rect x="170" y="380" width="290" height="170" rx="20" fill="url(#soil)"/>
    <rect x="330" y="660" width="300" height="180" rx="20" fill="url(#soil)"/>
    <rect x="120" y="820" width="230" height="150" rx="20" fill="url(#soil)"/>
  </g>
  <!-- bed rows -->
  <g stroke="#6f4f33" stroke-width="3" opacity="0.45">
    <line x1="190" y1="430" x2="440" y2="430"/><line x1="190" y1="470" x2="440" y2="470"/><line x1="190" y1="510" x2="440" y2="510"/>
    <line x1="350" y1="710" x2="610" y2="710"/><line x1="350" y1="755" x2="610" y2="755"/><line x1="350" y1="800" x2="610" y2="800"/>
  </g>
  <!-- tree -->
  <ellipse cx="790" cy="900" rx="150" ry="150" fill="#3f6d40" opacity="0.25"/>
  <circle cx="780" cy="870" r="150" fill="url(#canopy)"/>
  <circle cx="700" cy="900" r="80" fill="#5c9a57" opacity="0.85"/>
  <circle cx="860" cy="930" r="74" fill="#5c9a57" opacity="0.8"/>
  <!-- pond -->
  <ellipse cx="640" cy="300" rx="150" ry="100" fill="#7fb6d8"/>
  <ellipse cx="640" cy="300" rx="150" ry="100" fill="none" stroke="#cfe3c4" stroke-width="10"/>
  <ellipse cx="600" cy="280" rx="46" ry="28" fill="#a7d0e8" opacity="0.8"/>
  <!-- deck near house (bottom) -->
  <rect x="60" y="1120" width="880" height="150" rx="16" fill="#d8c39c"/>
  <g stroke="#bda678" stroke-width="4">
    <line x1="60" y1="1170" x2="940" y2="1170"/><line x1="60" y1="1220" x2="940" y2="1220"/>
  </g>
</svg>`;
}

function seedDatabase(dbPath, lang, opts) {
  const { mapImagePath, mapW, mapH } = opts;
  if (fs.existsSync(dbPath)) fs.rmSync(dbPath);
  for (const ext of ['-wal', '-shm']) { try { fs.rmSync(dbPath + ext); } catch {} }

  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA foreign_keys = ON');

  // Plné schéma (sloupce už po migracích) — drží se backend/db.js.
  db.exec(`
    CREATE TABLE IF NOT EXISTS gardens (
      id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, image_path TEXT,
      image_width INTEGER, image_height INTEGER, rotation INTEGER DEFAULT 0,
      share_token TEXT, shared_at TEXT, soil_type TEXT, exposure TEXT, altitude_m INTEGER,
      climate_zone TEXT, location TEXT, garden_polygon TEXT, ical_token TEXT,
      created_at TEXT DEFAULT (datetime('now')));
    CREATE TABLE IF NOT EXISTS pins (
      id INTEGER PRIMARY KEY AUTOINCREMENT, garden_id INTEGER NOT NULL, name TEXT NOT NULL,
      x REAL NOT NULL, y REAL NOT NULL, plant_name TEXT, planting_date TEXT, notes TEXT,
      photo_path TEXT, color TEXT DEFAULT '#4a7c3a', created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (garden_id) REFERENCES gardens(id) ON DELETE CASCADE);
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT, pin_id INTEGER NOT NULL, title TEXT NOT NULL,
      task_type TEXT NOT NULL, frequency_days INTEGER, specific_date TEXT, next_due TEXT,
      last_done TEXT, notes TEXT, recurring INTEGER DEFAULT 0, recurrence_pattern TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (pin_id) REFERENCES pins(id) ON DELETE CASCADE);
    CREATE TABLE IF NOT EXISTS care_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT, task_id INTEGER, pin_id INTEGER NOT NULL,
      action TEXT NOT NULL, notes TEXT, done_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE SET NULL,
      FOREIGN KEY (pin_id) REFERENCES pins(id) ON DELETE CASCADE);
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT UNIQUE, password_hash TEXT,
      is_premium INTEGER DEFAULT 0, stripe_customer_id TEXT, stripe_subscription_id TEXT,
      created_at TEXT DEFAULT (datetime('now')));
    CREATE TABLE IF NOT EXISTS user_stats (
      user_id INTEGER PRIMARY KEY, current_streak INTEGER NOT NULL DEFAULT 0,
      longest_streak INTEGER NOT NULL DEFAULT 0, last_done_date TEXT,
      total_completed INTEGER NOT NULL DEFAULT 0, updated_at TEXT DEFAULT (datetime('now')));
    CREATE TABLE IF NOT EXISTS email_settings (
      user_id INTEGER PRIMARY KEY, email TEXT, enabled INTEGER NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')));
  `);

  db.prepare('INSERT OR IGNORE INTO users (id, email) VALUES (1, ?)').run('demo@gardenpin.local');
  db.prepare('INSERT OR IGNORE INTO user_stats (user_id, current_streak, longest_streak, total_completed, last_done_date) VALUES (1, ?, ?, ?, ?)')
    .run(12, 21, 37, isoOffset(0));
  db.prepare('INSERT OR IGNORE INTO email_settings (user_id, email, enabled) VALUES (1, NULL, 0)').run();

  // Gardens
  const gIds = [];
  const insG = db.prepare('INSERT INTO gardens (name, image_path, image_width, image_height, location, climate_zone) VALUES (?, ?, ?, ?, ?, ?)');
  for (const g of GARDENS) {
    const r = insG.run(
      g.name[lang], g.withMap ? mapImagePath : null, g.withMap ? mapW : null, g.withMap ? mapH : null,
      g.location, g.climate_zone,
    );
    gIds.push(Number(r.lastInsertRowid));
  }

  // Pins
  const pIds = [];
  const insP = db.prepare('INSERT INTO pins (garden_id, name, x, y, plant_name, color, planting_date) VALUES (?, ?, ?, ?, ?, ?, ?)');
  for (const p of PLANTS) {
    const r = insP.run(gIds[p.g], p.name[lang], p.x, p.y, p.name[lang], p.color, isoOffset(-40));
    pIds.push(Number(r.lastInsertRowid));
  }

  // Pending tasks
  const insT = db.prepare('INSERT INTO tasks (pin_id, title, task_type, next_due, specific_date, recurring) VALUES (?, ?, ?, ?, ?, 0)');
  for (const t of TASKS) {
    const d = isoOffset(t.due);
    insT.run(pIds[t.p], t.title[lang], t.type, d, d);
  }

  // Done tasks -> care_history (+ a completed task row with last_done)
  const insDoneTask = db.prepare('INSERT INTO tasks (pin_id, title, task_type, last_done, recurring) VALUES (?, ?, ?, ?, 0)');
  const insHist = db.prepare('INSERT INTO care_history (task_id, pin_id, action, done_at) VALUES (?, ?, ?, ?)');
  for (const t of DONE) {
    const when = isoOffset(-t.ago);
    const r = insDoneTask.run(pIds[t.p], t.title[lang], t.type, when);
    insHist.run(Number(r.lastInsertRowid), pIds[t.p], t.title[lang], when + ' 09:00:00');
  }

  db.close();
}

module.exports = { LANGS, USER_NAME, GARDENS, seedDatabase, mapSvg };
