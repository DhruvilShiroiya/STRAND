const Upload = {
  activeControllers: new Map(),
  isUploading: false,
  pickedPath: { D: '/', M: '/' },
  recentUploads: new Set(),

  openPicker(side) {
    const list = document.getElementById('pickerList');
    list.innerHTML = '<div class="loading-row">Scanning folders…</div>';
    document.getElementById('pickerOverlay').classList.add('show');
    
    API.get('/files/list?path=/').then(data => {
      list.innerHTML = '';
      const folders = data.items.filter(i => i.isDir);
      
      const root = document.createElement('div');
      root.className = 'picker-item';
      root.textContent = '/ My Files';
      root.onclick = () => this.selectFolder(side, '/', '/ My Files');
      list.appendChild(root);

      folders.forEach(f => {
        const item = document.createElement('div');
        item.className = 'picker-item';
        item.textContent = '/' + f.name;
        item.onclick = () => this.selectFolder(side, '/' + f.name, '/' + f.name);
        list.appendChild(item);
      });
    }).catch(err => {
      list.innerHTML = `<div class="empty-state">Error: ${err.message}</div>`;
    });
  },

  selectFolder(side, path, label) {
    this.pickedPath[side] = path;
    const nameEl = document.getElementById('destName' + side);
    if (nameEl) nameEl.textContent = label;
    this.closePicker();
  },

  closePicker() {
    document.getElementById('pickerOverlay').classList.remove('show');
  },

  over(e, zoneId) {
    e.preventDefault();
    document.getElementById(zoneId).classList.add('over');
  },

  leave(zoneId) {
    document.getElementById(zoneId).classList.remove('over');
  },

  drop(e, side) {
    e.preventDefault();
    this.leave('dropZone' + side);
    if (e.dataTransfer.files.length) this.handle(e.dataTransfer.files, side);
  },

  cancelBatch(batchId) {
    const controller = this.activeControllers.get(batchId);
    if (controller) {
      controller.abort();
      this.activeControllers.delete(batchId);
      Toast.show('Upload cancelled');
    }
  },

  async handle(files, side) {
    if (!files.length) return;

    this.recentUploads.clear(); // Clear old tags when a new upload starts
    this.isUploading = true;
    const batchId = 'b' + Date.now();
    const controller = new AbortController();
    this.activeControllers.set(batchId, controller);

    const warn = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);

    const wrapId = 'queueWrap' + side;
    const listId = 'queueList' + side;
    const wrapEl = document.getElementById(wrapId);
    wrapEl.style.display = 'block';
    
    if (!document.getElementById('notice' + side)) {
      const notice = document.createElement('div');
      notice.id = 'notice' + side;
      notice.className = 'upload-notice';
      notice.innerHTML = '<span>⚠</span> Keep this page open until complete';
      wrapEl.insertBefore(notice, document.getElementById(listId));
    }

    const listEl = document.getElementById(listId);

    const items = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const ext  = file.name.includes('.') ? file.name.split('.').pop().toLowerCase() : 'file';
      const uid  = 'q' + Date.now() + i;

      const row = document.createElement('div');
      row.className = 'q-item';
      row.style.animationDelay = (i * 0.05) + 's';
      row.innerHTML = `
        <div class="q-thumb" id="th_${uid}">
          <span class="q-ext">${escAttr(ext)}</span>
        </div>
        <div class="q-info">
          <div class="q-name">${escAttr(file.name)}</div>
          <div class="q-track"><div class="q-bar" id="b_${uid}"></div></div>
          <div class="q-pct" id="p_${uid}">Waiting…</div>
        </div>
        <div class="q-cancel" onclick="Upload.cancelBatch('${batchId}')" title="Cancel Batch">✕</div>
        <div class="q-check" id="c_${uid}"></div>`;
      listEl.appendChild(row);
      items.push({ uid, row });
    }

    const startTime = Date.now();

    const targetPath = (this.pickedPath[side] && this.pickedPath[side] !== '/') 
      ? this.pickedPath[side] 
      : (Folder.currentPath[side] === '/' ? '' : Folder.currentPath[side]);

    const form = new FormData();
    form.append('path', targetPath);
    for (const file of files) form.append('files', file);

    try {
      await API.upload('/files/upload', form, (progress) => {
        const { percent, loaded, total } = progress;
        
        const elapsed = (Date.now() - startTime) / 1000;
        const speed = loaded / elapsed;
        const remaining = (total - loaded) / speed;
        let etaText = '';
        if (remaining > 60) etaText = ` · ${Math.ceil(remaining / 60)}m left`;
        else if (remaining > 0) etaText = ` · ${Math.ceil(remaining)}s left`;

        items.forEach(({ uid }) => {
          const bar = document.getElementById('b_' + uid);
          const pct = document.getElementById('p_' + uid);
          if (bar) bar.style.width = percent + '%';
          if (pct) pct.textContent = Math.round(percent) + '%' + etaText;
        });
      }, controller.signal);

      items.forEach(({ uid, row }) => {
        const fileName = row.querySelector('.q-name').textContent;
        const fullPath = (targetPath === '' ? '/' : targetPath + '/') + fileName;
        this.recentUploads.add(fullPath);

        const bar = document.getElementById('b_' + uid);
        const pct = document.getElementById('p_' + uid);
        const chk = document.getElementById('c_' + uid);
        const thm = document.getElementById(`th_${uid}`);
        if (bar) { bar.style.width = '100%'; bar.classList.add('done'); }
        if (pct) pct.textContent = 'Done';
        if (thm) thm.classList.add('done');
        if (chk) chk.classList.add('done');
      });

      Toast.show('Uploaded ' + files.length + ' file' + (files.length > 1 ? 's' : ''));
      Folder.refresh(side);

    } catch (err) {
      if (err.name === 'AbortError' || err.message === 'Upload failed') {
        items.forEach(({ row }) => row.remove()); 
      } else {
        items.forEach(({ uid }) => {
          const pct = document.getElementById('p_' + uid);
          const bar = document.getElementById('b_' + uid);
          if (pct) { pct.textContent = 'Failed'; pct.style.color = 'var(--red)'; }
          if (bar) bar.style.background = 'var(--red)';
        });
        Toast.error(err.message);
      }
    } finally {
      this.activeControllers.delete(batchId);
      this.isUploading = this.activeControllers.size > 0;
      
      if (!this.isUploading) {
        window.removeEventListener('beforeunload', warn);
        document.getElementById('notice' + side)?.remove();
      }
      
      const input = document.getElementById('fileIn' + side);
      if (input) input.value = '';
    }
  }
};