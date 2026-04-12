const Nav = {

  init() {
    const mobile = this._isMobile();

    // Show correct pill buttons
    document.querySelector('[data-tab="files"]').style.display = mobile ? 'none' : '';
    document.querySelector('[data-tab="upload"]').style.display = mobile ? '' : 'none';
    document.querySelector('[data-tab="folder"]').style.display = mobile ? '' : 'none';

    // Set active button
    const btns = this._visible();
    btns.forEach(b => b.classList.remove('active'));

    const savedTab = sessionStorage.getItem('strand_tab');
    if (!savedTab) {
      btns[0].classList.add('active');
      setTimeout(() => this._updateTrack(btns[0]), 100);
    }

    // Show correct layout
    if (mobile) {
      const activeTab = savedTab || (btns[0] ? btns[0].dataset.tab : 'upload');
      this.showMobilePage(activeTab === 'files' ? 'upload' : activeTab);
      
      document.getElementById('desktopUpload').style.display = 'none';
      document.getElementById('desktopFolder').style.display = 'none';
      document.getElementById('desktopProfile').classList.remove('active');
    } else {
      document.getElementById('desktopUpload').style.display = '';
      document.getElementById('desktopFolder').style.display = '';
      document.getElementById('desktopProfile').classList.remove('active');
      document.querySelectorAll('.mobile-page')
        .forEach(p => p.classList.remove('active'));
    }
  },

  switch(btn) {
    if (btn.classList.contains('active')) {
      location.reload();
      return;
    }
    const mobile = this._isMobile();

    this._visible().forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    this._updateTrack(btn);

    const tab = btn.dataset.tab;

    if (mobile) {
      if (tab === 'upload') this.showMobilePage('upload');
      if (tab === 'folder') this.showMobilePage('folder');
      if (tab === 'profile') {
        this.showMobilePage('profile');
        Profile.render('mobProfileContent');
      }
    } else {
      if (tab === 'files') {
        this.switchToFiles();
      }
      if (tab === 'profile') {
        document.getElementById('desktopUpload').style.display = '';
        document.getElementById('desktopFolder').style.display = '';
        document.getElementById('desktopProfile').classList.add('active');
        Profile.render('profileContent');
      }
    }

    sessionStorage.setItem('strand_tab', tab);
  },

  switchToFiles() {
    document.getElementById('desktopUpload').style.display = '';
    document.getElementById('desktopFolder').style.display = '';
    document.getElementById('desktopProfile').classList.remove('active');

    // Update pill track to Files button
    const filesBtn = document.querySelector('[data-tab="files"]');
    if (filesBtn) {
      this._visible().forEach(b => b.classList.remove('active'));
      filesBtn.classList.add('active');
      this._updateTrack(filesBtn);
    }
  },

  showMobilePage(id) {
    document.querySelectorAll('.mobile-page')
      .forEach(p => p.classList.remove('active'));
    document.getElementById('mob-' + id).classList.add('active');
  },

  _isMobile() {
    return window.innerWidth < 768;
  },

  _visible() {
    return [...document.querySelectorAll('.pill-btn')]
      .filter(b => b.offsetParent !== null);
  },

  _updateTrack(btn) {
    const pill = document.getElementById('pill');
    const track = document.getElementById('pillTrack');
    if (!pill || !track || !btn) return;
    const pr = pill.getBoundingClientRect();
    const br = btn.getBoundingClientRect();
    track.style.left = (br.left - pr.left) + 'px';
    track.style.width = br.width + 'px';
    track.style.top = '5px';
    track.style.bottom = '5px';
  }
};

window.addEventListener('resize', () => {
  if (Auth.token) Nav.init();
});

window.addEventListener('load', () => {
  if (Auth.token) {
    const btns = Nav._visible();
    if (btns.length) Nav._updateTrack(btns.find(b => b.classList.contains('active')) || btns[0]);
  }
});