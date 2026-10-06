# Third-Party Assets

Every third-party asset (models, textures, sounds, fonts) must be listed here.

## Used in the game

| Name | Creator | URL | License | Date | Purpose | Changes |
|---|---|---|---|---|---|---|
| vehicle-truck-red/yellow/purple/green.glb + Textures/colormap.png (Starter Kit Racing) | Kenney | https://github.com/KenneyNL/Starter-Kit-Racing | CC0 1.0 (assets; repo code MIT) | 2026-10-06 | Parked cars in the mahalle (`apps/client/public/models/`) | none; scaled at runtime to the car colliders |
| walking, jump, land, coin, break .ogg (Starter Kit 3D Platformer) | Kenney | https://github.com/KenneyNL/Starter-Kit-3D-Platformer | CC0 1.0 | 2026-10-06 | Footsteps, jump/land, kurtuldu chime, sobe thud (`public/sfx/`) | none |
| ambience.ogg, toggle.ogg → click.ogg, placement-a.ogg → pop.ogg (Starter Kit City Builder) | Kenney | https://github.com/KenneyNL/Starter-Kit-City-Builder | CC0 1.0 | 2026-10-06 | Street ambience loop, UI click, chat pop | renamed |
| impact.ogg → thud.ogg (Starter Kit Racing) | Kenney | https://github.com/KenneyNL/Starter-Kit-Racing | CC0 1.0 | 2026-10-06 | Pebble landing | renamed, played pitched up |
| characterMedium rigged mesh ("Male", Animated Characters) — via `pmndrs/market-assets` (`files/models/male/model.gltf`, info.json: creator kenney, license CC0) | Kenney | https://github.com/pmndrs/market-assets (original: https://kenney.nl/assets/animated-characters-1) | CC0 1.0 | 2026-10-06 | Every character (players, bots, çaycı, regulars) — `apps/client/public/models/character.glb` | Draco decoded, vertex colors and the embedded skin texture removed (skins are painted per look at runtime by `skinPainter.ts`); no animations in the file — posed procedurally |
| Baloo 2 (weights 600, 800) via `@fontsource/baloo-2` | Ek Type | https://fonts.google.com/specimen/Baloo+2 | SIL Open Font License 1.1 | 2026-10-06 | UI font (self-hosted, Turkish glyphs) | none |

Everything else is generated in code by this project:

- **Models:** buildings (plaster, shutters, flower boxes, balconies, doors, roofs), broken sedan, dolmuş, crates, çöp konteynerleri, trees, bushes, slide, tea garden, lamps, pigeons, clouds, skyline — `apps/client/src/game/world.ts`; surface detail (brick, plaster, paving, asphalt, grass, wood) from a world-space shader in `materials.ts`; hair pieces, hats, glasses and props on the rigged character in `character.ts`; face, hairline and outfit textures painted on a canvas in `skinPainter.ts`; the kıraathane (cement-tile floor, çini, lace curtains, street backdrop, bentwood chairs, okey tables with ıstakas, samovar, çaydanlık, tavla, clock, TV) in `kahveScene.ts` / `kahveProps.ts`; okey tile faces in `okeyTiles.ts`.
- **Signs** ("EBE DUVARI", "BAKKAL", "ÇAY OCAĞI", "DOLMUŞ") are drawn on a canvas at runtime with the system font.
- **Sounds** are synthesized with WebAudio (`apps/client/src/game/audio.ts`). Counting numbers and "Önüm arkam sağım solum sobe…" use the browser's own Turkish speech voice if the device has one (nothing is downloaded).

## Recommended assets (could not be downloaded in the dev environment)

kenney.nl, quaternius.com and polyhaven.com are blocked in the dev container (Kenney's GitHub starter kits are reachable and were used above). These CC0 packs would still be good upgrades:

| ASSET RECOMMENDED | NAME | SOURCE | LICENSE | WHY | WHAT THE USER NEEDS TO DO |
|---|---|---|---|---|---|
| 1 | City Kit (Suburban) | https://kenney.nl/assets/city-kit-suburban | CC0 | Low-poly houses/fences/trees matching the style | Download the GLB files, put the needed ones in `assets/models/`, list them here; swap the matching builders in `world.ts` for a GLTF loader (keep colliders as they are). |
| 2 | Car Kit | https://kenney.nl/assets/car-kit | CC0 | Nicer parked cars / minibus / old sedan | Same as above, replace `car()` in `world.ts`. |
| 3 | Animated Characters (animation files) | https://kenney.nl/assets/animated-characters-1 | CC0 | The mesh is in use; Kenney's idle/run/jump clips would replace the procedural posing | Download the pack's animation FBX/GLB, convert to GLB and play the clips with an `AnimationMixer` in `character.ts`. |
| 4 | Interface Sounds + Impact Sounds | https://kenney.nl/assets/interface-sounds | CC0 | Real recorded clicks / whistles | Put OGG/MP3 files in `apps/client/public/sfx/`, play them from `audio.ts`. |
| 5 | Voice lines | (record yourself) | own | Real kid voices for counting and "sobe" | Record "bir… otuz", "Önüm arkam sağım solum sobe, saklanmayan ebe!", "Sobe!" and add them to `public/sfx/`. |

Keep the total download under 5 MB (CLAUDE.md performance budget).
