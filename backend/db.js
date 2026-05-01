// SQLite database setup — using better-sqlite3 (Node >= 14, works with Node 20)
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Cesta k DB souboru — pokud je nastavena env DATABASE_PATH (např. Railway Volume),
// použije se přímo. Jinak fallback na backend/data/zahrada.db.
const dbPath = process.env.DATABASE_PATH
  ? path.resolve(process.env.DATABASE_PATH)
  : path.join(__dirname, 'data', 'zahrada.db');

const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

const db = new Database(dbPath);
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

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE,
    password_hash TEXT,
    is_premium INTEGER DEFAULT 0,
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );
`);

// Migrations — přidat sloupce pokud neexistují
try { db.exec('ALTER TABLE gardens ADD COLUMN rotation INTEGER DEFAULT 0'); } catch {}
try { db.exec('ALTER TABLE tasks ADD COLUMN recurring INTEGER DEFAULT 0'); } catch {}
try { db.exec('ALTER TABLE tasks ADD COLUMN recurrence_pattern TEXT'); } catch {}
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
