# SOKAK OYUNLARI — Agent Guide

You are the lead development agent for **SOKAK OYUNLARI** ("Street Games"), an instant-loading, multiplayer 3D browser game. The game is **101 Okey in an Üsküdar kıraathane** — and only that. (Saklambaç, the original first mode, was removed at the user's request on 2026-10-07; its rules and history live in `Docs/Decisions.md` and git.)

You inspect, design, implement, test, debug and document the actual project. The game must stay runnable after every session.

> **Language rule:** Always talk to the user in **Turkish**: questions, progress updates, end-of-session reports and run instructions. Keep code, identifiers, comments, commit messages and `Docs/` files in English. In-game text is Turkish.

> **Autonomy rule:** The user is not available during development and will only review the finished result. **Never stop to ask questions.** When something is ambiguous, choose the most reasonable option that fits this guide, record the decision in `Docs/Decisions.md`, and continue. Work through all milestones M0 → M6 in order without waiting for approval. The only things you must not do on your own are irreversible or account-bound actions (deploying to a real server, buying anything, creating accounts); prepare those and document the steps instead.

> **Budget rule:** Development runs on limited cloud-session credit. Keep diffs focused, avoid unnecessary dependencies, and do not explore, refactor or polish outside the current milestone.

> **Checkpoint rule:** After each milestone: typecheck, build, run tests, fix failures, update `Docs/Roadmap.md` and `Docs/SessionLog.md`, then **commit and push**. If the session ends unexpectedly, the next session must be able to continue from the log.

---

## 1. The Game

**Fantasy:** A summer evening in Üsküdar. You walk into a modern kıraathane by the sea, the çaycı brings tea, and four friends sit down for a hand of 101 Okey. Between hands you step out to the sahil: simit, gulls, Kız Kulesi, the vapur calling at the pier.

**Formula (proven by instant multiplayer browser hits):**
- Click a link → playing within seconds. No download, no account, just a nickname.
- One well-known game, played properly, with friends.
- Social first: salons shared by link, friends play together; bots fill empty seats.
- Works on phone and desktop.

**Pillars:** NOSTALGIA · INSTANT · TOGETHER · FUNNY MOMENTS

**Design test for every feature:** *Does this make an evening at the kıraathane with friends more fun or more shareable?* If not → `Docs/Backlog.md`.

**Not:** real-money gambling (play money only, never purchasable), a battle royale, a shooter, or anything with violence.

---

## 2. 101 Okey Rules

The chosen house rules, the play-money economy, the taş çalma mechanic, orders, levels and missions are recorded in `Docs/Decisions.md` ("Mode 2" and later sections) and implemented in `packages/okey` (pure, unit-tested) and `KahvehaneRoom` (server-authoritative). Change them only deliberately and record the change there.

---

## 3. Child-Safety and Social Rules (Non-Negotiable)

Many players will be young.
- **No free-text chat.** Only preset quick-chat phrases and emotes.
- **Nicknames** are filtered against a profanity list and length-limited; offensive nicknames are replaced with a random one.
- **No accounts and no personal data** in the first version: nickname + look only; the play-money wallet is keyed by an anonymous random device token.
- No voice chat and no cigarettes — except the opt-in voice chat and the cosmetic, warned virtual cigarettes the user explicitly asked for (see `Docs/Decisions.md`). No external links in game.
- Room links are unguessable random IDs.

---

## 4. The World

One compact Üsküdar scene: the modern kıraathane (hall with okey and tavla tables, çay ocağı, terrace), the corner market, the street with parked cars, and the Salacak-style sahil (benches, simitçi, çay bahçesi, fishermen, a stone ledge to sit on, the ferry pier) facing Kız Kulesi and the historic peninsula skyline.

Visual style: warm summer evening, **realistic** (the user asked for realistic models: textured adult avatars, varnished wood, glossy tiles), long soft shadows, lamps glowing. No real brand logos.

---

## 5. Technical Stack

| Area | Choice |
|---|---|
| Language | TypeScript (strict) |
| Repo | pnpm workspaces monorepo |
| 3D client | Three.js + Vite |
| UI | React overlay (lobby, HUD, okey board, quick-chat) |
| Multiplayer | Colyseus + @colyseus/schema, server-authoritative |
| Physics/collision | Simple kinematic movement + box/capsule colliders shared between client and server |
| Tests | Vitest; headless network clients for multiplayer tests |
| Assets | glTF/GLB, CC0 or clearly commercial-friendly (Kenney, Poly Haven, Microsoft Rocketbox MIT) |
| Deploy | Docker Compose + Caddy on a Linux VDS |

### Layout
```
apps/
  client/     Vite + Three.js + React overlay
  server/     Colyseus KahvehaneRoom, wallets, lobby API
packages/
  shared/     types, constants, kahvehane collision data, protocol
  okey/       pure TS 101 Okey engine + bot AI (no I/O, fully unit-tested)
Docs/
  Roadmap.md  Backlog.md  ThirdPartyAssets.md  SessionLog.md  Architecture.md
assets/
```

### Architecture Rules
- **Server is authoritative** for positions, seats, turns, timers, tiles, scores, money and orders. Clients send inputs and intents only.
- **Hidden information:** a player's hand is sent only to that player; the public table view has counts, discards, melds and the gösterge.
- **Okey rules live in `packages/okey`** as a pure engine with unit tests for every rule and edge case.
- **Disconnects:** a reconnect window keeps a player's seat for 20 s; a player who leaves mid-match is replaced by a bot.
- **Input** goes through an action map: keyboard/mouse and on-screen touch joystick + buttons. No logic bound to raw keys.
- **Bots** fill empty seats (clearly labeled as bots).

### Performance Budget
- **Fast lobby, realistic game:** the lobby shows from under 300 KB; the realistic textures and models (up to ~60 MB in all) stream in after it. The user dropped the old 5 MB instant-load rule on 2026-10-08 in favour of realism (see `Docs/Decisions.md`).
- 60 fps on a mid-range phone and on a GTX 1050 Ti laptop/desktop.
- Instanced props, shared materials, one directional light with limited shadow distance, baked/fake ambient light.
- Network: 20 Hz server tick, interpolation on clients, small delta-compressed state.

---

## 6. Assets
- CC0 or clearly commercial-friendly licenses only; never ripped or unclear-provenance assets.
- Record every asset in `Docs/ThirdPartyAssets.md` (name, creator, URL, license, date, purpose, changes).
- If an asset cannot be downloaded, report `ASSET RECOMMENDED / NAME / SOURCE / LICENSE / WHY / WHAT THE USER NEEDS TO DO` and continue with primitives.
- Missing art never blocks engineering.
- Sounds: CC0 only, or synthesized with WebAudio.

---

## 7. Milestones

M0–M6 were built for Saklambaç and then the 101 Okey kahvehane (see `Docs/Roadmap.md`, `Docs/SessionLog.md`, `Docs/FINAL_REPORT.md`). Saklambaç was removed on 2026-10-07; the game is the okey kahvehane only. New work continues from the Roadmap's open items and the user's latest requests.

**Future ideas (Backlog, do not build unless asked):** playable tavla, a vapur ride across, more salons/venues.

---

## 8. How to Work
1. Read this file, `Docs/Roadmap.md` and the latest entry of `Docs/SessionLog.md`.
2. Check git status; never overwrite unrelated work.
3. Start from the earliest open item in `Docs/Roadmap.md` (or the user's latest request) and continue without stopping.
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
