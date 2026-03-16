const router = require('express').Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../db');
const auth = require('../middleware/auth');
const { getDriveStats, isDriveAccessible } = require('../utils/driveUtils');

// ── POST /api/auth/login ──
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).json({ error: 'Username and password required' });

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });

  const match = await bcrypt.compare(password, user.password);
  if (!match) return res.status(401).json({ error: 'Invalid credentials' });

  const token = jwt.sign(
    { userId: user.id, username: user.username, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );

  // Save session
  const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  db.prepare(
    'INSERT INTO sessions (user_id, token, expires_at) VALUES (?, ?, ?)'
  ).run(user.id, token, expires);

  res.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
      quota_mb: user.quota_mb,
      warn_mb: user.warn_mb,
      drive_id: user.drive_id
    }
  });
});

// ── POST /api/auth/logout ──
router.post('/logout', auth, (req, res) => {
  const token = req.headers['authorization']?.slice(7);
  db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
  res.json({ message: 'Logged out' });
});

// ── GET /api/auth/me ──
router.get('/me', auth, (req, res) => {
  // 1. Usage cache
  const usage = db.prepare(
    'SELECT used_mb FROM usage_cache WHERE user_id = ?'
  ).get(req.user.id);

  // 2. Fetch the user's assigned drive
  const drive = db.prepare(
    'SELECT * FROM drives WHERE id = ?'
  ).get(req.user.drive_id);

  // 3. Determine real capacity via df -k
  // Admins always get full drive access (quota_percent = 1.0)
  const quota_percent = req.user.role === 'admin' ? 1.0 : (req.user.quota_percent || 0.1);
  let quota_mb = req.user.quota_mb;
  let warn_mb = req.user.warn_mb;
  let drive_status = 'offline';

  if (drive && isDriveAccessible(drive.path)) {
    drive_status = 'online';
    try {
      const stats = getDriveStats(drive.path);
      quota_mb = Math.round(stats.totalMb * quota_percent);
      warn_mb = Math.round(quota_mb * 0.9);

      // Keep the DB in sync (also updates quota_percent for admins on first run)
      db.prepare(
        'UPDATE users SET quota_mb = ?, warn_mb = ?, quota_percent = ? WHERE id = ?'
      ).run(quota_mb, warn_mb, quota_percent, req.user.id);
    } catch (err) {
      console.warn('[/me] getDriveStats failed:', err.message);
    }
  }

  // 4. For admins — return live stats for ALL drives
  let all_drives = undefined;
  if (req.user.role === 'admin') {
    const allDrives = db.prepare('SELECT * FROM drives').all();
    all_drives = allDrives.map(d => {
      const online = isDriveAccessible(d.path);
      let stats = null;
      if (online) {
        try { stats = getDriveStats(d.path); } catch (_) { }
      }
      return {
        id: d.id,
        label: d.label,
        path: d.path,
        status: online ? 'online' : 'offline',
        stats   // { totalMb, usedMb, freeMb } or null
      };
    });
  }

  res.json({
    id: req.user.id,
    username: req.user.username,
    role: req.user.role,
    quota_percent,
    quota_mb,
    warn_mb,
    drive_id: req.user.drive_id,
    drive_path: drive?.path || null,
    drive_label: drive?.label || null,
    used_mb: usage?.used_mb || 0,
    drive_status,
    ...(all_drives !== undefined && { all_drives })
  });
});

// ── PUT /api/auth/drive ──
router.put('/drive', auth, (req, res) => {
  const { path: newPath } = req.body;
  if (!newPath) return res.status(400).json({ error: 'path is required' });

  if (!isDriveAccessible(newPath)) {
    return res.status(400).json({ error: 'Drive path not accessible — is it plugged in?' });
  }

  const drive = db.prepare('SELECT * FROM drives WHERE id = ?').get(req.user.drive_id);
  if (!drive) return res.status(404).json({ error: 'Drive not found for this user' });

  // Update drive path
  db.prepare('UPDATE drives SET path = ? WHERE id = ?').run(newPath, drive.id);

  // Ensure user folder exists on the new path
  const { ensureUserFolder } = require('../utils/driveUtils');
  try { ensureUserFolder(newPath, req.user.username); } catch (_) { }

  const updated = db.prepare('SELECT * FROM drives WHERE id = ?').get(drive.id);
  console.log(`[PUT /auth/drive] user "${req.user.username}" drive #${drive.id} path → ${newPath}`);
  res.json({ message: 'Drive path updated', drive: updated });
});

// ── PUT /api/auth/password ──
router.put('/password', auth, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Current and new passwords required' });
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const match = await bcrypt.compare(currentPassword, user.password);
  if (!match) return res.status(401).json({ error: 'Current password incorrect' });

  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'New password must be at least 8 characters' });
  }

  const hash = await bcrypt.hash(newPassword, 12);
  db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hash, user.id);

  console.log(`[PUT /auth/password] user "${user.username}" updated their password`);
  res.json({ message: 'Password updated successfully' });
});

module.exports = router;