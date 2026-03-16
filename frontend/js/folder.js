const Folder = {
  currentPath: { D: '/', M: '/' },
  pathStack: { D: [], M: [] },
  allFiles: [],

  // ── Load root view ──
  async loadRoot(side) {
    const saved = sessionStorage.getItem('strand_path_' + side);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.path && parsed.path !== '/') {
          this.currentPath[side] = parsed.path;
          this.pathStack[side] = parsed.stack || [];
          const name = parsed.path.split('/').pop();
          if (side === 'D') {
            document.getElementById('dRootView').style.display = 'none';
            document.getElementById('dInnerView').style.display = 'block';
            document.getElementById('dInnerTitle').textContent = name;
            document.getElementById('dInnerLabel').textContent = name;
          } else {
            document.getElementById('mRootView').style.display = 'none';
            document.getElementById('mInnerView').style.display = 'block';
            document.getElementById('mInnerTitle').textContent = name;
          }
          this._renderCrumbs(side);
          this.loadInner(side, parsed.path);
          return;
        }
      } catch (err) { }
    }

    this.currentPath[side] = '/';
    this.pathStack[side] = [];

    const listId = side === 'D' ? 'dFolderList' : 'mFolderList';
    const metaId = side === 'D' ? 'dFolderMeta' : 'mFolderMeta';

    document.getElementById(listId).innerHTML = '<div class="loading-row">Loading…</div>';

    try {
      const data = await API.get('/files/list?path=/');
      const folders = data.items.filter(i => i.type === 'folder');
      const files = data.items.filter(i => i.type === 'file');

      document.getElementById(metaId).textContent =
        folders.length + ' folder' + (folders.length !== 1 ? 's' : '') +
        ' · ' + files.length + ' file' + (files.length !== 1 ? 's' : '');

      if (side === 'D') {
        document.getElementById('dFolderCount').textContent =
          folders.length + ' folder' + (folders.length !== 1 ? 's' : '');
      }

      // Cache for search
      this._cacheItems(data.items, '/');

      const list = document.getElementById(listId);
      list.innerHTML = '';

      if (data.items.length === 0) {
        list.innerHTML = '<div class="empty-state">Nothing here yet</div>';
        return;
      }

      folders.forEach((f, i) => {
        const el = document.createElement('div');
        el.className = 'folder-item';
        el.style.animationDelay = (i * 0.04) + 's';
        el.innerHTML = `
          <span class="fi-name">${escAttr(f.name)}</span>
          <span class="fi-meta">—</span>
          <span class="fi-arrow">›</span>
          <div class="fr-actions">
            <button class="fr-btn del" onclick="event.stopPropagation();Folder.delete('${escAttr(side)}','${escAttr(f.name)}');">✕</button>
          </div>`;
        el.onclick = () => this.enter(side, f.name);
        list.appendChild(el);
      });

      files.forEach((f, i) => {
        list.appendChild(this._fileRow(f, side, i + folders.length));
      });

    } catch (err) {
      document.getElementById(listId).innerHTML =
        `<div class="empty-state" style="color:var(--red);font-style:normal;font-family:'DM Mono',monospace;font-size:11px;">${escAttr(err.message)}</div>`;
    }
  },

  // ── Load inner folder ──
  async loadInner(side, path) {
    const listId = side === 'D' ? 'dFileList' : 'mFileList';
    const metaId = side === 'D' ? 'dInnerMeta' : 'mInnerMeta';

    document.getElementById(listId).innerHTML = '<div class="loading-row">Loading…</div>';

    try {
      const data = await API.get('/files/list?path=' + encodeURIComponent(path));
      const folders = data.items.filter(i => i.type === 'folder');
      const files = data.items.filter(i => i.type === 'file');
      const total = data.items.length;

      document.getElementById(metaId).textContent =
        total + ' item' + (total !== 1 ? 's' : '');

      this._cacheItems(data.items, path);

      const list = document.getElementById(listId);
      list.innerHTML = '';

      if (data.items.length === 0) {
        list.innerHTML = '<div class="empty-state">This folder is empty</div>';
        return;
      }

      folders.forEach((f, i) => {
        const el = document.createElement('div');
        el.className = 'folder-item';
        el.style.animationDelay = (i * 0.04) + 's';
        el.innerHTML = `
          <span class="fi-name">${escAttr(f.name)}</span>
          <span class="fi-meta">—</span>
          <span class="fi-arrow">›</span>
          <div class="fr-actions">
            <button class="fr-btn del" onclick="event.stopPropagation();Folder.delete('${escAttr(side)}','${escAttr(f.name)}');">✕</button>
          </div>`;
        el.onclick = () => this.enter(side, f.name);
        list.appendChild(el);
      });

      files.forEach((f, i) => {
        list.appendChild(this._fileRow(f, side, i + folders.length));
      });

    } catch (err) {
      document.getElementById(listId).innerHTML =
        `<div class="empty-state" style="color:var(--red);font-style:normal;font-family:'DM Mono',monospace;font-size:11px;">${escAttr(err.message)}</div>`;
    }
  },

  // ── Enter a folder ──
  enter(side, name) {
    const newPath = this.currentPath[side] === '/'
      ? '/' + name
      : this.currentPath[side] + '/' + name;

    this.pathStack[side].push(this.currentPath[side]);
    this.currentPath[side] = newPath;

    if (side === 'D') {
      document.getElementById('dRootView').style.display = 'none';
      document.getElementById('dInnerView').style.display = 'block';
      document.getElementById('dInnerTitle').textContent = name;
      document.getElementById('dInnerLabel').textContent = name;
      document.getElementById('desktopFolder').scrollTop = 0;
    } else {
      document.getElementById('mRootView').style.display = 'none';
      document.getElementById('mInnerView').style.display = 'block';
      document.getElementById('mInnerTitle').textContent = name;
      document.getElementById('mob-folder').scrollTop = 0;
    }

    this._renderCrumbs(side);
    this.loadInner(side, newPath);

    sessionStorage.setItem('strand_path_D', JSON.stringify({ path: this.currentPath.D, stack: this.pathStack.D }));
    sessionStorage.setItem('strand_path_M', JSON.stringify({ path: this.currentPath.M, stack: this.pathStack.M }));
  },

  // ── Go back ──
  back(side) {
    const prev = this.pathStack[side].pop();
    if (prev === undefined) return;
    this.currentPath[side] = prev;

    if (prev === '/') {
      if (side === 'D') {
        document.getElementById('dRootView').style.display = '';
        document.getElementById('dInnerView').style.display = 'none';
      } else {
        document.getElementById('mRootView').style.display = '';
        document.getElementById('mInnerView').style.display = 'none';
      }
      this.loadRoot(side);
    } else {
      const name = prev.split('/').pop();
      if (side === 'D') {
        document.getElementById('dInnerTitle').textContent = name;
        document.getElementById('dInnerLabel').textContent = name;
      } else {
        document.getElementById('mInnerTitle').textContent = name;
      }
      this._renderCrumbs(side);
      this.loadInner(side, prev);
    }

    sessionStorage.setItem('strand_path_D', JSON.stringify({ path: this.currentPath.D, stack: this.pathStack.D }));
    sessionStorage.setItem('strand_path_M', JSON.stringify({ path: this.currentPath.M, stack: this.pathStack.M }));
  },

  // ── Refresh current view ──
  refresh(side) {
    if (this.pathStack[side].length > 0) {
      this.loadInner(side, this.currentPath[side]);
    } else {
      this.loadRoot(side);
    }
  },

  // ── Delete a file or folder ──
  async delete(side, name) {
    const filePath = this.currentPath[side] === '/'
      ? '/' + name
      : this.currentPath[side] + '/' + name;
    try {
      console.log('[delete] sending path:', filePath);
      await API.del('/files/delete', { path: filePath });
      Toast.show('Deleted');
      this.refresh(side);
    } catch (err) {
      Toast.error(err.message);
    }
  },

  // ── Download a file ──
  download(name) {
    const filePath = this.currentPath['D'] === '/'
      ? '/' + name
      : this.currentPath['D'] + '/' + name;
    const a = document.createElement('a');
    a.href = API.downloadUrl(filePath);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  },

  // ── Build a file row element ──
  _fileRow(f, side, delay) {
    const ext = f.ext || '—';
    const el = document.createElement('div');
    el.className = 'file-row';
    el.style.animationDelay = (delay * 0.04) + 's';

    // Add click handler for preview
    const filePath = this.currentPath[side] === '/' ? '/' + f.name : this.currentPath[side] + '/' + f.name;
    el.onclick = () => Preview.open(f.name, filePath);
    el.innerHTML = `
      <div class="file-ext-block">${escAttr(ext)}</div>
      <div class="fr-info">
        <div class="fr-name">${escAttr(f.name)}</div>
        <div class="fr-meta">${timeAgo(f.modified)}</div>
      </div>
      <span class="fr-size">${f.size_fmt || '—'}</span>
      <div class="fr-actions">
        <button class="fr-btn"     onclick="event.stopPropagation();Folder.download('${escAttr(f.name)}')">↓</button>
        <button class="fr-btn del" onclick="event.stopPropagation();Folder.delete('${escAttr(side)}','${escAttr(f.name)}')">✕</button>
      </div>`;
    return el;
  },

  // ── Render breadcrumbs ──
  _renderCrumbs(side) {
    const elId = side === 'D' ? 'dBreadcrumb' : 'mBreadcrumb';
    const bc = document.getElementById(elId);
    bc.innerHTML = '';

    const segs = ['My Files',
      ...this.pathStack[side]
        .filter(p => p !== '/')
        .map(p => p.split('/').pop()),
      this.currentPath[side].split('/').pop()
    ].filter(Boolean);

    segs.forEach((seg, i) => {
      const last = i === segs.length - 1;
      const el = document.createElement('span');
      el.className = 'bc' + (last ? ' current' : '');
      el.textContent = seg;
      if (!last) {
        el.onclick = () => {
          const stepsBack = segs.length - 1 - i;
          for (let j = 0; j < stepsBack; j++) this.back(side);
        };
      }
      bc.appendChild(el);
      if (!last) {
        const sep = document.createElement('span');
        sep.className = 'bc-sep';
        sep.textContent = '/';
        bc.appendChild(sep);
      }
    });
  },

  // ── Cache items for search ──
  _cacheItems(items, path) {
    items.forEach(item => {
      const fullPath = path === '/' ? '/' + item.name : path + '/' + item.name;
      if (!this.allFiles.find(f => f.fullPath === fullPath)) {
        this.allFiles.push({ ...item, fullPath });
      }
    });
  }
};

// ── New Folder Sheet ──
const Sheet = {
  _side: 'D',

  open(side) {
    this._side = side;
    document.getElementById('sheetOverlay').classList.add('show');
    setTimeout(() => document.getElementById('folderInput').focus(), 220);
  },

  close() {
    document.getElementById('sheetOverlay').classList.remove('show');
    document.getElementById('folderInput').value = '';
  },

  async create() {
    const name = document.getElementById('folderInput').value.trim();
    if (!name) return;
    const side = this._side;
    const folderPath = Folder.currentPath[side] === '/'
      ? '/' + name
      : Folder.currentPath[side] + '/' + name;
    try {
      await API.post('/files/mkdir', { path: folderPath });
      this.close();
      Toast.show('Folder created');
      Folder.refresh(side);
    } catch (err) {
      Toast.error(err.message);
    }
  }
};

// Enter key on folder input
document.getElementById('folderInput')
  .addEventListener('keydown', e => { if (e.key === 'Enter') Sheet.create(); });