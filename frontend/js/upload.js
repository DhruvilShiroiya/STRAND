const Upload = {
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

  async handle(files, side) {
    if (!files.length) return;

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
          <div class="q-pct" id="p_${uid}">Waiting…</div>
        </div>
        <div class="q-check" id="c_${uid}"></div>`;
      listEl.appendChild(row);
      items.push({ uid, row });
    }

    // Animate bars to ~80% while uploading
    const intervals = items.map(({ uid }) => {
      let p = 0;
      return setInterval(() => {
        p = Math.min(p + Math.random() * 10 + 3, 82);
        const bar = document.getElementById('b_' + uid);
        const pct = document.getElementById('p_' + uid);
        if (bar) bar.style.width = p + '%';
        if (pct) pct.textContent = Math.round(p) + '%';
      }, 160);
    });

    // Build form
    const uploadPath = Folder.currentPath[side] === '/'
      ? ''
      : Folder.currentPath[side];

    const form = new FormData();
    form.append('path', uploadPath);
    for (const file of files) form.append('files', file);

    try {
      await API.call('POST', '/files/upload', form);

      // Stop intervals, mark done
      intervals.forEach(iv => clearInterval(iv));
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
      intervals.forEach(iv => clearInterval(iv));
      items.forEach(({ uid }) => {
        const pct = document.getElementById('p_' + uid);
        const bar = document.getElementById('b_' + uid);
        if (pct) { pct.textContent = 'Failed'; pct.style.color = 'var(--red)'; }
        if (bar) bar.style.background = 'var(--red)';
      });
      Toast.error(err.message);
    }

    // Reset input
    const input = document.getElementById('fileIn' + side);
    if (input) input.value = '';
  }
};