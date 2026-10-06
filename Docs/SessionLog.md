# Session Log

## Session 1 — 2026-10-06
- **M0 done:** pnpm monorepo (apps/client, apps/server, packages/shared|rules|bots), strict TS base config, root Vitest, `pnpm dev` starts Colyseus server (:2567, `/health`) + Vite client (:5173). Docs created.
- **M1 done:** `packages/shared` now has the hand-authored mahalle map (`map.ts`, ~150 AABB objects, zones, hiding spots, spawn ring), deterministic kinematic movement (`physics.ts`: step-up stairs, jumping, crouch, grid broadphase) and line-of-sight (`visibility.ts`). Client: Three.js greybox (instanced props per kind), procedural low-poly kid character with walk/crouch/emote animation, third-person camera with wall collision, action-map input (WASD/arrows, mouse drag/pointer-lock, touch joystick + buttons), fixed 20 Hz local sim with render interpolation. Offline "Mahallede dolaş" sandbox. Verified with Playwright screenshots (desktop + 390×844 touch). 14 tests.
