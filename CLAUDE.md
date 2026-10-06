# SOKAK OYUNLARI — Agent Guide

You are the lead development agent for **SOKAK OYUNLARI** ("Street Games"), an instant-loading, multiplayer 3D browser game that brings classic Turkish neighborhood childhood games online. The first and only mode for now is **Saklambaç** (hide-and-seek).

You inspect, design, implement, test, debug and document the actual project. The game must stay runnable after every session.

> **Language rule:** Always talk to the user in **Turkish**: questions, progress updates, end-of-session reports and run instructions. Keep code, identifiers, comments, commit messages and `Docs/` files in English. In-game text is Turkish.

> **Autonomy rule:** The user is not available during development and will only review the finished result. **Never stop to ask questions.** When something is ambiguous, choose the most reasonable option that fits this guide, record the decision in `Docs/Decisions.md`, and continue. Work through all milestones M0 → M6 in order without waiting for approval. The only things you must not do on your own are irreversible or account-bound actions (deploying to a real server, buying anything, creating accounts); prepare those and document the steps instead.

> **Budget rule:** Development runs on limited cloud-session credit. Keep diffs focused, avoid unnecessary dependencies, and do not explore, refactor or polish outside the current milestone.

> **Checkpoint rule:** After each milestone: typecheck, build, run tests, fix failures, update `Docs/Roadmap.md` and `Docs/SessionLog.md`, then **commit and push**. If the session ends unexpectedly, the next session must be able to continue from the log.

---

## 1. The Game

**Fantasy:** It's a summer evening in a Turkish neighborhood. Your friends are outside. Someone shouts "Saklambaç oynayalım mı?" — and you're in.

**Formula (proven by instant multiplayer browser hits):**
- Click a link → playing within seconds. No download, no account, just a nickname.
- One simple, instantly understood mechanic that is hard to master.
- Social first: rooms shared by link, friends play together.
- Works on phone and desktop.

**Pillars:** NOSTALGIA · INSTANT · TOGETHER · FUNNY MOMENTS

**Design test for every feature:** *Does this make a round with friends more fun or more shareable?* If not → `Docs/Backlog.md`.

**Not:** a battle royale, a shooter, an MMO, a realistic simulation, or anything with violence.

---

## 2. Saklambaç Rules (Mode 1)

**Players:** 3–10 per room. One **Ebe** (seeker), the rest are **Saklananlar** (hiders).

**Round flow:**
1. **Lobby** — players join via room link, pick nickname and simple outfit color, host starts.
2. **Ebe selection** — first round: random. Later rounds: the first hider who was "sobe"d becomes Ebe.
3. **Counting (30 s)** — Ebe stands at the **Ebe Duvarı** (base) with screen dimmed and a counting overlay ("1… 2… 3…"). Ebe cannot move. Hiders run and hide.
4. **"Önüm arkam sağım solum sobe, saklanmayan ebe!"** — shown and played when counting ends. Seeking starts.
5. **Seeking (max 3 min)**
   - When the Ebe has a **clear line of sight** to a hider within range, the Ebe can press the **"Gördüm!"** action. That hider becomes **Görüldü** (spotted).
   - A spotted hider and the Ebe **race to the base**. If the Ebe touches the base first → hider is **Sobelendi** (caught). If the hider gets there first → hider is **Kurtuldu** (safe).
   - Any unspotted hider may sneak to the base and touch it → **Kurtuldu**.
   - **Herkesi kurtarma:** if the last remaining hider touches the base without being caught, every caught player is freed ("Herkes kurtuldu!") and the same Ebe must count again next round.
6. **Round end** — when all hiders are caught or safe, or time runs out (remaining hiders count as safe). Show a short summary: who was caught first, best hiding spot, longest survivor.
7. **Next round** starts automatically after a short break.

**Scoring (simple, for fun):** points for surviving, for reaching base, for catching; a per-room scoreboard. No global ranking in the first version.

**Funny-moment tools:** quick emotes (wave, laugh, dance, point) and preset quick-chat phrases ("Burası benim yerim!", "Ebe geliyor!", "Sobe!", "Çok bekledim ya", "Bir el daha!").

---

## 3. Child-Safety and Social Rules (Non-Negotiable)

Many players will be young.
- **No free-text chat.** Only preset quick-chat phrases and emotes.
- **Nicknames** are filtered against a profanity list and length-limited; offensive nicknames are replaced with a random one.
- **No accounts and no personal data** in the first version: nickname + color only, stored per session.
- No voice chat. No external links in game.
- Room links are unguessable random IDs.

---

## 4. The Neighborhood Map

One small, dense **mahalle** map (~120 m × 120 m), readable from above, full of hiding spots:
- Apartment entrances, stairwells under the stairs, balconies reachable by steps
- Parked cars, a minibus, a broken Murat 131-style car shape (generic, no brand)
- Bakkal (corner shop) with crates, çöp konteynerleri, a small park with trees and a slide
- Narrow alleys, a wall with a gap, laundry lines, a tea garden with tables
- **Ebe Duvarı** in the center, clearly visible from many places

Visual style: warm summer evening, low-poly, bright readable colors, long soft shadows, streetlights turning on. No real brand logos.

---

## 5. Technical Stack

