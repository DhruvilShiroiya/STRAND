const router = require('express').Router();
const bcrypt = require('bcrypt');
const fs = require('fs');
const db = require('../db');
const auth = require('../middleware/auth');
const adminOnly = require('../middleware/adminOnly');
const { isDriveAccessible, getDriveStats, getFolderSizeMb, formatSize } = require('../utils/driveUtils');
const { recalculate } = require('../utils/quotaUtils');

// All admin routes require auth + localhost + admin role
router.use(auth, adminOnly);

// ── GET /api/admin/dashboard ──
router.get('/dashboard', (req, res) => {
  const users = db.prepare('SELECT * FROM users').all();
  const drives = db.prepare('SELECT * FROM drives').all();

  const usersWithUsage = users.map(u => {
    const usage = db.prepare('SELECT used_mb FROM usage_cache WHERE user_id = ?').get(u.id);
    const drive = drives.find(d => d.id === u.drive_id);
    const quota_percent = u.role === 'admin' ? 1.0 : (u.quota_percent || 0.1);

    // Compute live quota from percent × drive size
    let quota_mb = u.quota_mb;
    if (drive && isDriveAccessible(drive.path)) {
      try {
        const stats = getDriveStats(drive.path);
        quota_mb = Math.round(stats.totalMb * quota_percent);
      } catch (_) { }
    }
    return {
      id: u.id,
      username: u.username,
      role: u.role,
      drive_id: u.drive_id,
      quota_percent,
      quota_mb,
      warn_mb: Math.round(quota_mb * 0.9),
      used_mb: usage?.used_mb || 0,
      used_fmt: formatSize(usage?.used_mb || 0),
      quota_fmt: formatSize(quota_mb)
    };
  });

  const drivesWithStatus = drives.map(d => {
    const online = isDriveAccessible(d.path);
    db.prepare('UPDATE drives SET status = ? WHERE id = ?')
      .run(online ? 'online' : 'offline', d.id);
    return { ...d, status: online ? 'online' : 'offline' };
  });

  res.json({ users: usersWithUsage, drives: drivesWithStatus });
});

// ── GET /api/admin/drives ──
router.get('/drives', (req, res) => {
  const drives = db.prepare('SELECT * FROM drives').all();
  const result = drives.map(d => {
    const online = isDriveAccessible(d.path);
    db.prepare('UPDATE drives SET status = ? WHERE id = ?')
      .run(online ? 'online' : 'offline', d.id);
    let stats = null;
    if (online) {
      try { stats = getDriveStats(d.path); } catch (_) { }
    }
    return { ...d, status: online ? 'online' : 'offline', stats };
  });
  res.json(result);
});

// ── PUT /api/admin/drives/:id ──
router.put('/drives/:id', (req, res) => {
  const { path: newPath, label } = req.body;
  const drive = db.prepare('SELECT * FROM drives WHERE id = ?').get(req.params.id);
  if (!drive) return res.status(404).json({ error: 'Drive not found' });

  if (newPath) {
    if (!isDriveAccessible(newPath)) {
      return res.status(400).json({ error: 'Path is not accessible — is the drive plugged in?' });
    }
    // Ensure strand folder exists on new drive
    fs.mkdirSync(newPath, { recursive: true });
    db.prepare('UPDATE drives SET path = ? WHERE id = ?').run(newPath, drive.id);
  }

  if (label) {
    db.prepare('UPDATE drives SET label = ? WHERE id = ?').run(label, drive.id);
  }

  res.json({ message: 'Drive updated', drive: db.prepare('SELECT * FROM drives WHERE id = ?').get(drive.id) });
});

