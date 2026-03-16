const Theme = {
  current: 'auto',
  init() {
    this.current = localStorage.getItem('strand_theme') || 'auto';
    this.set(this.current);
  },
  set(mode) {
    this.current = mode;
    document.documentElement.classList.remove('theme-light', 'theme-dark');
    if (mode === 'light') document.documentElement.classList.add('theme-light');
    if (mode === 'dark') document.documentElement.classList.add('theme-dark');
    localStorage.setItem('strand_theme', mode);
  },
  cycle(spanEl) {
    const modes = ['auto', 'light', 'dark'];
    const next = modes[(modes.indexOf(this.current) + 1) % modes.length] || 'auto';
    this.set(next);
    if (spanEl) {
      spanEl.textContent = next.charAt(0).toUpperCase() + next.slice(1);
    }
  }
};
Theme.init();

const Profile = {

  async render(containerId) {
    const el = document.getElementById(containerId);
    el.innerHTML = '<div class="loading-row" style="padding:28px;">Loading…</div>';

    try {
      const me = await API.get('/auth/me');

      const pct = me.quota_mb > 0 ? Math.min(Math.round((me.used_mb / me.quota_mb) * 100), 100) : 0;
      const usedFmt = fmtMb(me.used_mb);
      const quotaFmt = fmtMb(me.quota_mb);
      const freeMb = Math.max(me.quota_mb - me.used_mb, 0);
      const freeFmt = fmtMb(freeMb);
      const fillCls = pct >= 95 ? 'danger' : pct >= 90 ? 'warn' : '';
      const initial = me.username.charAt(0).toUpperCase();
      const driveLabel = me.drive_id === 1 ? 'A' : 'B';
      const fillId = 'sFill_' + containerId;
      const driveOnline = me.drive_status !== 'offline';
      const quotaPctDisplay = me.quota_percent != null
        ? (me.quota_percent * 100).toFixed(0) + '% of drive'
        : quotaFmt;

      // Fetch memories
      let memories = [];
      try { memories = await API.get('/files/memories'); } catch (_) { }

      // ── Admin section HTML ──
      const adminHtml = me.role === 'admin' ? `
        <div class="s-label" style="margin-top:8px;">Admin</div>
        <div class="divider"></div>
        <div class="setting-row" onclick="Profile.openUserManager()">
          <span class="sr-label">Manage users</span>
          <span class="sr-arrow">›</span>
        </div>
        <div class="setting-row" onclick="Profile.driveSettings()">
          <span class="sr-label">Drive settings</span>
          <span class="sr-arrow">›</span>
        </div>` : '';

      // ── Drives section HTML (admin only) ──
      const drivesHtml = Array.isArray(me.all_drives) && me.all_drives.length ? `
        <div class="s-label" style="margin-top:8px;">Drives</div>
        <div class="divider"></div>
        ${me.all_drives.map(d => {
        const online = d.status === 'online';
        const totalGb = d.stats ? (d.stats.totalMb / 1024).toFixed(1) + ' GB' : '—';
        const usedPct = d.stats ? Math.min(Math.round((d.stats.usedMb / d.stats.totalMb) * 100), 100) : 0;
        const barColor = usedPct >= 90 ? 'var(--red)' : usedPct >= 75 ? 'var(--amber)' : 'var(--green)';
        const freeFmt = d.stats ? fmtMb(d.stats.freeMb) : '—';
        return `
          <div class="drive-status" style="flex-direction:column;align-items:stretch;gap:8px;padding:16px 28px;">
            <div style="display:flex;align-items:center;gap:10px;">
              <div class="drive-dot${online ? '' : ' offline'}"></div>
              <span class="drive-status-text" style="flex:1;">${escAttr(d.label)}</span>
              <span style="font-family:'DM Mono',monospace;font-size:10px;letter-spacing:0.05em;text-transform:uppercase;
                color:${online ? 'var(--green)' : 'var(--red)'};
              ">${d.status}</span>
              <span class="drive-status-sub">${totalGb}</span>
            </div>
            ${d.stats ? `
            <div style="display:flex;align-items:center;gap:8px;">
              <div class="storage-track" style="flex:1;margin:0;">
                <div class="storage-fill" style="width:${usedPct}%;background:${barColor};transition:width 0.6s;"></div>
              </div>
              <span style="font-family:'DM Mono',monospace;font-size:10px;color:var(--ink3);flex-shrink:0;white-space:nowrap;">
                ${fmtMb(d.stats.usedMb)} used &nbsp;·&nbsp; ${freeFmt} free
              </span>
            </div>` : `
            <span style="font-family:'DM Mono',monospace;font-size:10px;color:var(--ink3);">Drive offline — stats unavailable</span>`}
          </div>`;
      }).join('')}` : '';

      // ── Memories section HTML ──
      const memoriesHtml = memories.map(m => `
        <div class="setting-row">
          <span class="sr-label" style="flex:1;">
            <span style="display:block;font-weight:500;">${escAttr(m.title)}</span>
            <span style="display:block;font-family:'DM Mono',monospace;font-size:10px;color:var(--ink3);margin-top:2px;">
              ${timeAgo(m.created_at)} &nbsp;·&nbsp; ${m.usage_mb != null ? fmtMb(m.usage_mb) + ' used' : '—'}
            </span>
          </span>
          <button class="fr-btn del" onclick="event.stopPropagation();Profile.deleteMemory(${m.id})">✕</button>
        </div>`).join('');

      el.innerHTML = `
        <div style="max-width:600px;width:100%;margin:0 auto;"
        >

        <div class="profile-top">
          <div class="profile-initial">${initial}</div>
          <div class="profile-name">${escAttr(me.username)}</div>
          <div class="profile-sub">${escAttr(me.role)} &nbsp;·&nbsp; Drive ${driveLabel}</div>
        </div>

        <div class="drive-status">
          <div class="drive-dot${driveOnline ? '' : ' offline'}"></div>
          <span class="drive-status-text">Drive ${driveLabel} — ${driveOnline ? 'Online' : 'Offline'}</span>
          <span class="drive-status-sub">${usedFmt} used</span>
        </div>

        <div class="storage-section">
          <div class="storage-row">
            <span class="storage-title">Storage</span>
            <span class="storage-nums"><strong>${usedFmt}</strong> used &nbsp;·&nbsp; ${quotaPctDisplay}</span>
          </div>
          <div class="storage-track">
            <div class="storage-fill ${fillCls}" id="${fillId}" style="width:0%"></div>
          </div>
          <div class="storage-breakdown">
            <span class="sb-item">Used <strong>${usedFmt}</strong></span>
            <span class="sb-item">Free <strong>${freeFmt}</strong></span>
            <span class="sb-item">Quota <strong>${quotaFmt}</strong></span>
          </div>
        </div>

        ${drivesHtml}

        <div class="s-label">Account</div>
        <div class="divider"></div>
        <div class="setting-row">
          <span class="sr-label">Username</span>
          <span class="sr-value">${escAttr(me.username)}</span>
          <span class="sr-arrow">›</span>
        </div>
        <div class="setting-row" onclick="Profile.changePassword()">
          <span class="sr-label">Change password</span>
          <span class="sr-arrow">›</span>
        </div>


        <div class="s-label" style="margin-top:8px;">Preferences</div>
        <div class="divider"></div>
        <div class="setting-row" onclick="Theme.cycle(this.querySelector('.sr-value'))">
          <span class="sr-label">Theme</span>
          <span class="sr-value">${Theme.current.charAt(0).toUpperCase() + Theme.current.slice(1)}</span>
          <span class="sr-arrow">›</span>
        </div>

        ${adminHtml}

        <div class="s-label" style="margin-top:8px;">Drive Memories</div>
        <div class="divider"></div>
        ${memoriesHtml || '<div class="empty-state" style="padding:20px 28px;font-size:15px;">No memories yet</div>'}
        <div class="setting-row" onclick="Profile.addMemory('${containerId}')">
          <span class="sr-label" style="color:var(--ink3);">+ Add memory</span>
        </div>

        <div class="signout-row" onclick="Profile.signOut()">
          <span class="sr-signout">Sign out</span>
        </div>

        </div>`;

      // Cache current values for methods
      Profile._currentDrivePath = me.drive_path || '';
      Profile._currentContainerId = containerId;

      // Animate storage bar
      setTimeout(() => {
        const fill = document.getElementById(fillId);
        if (fill) fill.style.width = pct + '%';
      }, 150);

      // Storage warning toast
      if (me.used_mb > me.warn_mb) {
        Toast.error('You are at ' + pct + '% storage — consider adding a memory note for this drive');
      }

    } catch (err) {
      el.innerHTML = `
        <div class="empty-state"
          style="color:var(--red);font-style:normal;font-family:'DM Mono',monospace;font-size:11px;">
          ${escAttr(err.message)}
        </div>`;
    }
  },

  // ── Open full-screen user manager ──
  async openUserManager() {
    // Remove any stale instance
    document.getElementById('um-overlay')?.remove();

    const overlay = document.createElement('div');
    overlay.id = 'um-overlay';
    overlay.style.cssText = `
      position:fixed;inset:0;z-index:300;
      background:var(--bg);
      display:flex;flex-direction:column;
      animation:fadeUp 0.22s var(--ease) both;
    `;
    overlay.innerHTML = `
      <div style="
        display:flex;align-items:center;gap:14px;
        padding:0 28px;height:60px;
        border-bottom:1px solid var(--line);
        flex-shrink:0;
      ">
        <button onclick="document.getElementById('um-overlay').remove()" style="
          font-family:'DM Mono',monospace;font-size:11px;letter-spacing:0.06em;
          text-transform:uppercase;color:var(--ink3);
          background:none;border:none;cursor:pointer;padding:0;
          transition:color 0.15s;
        " onmouseover="this.style.color='var(--ink)'" onmouseout="this.style.color='var(--ink3)'">← Back</button>
        <span style="
          font-family:'Cormorant',serif;font-size:22px;font-weight:400;
          letter-spacing:0.02em;flex:1;
        ">Users</span>
        <button onclick="Profile.openAddUser()" style="
          font-family:'DM Mono',monospace;font-size:11px;letter-spacing:0.06em;
          text-transform:uppercase;color:var(--bg);
          background:var(--ink);border:none;cursor:pointer;
          padding:8px 16px;border-radius:6px;transition:opacity 0.15s;
        " onmouseover="this.style.opacity='0.8'" onmouseout="this.style.opacity='1'">+ Add user</button>
      </div>
      <div id="um-list" style="flex:1;overflow-y:auto;scrollbar-width:none;">
        <div class="loading-row" style="padding:28px;">Loading…</div>
      </div>`;

    document.body.appendChild(overlay);
    await this._loadUserList();
  },

  async _loadUserList() {
    const list = document.getElementById('um-list');
    if (!list) return;
    try {
      const users = await API.get('/admin/users');
      if (!users.length) {
        list.innerHTML = '<div class="empty-state" style="padding:40px 28px;">No users yet</div>';
        return;
      }
      list.innerHTML = users.map(u => {
        const dl = u.drive_id === 1 ? 'A' : 'B';
        const pct = u.quota_mb ? Math.min(Math.round((u.used_mb / u.quota_mb) * 100), 100) : 0;
        const fillCls = pct >= 95 ? 'var(--red)' : pct >= 80 ? 'var(--amber)' : 'var(--green)';
        const qPct = u.quota_percent != null ? (u.quota_percent * 100).toFixed(0) + '%' : '?%';
        return `
          <div style="
            display:flex;align-items:center;gap:14px;
            padding:16px 28px;border-bottom:1px solid var(--line2);
          ">
            <div style="
              width:38px;height:38px;border-radius:50%;
              background:var(--bg3);border:1px solid var(--line);
              display:flex;align-items:center;justify-content:center;
              font-family:'Cormorant',serif;font-size:20px;flex-shrink:0;
            ">${escAttr(u.username.charAt(0).toUpperCase())}</div>
            <div style="flex:1;min-width:0;">
              <div style="font-size:15px;font-weight:500;margin-bottom:2px;">${escAttr(u.username)}</div>
              <div style="font-family:'DM Mono',monospace;font-size:10px;color:var(--ink3);letter-spacing:0.05em;text-transform:uppercase;">
                ${escAttr(u.role)} &nbsp;·&nbsp; Drive ${dl} &nbsp;·&nbsp; ${qPct} of drive
              </div>
              <div style="display:flex;align-items:center;gap:8px;margin-top:6px;">
                <div style="flex:1;height:2px;background:var(--bg3);border-radius:99px;overflow:hidden;">
                  <div style="height:100%;width:${pct}%;background:${fillCls};border-radius:99px;transition:width 0.6s;"></div>
                </div>
                <span style="font-family:'DM Mono',monospace;font-size:10px;color:var(--ink3);flex-shrink:0;">
                  ${fmtMb(u.used_mb)} / ${fmtMb(u.quota_mb)}
                </span>
              </div>
            </div>
            ${u.role !== 'admin' ? `
            <button onclick="Profile.deleteUser(${u.id}, '${escAttr(u.username)}')" style="
              font-family:'DM Mono',monospace;font-size:10px;letter-spacing:0.05em;
              color:var(--red);background:none;
              border:1px solid rgba(184,48,48,0.3);cursor:pointer;
              padding:5px 10px;border-radius:5px;flex-shrink:0;
              transition:all 0.15s;
            " onmouseover="this.style.background='rgba(184,48,48,0.08)'" onmouseout="this.style.background='none'">Delete</button>
            ` : ''}
          </div>`;
      }).join('');
    } catch (err) {
      list.innerHTML = `<div class="empty-state" style="color:var(--red);font-style:normal;font-family:'DM Mono',monospace;font-size:11px;padding:28px;">${escAttr(err.message)}</div>`;
    }
  },

  // ── Add-user sheet (slider-based quota) ──
  async openAddUser() {
    document.getElementById('um-add-sheet')?.remove();

    // Fetch drives so we have real total sizes (cache-bust so stale responses don't hide stats)
    let drives = [];
    try {
      drives = await API.get('/admin/drives?t=' + Date.now());
      console.log('[openAddUser] drives:', JSON.stringify(drives));
    } catch (e) { console.warn('[openAddUser] drives fetch failed:', e); }
    const drivesArr = Array.isArray(drives) ? drives : [];

    // Build drive options + store totalMb per drive_id for live calc
    const driveMap = {};
    const driveOptions = drivesArr.map(d => {
      driveMap[d.id] = d.stats?.totalMb || 0;
      console.log(`[openAddUser] drive ${d.id} "${d.label}" stats:`, d.stats);
      const sizeStr = d.stats ? ' · ' + (d.stats.totalMb / 1024).toFixed(1) + ' GB' : '';
      return `<option value="${d.id}">${escAttr(d.label)} [${d.status}]${sizeStr}</option>`;
    }).join('') || '<option value="1">Drive 1 (default)</option>';

    // Store driveMap on window so the inline oninput can reach it
    window._auDriveMap = driveMap;

    // Default drive total (first drive, or 0 if unknown)
    const firstTotal = drivesArr[0]?.stats?.totalMb || 0;

    const sheet = document.createElement('div');
    sheet.id = 'um-add-sheet';
    sheet.style.cssText = `
      position:fixed;inset:0;z-index:400;
      background:rgba(26,24,20,0.5);
      backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);
      display:flex;align-items:flex-end;justify-content:center;
    `;
    sheet.innerHTML = `
      <div class="sheet" style="max-height:90dvh;overflow-y:auto;scrollbar-width:none;">
        <div class="sheet-handle"></div>
        <div class="sheet-label">Admin</div>
        <div class="sheet-title">Add user</div>

        <div class="sheet-label">Username</div>
        <input id="au-username" class="sheet-input" placeholder="username" autocomplete="off">

        <div class="sheet-label">Password</div>
        <input id="au-password" class="sheet-input" type="password" placeholder="min 8 characters">

        <div class="sheet-label">Role</div>
        <select id="au-role" style="
          width:100%;background:transparent;
          border:none;border-bottom:1.5px solid var(--line);
          padding:10px 0;font-family:'Figtree',sans-serif;font-size:16px;
          color:var(--ink);outline:none;margin-bottom:28px;
          -webkit-appearance:none;cursor:pointer;
        ">
          <option value="user">User</option>
          <option value="admin">Admin</option>
        </select>

        <div class="sheet-label">Drive</div>
        <select id="au-drive" onchange="Profile._auUpdateSlider()" style="
          width:100%;background:transparent;
          border:none;border-bottom:1.5px solid var(--line);
          padding:10px 0;font-family:'Figtree',sans-serif;font-size:16px;
          color:var(--ink);outline:none;margin-bottom:28px;
          -webkit-appearance:none;cursor:pointer;
        ">${driveOptions}</select>

        <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:10px;">
          <div class="sheet-label" style="margin-bottom:0;">Quota</div>
          <span id="au-quota-display" style="
            font-family:'DM Mono',monospace;font-size:13px;font-weight:500;
            color:var(--ink);letter-spacing:0.02em;
          ">10% · ${firstTotal ? (firstTotal * 0.1 / 1024).toFixed(1) + ' GB' : '—'}</span>
        </div>

        <!-- Slider -->
        <input id="au-quota-slider" type="range" min="5" max="100" step="5" value="10"
          oninput="Profile._auUpdateSlider()"
          style="
            width:100%;margin-bottom:8px;cursor:pointer;
            -webkit-appearance:none;appearance:none;
            height:3px;border-radius:99px;outline:none;
            background:linear-gradient(to right, var(--ink) 10%, var(--bg3) 10%);
          ">
        <div id="au-drive-total" style="
          font-family:'DM Mono',monospace;font-size:10px;
          color:var(--ink3);margin-bottom:28px;letter-spacing:0.04em;
        ">Drive total: ${firstTotal ? (firstTotal / 1024).toFixed(1) + ' GB' : 'offline — size unknown'}</div>

        <div id="au-error" style="display:none;
          background:rgba(184,48,48,0.1);border:1px solid rgba(184,48,48,0.3);
          color:var(--red);border-radius:8px;padding:10px 14px;
          font-family:'DM Mono',monospace;font-size:11px;
          letter-spacing:0.04em;margin-bottom:16px;
        "></div>

        <div style="display:flex;gap:10px;">
          <button onclick="document.getElementById('um-add-sheet').remove()" style="
            flex:1;padding:15px;background:var(--bg3);color:var(--ink);
            border:none;border-radius:9px;font-family:'Figtree',sans-serif;
            font-size:15px;font-weight:600;cursor:pointer;transition:opacity 0.15s;
          " onmouseover="this.style.opacity='0.7'" onmouseout="this.style.opacity='1'">Cancel</button>
          <button id="au-submit-btn" onclick="Profile._submitAddUser()" class="sheet-cta" style="flex:2;">
            Create user
          </button>
        </div>
      </div>`;

    document.body.appendChild(sheet);
    setTimeout(() => {
      document.getElementById('au-username')?.focus();
      Profile._auUpdateSlider(); // set initial gradient
    }, 100);
  },

  // ── Live slider update ──
  _auUpdateSlider() {
    const slider = document.getElementById('au-quota-slider');
    const display = document.getElementById('au-quota-display');
    const label = document.getElementById('au-drive-total');
    const driveEl = document.getElementById('au-drive');
    if (!slider) return;

    const pct = parseInt(slider.value, 10);
    const driveId = parseInt(driveEl?.value, 10) || 0;
    const totalMb = window._auDriveMap?.[driveId] || 0;
    const quotaMb = totalMb * (pct / 100);
    const quotaStr = quotaMb >= 1024 ? (quotaMb / 1024).toFixed(1) + ' GB' : Math.round(quotaMb) + ' MB';

    if (display) display.textContent = pct + '% · ' + (totalMb ? quotaStr : '—');
    if (label) label.textContent = 'Drive total: ' + (totalMb ? (totalMb / 1024).toFixed(1) + ' GB' : 'offline — size unknown');

    // Update track fill gradient
    slider.style.background = `linear-gradient(to right, var(--ink) ${pct}%, var(--bg3) ${pct}%)`;
  },

  async _submitAddUser() {
    const username = document.getElementById('au-username')?.value.trim();
    const password = document.getElementById('au-password')?.value;
    const role = document.getElementById('au-role')?.value;
    const drive_id = parseInt(document.getElementById('au-drive')?.value, 10) || 1;
    const pct = parseInt(document.getElementById('au-quota-slider')?.value, 10) || 10;
    const quota_percent = pct / 100;

    const showErr = msg => {
      const banner = document.getElementById('au-error');
      if (banner) { banner.textContent = msg; banner.style.display = 'block'; }
      Toast.error(msg);
    };

    if (!username) { showErr('Username is required'); return; }
    if (!password || password.length < 8) { showErr('Password must be at least 8 characters'); return; }

    const btn = document.getElementById('au-submit-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Creating…'; btn.style.opacity = '0.6'; }

    try {
      console.log('[createUser]', { username, role, drive_id, quota_percent });
      await API.post('/admin/users', { username, password, role, drive_id, quota_percent });
      document.getElementById('um-add-sheet')?.remove();
      Toast.show('User created');
      await this._loadUserList();
    } catch (err) {
      console.error('[createUser] error:', err);
      showErr(err.message);
      if (btn) { btn.disabled = false; btn.textContent = 'Create user'; btn.style.opacity = '1'; }
    }
  },

  // ── Delete a user (admin) ──
  async deleteUser(id, username) {
    try {
      await API.del('/admin/users/' + id);
      Toast.show('User “' + username + '” deleted');
      await this._loadUserList();
    } catch (err) {
      Toast.error(err.message);
    }
  },

  // ── Add a memory snapshot ──
  async addMemory(containerId) {
    const title = prompt('Memory title (e.g. "Before holiday backup"):');
    if (!title) return;
    const note = prompt('Optional note:');
    try {
      await API.post('/files/memories', { title, note });
      Toast.show('Memory saved');
      this.render(containerId);
    } catch (err) {
      Toast.error(err.message);
    }
  },

  // ── Delete a memory ──
  async deleteMemory(id) {
    try {
      const el = document.querySelector('.pane-profile.active, .mobile-page.active');
      const containerId = el ? el.querySelector('[id]')?.id || el.id : 'dProfileInner';
      await API.del('/files/memories/' + id);
      Toast.show('Memory deleted');
      this.render(containerId);
    } catch (err) {
      Toast.error(err.message);
    }
  },

  // ── Admin: drive settings overlay ──
  async driveSettings() {
    try {
      const data = await API.get('/admin/drives');
      const drives = Array.isArray(data) ? data : data.drives || [];

      document.getElementById('ds-overlay')?.remove();
      const ov = document.createElement('div');
      ov.id = 'ds-overlay';
      ov.style.cssText = `
        position:fixed;inset:0;z-index:500;
        background:rgba(26,24,20,0.55);backdrop-filter:blur(14px);
        display:flex;align-items:flex-end;justify-content:center;
      `;
      ov.innerHTML = `
        <div style="
          background:var(--bg);border-radius:22px 22px 0 0;
          border-top:1px solid var(--line);
          padding:20px 28px 48px;width:100%;max-width:480px;
          animation:sheetUp 0.3s var(--ease) both;
        ">
          <div class="sheet-handle"></div>
          <div class="sheet-label">Admin</div>
          <div class="sheet-title" style="margin-bottom:20px;">Drive settings</div>
          ${drives.map(d => `
            <div style="padding:14px 0;border-bottom:1px solid var(--line2);">
              <div style="display:flex;align-items:center;gap:12px;">
                <div style="flex:1;min-width:0;">
                  <div style="font-size:14px;font-weight:500;">${escAttr(d.label)}</div>
                  <div style="font-family:'DM Mono',monospace;font-size:10px;color:var(--ink3);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escAttr(d.path)}</div>
                </div>
                <div style="
                  font-family:'DM Mono',monospace;font-size:10px;letter-spacing:0.05em;
                  text-transform:uppercase;flex-shrink:0;
                  color:${d.status === 'online' ? 'var(--green)' : 'var(--red)'};
                ">${d.status}</div>
              </div>
              <button
                onclick="document.getElementById('ds-overlay').remove();Profile.changeDrivePath(${d.id}, '${escAttr(d.path)}');"
                style="margin-top:10px;width:100%;padding:10px;
                  font-family:'DM Mono',monospace;font-size:10px;letter-spacing:0.06em;
                  text-transform:uppercase;cursor:pointer;
                  background:var(--bg3);color:var(--ink);
                  border:1px solid var(--line);border-radius:7px;
                  transition:all 0.15s;"
                onmouseover="this.style.borderColor='var(--ink3)'"
                onmouseout="this.style.borderColor='var(--line)'">
                Change path
              </button>
            </div>`).join('')}
          <button onclick="document.getElementById('ds-overlay').remove()" style="
            width:100%;margin-top:20px;padding:14px;
            background:var(--bg3);color:var(--ink);
            border:none;border-radius:9px;
            font-family:'Figtree',sans-serif;font-size:15px;font-weight:600;
            cursor:pointer;
          ">Done</button>
        </div>`;
      ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); });
      document.body.appendChild(ov);
    } catch (err) {
      Toast.error(err.message);
    }
  },

  // ── Change drive path (sheet) ──
  changeDrivePath(driveId, currentPath) {
    document.getElementById('cdp-sheet')?.remove();
    const path = currentPath || Profile._currentDrivePath || '';
    const containerId = Profile._currentContainerId || 'dProfileInner';
    const isAdmin = Auth.user?.role === 'admin';
    const endpoint = isAdmin ? '/admin/drives/' + driveId : '/auth/drive';

    const sheet = document.createElement('div');
    sheet.id = 'cdp-sheet';
    sheet.style.cssText = `
      position:fixed;inset:0;z-index:400;
      background:rgba(26,24,20,0.5);
      backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);
      display:flex;align-items:flex-end;justify-content:center;
    `;
    sheet.innerHTML = `
      <div class="sheet">
        <div class="sheet-handle"></div>
        <div class="sheet-label">Drive ${isAdmin ? '#' + driveId : ''}</div>
        <div class="sheet-title">Change path</div>

        <div class="sheet-label">Drive path</div>
        <input id="cdp-path" class="sheet-input"
          placeholder="/Volumes/MyDrive"
          value="${escAttr(path)}"
          autocomplete="off" autocorrect="off" spellcheck="false">

        <div id="cdp-error" style="display:none;
          background:rgba(184,48,48,0.1);border:1px solid rgba(184,48,48,0.3);
          color:var(--red);border-radius:8px;padding:10px 14px;
          font-family:'DM Mono',monospace;font-size:11px;
          letter-spacing:0.04em;margin-bottom:16px;
        "></div>

        <div style="display:flex;gap:10px;">
          <button onclick="document.getElementById('cdp-sheet').remove()" style="
            flex:1;padding:15px;background:var(--bg3);color:var(--ink);
            border:none;border-radius:9px;font-family:'Figtree',sans-serif;
            font-size:15px;font-weight:600;cursor:pointer;
          ">Cancel</button>
          <button id="cdp-save-btn" class="sheet-cta" style="flex:2;"
            onclick="Profile._saveDrivePath('${containerId}', '${endpoint}')">
            Save
          </button>
        </div>
      </div>`;

    sheet.addEventListener('click', e => { if (e.target === sheet) sheet.remove(); });
    document.body.appendChild(sheet);
    setTimeout(() => {
      const inp = document.getElementById('cdp-path');
      if (inp) { inp.focus(); inp.select(); }
    }, 200);
  },

  async _saveDrivePath(containerId, endpoint) {
    const newPath = document.getElementById('cdp-path')?.value.trim();
    const btn = document.getElementById('cdp-save-btn');
    const showErr = msg => {
      const b = document.getElementById('cdp-error');
      if (b) { b.textContent = msg; b.style.display = 'block'; }
      Toast.error(msg);
    };

    if (!newPath) { showErr('Path cannot be empty'); return; }
    if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; btn.style.opacity = '0.6'; }

    try {
      await API.put(endpoint, { path: newPath });
      document.getElementById('cdp-sheet')?.remove();
      Toast.show('Drive path updated');
      await this.render(containerId || Profile._currentContainerId || 'dProfileInner');
    } catch (err) {
      showErr(err.message);
      if (btn) { btn.disabled = false; btn.textContent = 'Save'; btn.style.opacity = '1'; }
    }
  },

  async changePassword() {
    const p = prompt('New password (min 8 characters):');
    if (!p) return;
    if (p.length < 8) { Toast.error('Password must be at least 8 characters'); return; }
    try {
      await API.put('/admin/users/' + Auth.user.id, { password: p });
      Toast.show('Password updated');
    } catch (err) {
      Toast.error(err.message);
    }
  },

  async signOut() {
    try { await API.post('/auth/logout'); } catch (_) { }
    Auth.clear();
    window.location.href = '/';
  }
};