# Roadmap

| # | Milestone | Status |
|---|---|---|
| M0 | Foundation — monorepo, strict TS, Vitest, `pnpm dev`, Docs | ✅ done |
| M1 | Movement — greybox mahalle, colliders, third-person, keyboard + touch | ✅ done |
| M2 | Rooms — create/share/join, synced movement, reconnect, wandering bots | ✅ done |
| M3 | Saklambaç rules — state machine + tests, lobby, counting, seeking, HUD | ✅ done |
| M4 | Spotting & sobe — visibility, Gördüm!, race, filtering, hide/seek bots | ✅ done — **First Playable** |
| M5 | Mahalle feel — art, lighting, quick-chat, emotes, SFX, summary | ✅ done (procedural art, see ThirdPartyAssets) |
| M6 | Launch — Docker + Caddy, nickname filter, landing, share, analytics | ✅ done |
| M7 | Quality pass — professional look & deeper gameplay (user request after M6) | ✅ done |
| K1 | 101 Okey rules package (`packages/okey`): tiles, okey/gösterge, melds, opening, işleme, okey swap, scoring, taş çalma, bot AI | ✅ done |
| K2 | Kahvehane server room: public lobby, 6 tables, seating, bets/pot, turn timer, bots, private hands, orders, veresiye, steal/catch fines | ✅ done |
| K3 | Kahvehane client: mode select, 3D kahvehane + çaycı, okey board (rack drag & drop, seri/çift diz, open/lay/işle/swap, steal/accuse), menu, drinks | ✅ done |
| Q2 | Quality pass 2: rigged CC0 characters with painted skins, post-processing tiers, bump-mapped surfaces, rebuilt kıraathane (karo, wainscot, windows + sun, çay ocağı, Thonet chairs, new okey tables, regulars), 3D okey table with animated tiles and an insert-and-slide ıstaka | ✅ done |
| N1 | Night session: bug fixes (camera jitter, stuck bodies, black halos, leaving the venue), modern kıraathane with terrace + 22 tables, Üsküdar sahil with Kız Kulesi, market (virtual items incl. sigara with warning), benches/ledge sitting, lobby (salons, quick play, private salons, invite), persistent device wallet + daily bonus, online leaderboard, opt-in voice chat, çaycı path finding, reload resync | ✅ done |

## 2026-10-07 — okey only
- [x] Saklambaç removed at the user's request; the game is the 101 Okey kahvehane (see `Docs/Decisions.md`).
- [x] Home: pick one of the realistic avatars instead of the cartoon look editor.
- [x] ⚙️ Ayarlar: graphics quality (Düşük / Orta / Yüksek / Otomatik with live fps-based tuning), fps counter, volume.
- [ ] Real-device fps check of the quality tiers (mid-range phone, GTX 1050 Ti).
- [x] Real match streams on the kıraathane TV: owner-managed channels (video/HLS on the 3D screen, embeds in a "📺 Maçı izle" overlay), admins pick a channel; simulated derby kept as the second option.
