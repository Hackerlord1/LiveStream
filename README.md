# BraveStream

BraveStream has two parts that run in different places:

| Part | What it does | Where it runs |
| --- | --- | --- |
| **Website** (`src/`) | The Next.js site visitors use. Live match chat uses Convex (`convex/messages.ts`). | Your web host (e.g. Vercel) |
| **Stream server** (`server/`) | Talks to the IPTV portal, keeps the channel/movie/series lists, restreams live TV, plays movies, episodes and radio. | An always-on computer, reachable as `https://api.bravestream.live` through a Cloudflare Tunnel |

The website calls the stream server for everything IPTV. If the stream server is down,
IPTV pages show "Can't reach the server" (and browsers may report a CORS error; see
[Troubleshooting](#troubleshooting)).

---

## Setting up the stream server computer

Do this once on the computer that will stay on and connected to the internet. Commands are
for **Windows (PowerShell)**; Linux equivalents follow each step where they differ.

### 1. Before you start

- **Upload speed matters most.** Every viewer streams from this computer's internet
  connection, at roughly 3–5 Mbps each. Run a speed test and look at the *upload* number:
  20 Mbps upload ≈ 4–6 viewers at once.
- **The computer must not sleep.** Windows: *Settings → System → Power* → set *Sleep* to
  **Never** (when plugged in). Also set *Settings → Windows Update → Advanced options →
  Active hours* so updates don't restart it during matches.
- **No router or firewall changes are needed.** The Cloudflare Tunnel connects outwards, so
  nothing on your network is opened up and your home IP stays hidden.

### 2. Install the tools

```powershell
winget install OpenJS.NodeJS.LTS Gyan.FFmpeg Git.Git Cloudflare.cloudflared
```

Then **close and reopen PowerShell** (or restart the computer) so the new programs are on
the PATH. Check each one:

```powershell
node -v          # v20 or newer
ffmpeg -version  # any recent version
cloudflared -v
git --version
```

<details>
<summary>Linux (Ubuntu/Debian)</summary>

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs ffmpeg git
# cloudflared: https://pkg.cloudflare.com/ (add the repo, then: sudo apt install cloudflared)
```
</details>

### 3. Get the code

```powershell
cd C:\
git clone https://github.com/Hackerlord1/LiveStream.git bravestream
cd C:\bravestream\server
npm install
```

Only the `server/` folder is needed on this computer. `npm install` there installs its one
dependency.

> Push your latest changes to GitHub first, or the server computer gets an old version.
> Without git, copying the `server/` folder works too, then run `npm install` inside it.

### 4. Configure

```powershell
copy .env.example .env
notepad .env
```

Fill in at least:

| Setting | Value |
| --- | --- |
| `IPTV_PORTAL_URL` | `http://3tv.pro` (no `/c/`, no trailing slash) |
| `IPTV_MAC` | The MAC address of your portal subscription |
| `IPTV_API_PATH` | `portal.php` |

The other settings have sensible defaults; each is explained in `.env.example`.
**Never commit or share `.env`.** It holds your subscription's MAC.

### 5. Optional: copy the catalogue cache

On its very first start the server downloads every channel, movie and series from the
portal, which takes **20–30 minutes** for movies. To skip that, copy the `server\cache\`
folder from a computer where the server has already run into `C:\bravestream\server\cache\`.

### 6. First test run

```powershell
cd C:\bravestream\server
node server.js
```

You should see the portal log in and the catalogues load. If you see
**"ffmpeg and ffprobe not found"**, reopen PowerShell (step 2) and try again.

In a browser **on the server computer**, open <http://localhost:3477/health>. It should
show `"status":"ok"` and catalogue counts. Then stop the server with **Ctrl+C**.

### 7. Keep it running with pm2

pm2 restarts the server if it crashes and starts it again after a reboot.

```powershell
npm install -g pm2 pm2-windows-startup
pm2-startup install
cd C:\bravestream\server
pm2 start ecosystem.config.js
pm2 save
```

Useful commands:

```powershell
pm2 status                       # is it running?
pm2 logs bravestream-server      # live log (Ctrl+C to stop watching)
pm2 restart bravestream-server   # after changing .env or updating the code
```

<details>
<summary>Linux</summary>

```bash
sudo npm install -g pm2
cd ~/bravestream/server && pm2 start ecosystem.config.js && pm2 save
pm2 startup   # then run the command it prints
```
</details>

### 8. Connect `api.bravestream.live` with a Cloudflare Tunnel

The easiest way is a tunnel managed from the Cloudflare dashboard:

1. Go to **Cloudflare dashboard → Zero Trust → Networks → Tunnels**.
2. If a tunnel for `api.bravestream.live` already exists (from the old VPS), open it.
   Otherwise click **Create a tunnel**, choose **Cloudflared**, and name it `bravestream`.
3. Under **Install and run a connector**, pick **Windows**. Copy the command it shows
   (`cloudflared.exe service install <long token>`) and run it in an
   **Administrator** PowerShell. This installs the tunnel as a Windows service that starts
   on boot.
4. Under **Public Hostname**, add (or edit) the route:
   - Subdomain `api`, domain `bravestream.live`
   - Service **HTTP**, URL `localhost:3477`
5. Save. The tunnel should show **Healthy** within a minute.
6. If the old VPS connector is still listed, delete it, since that machine is gone.

Check from any device: <https://api.bravestream.live/health> should show `"status":"ok"`.

### 9. Point the website at the server

On the website's host (e.g. *Vercel → Project → Settings → Environment Variables*), make sure
`NEXT_PUBLIC_API_URL` is `https://api.bravestream.live` (that's also the default if it's
unset), then redeploy. Open the site's IPTV section and play a channel to confirm.

### 10. Updating later

```powershell
cd C:\bravestream
git pull
cd server
npm install
pm2 restart bravestream-server
```

---

## Running locally (development)

### Website

```bash
npm install
npm run dev          # http://localhost:3000
npm run convex:dev   # chat functions
```

`.env.local`:

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_API_URL` | Stream server. Default `https://api.bravestream.live`; use `http://localhost:3477` to test against a local server |
| `NEXT_PUBLIC_CONVEX_URL` | Convex deployment used for chat |
| `NEXT_PUBLIC_API_BASE_URL`, `NEXT_PUBLIC_API_USER`, `NEXT_PUBLIC_API_PLAN` | Sports/channels API |
| `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET` | Email (contact form, inbound forwarding) |
| `CONTACT_TO_EMAIL` | Where contact-form and forwarded emails are sent |

### Stream server

```bash
cd server
npm install
cp .env.example .env   # fill in IPTV_PORTAL_URL and IPTV_MAC
node server.js         # http://localhost:3477
```

---

## Troubleshooting

| Symptom | Cause and fix |
| --- | --- |
| Site shows **"Can't reach the server"**, browser console shows a **CORS error** on `api.bravestream.live`, or that URL shows **Cloudflare error 1033** | The tunnel has no running connector, or the server is down. On the server computer: `pm2 status`, and check the tunnel is *Healthy* in the Cloudflare dashboard. (Cloudflare's error page has no CORS header, so browsers report it as CORS.) |
| **"Playback isn't available… missing ffmpeg"**, or `spawn ffmpeg ENOENT` in the log | ffmpeg isn't installed or isn't on PATH. Install it (step 2), then restart PowerShell *and* the server. Or set `FFMPEG_PATH` / `FFPROBE_PATH` in `server/.env`. |
| Catalogues empty or "Loading…" for a long time | First run is still downloading (movies take 20–30 min). `http://localhost:3477/api/status` shows progress. |
| Portal login errors in the log | Check `IPTV_PORTAL_URL`, `IPTV_MAC` and `IPTV_API_PATH` in `server/.env`, and that the subscription is still active. |
| Streams buffer when several people watch | Upload bandwidth is full. See "Before you start". |
| `↻ … file server closed the connection …, resuming` in the log | Normal. The provider drops connections often, and the server resumes automatically. |

---

## How the stream server works

**Catalogues.** On startup the server serves the channel, radio, movie and series lists from
`server/cache/` immediately, then refreshes them from the portal in the background every
`CATALOGUE_REFRESH_HOURS` (default 6). A refreshed list only replaces the old one once it's
complete. The very first run (no cache) downloads everything, which takes 20–30 minutes.

**Live TV.** One portal connection per channel, shared by every viewer of that channel.
ffmpeg re-encodes it to H.264/AAC HLS with 4-second segments. Re-encoding gives clean
timestamps across the provider's frequent reconnects and plays in every browser.
`LIVE_VIDEO_MODE=copy` saves CPU at the cost of reliability.

**Movies and episodes.** Each title is probed once. Browser-friendly MP4/H.264 files (most
episodes) are passed through with byte-range support, so seeking is native. Everything else
(most movies are MKV, often with E-AC3 audio) is repackaged by ffmpeg into MP4 on the fly:
video is copied, audio converted to AAC, and seeking restarts at `?start=`. Expect ~3–5 s to
start. The provider's file-server links expire after ~30–40 s and connections drop often,
so all reads go through a reader that resumes from the exact byte with a fresh link.

**Limits.** The portal account allows **6 simultaneous streams** (live channels count once
each however many people watch them; every movie/episode/radio listener counts separately).
The real limit is usually upload bandwidth.

### Endpoints

| Endpoint | |
| --- | --- |
| `GET /api/channels-all`, `GET /api/channel/:id`, `GET /api/epg` | Live channels, programme guide |
| `GET /watch/:id`, `GET /leave/:id`, `GET /hls/:file` | Start/stop a live restream, HLS output |
| `GET /api/games` | Fixtures parsed from event-channel names (the portal's programme guide is empty) |
| `GET /api/radio`, `GET /api/radio/:id/listen` | Radio list, audio converted to MP3 |
| `GET /api/vod/all`, `GET /api/vod/:id` | Movies |
| `GET /api/vod/:id/source`, `GET /api/vod/:id/stream?start=` | Movie playback |
| `GET /api/series/all`, `GET /api/series/:id`, `GET /api/series/:id/episodes` | Series |
| `GET /api/series/:id/source?season=&episode=`, `…/stream` | Episode playback |
| `GET /api/status` | Catalogue counts and first-load progress (polled by the site) |
| `GET /health` | Server status |
