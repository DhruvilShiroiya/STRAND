const API_BASE = (typeof CONFIG !== 'undefined' && CONFIG.API_BASE) ? CONFIG.API_BASE : '';

// ══════════════════════════════
// AUTH STATE
// ══════════════════════════════
const _token = sessionStorage.getItem('strand_token') || localStorage.getItem('strand_token');
const _user  = sessionStorage.getItem('strand_user')  || localStorage.getItem('strand_user');

const Auth = {
  token: _token,
  user:  _user ? JSON.parse(_user) : null,

  check() {
    if (!this.token) {
      window.location.href = '/';
      return false;
    }
    return true;
  },

  clear() {
    sessionStorage.removeItem('strand_token');
    sessionStorage.removeItem('strand_user');
    localStorage.removeItem('strand_token');
    localStorage.removeItem('strand_user');
    this.token = null;
    this.user  = null;
  }
};

// ══════════════════════════════
// API FETCH WRAPPER
// ══════════════════════════════
const API = {
  async call(method, path, body, signal) {
    const opts = {
      method,
      headers: { 'Authorization': 'Bearer ' + Auth.token },
      signal
    };

    if (body instanceof FormData) {
      opts.body = body;
    } else if (body) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }

    const res  = await fetch(API_BASE + '/api' + path, opts);
    const data = await res.json();
    
    if (res.status === 401) {
      Auth.clear();
      window.location.href = '/';
      return;
    }

    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  },

  get(path)         { return this.call('GET',    path); },
  post(path, body)  { return this.call('POST',   path, body); },
  put(path, body)   { return this.call('PUT',    path, body); },
  del(path, body)   { return this.call('DELETE', path, body); },

  // Direct download via link (needs token in query for browser download)
  downloadUrl(filePath) {
    return API_BASE + '/api/files/download?path=' + encodeURIComponent(filePath)
         + '&token=' + encodeURIComponent(Auth.token);
  }
};

// ══════════════════════════════
// TOAST
// ══════════════════════════════
const Toast = {
  _timer: null,

  show(msg, error = false) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.className   = 'toast show' + (error ? ' error' : '');
    clearTimeout(this._timer);
    this._timer = setTimeout(() => el.classList.remove('show'), 2800);
  },

  error(msg) { this.show(msg, true); }
};

// ══════════════════════════════
// UTILS
// ══════════════════════════════
function fmtSize(bytes) {
  if (!bytes && bytes !== 0) return '—';
  if (bytes >= 1073741824) return (bytes / 1073741824).toFixed(1) + ' GB';
  if (bytes >= 1048576)    return (bytes / 1048576).toFixed(1) + ' MB';
  if (bytes >= 1024)       return (bytes / 1024).toFixed(1) + ' KB';
  return bytes + ' B';
}

function fmtMb(mb) {
  if (mb >= 1024) return (mb / 1024).toFixed(1) + ' GB';
  return mb.toFixed(1) + ' MB';
}

function timeAgo(date) {
  const s = Math.floor((Date.now() - new Date(date)) / 1000);
  if (s < 60)    return 'just now';
  if (s < 3600)  return Math.floor(s / 60) + 'm ago';
  if (s < 86400) return Math.floor(s / 3600) + 'h ago';
  return Math.floor(s / 86400) + 'd ago';
}

function escAttr(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}