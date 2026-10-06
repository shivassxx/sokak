# Third-Party Assets

Every third-party asset (models, textures, sounds, fonts) must be listed here.

## Used in the game

| Name | Creator | URL | License | Date | Purpose | Changes |
|---|---|---|---|---|---|---|
| _(none)_ | | | | | | |

All visuals and sounds are currently generated in code by this project (no external files):

- **Models:** buildings with windows/balconies/AC units, cars, broken sedan, dolmuş minibus, crates, çöp konteynerleri, trees, bushes, slide, tea-garden tables, lamps, laundry sheets, skyline — built from Three.js primitives in `apps/client/src/game/world.ts`; characters in `character.ts`.
- **Signs** ("EBE DUVARI", "BAKKAL", "ÇAY OCAĞI", "DOLMUŞ") are drawn on a canvas at runtime with the system font.
- **Sounds** are synthesized with WebAudio (`apps/client/src/game/audio.ts`). Counting numbers and "Önüm arkam sağım solum sobe…" use the browser's own Turkish speech voice if the device has one (nothing is downloaded).

## Recommended assets (could not be downloaded in the dev environment)

The cloud dev environment blocks kenney.nl, quaternius.com and polyhaven.com, so the game ships with procedural art. These CC0 packs would be good upgrades:

| ASSET RECOMMENDED | NAME | SOURCE | LICENSE | WHY | WHAT THE USER NEEDS TO DO |
|---|---|---|---|---|---|
| 1 | City Kit (Suburban) | https://kenney.nl/assets/city-kit-suburban | CC0 | Low-poly houses/fences/trees matching the style | Download the GLB files, put the needed ones in `assets/models/`, list them here; swap the matching builders in `world.ts` for a GLTF loader (keep colliders as they are). |
| 2 | Car Kit | https://kenney.nl/assets/car-kit | CC0 | Nicer parked cars / minibus / old sedan | Same as above, replace `car()` in `world.ts`. |
| 3 | Ultimate Modular Characters / Animated Characters | https://quaternius.com | CC0 | Animated kid-like characters instead of box characters | Download a GLB with walk/idle animations, load it in `character.ts`. |
| 4 | Interface Sounds + Impact Sounds | https://kenney.nl/assets/interface-sounds | CC0 | Real recorded clicks / whistles | Put OGG/MP3 files in `apps/client/public/sfx/`, play them from `audio.ts`. |
| 5 | Voice lines | (record yourself) | own | Real kid voices for counting and "sobe" | Record "bir… otuz", "Önüm arkam sağım solum sobe, saklanmayan ebe!", "Sobe!" and add them to `public/sfx/`. |

Keep the total download under 5 MB (CLAUDE.md performance budget).
