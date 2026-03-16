const Search = {

  open() {
    document.getElementById('searchPg').classList.add('show');
    setTimeout(() => document.getElementById('searchField').focus(), 100);
  },

  close() {
    document.getElementById('searchPg').classList.remove('show');
    document.getElementById('searchField').value = '';
    document.getElementById('searchBody').innerHTML =
      '<div class="search-empty">Start typing to search</div>';
  },

  query(q) {
    const body = document.getElementById('searchBody');

    if (!q.trim()) {
      body.innerHTML = '<div class="search-empty">Start typing to search</div>';
      return;
    }

    const term = q.toLowerCase();
    const hits = Folder.allFiles.filter(f =>
      f.name.toLowerCase().includes(term)
    );

    if (!hits.length) {
      body.innerHTML = `
        <div class="search-empty"
          style="font-style:normal;font-family:'DM Mono',monospace;font-size:11px;color:var(--ink3);">
          No results for "${escAttr(q)}"
        </div>`;
      return;
    }

    body.innerHTML = '';
    hits.slice(0, 50).forEach((f, i) => {
      const ext = f.type === 'folder' ? '/' : (f.ext || '—');
      const el  = document.createElement('div');
      el.className = 'file-row';
      el.style.animationDelay = (i * 0.03) + 's';
      el.style.paddingLeft  = '28px';
      el.style.paddingRight = '28px';
      el.innerHTML = `
        <div class="file-ext-block">${escAttr(ext)}</div>
        <div class="fr-info">
          <div class="fr-name">${escAttr(f.name)}</div>
          <div class="fr-meta">${escAttr(f.fullPath)}</div>
        </div>
        ${f.size_fmt ? `<span class="fr-size">${escAttr(f.size_fmt)}</span>` : ''}`;

      // Clicking a result navigates to it
      el.onclick = () => {
        this.close();
        const side = window.innerWidth >= 768 ? 'D' : 'M';
        if (f.type === 'folder') {
          this._navigateTo(side, f.fullPath);
        } else {
          // Navigate to parent folder
          const parent = f.fullPath.substring(0, f.fullPath.lastIndexOf('/')) || '/';
          this._navigateTo(side, parent);
        }
      };

      body.appendChild(el);
    });
  },

  // Navigate folder view to a given path
  _navigateTo(side, targetPath) {
    if (targetPath === '/') {
      // Reset to root
      Folder.currentPath[side] = '/';
      Folder.pathStack[side]   = [];
      if (side === 'D') {
        document.getElementById('dRootView').style.display  = '';
        document.getElementById('dInnerView').style.display = 'none';
        Nav.switchToFiles();
      } else {
        document.getElementById('mRootView').style.display  = '';
        document.getElementById('mInnerView').style.display = 'none';
        Nav.showMobilePage('folder');
      }
      Folder.loadRoot(side);
      return;
    }

    // Build path segments e.g. /a/b/c → ['a', 'b', 'c']
    const segs  = targetPath.split('/').filter(Boolean);
    const stack = ['/'];
    for (let i = 0; i < segs.length - 1; i++) {
      stack.push('/' + segs.slice(0, i + 1).join('/'));
    }

    Folder.pathStack[side]   = stack;
    Folder.currentPath[side] = targetPath;

    const name = segs[segs.length - 1];

    if (side === 'D') {
      document.getElementById('dRootView').style.display  = 'none';
      document.getElementById('dInnerView').style.display = 'block';
      document.getElementById('dInnerTitle').textContent  = name;
      document.getElementById('dInnerLabel').textContent  = name;
      Nav.switchToFiles();
    } else {
      document.getElementById('mRootView').style.display  = 'none';
      document.getElementById('mInnerView').style.display = 'block';
      document.getElementById('mInnerTitle').textContent  = name;
      Nav.showMobilePage('folder');
    }

    Folder._renderCrumbs(side);
    Folder.loadInner(side, targetPath);
  }
};