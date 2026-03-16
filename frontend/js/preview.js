const Preview = {
    open(name, filePath) {
        const filenameEl = document.getElementById('previewFilename');
        const bodyEl = document.getElementById('previewBody');
        const overlay = document.getElementById('previewOverlay');

        if (!filenameEl || !bodyEl || !overlay) return;

        filenameEl.textContent = name;

        // Build secure authorized URL for streaming the file via server
        const previewUrl = '/api/files/preview?path=' + encodeURIComponent(filePath) + '&token=' + Auth.token;

        // Detect file type
        const extMatch = name.match(/\.([^.]+)$/);
        const ext = extMatch ? extMatch[1].toLowerCase() : '';

        const imgExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'];
        const vidExts = ['mp4', 'mov', 'webm'];
        const audExts = ['mp3', 'wav', 'm4a', 'ogg'];
        const txtExts = ['txt', 'md', 'js', 'json', 'html', 'css', 'py', 'sh', 'log'];

        // Render appropriate player
        if (imgExts.includes(ext)) {
            bodyEl.innerHTML = `<img src="${previewUrl}" alt="${escAttr(name)}">`;
        }
        else if (ext === 'pdf') {
            bodyEl.innerHTML = `<iframe src="${previewUrl}"></iframe>`;
        }
        else if (vidExts.includes(ext)) {
            bodyEl.innerHTML = `<video src="${previewUrl}" controls autoplay></video>`;
        }
        else if (audExts.includes(ext)) {
            bodyEl.innerHTML = `<audio src="${previewUrl}" controls autoplay></audio>`;
        }
        else if (txtExts.includes(ext)) {
            bodyEl.innerHTML = `<div class="loading-row">Loading text…</div>`;
            fetch(previewUrl)
                .then(res => res.text())
                .then(text => {
                    bodyEl.innerHTML = `<pre style="width:100%;height:100%;font-family:'DM Mono',monospace;font-size:13px;padding:24px;overflow:auto;white-space:pre-wrap;box-sizing:border-box;">${escAttr(text)}</pre>`;
                })
                .catch(err => {
                    bodyEl.innerHTML = `<div class="preview-unsupported">Error loading text preview</div>`;
                });
        }
        else {
            bodyEl.innerHTML = `
        <div class="preview-unsupported">
          <div style="font-size:32px;margin-bottom:12px;">📄</div>
          <div>Preview not available for .${escAttr(ext)} files</div>
          <button class="sheet-cta" style="margin-top:24px;width:auto;padding:12px 24px;" 
            onclick="Folder.download('${escAttr(name)}')">Download file</button>
        </div>`;
        }

        overlay.classList.add('show');
    },

    close() {
        const overlay = document.getElementById('previewOverlay');
        const bodyEl = document.getElementById('previewBody');

        if (overlay) overlay.classList.remove('show');

        // Clear innerHTML so audio/videos actively stop playing and buffering
        if (bodyEl) bodyEl.innerHTML = '';
    }
};
