# Deploy to a Linux VDS (Docker Compose + Caddy)

The whole game is one Node process (Express + Colyseus) that also serves the built client. Caddy in front provides HTTPS (Let's Encrypt) and proxies WebSockets.

```
Internet ──443──> Caddy ──> app:2567 (Node: static client + /matchmake + WebSocket rooms)
```

## 1. What you need (account-bound — the user must do these)
- A Linux VDS (Ubuntu 22.04/24.04, 1 vCPU / 1 GB RAM is enough for dozens of rooms).
- A domain or subdomain, e.g. `okey.example.com`, with an **A record** pointing to the VDS IP.
- Ports **80** and **443** open in the provider firewall.

## 2. Install Docker on the VDS
```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER   # log out/in afterwards
```

## 3. Get the code and configure
```bash
git clone <your repo url> sokak && cd sokak
cp .env.example .env
nano .env        # set DOMAIN=okey.example.com and a random STATS_TOKEN
```

## 4. Start
```bash
docker compose up -d --build
docker compose logs -f app      # "[sokak] server listening on :2567"
```
Open `https://okey.example.com` — Caddy fetches the certificate automatically on first request (takes a few seconds).

## 5. Operate
| Task | Command |
|---|---|
| Update to the latest code | `git pull && docker compose up -d --build` |
| Health check | `curl https://DOMAIN/health` |
| Analytics (counts only) | `curl "https://DOMAIN/stats?token=STATS_TOKEN"` |
| Raw analytics log | `docker compose exec app cat /app/data/analytics.jsonl` |
| Restart | `docker compose restart app` |
| Stop | `docker compose down` |

Notes
- Rooms live in memory; restarting the app ends running rounds (players just create a new room). Graceful shutdown on SIGTERM.
- One process handles everything. For much larger traffic, Colyseus can be scaled with its Redis presence/driver (backlog).
- `/stats` returns only aggregate numbers (rooms, rounds, room-size histogram). No names, ids or IPs are stored.

## Kahvehane extras

- **Wallets (play money):** stored in `data/wallets.json` (override with `WALLET_FILE`). Only an anonymous random device token, the balance, the last daily-bonus time, match counts and — for the weekly leaderboard — this and last week's results with the nickname used are kept; week results older than last week are dropped, whole entries unseen for 60 days too. Keep the `data/` volume when redeploying.
- **Voice chat** is peer-to-peer WebRTC; the game server only relays signalling. Public STUN (Google) is used by default. Players behind strict NATs (some mobile networks) need a TURN relay: run e.g. `coturn` on the VDS (UDP 3478 + a relay port range open in the firewall) and set `VITE_TURN_URL=turn:your.domain:3478`, `VITE_TURN_USER`, `VITE_TURN_PASS` in `.env` — `docker compose build` passes them to the client build (account-bound / server setup: the user must do this).

## Admin panel (staff accounts)

Only staff have accounts; players stay anonymous. The owner account is **`shivass`** (always exists, cannot be deleted). The owner adds admins; admins can only start/stop the derby on the kıraathane TV, the owner can do everything (staff, salons, kick/close, announcements, play-money grants, stats, action log).

1. In `.env` set a strong owner password (at least 8 characters):
   ```
   SOKAK_OWNER_PASSWORD=<a long random password>
   STAFF_FILE=/app/data/staff.json
   ```
   `STAFF_FILE` must be on the persistent `app_data` volume (the default `/app/data/staff.json` already is). It holds the users with salted scrypt hashes only; the admin action log is appended next to it (`staff-log.jsonl`).
2. `docker compose up -d --build`, then open **https://DOMAIN/admin** and log in as `shivass`.
3. `SOKAK_OWNER_PASSWORD` is applied at every start: if you change the owner password in the panel and the variable is still set, the next restart resets it to the variable. Either keep them the same or remove the variable after the first start (the stored hash is kept).
4. If no password is set and no staff file exists yet, the server generates a one-time owner password and prints it once in the log: `docker compose logs app | grep -A2 "SOKAK ADMIN"`. Change it in the panel ("Yetkililer → Şifremi değiştir").

Security notes: sessions are HttpOnly + SameSite=Strict cookies (Secure behind Caddy's https), 12 h; 5 failed logins per IP or per username in 10 minutes give HTTP 429. Removing an admin ends their sessions immediately. Forgot the owner password: set `SOKAK_OWNER_PASSWORD` and restart.

## Verified in development
- `docker build` of this Dockerfile succeeds and the container serves the client, `/health`, `/stats` and a real Colyseus room (tested with a headless bot client).
- `docker compose config` validates. The Caddy image could not be pulled in the sandbox (no registry access), the Caddyfile uses only the standard `reverse_proxy` + `encode` directives.

## Running without Docker (any Node 22 host)
```bash
corepack enable && pnpm install --frozen-lockfile && pnpm build
NODE_ENV=production PORT=2567 node apps/server/dist/index.js
```
Then put any HTTPS reverse proxy (Caddy, nginx) in front that forwards WebSocket upgrades.
