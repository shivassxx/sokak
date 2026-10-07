# Architecture

The game is 101 Okey in an Üsküdar kıraathane (Saklambaç was removed on 2026-10-07).

```
apps/client     Vite + Three.js renderer + React overlay (home, lobby, okey board, HUD, social)
apps/server     Express + Colyseus 0.16: KahvehaneRoom, wallets, lobby API, analytics,
                serves the client build
packages/shared constants, protocol types, kahvehane layout + colliders, movement physics,
                nickname cleaning + profanity filter
packages/okey   101 Okey rules (pure) + meld search + okey bot
```

## Kahvehane / 101 Okey
- `KahvehaneRoom` (public, `joinOrCreate('kahvehane')`): avatar movement uses the input/snapshot protocol with `KAHVE_WORLD` collisions. Schema: players (look, money, table, seat, held item, fishing, level, missions) and 22 tables (status, bet, hands, seats, totals, pot, turn deadline, JSON public view, last hand/match results).
- One `OkeyGame` per playing table. Hands are private (`hand` message to the owner only); everything else is in the table's JSON view. Bots act on a delay; humans auto-play when the 30 s timer runs out.
- Client: `KahveScreen` (lazy chunk) drives `Game(canvas, buildKahve)`; the okey board is HTML/CSS over the 3D scene (seat camera).
- Salons: every `KahvehaneRoom` is a salon (name from a list of Üsküdar neighbourhoods, up to 60 players, 22 tables). Room metadata `{name, private, playing, waiting, humans, top}` feeds `GET /api/salons` (public salons) and `GET /api/leaders` (richest online players). Join options: `quick` (seat at the best table), `private`, `device` (wallet token).
- Wallets: `WalletStore` (`apps/server/src/wallets.ts`) maps an anonymous device token → balance, last daily bonus, played/won, missions; JSON file (`WALLET_FILE`), delta saves, atomic writes. Weekly leaderboard: each wallet also keeps `week`/`prevWeek` stats (ISO week in Europe/Istanbul, matches, wins, net winnings, last nickname); any game mode reports a finished match with `recordMatch(device, name, { won, net })`; `GET /api/leaders/weekly[?week=last][&device=…]` returns the top 10, the asker's rank and last week's champion (never tokens). Stats older than last week and wallets unseen for 60 days are pruned on load and on every save; the clock is injectable (`new WalletStore(file, { now })`).
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
- `game/postfx.ts` — quality tiers and the EffectComposer chain (RenderPass → GTAO → Bloom → Output → grade).
- `game/kahveScene.ts` + `kahveProps.ts` — kıraathane, regulars, çaycı, and the table tiles: `layoutTable()` produces placements (racks, deck, gösterge, piles, melds) + anchors (deck, piles, meld corners) for the UI; face-up tiles ease to their placements.
- `game/okeyTiles.ts` — `TileField` (one InstancedMesh, per-instance atlas cell).
- `ui/okey/OkeyBoard.tsx` — overlay that projects anchors to screen every frame (hot-spots, name plates) and owns the HTML ıstaka; `ui/okey/rack.ts` — pure rack logic (`moveTile`, `syncRack`, groups, open plan), unit tested in `apps/client/test/rack.test.ts`.
