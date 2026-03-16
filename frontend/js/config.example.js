// Copy this file to config.js and fill in your tunnel URL
const CONFIG = {
  API_BASE: window.location.hostname === 'localhost' || 
            window.location.hostname === '127.0.0.1'
    ? ''
    : 'https://your-tunnel-domain.com'
};
