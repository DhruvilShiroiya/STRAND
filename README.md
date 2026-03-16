# STRAND
### Local storage, without the local.

---

Strand is a self-hosted file storage system that runs on your own hardware. Files live on your external drive. Access them from anywhere via a secure Cloudflare tunnel. No cloud. No subscriptions. No data leaving your home.

---

## Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 23 |
| Framework | Express 5 |
| Database | SQLite (better-sqlite3) |
| Auth | JWT + bcrypt |
| Uploads | Multer |
| Tunnel | Cloudflare Tunnel |
| Frontend | Vanilla JS, CSS custom properties |
| Typography | Cormorant · DM Mono · Figtree |

---

## Structure

```
STRAND/
├── server/
│   ├── routes/
│   │   ├── auth.js        — login, logout, /me
│   │   ├── files.js       — list, upload, download, delete, mkdir, rename
│   │   └── admin.js       — user management, drive management, usage
│   ├── middleware/
│   │   ├── auth.js        — JWT verification
│   │   └── adminOnly.js   — localhost + admin role guard
│   ├── utils/
│   │   ├── driveUtils.js  — path safety, folder size, drive stats
│   │   └── quotaUtils.js  — usage cache, quota checks
│   ├── db.js              — SQLite schema + seed
│   ├── seed.js            — first admin user
│   └── index.js           — Express entry point
├── frontend/
│   ├── css/strand.css
│   ├── js/
│   │   ├── api.js         — fetch wrapper, auth state
│   │   ├── app.js         — boot
│   │   ├── folder.js      — folder nav, file list, breadcrumbs
│   │   ├── upload.js      — drag drop, queue, progress
│   │   ├── profile.js     — storage bar, settings, setup guide
│   │   ├── search.js      — full-text file search
│   │   ├── nav.js         — pill nav, responsive switching
│   │   ├── preview.js     — inline file preview
│   │   ├── gestures.js    — swipe back, swipe to dismiss
│   │   └── config.js      — API base URL
│   ├── index.html         — login
│   └── app.html           — main app
├── data/
│   └── strand.db          — SQLite database
├── config.json            — drive paths, port, quota thresholds
├── .env                   — JWT secret, port, node env
└── README.md
```

---

## Design

Strand uses a strict typographic hierarchy with no icons or decorative elements.

- **Display** — Cormorant (serif) — page titles, wordmark, headings
- **Data** — DM Mono (monospace) — labels, sizes, timestamps, navigation
- **Body** — Figtree (sans-serif) — prose, inputs

Themes follow the device preference via `prefers-color-scheme`. Warm cream in light mode, rich near-black in dark mode.

---

## License

Personal use. Not for redistribution.
