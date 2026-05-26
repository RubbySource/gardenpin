// SQLite database setup — using built-in node:sqlite (Node 22+, no compilation needed)
const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');

// Cesta k DB souboru — pokud je nastavena env DATABASE_PATH (např. Railway Volume),
// použije se přímo. Jinak fallback na backend/data/zahrada.db.
const dbPath = process.env.DATABASE_PATH
  ? path.resolve(process.env.DATABASE_PATH)
  : path.join(__dirname, 'data', 'zahrada.db');

const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

const db = new DatabaseSync(dbPath);
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

// Create all tables
db.exec(`
  CREATE TABLE IF NOT EXISTS gardens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    image_path TEXT,
    image_width INTEGER,
    image_height INTEGER,
    rotation INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS pins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    garden_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    x REAL NOT NULL,
    y REAL NOT NULL,
    plant_name TEXT,
    planting_date TEXT,
    notes TEXT,
    photo_path TEXT,
    color TEXT DEFAULT '#4a7c3a',
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (garden_id) REFERENCES gardens(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pin_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    task_type TEXT NOT NULL,
    frequency_days INTEGER,
    specific_date TEXT,
    next_due TEXT,
    last_done TEXT,
    notes TEXT,
    recurring INTEGER DEFAULT 0,
    recurrence_pattern TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (pin_id) REFERENCES pins(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS care_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER,
    pin_id INTEGER NOT NULL,
    action TEXT NOT NULL,
    notes TEXT,
    done_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE SET NULL,
    FOREIGN KEY (pin_id) REFERENCES pins(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS push_subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    endpoint TEXT NOT NULL UNIQUE,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );

  -- Nativní push device tokeny (APNs/FCM z Capacitoru). Doručování přes APNs
  -- vyžaduje konfiguraci na backendu (viz docs/IOS_BUILD.md); tokeny ukládáme
  -- vždy, ať je klient připraven dřív než APNs creds.
  CREATE TABLE IF NOT EXISTS native_push_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token TEXT NOT NULL UNIQUE,
    platform TEXT NOT NULL DEFAULT 'ios',
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE,
    password_hash TEXT,
    is_premium INTEGER DEFAULT 0,
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS pin_photos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pin_id INTEGER NOT NULL,
    filename TEXT NOT NULL,
    caption TEXT,
    uploaded_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (pin_id) REFERENCES pins(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS beds (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    garden_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    x REAL NOT NULL,
    y REAL NOT NULL,
    width REAL NOT NULL,
    height REAL NOT NULL,
    width_m REAL,
    height_m REAL,
    color TEXT DEFAULT '#8b6f47',
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (garden_id) REFERENCES gardens(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS harvests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pin_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    amount REAL NOT NULL,
    unit TEXT NOT NULL DEFAULT 'kg',
    note TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (pin_id) REFERENCES pins(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS idx_harvests_pin ON harvests(pin_id);
  CREATE INDEX IF NOT EXISTS idx_harvests_date ON harvests(date);

  -- Streak / gamifikace — jeden řádek na uživatele (MVP: user_id=1)
  CREATE TABLE IF NOT EXISTS user_stats (
    user_id INTEGER PRIMARY KEY,
    current_streak INTEGER NOT NULL DEFAULT 0,
    longest_streak INTEGER NOT NULL DEFAULT 0,
    last_done_date TEXT,
    total_completed INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT DEFAULT (datetime('now'))
  );

  -- Email připomínky — MVP single-user (user_id=1, jeden řádek)
  CREATE TABLE IF NOT EXISTS email_settings (
    user_id INTEGER PRIMARY KEY,
    email TEXT,
    enabled INTEGER NOT NULL DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  -- Spolupráce na zahradě — členové (rodina/přátelé) s rolí.
  -- Bez plné autentizace: člen je identita vázaná na zahradu, kterou si
  -- klient po přijetí pozvánky uloží lokálně (viz frontend member.js).
  -- Vlastník (owner) NENÍ řádek — je implicitní (single-user MVP, userName v localStorage).
  CREATE TABLE IF NOT EXISTS garden_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    garden_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    email TEXT,
    role TEXT NOT NULL DEFAULT 'editor',   -- editor | viewer
    color TEXT,
    invite_token TEXT,
    invited_at TEXT DEFAULT (datetime('now')),
    accepted_at TEXT,
    FOREIGN KEY (garden_id) REFERENCES gardens(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS idx_members_garden ON garden_members(garden_id);
  CREATE UNIQUE INDEX IF NOT EXISTS idx_members_token ON garden_members(invite_token) WHERE invite_token IS NOT NULL;
`);

