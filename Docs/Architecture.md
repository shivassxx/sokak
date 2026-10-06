# Architecture

```
apps/client     Vite + Three.js renderer + React overlay (lobby, HUD)
apps/server     Express + Colyseus; SaklambacRoom; serves client build in production
packages/shared constants, map data, colliders, movement, visibility, protocol types
packages/rules  pure Saklambaç state machine (no I/O)
packages/bots   bot brains (server-side bots) + headless network bot client
```

The sections below are extended milestone by milestone.