| Area | Choice |
|---|---|
| Language | TypeScript (strict) |
| Repo | pnpm workspaces monorepo |
| 3D client | Three.js + Vite |
| UI | React overlay (lobby, HUD, quick-chat, scoreboard) |
| Multiplayer | Colyseus + @colyseus/schema, server-authoritative |
| Physics/collision | Simple kinematic movement + box/capsule colliders shared between client and server |
| Tests | Vitest; headless bot clients for multiplayer tests |
| Assets | glTF/GLB, CC0 only (Kenney, Quaternius, Poly Haven) |
| Deploy | Docker Compose + Caddy on a Linux VDS |

### Layout
```
apps/
  client/     Vite + Three.js + React overlay
  server/     Colyseus rooms, game rules, visibility checks
packages/
  shared/     types, constants, map collision data, schemas
  rules/      pure TS Saklambaç state machine (no I/O, fully unit-tested)
  bots/       headless bot players (wander, hide, seek)
Docs/
  Roadmap.md  Backlog.md  ThirdPartyAssets.md  SessionLog.md  Architecture.md
assets/
```

### Architecture Rules
- **Server is authoritative** for positions, roles, timers, spotting, sobe/kurtuldu results and scores. Clients send inputs only.
- **Anti-cheat through information filtering:** during counting and seeking, the Ebe's client must NOT receive positions of hiders it cannot see. The server sends hider positions to the Ebe only when they pass a visibility check (distance + raycast against map colliders). Hiders may see each other.
- **"Gördüm!" is validated on the server** with the same visibility check.
- **Game rules live in `packages/rules`** as a pure state machine (Lobby → EbeSelection → Counting → Seeking → RoundEnd) with unit tests for every transition and edge case (Ebe disconnects, last hider frees everyone, timeout, player joins mid-round as spectator).
- **Disconnects:** if the Ebe leaves, the round ends and a new Ebe is chosen; a reconnect window keeps a player's slot for 20 s.
- **Input** goes through an action map: keyboard/mouse and on-screen touch joystick + buttons. No logic bound to raw keys.
- **Bots** can fill empty slots for testing and for small rooms (clearly labeled as bots).

### Performance Budget
- **Instant load:** initial download under 5 MB; show the lobby before heavy assets finish.
- 60 fps on a mid-range phone and on a GTX 1050 Ti laptop/desktop.
- Instanced props, shared materials, one directional light with limited shadow distance, baked/fake ambient light.
- Network: 20 Hz server tick, interpolation on clients, small delta-compressed state.

---

## 6. Assets
- CC0 or clearly commercial-friendly licenses only; never ripped or unclear-provenance assets.
- Record every asset in `Docs/ThirdPartyAssets.md` (name, creator, URL, license, date, purpose, changes).
- If an asset cannot be downloaded, report `ASSET RECOMMENDED / NAME / SOURCE / LICENSE / WHY / WHAT THE USER NEEDS TO DO` and continue with primitives.
- Missing art never blocks engineering.
- Sounds: CC0 only. Counting voice and "sobe" calls can be recorded by the user later; use text + simple SFX until then.

---

## 7. Milestones

| # | Milestone | Done when |
|---|---|---|
| M0 | Foundation | Monorepo, strict TS, Vitest, client + server start with `pnpm dev`, Docs files exist |
| M1 | Movement | Greybox mahalle with colliders, third-person character, camera, keyboard + touch controls, runs on phone |
| M2 | Rooms | Create room → shareable link → join with nickname/color, synced movement for up to 10 players, reconnect window, bots join and wander |
| M3 | Saklambaç rules | `packages/rules` state machine fully tested; lobby, counting with dimmed Ebe screen, seeking, round end, timers, HUD |
| M4 | Spotting & sobe | Server-side visibility check, "Gördüm!", race to base, kurtuldu/sobelendi, herkesi kurtarma, Ebe position filtering, bots that hide and seek |
| M5 | Mahalle feel | CC0 assets replace greybox, summer-evening lighting, quick-chat, emotes, SFX, round summary |
| M6 | Launch | Docker + Caddy deploy files, nickname filter, simple landing page, share button, basic analytics (rounds played, room size), load time verified |

**First Playable = M0–M4.** Ugly is fine; a fun round with friends is what matters.

**Future modes (Backlog, do not build yet):** Yakar Top, Kör Ebe, İstop, Mendil Kapmaca, Elim Sende.

---

## 8. How to Work
1. Read this file, `Docs/Roadmap.md` and the latest entry of `Docs/SessionLog.md`.
2. Check git status; never overwrite unrelated work.
3. Start from the earliest incomplete milestone and continue through M6 without stopping.
4. For each milestone: implement in small coherent slices → typecheck → build → test → fix → checkpoint (see Checkpoint rule).
5. If something blocks a milestone (e.g. an asset can't be downloaded), use a placeholder, note it in `Docs/SessionLog.md`, and move on.
6. Never commit `node_modules`, `dist`, caches or `.env`.
7. When all milestones are done (or the session is about to end), write `Docs/FINAL_REPORT.md` **in Turkish** and give the same report in chat:
   - what was built, milestone by milestone
   - how it was tested
   - decisions taken on the user's behalf (summary of `Docs/Decisions.md`)
   - assets used (source + license)
   - known issues and blockers
   - **how to run it locally step by step**, including testing with a phone on the same Wi-Fi
   - how to deploy to a VDS (pointing to `Docs/Deploy.md`)
   - recommended next steps

Do not generate thousands of lines in one go. Ideas outside the milestone go to `Docs/Backlog.md`.
