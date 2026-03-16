require('dotenv').config();
const bcrypt = require('bcrypt');
const db     = require('./db');

async function seed() {
  const username = 'admin';
  const password = 'strand123';
  const hash     = await bcrypt.hash(password, 12);

  // Get Drive A id
  const driveA = db.prepare("SELECT id FROM drives WHERE label = 'Drive A'").get();

  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) {
    console.log('Admin user already exists');
    process.exit(0);
  }

  db.prepare(`
    INSERT INTO users (username, password, role, drive_id, quota_mb, warn_mb)
    VALUES (?, ?, 'admin', ?, 102400, 92160)
  `).run(username, hash, driveA.id);

  console.log('✓ Admin user created');
  console.log('  Username: admin');
  console.log('  Password: strand123');
  console.log('  Change this password after first login!');
  process.exit(0);
}

seed();