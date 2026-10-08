# Third-Party Assets

Every third-party asset (models, textures, sounds, fonts) must be listed here.

## Used in the game

| Name | Creator | URL | License | Date | Purpose | Changes |
|---|---|---|---|---|---|---|
| vehicle-truck-red/yellow/purple/green.glb + Textures/colormap.png (Starter Kit Racing) | Kenney | https://github.com/KenneyNL/Starter-Kit-Racing | CC0 1.0 (assets; repo code MIT) | 2026-10-06 | Parked cars in the mahalle (`apps/client/public/models/`) | none; scaled at runtime to the car colliders **Removed 2026-10-07:** replaced by procedural sedans (`cars.ts`) in both maps. |
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


## Added in the night session
| Asset | Creator | Source | License | Date | Used for | Changes |
|---|---|---|---|---|---|---|
| Fabric030 (felt) | ambientCG (Lennart Demes) | ambientcg.com/a/Fabric030 (fetched from a GitHub mirror: pwmarcz/autotable) | CC0 | 2026-10-07 | `public/textures/felt_detail.jpg`: woven detail multiplied into the okey table felt | greyscale, 256 px, JPEG q82 (6 KB) |
| Microsoft Rocketbox Avatar Library — Male_Adult_01, 02, 03, 05, 08, 14; Female_Adult_01, 04, 09 | Microsoft (Mar Gonzalez-Franco et al.) | github.com/microsoft/Microsoft-Rocketbox | MIT (licence text shipped as `public/models/ROCKETBOX_LICENSE.txt`) | 2026-10-07 | `public/models/rb_*.glb`: realistic adult avatars for players and NPCs in the 101 Okey kahvehane | FBX → glTF (FBX2glTF); hi-poly LOD only, animations and facial blendshapes stripped (the procedural rig drives the Biped bones); colour 1024², normal 512², opacity (lashes/hair cards) 256²; meshopt geometry + WebP q72 (0.3–0.46 MB each) |
| Microsoft Rocketbox animation library: m_idle_neutral_01, m_idle_look_around_01, m_walk_neutral_01, m_run_neutral_01, m_sit_table_breathe_01, m_sit_table_gestic_thoughtful, m_sit_chair_idle_neutral_01, m_wave_01, m_gestic_laugh_loud, m_cheer_01, m_claphands_01, m_drink_drinking, m_dancing_neutral | Microsoft (Mar Gonzalez-Franco et al.) | github.com/microsoft/Microsoft-Rocketbox (Assets/Animations) | MIT (same licence file) | 2026-10-08 | `public/models/rb_anims.glb`: motion-captured clips for the realistic avatars (same Bip01 skeleton) | FBX → glTF (FBX2glTF), merged into one skeleton-only GLB, horizontal root motion removed (in place), long clips trimmed to 4–12 s, resampled, meshopt (362 KB, 110 KB gzip) |

Budget: the lobby stays under 300 KB; the whole client under 60 MB (CLAUDE.md, changed 2026-10-08).

## Libraries added for real match streams
| Library | Creator | Source | License | Date | Used for | Changes |
|---|---|---|---|---|---|---|
| hls.js 1.7.3 (light build, `hls.js/light`) | video-dev / hls.js contributors | https://github.com/video-dev/hls.js | Apache-2.0 | 2026-10-07 | Plays owner-added HLS (.m3u8) streams on the kıraathane TV in browsers without native HLS; loaded lazily as its own chunk | none |

## Realism pass (2026-10-08)
All fetched from public GitHub mirrors of the original CC0 libraries (polyhaven.com and ambientcg.com are blocked in the dev container): HHSOLL/DeskteriorOnline, TheMarco/liminal, EliteGamer007/6dof-drone-sim, hwcgames/snald, olaals/datasets-rgb-pose-estimation. File names match the originals.

| Asset | Creator | Original source | License | Date | Used for | Changes |
|---|---|---|---|---|---|---|
| painted_plaster_wall, floor_tiles_04, asphalt_02, wood_floor, brick_floor_003, oak_veneer_01, marble_01, large_sandstone_blocks_01 (textures) | Poly Haven | polyhaven.com/a/<name> | CC0 | 2026-10-08 | `public/textures/surf_albedo.jpg` + `surf_nrm.jpg`: triplanar photo detail for plaster, pavement, asphalt, floor planks, street setts, furniture oak, marble, sandstone | resized to 1024, AO baked into the colour, normal XY + roughness packed into one strip |
| Bricks097 (texture) | ambientCG | ambientcg.com/a/Bricks097 | CC0 | 2026-10-08 | same strips: brick walls | as above |
| comfy_cafe (HDRI) | Poly Haven | polyhaven.com/a/comfy_cafe | CC0 | 2026-10-08 | `public/textures/cafe_env.hdr`: reflections inside the kıraathane | box-filtered from 2k to 512×256 |
| lantern_chandelier_01, Chandelier_02, ceiling_fan, industrial_wall_sconce, mantel_clock_01, brass_pot_01, brass_vase_01, brass_vase_03, ornate_mirror_01, book_encyclopedia_set_01, street_lamp_01 (models) | Poly Haven | polyhaven.com/a/<name> | CC0 | 2026-10-08 | `public/models/props/*.glb`: lanterns over the okey tables, lounge chandeliers, fans, wall sconces, mirrors, shelf decor, the street and sahil lamp posts | Draco removed, some simplified (meshoptimizer), textures WebP 256–512 px, meshopt-compressed |
| potted_plant_01, potted_plant_02, vintage_grandfather_clock_01 (models) | Poly Haven | polyhaven.com/a/<name> (via TheMarco/liminal) | CC0 | 2026-10-08 | `public/models/props/plant_tall.glb`, `plant_big.glb`, `grandfather_clock.glb`: potted plants in the hall and on the terrace, the clock by the counter | simplified to 6–12 % (meshoptimizer), WebP 512 px |
| wasteland_clouds_puresky (HDRI) | Poly Haven | polyhaven.com/a/wasteland_clouds_puresky (via EliteGamer007/6dof-drone-sim) | CC0 | 2026-10-08 | `public/textures/clouds.jpg`: cloud mask (R) and shading (G) for the sky shader | tone-mapped, mask from low saturation, haze near the horizon and its sun faded out |