// Inicializace user_stats — jeden řádek pro výchozího uživatele (id=1)
try {
  db.prepare(
    'INSERT OR IGNORE INTO user_stats (user_id, current_streak, longest_streak, total_completed) VALUES (1, 0, 0, 0)',
  ).run();
} catch {}

// Inicializace email_settings — výchozí prázdný / vypnutý řádek pro user_id=1
try {
  db.prepare(
    'INSERT OR IGNORE INTO email_settings (user_id, email, enabled) VALUES (1, NULL, 0)',
  ).run();
} catch {}

// Migrations — přidat sloupce pokud neexistují
try { db.exec('ALTER TABLE gardens ADD COLUMN rotation INTEGER DEFAULT 0'); } catch {}
try { db.exec('ALTER TABLE gardens ADD COLUMN share_token TEXT'); } catch {}
try { db.exec('ALTER TABLE gardens ADD COLUMN shared_at TEXT'); } catch {}
try { db.exec('ALTER TABLE gardens ADD COLUMN soil_type TEXT'); } catch {}
try { db.exec("ALTER TABLE gardens ADD COLUMN exposure TEXT"); } catch {}
try { db.exec('ALTER TABLE gardens ADD COLUMN altitude_m INTEGER'); } catch {}
try { db.exec('ALTER TABLE gardens ADD COLUMN climate_zone TEXT'); } catch {}
try { db.exec('ALTER TABLE gardens ADD COLUMN location TEXT'); } catch {}
try { db.exec('ALTER TABLE gardens ADD COLUMN garden_polygon TEXT'); } catch {}
try { db.exec('ALTER TABLE gardens ADD COLUMN ical_token TEXT'); } catch {}
try { db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_gardens_ical_token ON gardens(ical_token) WHERE ical_token IS NOT NULL'); } catch {}
try { db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_gardens_share_token ON gardens(share_token) WHERE share_token IS NOT NULL'); } catch {}
try { db.exec('ALTER TABLE tasks ADD COLUMN recurring INTEGER DEFAULT 0'); } catch {}
try { db.exec('ALTER TABLE tasks ADD COLUMN recurrence_pattern TEXT'); } catch {}
// Spolupráce — přiřazení úkolu členovi + atribuce splnění
try { db.exec('ALTER TABLE tasks ADD COLUMN assigned_to INTEGER'); } catch {}
try { db.exec('ALTER TABLE care_history ADD COLUMN member_id INTEGER'); } catch {}
try { db.exec('ALTER TABLE users ADD COLUMN is_premium INTEGER DEFAULT 0'); } catch {}
try { db.exec('ALTER TABLE users ADD COLUMN stripe_customer_id TEXT'); } catch {}
try { db.exec('ALTER TABLE users ADD COLUMN stripe_subscription_id TEXT'); } catch {}

// Single-user MVP — nasaď výchozího uživatele s id=1, pokud neexistuje.
// Jakmile přidáme auth, bude se užívat reálné ID.
const userCount = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
if (userCount === 0) {
  db.prepare('INSERT INTO users (id, email) VALUES (1, ?)').run('default@gardenpin.local');
}

module.exports = db;
