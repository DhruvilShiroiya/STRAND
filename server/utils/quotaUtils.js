const db = require('../db');
const { getFolderSizeMb, ensureUserFolder } = require('./driveUtils');

// Get or calculate usage for a user
function getUsage(user, drivePath) {
  const cached = db.prepare(
    'SELECT used_mb, last_synced FROM usage_cache WHERE user_id = ?'
  ).get(user.id);

  // Recalculate if no cache or older than 5 minutes
  const stale = !cached || 
    (Date.now() - new Date(cached.last_synced).getTime()) > 5 * 60 * 1000;

  if (stale) return recalculate(user, drivePath);
  return cached.used_mb;
}

// Force recalculate from disk
function recalculate(user, drivePath) {
  ensureUserFolder(drivePath, user.username);
  const used = getFolderSizeMb(require('path').join(drivePath, user.username));

  db.prepare(`
    INSERT INTO usage_cache (user_id, used_mb, last_synced)
    VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(user_id) DO UPDATE SET
      used_mb = excluded.used_mb,
      last_synced = excluded.last_synced
  `).run(user.id, used);

  return used;
}

// Check if an upload would exceed quota
function checkQuota(user, drivePath, incomingMb) {
  const used = getUsage(user, drivePath);
  const afterUpload = used + incomingMb;

  return {
    used_mb:    used,
    quota_mb:   user.quota_mb,
    warn_mb:    user.warn_mb,
    incoming_mb: incomingMb,
    after_mb:   afterUpload,
    exceeded:   afterUpload > user.quota_mb,
    warning:    afterUpload > user.warn_mb && afterUpload <= user.quota_mb
  };
}

module.exports = { getUsage, recalculate, checkQuota };