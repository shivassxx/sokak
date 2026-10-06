# Decisions

Decisions taken autonomously on the user's behalf (see CLAUDE.md autonomy rule).

## M0
- **Pinned versions.** Colyseus 0.16 (`@colyseus/core`, `@colyseus/ws-transport`, `@colyseus/schema` 3, `colyseus.js` 0.16), TypeScript 5.9, Vitest 3.2, Vite 7, React 19, Three.js 0.186. Newer majors (Colyseus 0.18, TS 7, Vitest 5) exist but 0.16/5.x are well-known and stable; upgrading is a backlog item.
- **Workspace packages ship TS source** (`exports: ./src/index.ts`). Vite, Vitest and tsx consume them directly; the server is bundled with esbuild for production so no per-package build step is needed.
- **One root Vitest config** runs every package's tests (`pnpm test`).
- **Dev:** `pnpm dev` runs the server (`tsx watch`, port 2567) and the Vite client (port 5173, `--host` so phones on the same Wi-Fi can connect). In dev the client connects to `ws://<page-host>:2567`; in production the server serves the client and the socket on the same origin.
