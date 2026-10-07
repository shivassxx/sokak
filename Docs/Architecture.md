# Architecture

The game is 101 Okey in an Üsküdar kıraathane (Saklambaç was removed on 2026-10-07).

```
apps/client     Vite + Three.js renderer + React overlay (home, lobby, okey board, HUD, social)
apps/server     Express + Colyseus 0.16: KahvehaneRoom, wallets, lobby API, analytics,
                serves the client build
packages/shared constants, protocol types, kahvehane layout + colliders, movement physics,
                nickname cleaning + profanity filter
packages/okey   101 Okey rules (pure) + meld search + okey bot
packages/tavla  tavla (Turkish backgammon) rules (pure, injectable rng) + match scoring + heuristic bot
```

## Kahvehane / 101 Okey
- `KahvehaneRoom` (public, `joinOrCreate('kahvehane')`): avatar movement uses the input/snapshot protocol with `KAHVE_WORLD` collisions. Schema: players (look, money, table, seat, held item, fishing, level, missions) and 22 tables (status, bet, hands, seats, totals, pot, turn deadline, JSON public view, last hand/match results).
- One `OkeyGame` per playing table. Hands are private (`hand` message to the owner only); everything else is in the table's JSON view. Bots act on a delay; humans auto-play when the 30 s timer runs out.
- Client: `KahveScreen` (lazy chunk) drives `Game(canvas, buildKahve)`; the okey board is HTML/CSS over the 3D scene (seat camera).
- Salons: every `KahvehaneRoom` is a salon (name from a list of Üsküdar neighbourhoods, up to 60 players, 22 tables). Room metadata `{name, private, playing, waiting, humans, top}` feeds `GET /api/salons` (public salons) and `GET /api/leaders` (richest online players). Join options: `quick` (seat at the best table), `private`, `device` (wallet token).
- Wallets: `WalletStore` (`apps/server/src/wallets.ts`) maps an anonymous device token → balance, last daily bonus, played/won, missions; JSON file (`WALLET_FILE`), delta saves, atomic writes. Weekly leaderboard: each wallet also keeps `week`/`prevWeek` stats (ISO week in Europe/Istanbul, matches, wins, net winnings, last nickname); any game mode reports a finished match with `recordMatch(device, name, { won, net })`; `GET /api/leaders/weekly[?week=last][&device=…]` returns the top 10, the asker's rank and last week's champion (never tokens). Stats older than last week and wallets unseen for 60 days are pruned on load and on every save; the clock is injectable (`new WalletStore(file, { now })`).
- Wallets: `WalletStore` (`apps/server/src/wallets.ts`) maps an anonymous device token → balance, last daily bonus, played/won, missions; JSON file (`WALLET_FILE`), delta saves, atomic writes.
- Tavla: four two-seat tables in the entrance lounge (`TAVLA_TABLES`, `tavlaSeatPosition` in `packages/shared/src/kahve.ts`). Schema `TTable` in `state.tavla` (status, bet, target points, game no., seats, score, pot, turn deadline, JSON `TavlaView`, last game/match); `KPlayer.tavla` is the table index (seat 0 white, 1 black). One `TavlaMatch` per playing table on the server; `KMSG.tavlaSit` / `KMSG.tavla` (`roll`, `move {from, to}` with 24 = bar and 25 = off, `undo`, `end`) and `tavlaEvent` broadcasts; stand / config (`points`) / start / bots / fill reuse the okey table messages, routed by `p.tavla`. Bots step through `botStep()` on a delay; a turn with nothing (more) to play passes by itself (1.8 s, or 6 s after the last move so it can be undone); the 30 s timer auto-plays with `autoTurn()`. Everything in tavla is public, so the whole view is in the schema.
- Tavla client: `game/tavlaBoard.ts` (static table + inlaid board in the world builder; `TavlaPieces`: one InstancedMesh for all checkers, two dice per table with pip textures, tumble on a new roll), `kahveScene.setTavla/tavlaView`, `Game.tavla` (seat camera), `ui/tavla/TavlaBoard.tsx` (SVG board; legal moves computed client-side with the same engine; the server re-validates).
- Outside world: `SHOPS`/`SHOP_ITEMS` (buy → `holding`/`uses` in the schema, `use` broadcasts `used` for the animation), `SIT_SPOTS` (benches, stools, ledge; the server freezes the body while `spot ≥ 0`, the client skips local physics while seated), fishing (server-timed bites).
- Voice: `net/voice.ts` (perfect-negotiation WebRTC mesh, WebAudio gain per peer); the client decides who to connect (same table / within 14 m), the server relays `signal` only between players with `voice = true`.
- `resync`: the client sends it once its message handlers are wired; the server answers with the private hand (messages sent before that, e.g. right after a reconnect, are dropped).
- NPCs: `game/navGrid.ts` (A* over the kahve colliders) plans the çaycı's deliveries.

