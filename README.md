# BraveStream

BraveStream has two parts that run in different places:

| Part | What it does | Where it runs |
| --- | --- | --- |
| **Website** (`src/`) | The Next.js site visitors use. Live match chat uses Convex (`convex/messages.ts`). | The server computer (Next.js on :3000, behind Caddy), as `https://bravestream.live` |
| **Stream server** (`server/`) | Talks to the IPTV portal, keeps the channel/movie/series lists, restreams live TV, plays movies, episodes and radio. | An always-on computer, reachable as `https://api.bravestream.live` (directly via Caddy, or through a Cloudflare Tunnel) |

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
- **You'll need access to your router** to forward two ports (step 8).

### 2. Install the tools

```powershell
winget install OpenJS.NodeJS.LTS Gyan.FFmpeg Git.Git Cloudflare.cloudflared
```

Then **close and reopen PowerShell** (or restart the computer) so the new programs are on
the PATH. Until you do, you'll get errors like `git : The term 'git' is not recognized`.

Windows blocks PowerShell scripts by default, which stops `npm` and `pm2` with *"running
scripts is disabled on this system"*. Allow them for your user once (answer **Y**):

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

Check each tool:

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

### 8. Make `api.bravestream.live` reach this computer

Viewers connect **directly** to this computer: no tunnel or relay in between, so the only
limit is your own upload speed. [Caddy](https://caddyserver.com) handles HTTPS (free
certificate, renewed automatically) and passes requests to the stream server.

**Requirement:** your internet connection has a public IP. Compare the *WAN/Internet IP* on
your router's admin page with <https://whatismyip.com>. They must match. (If they don't,
you're behind CGNAT: use [the Cloudflare Tunnel instead](#alternative-cloudflare-tunnel).)

**8.1 Give this computer a fixed local IP.** Run `ipconfig` and note the *IPv4 Address*
(e.g. `192.168.1.50`). In your router, add a **DHCP reservation** for it so it never
changes.

**8.2 Forward ports on the router.**

| Outside port | Forward to | |
| --- | --- | --- |
| TCP **443** | this computer, port **443** | required (HTTPS) |
| TCP **80** | this computer, port **8880** | optional (redirects http to https) |

Caddy uses 8880 for plain HTTP because port 80 is often already taken on Windows (check with
`Get-NetTCPConnection -State Listen -LocalPort 80`). Do **not** forward 3477; the stream
server stays private behind Caddy. If something else already uses the router's outside 80,
skip that row: HTTPS certificates still work through 443 alone.

**8.3 Allow the ports in Windows Firewall** (Administrator PowerShell):

```powershell
New-NetFirewallRule -DisplayName "Caddy HTTPS" -Direction Inbound -Protocol TCP -LocalPort 443,8880 -Action Allow
```

**8.4 Point the domain at your IP.** The domain's DNS is on Cloudflare. In
*Cloudflare dashboard → bravestream.live → DNS → Records*:
- Delete the existing `api` record (it points at the old tunnel).
- Add an **A** record: name `api`, IPv4 = your public IP, **Proxy status: DNS only
  (grey cloud)**. The grey cloud matters: with an orange cloud, traffic would still go
  through Cloudflare.
- In *Zero Trust → Networks → Tunnels*, delete the old tunnel so it can't re-create the
  record.

**8.5 Install and test Caddy.**

```powershell
winget install CaddyServer.Caddy
```

Reopen PowerShell, then:

```powershell
caddy run --config C:\bravestream\server\Caddyfile
```

The first run obtains the certificate (a few seconds). Then test from a **phone on mobile
data** (not your Wi-Fi): <https://api.bravestream.live/health> should show
`"status":"ok"`. Stop Caddy with Ctrl+C.

**8.6 Keep it running:** Caddy is started by pm2 together with the website and stream
server in step 9.3.

> **pm2 on Windows starts when you log in**, not at power-on. Set the server computer to sign
> in automatically (`netplwiz` → untick *Users must enter a user name and password*), or
> just leave it signed in.

> **If your public IP changes** (many home connections get a new one occasionally), the
> `api` record must be updated, or the site loses the server. Ask your ISP for a static
> IP, or set up a dynamic-DNS updater.

#### Alternative: Cloudflare Tunnel

Use this only if you're behind CGNAT (no public IP). It needs no router changes, but all
video passes through Cloudflare, whose free plan restricts heavy video use.

1. *Cloudflare dashboard → Zero Trust → Networks → Tunnels → Create a tunnel* (Cloudflared).
2. Under *Install and run a connector* pick **Windows**, and run the
   `cloudflared.exe service install <token>` command it shows in an **Administrator**
   PowerShell.
3. Under *Public Hostname*: subdomain `api`, domain `bravestream.live`, service **HTTP**
   `localhost:3477`. Save. It should show **Healthy**.

Check from any device: <https://api.bravestream.live/health> should show `"status":"ok"`.

### 9. Run the website on this computer too

The website (`bravestream.live`) runs on the same computer, behind the same Caddy, so the
whole site is self-hosted with no third-party CPU or bandwidth limits.

**9.1 Website settings.** Copy your `.env.local` (Convex, Resend, sports API keys) into
`C:\bravestream\`. `NEXT_PUBLIC_API_URL` can stay unset: it defaults to
`https://api.bravestream.live`.

**9.2 Build it** (takes a few minutes):

```powershell
cd C:\bravestream
npm ci
npm run build
```

**9.3 Run everything with pm2.** The root `ecosystem.config.js` runs the website (port
3000), the stream server (3477) and Caddy together. If you started any of them with pm2
before, remove those first:

```powershell
pm2 delete all
cd C:\bravestream
pm2 start ecosystem.config.js
pm2 save
pm2 status
```

All three (`bravestream-web`, `bravestream-server`, `caddy`) should be **online**. Check
<http://localhost:3000> on this computer.

**9.4 Point the domain here.**
1. *Cloudflare → Workers & Pages →* (the old site's Worker) *→ Settings → Domains & Routes*:
   remove `bravestream.live` and `www.bravestream.live`, so Cloudflare stops serving the
   old site.
2. *Cloudflare → bravestream.live → DNS → Records*:
   - Delete the existing `www` A and AAAA records.
   - Add **A** `@` (the root, `bravestream.live`) → your public IP, **DNS only** (grey cloud).
   - Add **A** `www` → your public IP, **DNS only** (grey cloud).
   - Leave everything else alone (email MX/TXT records, the `*` wildcard, `api`).
3. `pm2 restart caddy` so it fetches certificates for the root domain and `www` straight away.

Then open <https://bravestream.live> from a phone on mobile data.

### 10. Updating later

```powershell
cd C:\bravestream
git pull
npm ci
npm run build
cd server
npm install
pm2 restart all
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
**Switching portal** (new `IPTV_PORTAL_URL` or `IPTV_MAC` in `server/.env`): just restart. Caches remember
which portal they came from, so the old ones are ignored and everything downloads fresh. To force
a fresh download for the same portal, delete `server/cache/` and restart.

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

**Quality choice.** Live channels are encoded in several qualities at once (`LIVE_QUALITIES`,
default 1080/720/480/360, never above the source). The player picks automatically for each
viewer's connection and screen, or the viewer chooses. Movies and episodes offer *Original*
(no extra CPU) plus lower qualities that are re-encoded per viewer, capped at
`MAX_VOD_TRANSCODES` (default 3) at once.

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
