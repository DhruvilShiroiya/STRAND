const fs = require('fs');
const path = require('path');

// ── Ensure user folder exists on drive ──
function ensureUserFolder(drivePath, username) {
  const userFolder = path.join(drivePath, username);
  if (!fs.existsSync(userFolder)) {
    fs.mkdirSync(userFolder, { recursive: true });
    console.log(`✓ Created folder for ${username} at ${userFolder}`);
  }
  return userFolder;
}

// ── Validate path stays inside user root (prevent traversal) ──
function safePath(drivePath, username, userPath = '') {
  const userRoot = path.join(drivePath, username);
  const resolved = path.resolve(path.join(userRoot, userPath));
  if (!resolved.startsWith(userRoot)) {
    throw new Error('Invalid path — access outside your folder is not allowed');
  }
  return resolved;
}

// ── Get folder size in MB recursively ──
function getFolderSizeMb(folderPath) {
  if (!fs.existsSync(folderPath)) return 0;
  let total = 0;
  function walk(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else {
        try {
          total += fs.statSync(full).size;
        } catch (_) { }
      }
    }
  }
  walk(folderPath);
  return total / (1024 * 1024);
}

// ── Check if a drive path is accessible ──
function isDriveAccessible(drivePath) {
  try {
    fs.accessSync(drivePath, fs.constants.R_OK | fs.constants.W_OK);
    return true;
  } catch (_) {
    return false;
  }
}

// ── Format bytes to human readable ──
function formatSize(mb) {
  if (mb >= 1024) return (mb / 1024).toFixed(1) + ' GB';
  return mb.toFixed(1) + ' MB';
}

// ── Get disk stats for a mounted drive path ──
function getDriveStats(drivePath) {
  const { execSync } = require('child_process');
  // df -k reports sizes in 1-KiB blocks: 1-KiB-blocks  Used  Available
  const output = execSync(`df -k "${drivePath}"`, { encoding: 'utf8' });
  const lines = output.trim().split('\n');
  // The second line contains the data row for the requested path
  const parts = lines[1].trim().split(/\s+/);
  const totalKb = parseInt(parts[1], 10);
  const usedKb = parseInt(parts[2], 10);
  const freeKb = parseInt(parts[3], 10);
  return {
    totalMb: Math.round(totalKb / 1024),
    usedMb: Math.round(usedKb / 1024),
    freeMb: Math.round(freeKb / 1024),
  };
}

module.exports = { ensureUserFolder, safePath, getFolderSizeMb, isDriveAccessible, formatSize, getDriveStats };