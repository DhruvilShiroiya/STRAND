// CUSTOM MODAL CONTROLLER
const Modal = {
  confirm(title, text, onConfirm) {
    document.getElementById('confirmTitle').textContent = title;
    document.getElementById('confirmText').textContent = text;
    document.getElementById('confirmOverlay').classList.add('show');
    
    const btn = document.getElementById('confirmActionBtn');
    btn.onclick = () => {
      onConfirm();
      this.close();
    };
  },
  close() {
    document.getElementById('confirmOverlay').classList.remove('show');
  }
};

// ══════════════════════════════
// BOOT
// ══════════════════════════════
(function () {
  // Redirect to login if no token
  if (!Auth.check()) return;

  // Init nav layout
  Nav.init();

  const savedTab = sessionStorage.getItem('strand_tab');
  if (savedTab) {
    const btn = document.querySelector(`[data-tab="${savedTab}"]`);
    if (btn) Nav.switch(btn);
  }

  // Load folder views for both sides
  Folder.loadRoot('D');
  Folder.loadRoot('M');

  // Keyboard shortcuts
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      Search.close();
      Sheet.close();
      if (typeof Preview !== 'undefined') Preview.close();
    }
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      Search.open();
    }
  });

  // Init gestures
  Gestures.init();

  // HARD LOCK: Prevent multi-finger zoom
  document.addEventListener('touchstart', e => {
    if (e.touches.length > 1) e.preventDefault();
  }, { passive: false });
  
  // Prevent double-tap zoom (except for inputs)
  let lastTouch = 0;
  document.addEventListener('touchend', e => {
    const now = Date.now();
    if (now - lastTouch <= 300) {
      if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
        e.preventDefault();
      }
    }
    lastTouch = now;
  }, { passive: false });
})();