// ── GET /api/admin/users ──
router.get('/users', (req, res) => {
  const users = db.prepare('SELECT * FROM users').all();
  const drives = db.prepare('SELECT * FROM drives').all();
  const result = users.map(u => {
    const usage = db.prepare('SELECT used_mb FROM usage_cache WHERE user_id = ?').get(u.id);
    const drive = drives.find(d => d.id === u.drive_id);
    const quota_percent = u.role === 'admin' ? 1.0 : (u.quota_percent || 0.1);

    // Compute live quota from percent × drive size
    let quota_mb = u.quota_mb;
    if (drive && isDriveAccessible(drive.path)) {
      try {
        const stats = getDriveStats(drive.path);
        quota_mb = Math.round(stats.totalMb * quota_percent);
      } catch (_) { }
    }

    return {
      id: u.id,
      username: u.username,
      role: u.role,
      drive_id: u.drive_id,
      quota_percent,
      quota_mb,
      warn_mb: Math.round(quota_mb * 0.9),
      used_mb: usage?.used_mb || 0,
      created_at: u.created_at
    };
  });
  res.json(result);
});

// ── POST /api/admin/users ──
router.post('/users', async (req, res) => {
  const { username, password, role, quota_gb, warn_gb } = req.body;
  const drive_id = req.body.drive_id || 1;   // default to drive 1

  if (!username || !password) {
    return res.status(400).json({ error: 'username and password are required' });
  }

  // Log available drives to help diagnose assignment issues
  const allDrives = db.prepare('SELECT * FROM drives').all();
  console.log('[POST /admin/users] available drives:', allDrives.map(d => `#${d.id} ${d.label} (${d.path})`));
  console.log('[POST /admin/users] requested drive_id:', drive_id);

  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) return res.status(400).json({ error: 'Username already taken' });

  const drive = db.prepare('SELECT * FROM drives WHERE id = ?').get(drive_id);
  if (!drive) {
    return res.status(400).json({
      error: `Drive #${drive_id} not found. Available: ${allDrives.map(d => `#${d.id} ${d.label}`).join(', ')}`
    });
  }

  const hash = await bcrypt.hash(password, 12);
  const quota_percent = parseFloat(req.body.quota_percent) || 0.1;  // default 10%

  // Compute quota_mb from real drive size; store 0 if drive offline (will be recomputed on next login)
  let quotaMb = 0;
  let warnMb = 0;
  if (isDriveAccessible(drive.path)) {
    try {
      const stats = getDriveStats(drive.path);
      quotaMb = Math.round(stats.totalMb * quota_percent);
      warnMb = Math.round(quotaMb * 0.9);

      // Quota validation check
      const row = db.prepare('SELECT SUM(quota_mb) as total_allocated FROM users WHERE drive_id = ?').get(drive.id);
      const allocated = row.total_allocated || 0;

      if (allocated + quotaMb > stats.totalMb) {
        const aGb = (allocated / 1024).toFixed(2).replace(/\.00$/, '');
        const tGb = (stats.totalMb / 1024).toFixed(2).replace(/\.00$/, '');
        return res.status(400).json({
          error: `Not enough space on ${drive.label} — ${aGb} GB already allocated out of ${tGb} GB total`
        });
      }
    } catch (_) { }
  }

  const result = db.prepare(`
    INSERT INTO users (username, password, role, drive_id, quota_mb, warn_mb, quota_percent)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(username, hash, role || 'user', drive_id, quotaMb, warnMb, quota_percent);

  // Init usage cache
  db.prepare(
    'INSERT INTO usage_cache (user_id, used_mb) VALUES (?, 0)'
  ).run(result.lastInsertRowid);

  // Create user folder on drive
  const userFolder = require('path').join(drive.path, username);
  fs.mkdirSync(userFolder, { recursive: true });

  console.log(`[POST /admin/users] created user "${username}" on drive #${drive_id} (${drive.label}) — quota ${(quota_percent * 100).toFixed(0)}% = ${quotaMb} MB`);

  res.json({
    message: 'User created',
    user: { id: result.lastInsertRowid, username, role: role || 'user', drive_id, quota_percent, quota_mb: quotaMb }
  });
});

