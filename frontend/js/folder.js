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

      this._cacheItems(data.items, '/');

      const list = document.getElementById(listId);
      list.innerHTML = '';

      if (data.items.length === 0) {
        list.innerHTML = '<div class="empty-state">Nothing here yet</div>';
        return;
      }

      folders.forEach((f, i) => {
        list.appendChild(this._folderRow(f, side, i));
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
        list.appendChild(this._folderRow(f, side, i));
      });

      files.forEach((f, i) => {
        list.appendChild(this._fileRow(f, side, i + folders.length));
      });

    } catch (err) {
      document.getElementById(listId).innerHTML =
        `<div class="empty-state" style="color:var(--red);font-style:normal;font-family:'DM Mono',monospace;font-size:11px;">${escAttr(err.message)}</div>`;
    }
  },

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

  back(side) {
    const prev = this.pathStack[side].pop();
    if (prev === undefined) return;
    this.currentPath[side] = prev;

    sessionStorage.setItem('strand_path_D', JSON.stringify({ path: this.currentPath.D, stack: this.pathStack.D }));
    sessionStorage.setItem('strand_path_M', JSON.stringify({ path: this.currentPath.M, stack: this.pathStack.M }));

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
  },

  refresh(side) {
    if (this.pathStack[side].length > 0) {
      this.loadInner(side, this.currentPath[side]);
    } else {
      this.loadRoot(side);
    }
  },

  async delete(side, name) {
    Modal.confirm('Delete Item', `Are you sure you want to delete "${name}"? This cannot be undone.`, async () => {
      const filePath = this.currentPath[side] === '/'
        ? '/' + name
        : this.currentPath[side] + '/' + name;
      try {
        await API.del('/files/delete', { path: filePath });
        Toast.show('Deleted');
        this.refresh(side);
      } catch (err) {
        Toast.error(err.message);
      }
    });
  },

  async rename(side, oldName) {
    // Find the row element
    const listId = side === 'D' 
      ? (this.pathStack[side].length > 0 ? 'dFileList' : 'dFolderList')
      : (this.pathStack[side].length > 0 ? 'mFileList' : 'mFolderList');
    
    const list = document.getElementById(listId);
    const rows = list.querySelectorAll('.folder-item, .file-row');
    let targetRow = null;
    let nameEl = null;

    rows.forEach(row => {
      const n = row.querySelector('.fi-name, .fr-name');
      if (n && n.textContent === oldName) {
        targetRow = row;
        nameEl = n;
      }
    });

    if (!nameEl) return;

    const isFile = nameEl.classList.contains('fr-name');
    let baseName = oldName;
    let extension = '';

    if (isFile && oldName.includes('.')) {
      const lastDot = oldName.lastIndexOf('.');
      baseName = oldName.substring(0, lastDot);
      extension = oldName.substring(lastDot); // includes the dot
    }

    // Create inline input
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'inline-rename-input';
    input.value = baseName;
    
    // Add extension label if it's a file
    let extLabel = null;
    if (extension) {
      extLabel = document.createElement('span');
      extLabel.className = 'inline-rename-ext';
      extLabel.textContent = extension;
    }

    const originalDisplay = nameEl.style.display;
    nameEl.style.display = 'none';
    nameEl.parentNode.insertBefore(input, nameEl);
    if (extLabel) nameEl.parentNode.insertBefore(extLabel, nameEl);
    
    input.focus();
    input.select();

    let isSaving = false;
    const save = async () => {
      if (isSaving) return;
      isSaving = true;

      const typedName = input.value.trim();
      const newName = typedName + extension;
      
      if (!typedName || newName === oldName) {
        done();
        return;
      }

      const base = this.currentPath[side] === '/' ? '/' : this.currentPath[side] + '/';
      try {
        await API.post('/files/rename', {
          oldPath: base + oldName,
          newPath: base + newName
        });
        Toast.show('Renamed');
        this.refresh(side);
      } catch (err) {
        Toast.error(err.message);
        done();
      }
    };

    const done = () => {
      input.remove();
      if (extLabel) extLabel.remove();
      nameEl.style.display = originalDisplay;
    };

    input.onkeydown = e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        save();
      }
      if (e.key === 'Escape') {
        input.onblur = null; // Disable save-on-blur for escape
        done();
      }
    };
    input.onblur = () => save(); 
  },

  async _move(side, fileName, targetNameOrPath, isPath = false) {
    const base = this.currentPath[side] === '/' ? '/' : this.currentPath[side] + '/';
    const oldPath = base + fileName;
    
    let newPath;
    if (isPath) {
      newPath = targetNameOrPath === '/' ? '/' + fileName : targetNameOrPath + '/' + fileName;
    } else {
      newPath = base + targetNameOrPath + '/' + fileName;
    }

    try {
      await API.post('/files/rename', { oldPath, newPath });
      Toast.show(`Moved ${fileName}`);
      this.refresh(side);
    } catch (err) {
      Toast.error(err.message);
    }
  },

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

  _folderRow(f, side, delay) {
    const el = document.createElement('div');
    el.className = 'folder-item';
    el.style.animationDelay = (delay * 0.04) + 's';
    el.innerHTML = `
      <span class="fi-name">${escAttr(f.name)}</span>
      <span class="fi-meta">—</span>
      <span class="fi-arrow">›</span>
      <div class="fr-actions">
        <button class="fr-btn"     onclick="event.stopPropagation();Folder.rename('${escAttr(side)}','${escAttr(f.name)}');">✎</button>
        <button class="fr-btn del" onclick="event.stopPropagation();Folder.delete('${escAttr(side)}','${escAttr(f.name)}');">✕</button>
      </div>`;
    el.onclick = () => this.enter(side, f.name);

    // Drop target logic
    el.ondragover = e => { e.preventDefault(); el.classList.add('drag-target'); };
    el.ondragleave = () => el.classList.remove('drag-target');
    el.ondrop = e => {
      e.preventDefault();
      el.classList.remove('drag-target');
      const fileName = e.dataTransfer.getData('text/plain');
      if (fileName && fileName !== f.name) {
        this._move(side, fileName, f.name);
      }
    };
    return el;
  },

  _fileRow(f, side, delay) {
    const ext = f.name.includes('.') ? f.name.split('.').pop().toLowerCase() : 'file';
    const row = document.createElement('div');
    row.className = 'file-row';
    row.style.animationDelay = (delay * 0.05) + 's';
    row.draggable = true;

    const fullPath = (this.currentPath[side] === '/' ? '/' : this.currentPath[side] + '/') + f.name;
    const isNew = typeof Upload !== 'undefined' && Upload.recentUploads.has(fullPath);

    row.innerHTML = `
      <div class="file-ext-block">${ext}</div>
      <div class="fr-info">
        <div class="fr-name">${escAttr(f.name)}${isNew ? '<span class="tag-new">New</span>' : ''}</div>
        <div class="fr-meta">${f.mtime ? timeAgo(f.mtime) : ''}</div>
      </div>
      <div class="fr-size">${f.size ? fmtSize(f.size) : ''}</div>
      <div class="fr-actions">
        <button class="fr-btn" onclick="Folder.rename('${side}', '${escAttr(f.name)}'); event.stopPropagation();" title="Rename">✎</button>
        <button class="fr-btn" onclick="Folder.download('${escAttr(f.name)}'); event.stopPropagation();" title="Download">↓</button>
        <button class="fr-btn del" onclick="Folder.delete('${side}', '${escAttr(f.name)}'); event.stopPropagation();" title="Delete">✕</button>
      </div>`;

    row.onclick = () => Preview.open(f.name, fullPath);
    
    row.ondragstart = e => {
      e.dataTransfer.setData('text/plain', f.name);
      row.classList.add('dragging');
    };
    row.ondragend = () => row.classList.remove('dragging');
    return row;
  },

  _renderCrumbs(side) {
    const elId = side === 'D' ? 'dBreadcrumb' : 'mBreadcrumb';
    const bc = document.getElementById(elId);
    bc.innerHTML = '';

    const pathParts = this.currentPath[side].split('/').filter(Boolean);
    const crumbs = [
      { label: 'My Files', path: '/' },
      ...pathParts.map((part, i) => ({
        label: part,
        path: '/' + pathParts.slice(0, i + 1).join('/')
      }))
    ];

    crumbs.forEach((crumb, i) => {
      const last = i === crumbs.length - 1;
      const el = document.createElement('span');
      el.className = 'bc' + (last ? ' current' : '');
      el.textContent = crumb.label;

      if (!last) {
        el.onclick = () => {
          this.pathStack[side] = crumbs.slice(0, i).map(c => c.path);
          this.currentPath[side] = crumb.path;

          // SAVE New state before loading
          sessionStorage.setItem('strand_path_' + side, JSON.stringify({ path: this.currentPath[side], stack: this.pathStack[side] }));
          
          if (crumb.path === '/') {
            if (side === 'D') {
              document.getElementById('dRootView').style.display = 'block';
              document.getElementById('dInnerView').style.display = 'none';
            } else {
              document.getElementById('mRootView').style.display = 'block';
              document.getElementById('mInnerView').style.display = 'none';
            }
            this.loadRoot(side);
          } else {
            // Ensure inner view is visible for parent folders
            if (side === 'D') {
              document.getElementById('dRootView').style.display = 'none';
              document.getElementById('dInnerView').style.display = 'block';
              document.getElementById('dInnerTitle').textContent = crumb.label;
              document.getElementById('dInnerLabel').textContent = crumb.label;
            } else {
              document.getElementById('mRootView').style.display = 'none';
              document.getElementById('mInnerView').style.display = 'block';
              document.getElementById('mInnerTitle').textContent = crumb.label;
            }
            this._renderCrumbs(side);
            this.loadInner(side, crumb.path);
          }
        };

        // Breadcrumb Drop Target
        el.ondragover = e => { 
          e.preventDefault(); 
          el.classList.add('bc-drag-over'); 
        };
        el.ondragleave = () => el.classList.remove('bc-drag-over');
        el.ondrop = e => {
          e.preventDefault();
          el.classList.remove('bc-drag-over');
          const fileName = e.dataTransfer.getData('text/plain');
          if (fileName) {
            this._move(side, fileName, crumb.path, true);
          }
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

  _cacheItems(items, path) {
    items.forEach(item => {
      const fullPath = path === '/' ? '/' + item.name : path + '/' + item.name;
      if (!this.allFiles.find(f => f.fullPath === fullPath)) {
        this.allFiles.push({ ...item, fullPath });
      }
    });
  }
};

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
    const folderPath = Folder.currentPath[side] === '/' ? '/' + name : Folder.currentPath[side] + '/' + name;
    try {
      await API.post('/files/mkdir', { path: folderPath });
      this.close();
      Toast.show('Folder created');
      Folder.refresh(side);
    } catch (err) { Toast.error(err.message); }
  }
};

document.getElementById('folderInput')?.addEventListener('keydown', e => { if (e.key === 'Enter') Sheet.create(); });