# Architecture

```
apps/client     Vite + Three.js renderer + React overlay (home, lobby, HUD, social)
apps/server     Express + Colyseus 0.16: SaklambacRoom, analytics, serves the client build
packages/shared constants, protocol types, map + colliders + zones, movement physics,
                visibility (raycast), nickname cleaning + profanity filter
packages/rules  pure Saklambaç state machine (no I/O), fully unit tested
packages/bots   nav grid + A*, bot brains (wander / hide / seek), headless NetBot client
```

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
