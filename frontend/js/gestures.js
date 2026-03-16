const Gestures = {
  _start: { x: 0, y: 0 },
  _dragging: false,
  _dragTarget: null,
  _dragType: null,
  _hintEl: null,
  _lastDy: 0,

  init() {
    console.log('[gestures] init called');
    
    // Use DOMContentLoaded to ensure elements exist
    const setup = () => {
      console.log('[gestures] setting up handlers');
      this._createHint();
      this._setupSwipeBack();
      this._setupSheetDismiss();
      this._setupSearchDismiss();
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', setup);
    } else {
      setup();
    }
  },

  _setupSwipeBack() {
    const body = document.querySelector('.app-body');
    if (!body) return;
    
    body.addEventListener('touchstart', e => {
      console.log('[gestures] touchstart detected on:', e.target);
      this._start.x = e.touches[0].clientX;
      this._start.y = e.touches[0].clientY;
      if (this._start.x < 40) {
        this._hintEl.style.opacity = '0.4';
      }
    }, { passive: false });

    body.addEventListener('touchend', e => {
      if (this._start.x < 40) this._hintEl.style.opacity = '0';
      const dx = e.changedTouches[0].clientX - this._start.x;
      const dy = e.changedTouches[0].clientY - this._start.y;
      
      if (this._start.x < 40 && dx > 60 && Math.abs(dx) > Math.abs(dy)) {
        const innerView = document.getElementById('mInnerView');
        if (innerView && innerView.style.display !== 'none') {
          Folder.back('M');
        }
      }
    });
  },

  _setupSheetDismiss() {
    this._attachDrag('#sheetOverlay', '.sheet', 'folder');
    this._attachDrag('#memorySheetOverlay', '.sheet', 'memory');
    this._attachDrag('#passwordSheetOverlay', '.sheet', 'password');
    this._attachDrag('#setupGuideOverlay', '.sheet', 'setup');
  },

  _setupSearchDismiss() {
    this._attachDrag('#searchPg', null, 'search');
  },

  _createHint() {
    if (this._hintEl) return;
    this._hintEl = document.createElement('div');
    this._hintEl.style.cssText = `
      position:fixed; left:0; top:0; bottom:0; width:2px;
      background:var(--ink); opacity:0; z-index:9999;
      transition:opacity 0.2s; pointer-events:none;
    `;
    document.body.appendChild(this._hintEl);
  },

  _attachDrag(parentSelector, targetSelector, type) {
    const parent = document.querySelector(parentSelector);
    if (!parent) return;
    const target = targetSelector ? parent.querySelector(targetSelector) : parent;

    target.addEventListener('touchstart', e => {
      console.log('[gestures] touchstart detected on:', e.target);
      this._start.y = e.touches[0].clientY;
      this._dragTarget = target;
      this._dragType = type;
      this._dragging = true;
      this._lastDy = 0;
      
      const wrap = targetSelector ? parent : target;
      wrap.classList.add('dragging');
    }, { passive: false });

    target.addEventListener('touchmove', e => {
      if (!this._dragging) return;
      const dy = e.touches[0].clientY - this._start.y;
      if (dy > 0) {
        // Prevent scroll when dragging down
        if (target.scrollTop <= 0) {
          e.preventDefault();
          this._lastDy = dy;
          this._dragTarget.style.transform = `translateY(${dy}px)`;
        }
      }
    }, { passive: false });

    target.addEventListener('touchend', e => {
      if (!this._dragging) return;
      this._dragging = false;
      const dy = this._lastDy;
      
      const wrap = targetSelector ? parent : target;
      wrap.classList.remove('dragging');

      if (dy > 80) {
        // Close
        if (this._dragType === 'folder') Sheet.close();
        if (this._dragType === 'memory') Profile.closeMemorySheet();
        if (this._dragType === 'password') Profile.closePasswordSheet();
        if (this._dragType === 'setup') Profile.closeSetupGuide();
        if (this._dragType === 'search') Search.close();
        
        // Reset transform after transition
        setTimeout(() => {
          this._dragTarget.style.transform = '';
        }, 300);
      } else {
        // Spring back
        this._dragTarget.style.transition = 'transform 0.3s var(--ease-spring)';
        this._dragTarget.style.transform = 'translateY(0)';
        setTimeout(() => {
          this._dragTarget.style.transition = '';
        }, 300);
      }
    });
  }
};
