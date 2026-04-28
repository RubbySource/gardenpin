// SQLite database setup — using Node.js built-in node:sqlite (Node >= 22.5)
const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new DatabaseSync(path.join(dataDir, 'zahrada.db'));
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
    recurrence TEXT,
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
`);

// Migrations — přidat sloupce pokud neexistují
try { db.exec('ALTER TABLE gardens ADD COLUMN rotation INTEGER DEFAULT 0'); } catch {}
try { db.exec('ALTER TABLE gardens ADD COLUMN share_token TEXT'); } catch {}
try { db.exec('ALTER TABLE tasks ADD COLUMN recurring INTEGER DEFAULT 0'); } catch {}
try { db.exec('ALTER TABLE tasks ADD COLUMN recurrence TEXT'); } catch {}

module.exports = db;
