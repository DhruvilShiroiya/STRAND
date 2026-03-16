const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// data/ folder sits on your Mac, never on the drive
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, 'strand.db'));

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ── CREATE TABLES ──
db.exec(`
  CREATE TABLE IF NOT EXISTS drives (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    label       TEXT NOT NULL,
    path        TEXT NOT NULL,
    status      TEXT DEFAULT 'offline',
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS users (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    username    TEXT UNIQUE NOT NULL,
    password    TEXT NOT NULL,
    role        TEXT DEFAULT 'user',
    drive_id    INTEGER NOT NULL,
    quota_mb    INTEGER NOT NULL DEFAULT 10240,
    warn_mb     INTEGER NOT NULL DEFAULT 9216,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (drive_id) REFERENCES drives(id)
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL,
    token       TEXT NOT NULL,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at  DATETIME NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS usage_cache (
    user_id     INTEGER PRIMARY KEY,
    used_mb     REAL NOT NULL DEFAULT 0,
    last_synced DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS drive_memories (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    drive_id    INTEGER NOT NULL,
    user_id     INTEGER NOT NULL,
    title       TEXT NOT NULL,
    note        TEXT,
    usage_mb    REAL,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (drive_id) REFERENCES drives(id),
    FOREIGN KEY (user_id)  REFERENCES users(id) ON DELETE CASCADE
  );
`);

// ── Add quota_percent column if it doesn't exist yet (SQLite safe migration) ──
try {
  db.exec('ALTER TABLE users ADD COLUMN quota_percent REAL NOT NULL DEFAULT 0.1');
  console.log('✓ Added quota_percent column to users');
} catch (_) {
  // Column already exists — safe to ignore
}

// ── SEED DEFAULT DRIVES if empty ──
const driveCount = db.prepare('SELECT COUNT(*) as c FROM drives').get();
if (driveCount.c === 0) {
  const config = require('../config.json');
  const insertDrive = db.prepare(
    'INSERT INTO drives (label, path, status) VALUES (?, ?, ?)'
  );
  insertDrive.run('Drive A', config.adminDrivePath, 'offline');
  insertDrive.run('Drive B', config.sharedDrivePath, 'offline');
  console.log('✓ Default drives seeded');
}

module.exports = db;