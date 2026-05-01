// SQLite database setup — using better-sqlite3 (Node >= 14, works with Node 20)
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, 'zahrada.db'));
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
`);

// Migrations — přidat sloupce pokud neexistují
try { db.exec('ALTER TABLE gardens ADD COLUMN rotation INTEGER DEFAULT 0'); } catch {}

module.exports = db;
