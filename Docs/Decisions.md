# Decisions

Decisions taken autonomously on the user's behalf (see CLAUDE.md autonomy rule).

## M0
- **Pinned versions.** Colyseus 0.16 (`@colyseus/core`, `@colyseus/ws-transport`, `@colyseus/schema` 3, `colyseus.js` 0.16), TypeScript 5.9, Vitest 3.2, Vite 7, React 19, Three.js 0.186. Newer majors (Colyseus 0.18, TS 7, Vitest 5) exist but 0.16/5.x are well-known and stable; upgrading is a backlog item.
- **Workspace packages ship TS source** (`exports: ./src/index.ts`). Vite, Vitest and tsx consume them directly; the server is bundled with esbuild for production so no per-package build step is needed.
- **One root Vitest config** runs every package's tests (`pnpm test`).
- **Dev:** `pnpm dev` runs the server (`tsx watch`, port 2567) and the Vite client (port 5173, `--host` so phones on the same Wi-Fi can connect). In dev the client connects to `ws://<page-host>:2567`; in production the server serves the client and the socket on the same origin.

## M1
- **Axis-aligned map only.** Every prop is an AABB so client/server share one cheap collision + raycast routine. Cars face along x or z.
- **Colliders have two flags:** `solid` (blocks movement) and `opaque` (blocks sight). Bushes, tree canopies and laundry sheets are opaque but walk-through → natural hiding spots. Fences and railings are solid but see-through.
- **Movement:** box footprint (r = 0.35 m, h = 1.8 m), step-up 0.5 m (stairs are stacked slabs; you can walk under high steps = "merdiven altı"), jump, crouch (slower, smaller visibility profile). Fixed 50 ms step = one input; identical code on client and server enables prediction + reconciliation.
- **No sprint.** Ebe and hiders have equal speed so the race to base is decided by position, not stamina.
- **Controls:** WASD/arrows, mouse drag to look (double-click = pointer lock), Space jump, C crouch (toggle), E/F "Gördüm!", Tab scoreboard, 1–4 emotes. Touch: dynamic joystick on the left 45 % of the screen, drag-to-look on the right, buttons bottom-right.
- **The 3D bundle is lazy-loaded** (`import('./game/Game')`) so the home screen / lobby shows before Three.js arrives.

## M2
- **Positions are not in the Colyseus schema.** The schema holds only low-frequency data (names, colors, roles, statuses, scores, phase, timer). Positions go out as a per-client `s` message every tick so the server can filter what each client sees (anti-cheat, M4) and include the receiver's own exact body + last processed input for reconciliation. 10 players × ~30 bytes per tick is well within budget.
- **Room ids:** 12 random chars from a 56-symbol alphabet (~70 bits) via `crypto.randomInt`; rooms are private (never matched by `joinOrCreate`).
- **Host** = first human in the room; passes to the next connected human when the host leaves. Only the host can start and add/remove bots. A room with only bots left is emptied (and auto-disposed).
- **Bots** are simulated inside the room (no network), use the same `stepBody`, and are labeled "bot" in the UI and with 🤖 in their name tag.
- **Reconnect:** non-consented leave keeps the slot for 20 s (`allowReconnection`). The client stores `{roomId, reconnectionToken}` in `sessionStorage`, retries automatically on drops and on page reload.
- **Nickname + color** are kept in `sessionStorage` only (no accounts, no persistent personal data). Duplicate names get a number suffix.
- **Vitest runs with `pool: 'threads'`:** Colyseus probes `process.send` (pm2) which breaks Vitest's forks pool.