## Data flow
1. **Client → server:** one `i` (input) message per 50 ms simulation step: `{seq, mx, mz, jump, crouch, yaw}`; plus the kahve messages (`KMSG`: sit, stand, okey actions, orders, buy/use, emotes, preset chat, voice signalling).
2. **Server tick (20 Hz):** apply queued inputs with the shared `stepBody`, run table timers and bots, send snapshots.
3. **Server → client:** the Colyseus schema (delta-compressed), an `s` snapshot per client per tick (server time, last processed input seq, the receiver's exact body for reconciliation, other players `[id, x, y, z, yaw, flags]`), private `hand` messages and table events.

## Client
- `Game` runs the local player with the same fixed-step physics (prediction), keeps unacknowledged inputs and replays them on every snapshot (reconciliation); remote players are interpolated 110 ms in the past.
- `Input` is an action map (keyboard, mouse, touch joystick, on-screen buttons); game code never reads raw keys.
- The 3D bundle is lazy-loaded after the home screen; the world is procedural and merged into a few draw calls per material bucket (`world.ts` Builder, `kahveWorld.ts`, `uskudarProps.ts`, `marketProps.ts`, `cars.ts`, `foliage.ts`).

## Anti-cheat
- The server is authoritative for position, seats, turns, tiles, scores and money; hands are private; inputs are clamped.

## Tests
`pnpm test` runs Vitest across packages: kahvehane physics, nickname/profanity filter, the okey engine, the client rack logic and nav grid, and multiplayer integration tests that start a real server on a random port and drive it with headless network clients (`apps/server/test/netBot.ts`): seating, a full bot match with money conservation, orders, taş çalma, market, benches, ledge, fishing, wallets, resync, missions, lobby, leaderboard, nickname filter, stats.

## Client rendering (quality pass 2)
- `game/character.ts` — rigged character (Kenney CC0 mesh, `public/models/character.glb`); virtual joints → bones each frame; `skinPainter.ts` paints the atlas per look.
- `game/quality.ts` — "Grafik kalitesi": preset (Düşük / Orta / Yüksek / Otomatik, localStorage), `TIERS` (pixel-ratio cap, sun shadows on/off + map size + box size, post passes + MSAA), device guess, `AutoTuner` (1 s fps windows, steps down under 45 fps, up only after 30 s at ≥57 fps and never back to a tier that was slow), fps meter. No three.js import (the home screen uses it). `Game.setQuality()` applies a tier live (renderer pixel ratio, `PostFX.setQuality`, the scene's shadow-casting sun); build-time details (foliage density, hall lamps, strollers, preloaded avatars) follow the tier at load. UI: `ui/Settings.tsx` (⚙️ button + panel portal'd to body, fps counter, volume → `audio.ts` master gain).
- `game/postfx.ts` — EffectComposer chain per tier (RenderPass → GTAO → Bloom → Output → grade), rebuilt live on a tier change.
- `game/kahveScene.ts` + `kahveProps.ts` — kıraathane, regulars, çaycı, and the table tiles: `layoutTable()` produces placements (racks, deck, gösterge, piles, melds) + anchors (deck, piles, meld corners) for the UI; face-up tiles ease to their placements.
- `game/okeyTiles.ts` — `TileField` (one InstancedMesh, per-instance atlas cell).
- `ui/okey/OkeyBoard.tsx` — overlay that projects anchors to screen every frame (hot-spots, name plates) and owns the HTML ıstaka; `ui/okey/rack.ts` — pure rack logic (`moveTile`, `syncRack`, groups, open plan), unit tested in `apps/client/test/rack.test.ts`.

## Staff accounts and admin panel (2026-10-07)
- Accounts exist for staff only; players stay anonymous. `apps/server/src/staff.ts` `StaffStore`: users `{username, role: owner|admin, passwordHash (scrypt$salt$hash), createdAt, createdBy}` in a JSON file (`STAFF_FILE`, atomic write, mode 600; `null` = memory). The owner `shivass` always exists; `SOKAK_OWNER_PASSWORD` is applied at start, otherwise a one-time password is generated and printed once. In-memory sessions (32-byte random tokens, 12 h), login rate limit (5 failures / 10 min per IP and per username → 429), constant-time hash compare, an action log (ring buffer of 200 + `staff-log.jsonl` next to the staff file).
- `apps/server/src/admin.ts` `adminRouter` mounted at `/api/admin` (same-origin, no CORS; `express.json` 4 kb; cookie `sokak_staff` HttpOnly SameSite=Strict, Secure on https / `X-Forwarded-Proto`, or `Authorization: Bearer`). Any staff: `login`, `logout`, `me`, `tv`, `tv/start`, `tv/stop` (the shared `TvChannel`). Owner only: `users` (list/add/delete/password), `salons` (all, incl. private, with players — never device tokens), `salons/:id/kick|close`, `announce` (≤140 chars, profanity-filtered), `wallet/grant` (±100 000, play money), `stats`, `log`. `app.set('trust proxy', 'loopback, linklocal, uniquelocal')` so Caddy's forwarded IP/proto are used.
- Rooms are reached with `matchMaker.remoteRoomCall` on public `KahvehaneRoom` methods `staffInfo`, `staffKick` (removes the player, bans the device from that salon, closes with `STAFF_KICK_CODE`), `staffClose` (saves wallets, `disconnect(STAFF_CLOSE_CODE)`), `staffAnnounce` (`KMSG.announce` broadcast), `staffGrant` (money + `saveWallet` + notice).
- Client: `/admin` is routed in `main.tsx` to the lazy `ui/admin/AdminPanel.tsx` (+ `admin.css`), so the lobby bundle does not grow. It calls `/api/admin/*` on its own origin; in dev Vite proxies `/api/admin` to the server (`SOKAK_SERVER_PORT`, default 2567). `App` turns the staff close codes into a Turkish notice on the start page; `kahve/AnnounceBanner.tsx` shows announcements in the HUD.
## Kıraathane TV (staff-started derbies)
- One `TvChannel` per server (`apps/server/src/tv.ts`); staff start/stop broadcasts (admin panel). Each `KahvehaneRoom` subscribes in `onCreate`, unsubscribes in `onDispose`, and mirrors the current `TvBroadcast` (`{ id, home, away, startedAt, seed, by }`) as JSON in the `tv` state field, so late joiners get it with the first state.
- The match is never streamed: `tvMatchAt(broadcast, nowMs)` in `packages/shared/src/tv.ts` is a pure, seeded simulation (phase, minute/clock, score, events with Turkish commentary, ball and attack state, stats, line-ups). Clients evaluate it at server time (`Game.serverNow()`), so every salon sees the same goal at the same moment. Timing constants: `TV_HALF_MS` (5 min), `TV_BREAK_MS` (1 min), `TV_FULL_SHOW_MS` (1 min), `TV_TOTAL_MS` (12 min); after that the TVs go back to the normal programme.
- Client: `game/tvScreen.ts` draws one 512×288 canvas shared by every TV mesh (the 3 m `MAIN_TV` on the back wall plus the four smaller sets), at 15 fps inside/near the hall and 2 fps elsewhere. `KahveScreen` watches the event list for new goals: NPC regulars celebrate and the çaycı waves (`KahveScene.tvGoal`), `audio.goalRoar` synthesizes the crowd and the "Gooool!", and players who cannot see the screen get a HUD toast.
- Dev only: `SOKAK_DEV_TV=1` starts a derby when the server starts (`SOKAK_DEV_TV_SEED`, `SOKAK_DEV_TV_AT` pick the match and jump into it).

## Başarımlar (achievements)
- Definitions and the pure unlock step (`bumpAchievement`) are in `packages/shared/src/achievements.ts`; the client and server share them.
- `KahvehaneRoom.ach(id, counter)` counts an event for a device player (never bots) → `WalletStore.bumpAch` updates `Wallet.ach` (counters + unlocked ids) and pays new unlocks into the stored balance in one step (idempotent across tabs/salons) → the room mirrors the reward into the session and sends `ach` `{ id, reward }`.
- Read path: `GET /api/achievements?device=` → `{ c, got, total }` for the lobby and the in-game panel (`ui/Achievements.tsx`, lazy in the lobby).
