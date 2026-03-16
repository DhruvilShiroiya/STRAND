require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./db');
const { isDriveAccessible } = require('./utils/driveUtils');
const config = require('../config.json');

const app = express();
const PORT = process.env.PORT || config.appPort || 3000;

// ── MIDDLEWARE ──
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── SERVE FRONTEND ──
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// ── DRIVE STATUS CHECK (runs on boot) ──
function checkDrives() {
  const drives = db.prepare('SELECT * FROM drives').all();
  const update = db.prepare('UPDATE drives SET status = ? WHERE id = ?');
  drives.forEach(drive => {
    const online = isDriveAccessible(drive.path);
    update.run(online ? 'online' : 'offline', drive.id);
    console.log(`  Drive "${drive.label}" (${drive.path}): ${online ? '✓ online' : '✗ offline'}`);
  });
}

// ── ROUTES ──
app.use('/api/auth', require('./routes/auth'));
app.use('/api/files', require('./routes/files'));
app.use('/api/admin', require('./routes/admin'));

// ── HEALTH CHECK ──
app.get('/api/health', (req, res) => {
  const drives = db.prepare('SELECT * FROM drives').all();
  res.json({ status: 'ok', drives });
});

// ── CATCH ALL → frontend ──
app.get('/{*path}', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html'));
});

// ── START ──
app.listen(PORT, () => {
  console.log(`\n┌─────────────────────────────────┐`);
  console.log(`│  Strand running on port ${PORT}     │`);
  console.log(`│  Admin panel: localhost:${PORT}     │`);
  console.log(`└─────────────────────────────────┘\n`);
  console.log('Checking drives...');
  checkDrives();
  console.log('');
});

module.exports = app;