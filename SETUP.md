# SETUP
### Get Strand running from scratch.

---

## Prerequisites

| Requirement | Version | Check |
|---|---|---|
| Node.js | 23+ | `node --version` |
| npm | 10+ | `npm --version` |
| Homebrew | any | `brew --version` |

---

## 01 — Install

Clone or download the project, then install dependencies.

```bash
npm install
```

## 02 — Frontend Config

Copy the example config and set your tunnel domain.
```bash
cp frontend/js/config.example.js frontend/js/config.js
```

Then edit `frontend/js/config.js` and replace `your-tunnel-domain.com` with your actual tunnel URL.

---

## 03 — Configure

Copy the example config and edit drive paths.

```bash
# config.json — set your external drive paths
{
  "adminDrivePath": "/Volumes/YourDrive/strand-admin",
  "sharedDrivePath": "/Volumes/YourDrive/strand-shared",
  "appPort": 3000,
  "warningThresholdPercent": 90
}
```

```bash
# .env — set a strong JWT secret
JWT_SECRET=change_this_to_something_long_and_random
PORT=3000
NODE_ENV=development
```

Create the folders on your drive.

```bash
mkdir -p /Volumes/YourDrive/strand-admin
mkdir -p /Volumes/YourDrive/strand-shared
```

---

## 04 — Database

Initialize the database and create the first admin user.

```bash
npm run dev       # starts server, creates strand.db automatically
node server/seed.js   # creates admin user
```

Default credentials — **change these after first login.**

```
username: admin
password: strand123
```

---

## 05 — First Login

Open your browser and go to:

```
http://localhost:3000
```

---

## 06 — Cloudflare Tunnel

For remote access from outside your home network.

**Install cloudflared**
```bash
brew install cloudflared
```

**Authenticate**
```bash
cloudflared tunnel login
```

**Create tunnel**
```bash
cloudflared tunnel create strand
```

**Create config file at `~/.cloudflared/config.yml`**
```yaml
tunnel: YOUR_TUNNEL_ID
credentials-file: /Users/YOU/.cloudflared/YOUR_TUNNEL_ID.json

ingress:
  - hostname: yourdomain.com
    service: http://localhost:3000
  - service: http_status:404
```

**Route DNS**
```bash
cloudflared tunnel route dns strand yourdomain.com
```

**Run tunnel**
```bash
cloudflared tunnel run strand
```

---

## 07 — Auto Start

To start both the server and tunnel automatically, run the included script.

```bash
chmod +x start-strand.sh
./start-strand.sh
```

To stop the script and all background processes (server and tunnel):
```bash
pkill -f strand
```

To run on Mac login, add `start-strand.sh` to **System Settings → General → Login Items**.

---

## 08 — Add Users

Use the admin API to create additional users. Must be called from localhost.

```bash
curl -X POST http://localhost:3000/api/admin/users \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "username": "alice",
    "password": "securepassword",
    "drive_id": 1,
    "quota_gb": 20
  }'
```

---

## Troubleshooting

**Drive shows offline**
Run `ls /Volumes/` to confirm the drive is mounted. Update paths in database if needed.

```bash
node -e "
const db = require('./server/db');
db.prepare(\"UPDATE drives SET path = ? WHERE label = 'Drive A'\").run('/Volumes/NewPath/strand-admin');
"
```

**Forgot password**
```bash
node -e "
const db = require('./server/db');
const bcrypt = require('bcrypt');
bcrypt.hash('newpassword', 12).then(h => {
  db.prepare('UPDATE users SET password = ? WHERE username = ?').run(h, 'admin');
  console.log('done');
});
"
```

**Upload fails with EXDEV error**
The tmp folder and drive are on different devices. Make sure `copyFileSync` is used instead of `renameSync` in `server/routes/files.js`.

---

*Strand — Local storage, without the local.*
