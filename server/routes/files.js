const router = require('express').Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../db');
const auth = require('../middleware/auth');
const { safePath, ensureUserFolder, formatSize, isDriveAccessible } = require('../utils/driveUtils');
const { getUsage, recalculate, checkQuota } = require('../utils/quotaUtils');

// ── Get user's drive path ──
function getUserDrivePath(user) {
  const drive = db.prepare('SELECT * FROM drives WHERE id = ?').get(user.drive_id);
  if (!drive) throw new Error('Drive not found');
  if (!isDriveAccessible(drive.path)) throw new Error('Your drive is currently offline');
  return drive.path;
}

// ── Ensure tmp directory exists at startup ──
const TMP_DIR = path.join(__dirname, '../../data/tmp');
fs.mkdirSync(TMP_DIR, { recursive: true });

// ── Multer — store to temp first, then move ──
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, TMP_DIR),
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
  }),
  limits: { fileSize: 10 * 1024 * 1024 * 1024 } // 10 GB max per file
});

// ── GET /api/files/list?path= ──
router.get('/list', auth, (req, res) => {
  try {
    const drivePath = getUserDrivePath(req.user);
    const targetPath = safePath(drivePath, req.user.username, req.query.path || '');
    ensureUserFolder(drivePath, req.user.username);

    if (!fs.existsSync(targetPath)) {
      return res.status(404).json({ error: 'Path not found' });
    }

    const entries = fs.readdirSync(targetPath, { withFileTypes: true })
      .filter(e => e.name !== '.DS_Store' && !e.name.startsWith('._'));
    const items = entries.map(entry => {
      const fullPath = path.join(targetPath, entry.name);
      const stat = fs.statSync(fullPath);
      return {
        name: entry.name,
        type: entry.isDirectory() ? 'folder' : 'file',
        size: entry.isFile() ? stat.size : null,
        size_fmt: entry.isFile() ? formatSize(stat.size / (1024 * 1024)) : null,
        modified: stat.mtime,
        ext: entry.isFile() ? path.extname(entry.name).slice(1).toLowerCase() : null
      };
    });

    // Folders first, then files — both alphabetical
    items.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    const used = getUsage(req.user, drivePath);
    res.json({
      path: req.query.path || '/',
      items,
      usage: {
        used_mb: used,
        quota_mb: req.user.quota_mb,
        warn_mb: req.user.warn_mb,
        warning: used > req.user.warn_mb
      }
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ── POST /api/files/upload ──
router.post('/upload', auth, upload.array('files', 50), async (req, res) => {
  const tmpFiles = req.files || [];

  // ── Debug: log what arrived ──
  console.log('[upload] req.body.path :', req.body.path);
  console.log('[upload] req.files     :', tmpFiles.map(f => ({ name: f.originalname, size: f.size, tmp: f.path })));

  try {
    const drivePath = getUserDrivePath(req.user);
    const targetPath = safePath(drivePath, req.user.username, req.body.path || '');
    fs.mkdirSync(targetPath, { recursive: true });

    // Check quota for total incoming size
    const totalMb = tmpFiles.reduce((sum, f) => sum + f.size, 0) / (1024 * 1024);
    const quota = checkQuota(req.user, drivePath, totalMb);

    if (quota.exceeded) {
      tmpFiles.forEach(f => fs.unlinkSync(f.path));
      return res.status(413).json({
        error: `Upload would exceed your ${formatSize(req.user.quota_mb)} quota`,
        usage: quota
      });
    }

    // Move files from tmp to target (Optimized: Try rename first, fallback to copy)
    const uploaded = [];
    for (const file of tmpFiles) {
      const tmpPath = file.path ?? file.tmp;
      const dest = path.join(targetPath, file.originalname);
      const realSize = fs.statSync(tmpPath).size;

      try {
        // Instant move if on same drive
        fs.renameSync(tmpPath, dest);
        console.log(`[upload] fast-moved: ${file.originalname}`);
      } catch (err) {
        if (err.code === 'EXDEV') {
          // Fallback to copy if cross-device
          fs.copyFileSync(tmpPath, dest);
          fs.unlinkSync(tmpPath);
          console.log(`[upload] cross-device copy: ${file.originalname}`);
        } else {
          throw err;
        }
      }
      uploaded.push({ name: file.originalname, size: realSize });
    }

    // Recalculate usage
    const newUsage = recalculate(req.user, drivePath);

    res.json({
      uploaded,
      usage: {
        used_mb: newUsage,
        quota_mb: req.user.quota_mb,
        warn_mb: req.user.warn_mb,
        warning: newUsage > req.user.warn_mb
      }
    });
  } catch (err) {
    // Log full error for server-side diagnostics
    console.error('[upload] ERROR:', err);
    // Clean up any tmp files that were already written
    tmpFiles.forEach(f => { try { fs.unlinkSync(f.path); } catch (_) { } });
    res.status(400).json({ error: err.message });
  }
});

// ── GET /api/files/download?path= ──
router.get('/download', auth, (req, res) => {
  try {
    const drivePath = getUserDrivePath(req.user);
    const targetPath = safePath(drivePath, req.user.username, req.query.path || '');

    if (!fs.existsSync(targetPath)) {
      return res.status(404).json({ error: 'File not found' });
    }

    const stat = fs.statSync(targetPath);
    if (stat.isDirectory()) {
      return res.status(400).json({ error: 'Cannot download a folder directly' });
    }

    res.download(targetPath);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ── GET /api/files/preview?path=&token= ──
const jwt = require('jsonwebtoken');
router.get('/preview', (req, res) => {
  try {
    const token = req.query.token;
    if (!token) return res.status(401).send('No token provided');

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (e) {
      return res.status(401).send('Invalid token');
    }
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(decoded.userId);
    if (!user) return res.status(401).send('Invalid user');

    const drivePath = getUserDrivePath(user);
    const targetPath = safePath(drivePath, user.username, req.query.path || '');

    if (!fs.existsSync(targetPath)) {
      return res.status(404).send('File not found');
    }

    const stat = fs.statSync(targetPath);
    if (stat.isDirectory()) {
      return res.status(400).send('Cannot preview a folder');
    }

    res.sendFile(path.resolve(targetPath));
  } catch (err) {
    res.status(400).send(err.message);
  }
});

// ── POST /api/files/mkdir ──
router.post('/mkdir', auth, (req, res) => {
  try {
    const drivePath = getUserDrivePath(req.user);
    const targetPath = safePath(drivePath, req.user.username, req.body.path || '');

    if (fs.existsSync(targetPath)) {
      return res.status(400).json({ error: 'Folder already exists' });
    }

    fs.mkdirSync(targetPath, { recursive: true });
    res.json({ message: 'Folder created', path: req.body.path });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ── DELETE /api/files/delete ──
router.delete('/delete', auth, (req, res) => {
  try {
    const drivePath = getUserDrivePath(req.user);
    const filePath = req.body.path ?? req.query.path ?? '';
    const targetPath = safePath(drivePath, req.user.username, filePath);

    console.log('[delete] targetPath :', targetPath);

    if (!fs.existsSync(targetPath)) {
      return res.status(404).json({ error: 'File or folder not found' });
    }

    const stat = fs.statSync(targetPath);
    if (stat.isDirectory()) {
      fs.rmSync(targetPath, { recursive: true, force: true });
    } else {
      fs.unlinkSync(targetPath);
    }

    const newUsage = recalculate(req.user, drivePath);
    res.json({
      message: 'Deleted successfully',
      usage: { used_mb: newUsage, quota_mb: req.user.quota_mb }
    });
  } catch (err) {
    console.error('[delete] ERROR:', err);
    res.status(400).json({ error: err.message });
  }
});

// ── POST /api/files/rename ──
router.post('/rename', auth, (req, res) => {
  try {
    const drivePath = getUserDrivePath(req.user);
    const oldPath = safePath(drivePath, req.user.username, req.body.oldPath || '');
    const newPath = safePath(drivePath, req.user.username, req.body.newPath || '');

    if (!fs.existsSync(oldPath)) {
      return res.status(404).json({ error: 'File or folder not found' });
    }
    if (fs.existsSync(newPath)) {
      return res.status(400).json({ error: 'A file with that name already exists' });
    }

    fs.renameSync(oldPath, newPath);
    res.json({ message: 'Renamed successfully' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ── GET /api/files/usage ──
router.get('/usage', auth, (req, res) => {
  try {
    const drivePath = getUserDrivePath(req.user);
    const used = recalculate(req.user, drivePath);
    res.json({
      used_mb: used,
      quota_mb: req.user.quota_mb,
      warn_mb: req.user.warn_mb,
      warning: used > req.user.warn_mb,
      used_fmt: formatSize(used),
      quota_fmt: formatSize(req.user.quota_mb)
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ── GET /api/files/memories ──
router.get('/memories', auth, (req, res) => {
  try {
    const memories = db.prepare(
      'SELECT * FROM drive_memories WHERE user_id = ? ORDER BY created_at DESC'
    ).all(req.user.id);
    res.json(memories);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ── POST /api/files/memories ──
router.post('/memories', auth, (req, res) => {
  try {
    const { title, note } = req.body;
    if (!title) return res.status(400).json({ error: 'Title is required' });

    const usage = db.prepare('SELECT used_mb FROM usage_cache WHERE user_id = ?').get(req.user.id);
    const usage_mb = usage?.used_mb ?? 0;

    const result = db.prepare(
      'INSERT INTO drive_memories (drive_id, user_id, title, note, usage_mb) VALUES (?, ?, ?, ?, ?)'
    ).run(req.user.drive_id, req.user.id, title, note || null, usage_mb);

    const memory = db.prepare('SELECT * FROM drive_memories WHERE id = ?').get(result.lastInsertRowid);
    res.json(memory);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ── DELETE /api/files/memories/:id ──
router.delete('/memories/:id', auth, (req, res) => {
  try {
    const memory = db.prepare(
      'SELECT * FROM drive_memories WHERE id = ? AND user_id = ?'
    ).get(req.params.id, req.user.id);

    if (!memory) return res.status(404).json({ error: 'Memory not found' });

    db.prepare('DELETE FROM drive_memories WHERE id = ?').run(req.params.id);
    res.json({ message: 'Memory deleted' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;