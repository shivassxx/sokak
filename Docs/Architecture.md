# Architecture

```
apps/client     Vite + Three.js renderer + React overlay (home, lobby, HUD, social)
apps/server     Express + Colyseus 0.16: SaklambacRoom, analytics, serves the client build
packages/shared constants, protocol types, map + colliders + zones, movement physics,
                visibility (raycast), nickname cleaning + profanity filter
packages/rules  pure Saklambaç state machine (no I/O), fully unit tested
packages/bots   nav grid + A*, bot brains (wander / hide / seek), headless NetBot client
packages/okey   101 Okey rules (pure) + meld search + okey bot
```

## Mode 2: kahvehane / 101 Okey
- `KahvehaneRoom` (public, `joinOrCreate('kahvehane')`): avatar movement uses the same input/snapshot protocol with `KAHVE_WORLD` collisions. Schema: players (look, money, table, seat) and 6 tables (status, bet, hands, seats, totals, pot, turn deadline, JSON public view, last hand/match results).
- One `OkeyGame` per playing table. Hands are private (`hand` message to the owner only); everything else is in the table's JSON view. Bots act on a delay; humans auto-play when the 30 s timer runs out.
- Client: `KahveScreen` (lazy chunk) drives `Game('kahve', buildKahve)`; the okey board is HTML/CSS over the 3D scene (seat camera).
- Salons: every `KahvehaneRoom` is a salon (name from a list of Üsküdar neighbourhoods, up to 60 players, 22 tables). Room metadata `{name, private, playing, waiting, humans, top}` feeds `GET /api/salons` (public salons) and `GET /api/leaders` (richest online players). Join options: `quick` (seat at the best table), `private`, `device` (wallet token).
- Wallets: `WalletStore` (`apps/server/src/wallets.ts`) maps an anonymous device token → balance + last daily bonus, JSON file (`WALLET_FILE`), debounced saves.
- Outside world: `SHOPS`/`SHOP_ITEMS` (buy → `holding`/`uses` in the schema, `use` broadcasts `used` for the animation), `SIT_SPOTS` (benches, stools, ledge; the server freezes the body while `spot ≥ 0`, the client skips local physics while seated).
- Voice: `net/voice.ts` (perfect-negotiation WebRTC mesh, WebAudio gain per peer); the client decides who to connect (same table / within 14 m), the server relays `signal` only between players with `voice = true`.
- `resync`: the client sends it once its message handlers are wired; the server answers with the private hand (messages sent before that, e.g. right after a reconnect, are dropped).
- NPCs: `game/navGrid.ts` (A* over the kahve colliders) plans the çaycı's deliveries.

## Data flow
1. **Client → server:** one `i` (input) message per 50 ms simulation step: `{seq, mx, mz, jump, crouch, yaw}` in world space. Plus `spot`, `emote`, `chat` (preset index), `start`, `addBot`, `removeBot`.
2. **Server tick (20 Hz):** apply queued inputs with the shared `stepBody` (max 3 per tick), run bots, detect base touches (hiders first), update the Ebe's vision, `rules.tick(dt)`, mirror rules into the schema, send snapshots.
3. **Server → client:**
   - Colyseus schema (delta-compressed): phase, timeLeft (s), round, ebeId, hostId, players {name, color, isBot, connected, role, status, score}.
   - `s` snapshot per client per tick: server time, last processed input seq, the receiver's exact body (for reconciliation) and the **filtered** list of other players `[id, x, y, z, yaw, flags]`.
   - `ev` rule events, `summary` at round end, `tp` teleports, `emote`, `chat`.

## Client
- `Game` runs the local player with the same fixed-step physics (prediction), keeps unacknowledged inputs and replays them on every snapshot (reconciliation); remote players are interpolated 110 ms in the past.
- `Input` is an action map (keyboard, mouse, touch joystick, on-screen buttons); game code never reads raw keys.
- The 3D bundle is lazy-loaded after the home screen; the world is procedural and merged into a few draw calls (`world.ts`), lights are faked (emissive + light pools) for phones.

## Anti-cheat
- The server is authoritative for position, roles, timers, spotting, sobe/kurtuldu and scores.
- `isVisibleTo(viewer, target)`: the Ebe gets **no** hider positions during selection and counting and only hiders that pass `canSee` (distance ≤ 34 m + rays against opaque colliders, 250 ms hysteresis) during seeking. Spectators are invisible to everyone.
- "Gördüm!" is validated with the same check (≤ 20 m), refused while the Ebe stands on the base.
- Inputs are clamped; jump/crouch are booleans; at most 8 queued inputs.

## Rules state machine (`packages/rules`)
`lobby → ebeSelection (3 s) → counting (30 s) → seeking (180 s) → roundEnd (10 s) → ebeSelection …` (back to `lobby` if fewer than 3 players). API: `addPlayer`, `removePlayer`, `start`, `tick(dt)`, `spot(id)`, `touchBase(id)`, `toLobby()`, returning `GameEvent[]`.

## Tests
`pnpm test` runs Vitest across packages: physics/visibility/map sanity, nav grid, profanity filter, 26 rules tests, and multiplayer integration tests that start a real server on a random port and drive it with headless `NetBot` clients (join by link, movement sync, reconnect, round flow, Ebe filtering, Gördüm!, race, herkes kurtuldu, bot-only rounds, analytics).

## Client rendering (quality pass 2)
- `game/character.ts` — rigged character (Kenney CC0 mesh, `public/models/character.glb`); virtual joints → bones each frame; `skinPainter.ts` paints the atlas per look.
- `game/postfx.ts` — quality tiers and the EffectComposer chain (RenderPass → GTAO → Bloom → Output → grade).
- `game/kahveScene.ts` + `kahveProps.ts` — kıraathane, regulars, çaycı, and the table tiles: `layoutTable()` produces placements (racks, deck, gösterge, piles, melds) + anchors (deck, piles, meld corners) for the UI; face-up tiles ease to their placements.
- `game/okeyTiles.ts` — `TileField` (one InstancedMesh, per-instance atlas cell).
- `ui/okey/OkeyBoard.tsx` — overlay that projects anchors to screen every frame (hot-spots, name plates) and owns the HTML ıstaka; `ui/okey/rack.ts` — pure rack logic (`moveTile`, `syncRack`, groups, open plan), unit tested in `apps/client/test/rack.test.ts`.