// ── PUT /api/admin/users/:id ──
router.put('/users/:id', async (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const { quota_gb, warn_gb, role, drive_id, password } = req.body;

  if (quota_gb) {
    const targetDriveId = drive_id || user.drive_id;
    const drive = db.prepare('SELECT * FROM drives WHERE id = ?').get(targetDriveId);

    if (drive && isDriveAccessible(drive.path)) {
      try {
        const stats = getDriveStats(drive.path);
        const row = db.prepare('SELECT SUM(quota_mb) as total_allocated FROM users WHERE drive_id = ? AND id != ?').get(targetDriveId, user.id);
        const allocated = row.total_allocated || 0;
        const newQuotaMb = quota_gb * 1024;

        if (allocated + newQuotaMb > stats.totalMb) {
          const aGb = (allocated / 1024).toFixed(2).replace(/\.00$/, '');
          const tGb = (stats.totalMb / 1024).toFixed(2).replace(/\.00$/, '');
          return res.status(400).json({
            error: `Not enough space on ${drive.label} — ${aGb} GB already allocated out of ${tGb} GB total`
          });
        }
      } catch (_) { }
    }
    db.prepare('UPDATE users SET quota_mb = ? WHERE id = ?').run(quota_gb * 1024, user.id);
  }
  if (warn_gb) db.prepare('UPDATE users SET warn_mb = ? WHERE id = ?').run(warn_gb * 1024, user.id);
  if (role) db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, user.id);
  if (drive_id) db.prepare('UPDATE users SET drive_id = ? WHERE id = ?').run(drive_id, user.id);
  if (password) {
    const hash = await bcrypt.hash(password, 12);
    db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hash, user.id);
  }

  res.json({ message: 'User updated', user: db.prepare('SELECT * FROM users WHERE id = ?').get(user.id) });
});

// ── DELETE /api/admin/users/:id ──
router.delete('/users/:id', (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (user.id === req.user.id) return res.status(400).json({ error: 'Cannot delete yourself' });
  if (user.role === 'admin') return res.status(403).json({ error: 'Admin accounts cannot be deleted' });

  // Remove user's folder from their drive
  const drive = db.prepare('SELECT * FROM drives WHERE id = ?').get(user.drive_id);
  if (drive) {
    const userFolder = require('path').join(drive.path, user.username);
    if (fs.existsSync(userFolder)) {
      try {
        fs.rmSync(userFolder, { recursive: true, force: true });
        console.log(`[DELETE /admin/users] removed folder: ${userFolder}`);
      } catch (err) {
        console.warn(`[DELETE /admin/users] could not remove folder: ${err.message}`);
      }
    }
  }

  db.prepare('DELETE FROM users WHERE id = ?').run(user.id);
  console.log(`[DELETE /admin/users] deleted user "${user.username}" (id=${user.id})`);
  res.json({ message: 'User deleted' });
});

// ── POST /api/admin/users/:id/reset ──
router.post('/users/:id/reset', async (req, res) => {
  const { password } = req.body;
  if (!password) return res.status(400).json({ error: 'New password required' });

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const hash = await bcrypt.hash(password, 12);
  db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hash, user.id);
  res.json({ message: 'Password reset successfully' });
});

// ── GET /api/admin/usage ──
router.get('/usage', (req, res) => {
  const users = db.prepare('SELECT * FROM users').all();
  const drives = db.prepare('SELECT * FROM drives').all();
  const results = [];

  for (const user of users) {
    const drive = drives.find(d => d.id === user.drive_id);
    if (!drive || !isDriveAccessible(drive.path)) {
      results.push({ username: user.username, error: 'Drive offline' });
      continue;
    }
    const used = recalculate(user, drive.path);
    let quota_mb = user.quota_mb;
    try {
      const stats = getDriveStats(drive.path);
      quota_mb = Math.round(stats.totalMb * (user.quota_percent || 0.1));
    } catch (_) { }
    results.push({
      username: user.username,
      quota_percent: user.quota_percent || 0.1,
      used_mb: used,
      used_fmt: formatSize(used),
      quota_mb,
      quota_fmt: formatSize(quota_mb),
      warning: used > Math.round(quota_mb * 0.9)
    });
  }

  res.json(results);
});

module.exports = router;