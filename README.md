Strand is a self-hosted web app that turns your external hard drives into a 
personal cloud — accessible from any device, anywhere, through a secure tunnel.

Unlike Dropbox, Google Drive, or iCloud, Strand stores your files on drives 
you physically own. Nothing leaves your hardware. No subscriptions, no storage 
limits imposed by a third party, no data sitting on someone else's server.

You run Strand on your Mac, plug in your drives, and instantly get a clean 
web interface to upload, browse, download, and manage files — from your phone, 
laptop, or any browser in the world.

Built for small groups. Each user gets their own folder and quota on the drive. 
An admin panel lets you manage users, set storage limits, and monitor usage. 
Drives are hot-swappable — go offline, swap the drive, come back online.

Features
- Clean, typographic UI — light/dark auto theme, no icons, no clutter
- Real file storage on your own external drives
- Multi-user with per-user quotas and storage warnings
- File preview — PDFs, images, video, audio, text directly in the browser
- Drag and drop upload with live progress
- Folder navigation with breadcrumbs
- Secure remote access via Cloudflare Tunnel — free, no port forwarding
- JWT authentication, bcrypt passwords
- Zero cloud dependency — works entirely on your local network too

Stack: Node.js · Express · SQLite · Multer · JWT · Cloudflare Tunnel

Why Strand?
Most self-hosted solutions (Nextcloud, Seafile, Plex) are heavy — 
they require Docker, databases, complex setup, and still push you 
toward cloud sync. Strand is the opposite. No Docker. No sync. 
No monthly fee. Just your drives, your files, and a URL.
