const Upload = {
  activeControllers: new Map(), // batchId -> AbortController
  isUploading: false,

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

    this.isUploading = true;
    const batchId = 'b' + Date.now();
    const controller = new AbortController();
    this.activeControllers.set(batchId, controller);

    // Refresh warning
    const warn = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);

    const wrapId = 'queueWrap' + side;
    const listId = 'queueList' + side;
    document.getElementById(wrapId).style.display = 'block';
    const listEl = document.getElementById(listId);

    // Build queue rows
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
          <div class="q-pct" id="p_${uid}">Uploading…</div>
        </div>
        <div class="q-cancel" onclick="Upload.cancelBatch('${batchId}')" title="Cancel Batch">✕</div>
        <div class="q-check" id="c_${uid}"></div>`;
      listEl.appendChild(row);
      items.push({ uid, row });
    }

    // Build form
    const uploadPath = Folder.currentPath[side] === '/' ? '' : Folder.currentPath[side];
    const form = new FormData();
    form.append('path', uploadPath);
    for (const file of files) form.append('files', file);

    try {
      // NOTE: Standard fetch doesn't give us upload progress yet (need XHR for that if we want real 0-100%)
      // For now, we'll keep the "active" animation but handle real completion better.
      const uploadPromise = API.call('POST', '/files/upload', form, controller.signal);
      
      // Animate bars to 90% while waiting for server response
      const interval = setInterval(() => {
        items.forEach(({ uid }) => {
          const bar = document.getElementById('b_' + uid);
          const pct = document.getElementById('p_' + uid);
          if (!bar) return;
          let current = parseFloat(bar.style.width) || 0;
          if (current < 90) {
            current += (Math.random() * 5);
            bar.style.width = Math.min(current, 90) + '%';
            pct.textContent = Math.round(current) + '%';
          }
        });
      }, 300);

      await uploadPromise;
      clearInterval(interval);

      // Success
      items.forEach(({ uid }) => {
        const bar = document.getElementById('b_' + uid);
        const pct = document.getElementById('p_' + uid);
        const chk = document.getElementById('c_' + uid);
        const thm = document.getElementById('th_' + uid);
        if (bar) { bar.style.width = '100%'; bar.classList.add('done'); }
        if (pct) pct.textContent = 'Done';
        if (thm) thm.classList.add('done');
        if (chk) chk.classList.add('done');
      });

      Toast.show('Uploaded ' + files.length + ' file' + (files.length > 1 ? 's' : ''));
      Folder.refresh(side);

    } catch (err) {
      if (err.name === 'AbortError') {
        items.forEach(({ row }) => row.remove()); // Remove cancelled items
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
      window.removeEventListener('beforeunload', warn);
      
      const input = document.getElementById('fileIn' + side);
      if (input) input.value = '';
    }
  }
};