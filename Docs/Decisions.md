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

## M3
- **Phase timings:** Ebe selection 3 s (shows who is Ebe), counting 30 s, seeking 3 min, round-end break 10 s. `SOKAK_TIMERS=fast` (6 s / 45 s / 8 s) exists only for local testing; timings cannot be set by clients.
- **Catch rule:** when the Ebe is inside the base circle every currently spotted hider is sobelendi. Base touches are evaluated every tick, hiders before the Ebe, so a same-tick tie goes to the hider.
- **Herkesi kurtarma** triggers when the last hider still in play (hiding or spotted) reaches the base while at least one player is caught. Everyone caught becomes safe, the saver gets a bonus, and the same Ebe counts next round.
- **Next Ebe:** first caught player of the round; the same Ebe if nobody was caught or after "herkes kurtuldu"; random if the Ebe left or the chosen player left during the break.
- **Scoring:** reach base +3, survive until timeout +2, save everyone +5, Ebe +2 per sobe. Per room only.
- **Summary:** "best hiding spot" = hider unseen the longest, labeled with the named zone where they spent most of their hidden time; "longest survivor" = hider not caught for the longest time.
- **Mid-round joiners** are spectators until the next round (they can walk around but, from M4 on, are invisible to everyone else).
- **Too few players** (< 3 incl. bots) at the end of a break → back to the lobby.

## M4
- **Ranges:** the Ebe receives hider positions up to 34 m when in sight; "Gördüm!" works up to 20 m. Within 1.8 m a hider is always seen (no hiding inside a bush while the Ebe stands in it).
- **No aiming for "Gördüm!":** the server picks the nearest valid hider. One big button is far easier on phones and the server check stays authoritative.
- **"Gördüm!" is refused while the Ebe stands on the base circle.** Otherwise a camping Ebe could spot and catch in the same instant; leaving the base and racing back is the fun part of the real game.
- **Crouching** shrinks the visibility profile (rays to 0.85 m and 0.45 m instead of 1.55/1.0/0.4 m) and halves speed — low walls, cars and bushes become real cover.
- **Hysteresis:** once seen, a hider stays visible to the Ebe for 250 ms to avoid flicker at corners.
- **Bots only use information a player could have:** the Ebe bot sees exactly what the Ebe filter allows; hider bots know where the Ebe is only when they can see it. Bot skill varies (0.6–1.0) so humans can win.

## M5
- **Procedural art instead of downloaded models.** kenney.nl / quaternius.com / polyhaven.com are unreachable from the dev container. Rather than block, every prop is generated from primitives that exactly fill its collider (so visuals can never disagree with collision/visibility), merged by material into a few meshes. This also keeps the download tiny. Recommended CC0 packs are listed in `Docs/ThirdPartyAssets.md`.
- **Streetlights "turning on"** are faked with emissive bulbs, lit windows and additive light pools on the ground (no real point lights → cheap on phones). The dusk value follows round progress: lobby = golden hour, end of seeking = blue hour.
- **Sounds are synthesized** (WebAudio). Turkish voice lines use the device's speech synthesizer only if a Turkish voice exists; otherwise text + SFX only.
- **Quick-chat** stays preset-only (6 phrases from CLAUDE.md + "Hadi ama!"). Chat 1 per 1.2 s, emotes 1 per 0.7 s per player.
- **Mute preference** is stored in `localStorage` (a device setting, not personal data).

## M6
- **Nickname filter** is a small built-in list (no dependency). Strong roots are matched anywhere (even "o.r.o.s.p.u"), short words only as whole words to avoid false positives on common names. Offensive → replaced silently with a random "Adjective Animal" nickname.
- **Analytics** = aggregate counters only, no personal data, no third-party service. `/stats` is public unless `STATS_TOKEN` is set (recommended in production; `.env.example` sets one).
- **Single container** serves the client and the game socket; Caddy only terminates TLS. Simplest possible VDS setup.
- **`pnpm start` uses a `--prod` flag** instead of `NODE_ENV=…` so it also works in Windows shells.
- **Actual deployment is not done** (account-bound: needs a VDS + domain); steps are in `Docs/Deploy.md`.

## M7 — quality pass
- **Characters stay procedural.** The only animated CC0 character reachable (Kenney "Mini Arena" soldier with a helmet) does not fit a children's neighborhood game, so a new, much more detailed chibi kid was built in code (full control over outfits, hats, hair, skin tones; no download).
- **Kenney GitHub starter kits are reachable** (kenney.nl is not): their CC0 pickup trucks and sounds are used. Licenses recorded in ThirdPartyAssets.md.
- **Surface detail via shader, not textures:** a world-space pattern shader keeps the merged-mesh approach (few draw calls) and adds no download.
- **Sprint:** 7.4 m/s vs 5.0 walk, ~3.6 s of stamina, exhausted until 35 % regained. Deterministic in shared physics so prediction still matches the server.
- **Information fairness:** the Ebe only ever gets *directions* (with jitter) for unseen footsteps and pebbles, never positions; hiders only get a 0..1 "Ebe nearness". Crouching is silent.
- **Containers:** one hider per container; invisible to everyone while inside; the Ebe's "Gördüm!" within 1.8 m of the container opens the lid (hider pops out spotted). Hiders can't move inside, and can leave any time.
- **Pebbles:** 12 s cooldown, land at the first obstacle or 11 m ahead; everyone sees the landing, nobody sees the thrower.
- **Vertical speed of remotes is not sent**, so their "airborne" pose is inferred from height changes.

## Mode 2 — 101 Okey in the kahvehane (user request)
- **Scope:** the user asked for 101 Okey as the second game, set in a kahvehane that everybody can enter; friends sit at tables together, winnings buy çay/oralet etc., and tile stealing ("taş çalma") as a fun mechanic. Built as `packages/okey` (pure rules + bot AI, unit tested), `KahvehaneRoom` (public room), kahvehane 3D scene and an HTML okey board.
- **Play money only.** Everyone starts each session with 1.000 ₺ of *virtual* money; nothing can be bought or cashed out, no accounts, nothing is persisted. "Veresiye" gives 200 ₺ to a broke player once every 5 minutes. Child-safety rules stay: no free text (okey-specific preset phrases), nickname filter.
- **Public lobby:** `joinOrCreate('kahvehane')` (max 40 per kahvehane); the invite link `?kahve=<roomId>` puts friends in the same kahvehane. Six tables of 4 seats; empty seats can be filled with bots by the table host.
- **Rules chosen (house rules vary in Turkey):**
  - 106 tiles, gösterge → okey = same colour, next number (13 → 1); 2 sahte okey play as the okey's face; real okeys are wild.
  - Dealer gets 22 tiles and starts by discarding; others 21; 20 left in the deck. Turn passes to the right (seat+1); you may take the top discard of your left player only if you lay it on the table the same turn (otherwise put it back; on timeout the unused tile costs 101).
  - Opening: series melds (runs of one colour, 1 may follow 13; sets of 3–4 colours) worth ≥ 101, or ≥ 5 pairs. After opening: lay more melds (pairs only for pair-openers), işle onto any meld, swap a table okey for the real tile.
  - Scoring per hand (lower is better): finisher −101; others: not opened +202, opened = remaining tile values (okey = 101, pair-openers ×2). Finishing with the okey or "elden" (open and finish in the same turn) doubles everything. Discarding a tile that could be işlenmiş costs +101 (opened players only). Deck running out ends the hand without a finisher.
  - Ace after 13 counts 1 point. No rising opening threshold, no partner play (backlog).
- **Match:** 1/3/5 hands; bet 0/10/50/100/250 ₺ per player into the pot; lowest total wins the pot (split on ties). Turn timer 30 s, then auto-play.
- **Taş çalma (house mechanic):** once per hand, during your turn, swap one of your tiles with the top discard of the player opposite or on your right. Each opponent has a 55 % chance of a private "elleri bir garip" hint and the changed pile is visible to everyone. "Hile var!" within 6 s catches the thief: theft reverted, +101 penalty, 50 ₺ to the catcher. A wrong "Hile var!" costs 20 ₺. Bots occasionally steal and sometimes catch.
- **Orders:** menu (çay 5, oralet 5, Türk kahvesi 12, gazoz 10, ayran 8, simit 7, kaşarlı tost 15 ₺) for yourself, a player or your whole table; the çaycı walks the tray to the table; drinks show as badges at the table.
- **Hidden information:** hands are sent only to their owner; the table view in the schema contains counts, discards, melds and the gösterge only.

## Quality pass 2 — characters, graphics, kıraathane, okey table (user request)
- **Characters use a real rigged CC0 mesh.** Kenney's "Animated Characters" mesh was found in the `pmndrs/market-assets` GitHub repo (CC0, Kenney credited) — GitHub is reachable while kenney.nl is not. The file has a skeleton but no clips, so the existing procedural animation now drives a small virtual joint hierarchy that is mapped onto the bones every frame. The embedded skin texture was dropped; faces, hairlines and outfits are painted on a 512² canvas per look (cached), so the Look customisation (colour, hair, hat, skin) still works and nothing new goes over the wire. Kids use a 0.72 scale and a 1.1× head; the kahvehane uses adult proportions (0.8) and NPC extras (moustache, grey/bald, waistcoat, glasses, tespih).
- **Rendering tiers:** `high` (desktop default) = MSAA + GTAO + bloom + colour grade/vignette; `medium` drops AO; `low` (touch devices) renders directly. The tier steps down automatically when frames stay slow; `?q=low|medium|high` overrides. Shader bump mapping is derived from the same analytic patterns (no textures).
- **Kıraathane look:** 1900s Istanbul-style kıraathane — cement-tile floor (karo), walnut wainscot under sage plaster, Thonet-style bentwood chairs, çini panel behind the ocak, lace café curtains, the evening sun coming through real window openings (the south wall casts shadows), a painted street outside. Regular NPCs (tavla players, a newspaper reader, a dozer, a tea drinker) are decoration only.
- **The okey board is the 3D table.** All tiles are real instanced 3D tiles (one draw call for the whole hall, faces from a canvas atlas): racks with hidden tiles, deck stacks, gösterge, discard piles at each player's right-hand corner, melds in each player's zone. Face-up tiles are laid out in the viewer's frame so numbers read upright; other tables use the south seat as reference. The seated camera is solved so the table sits right above the on-screen ıstaka. Only the player's own rack is HTML (crisp, accessible drag & drop).
- **Rack arranging:** dropping a tile on an occupied slot inserts it and slides the neighbours towards the nearest free slot of that row (like a real ıstaka); a full row swaps. Tap a tile, then tap an empty slot to move without dragging. Drag tracking runs on window pointer events (element capture is lost when tiles re-flow). Rows are 15 slots. A new hand is auto-arranged once ("Seri diz").
- **Less confusing UI:** one contextual instruction line, pulsing hot-spots exactly on the deck / left pile / own pile, per-progress bar ("Per: 87/101"), valid groups outlined green on the rack, the "Elini aç" button only when it would succeed, rare actions (taş çal, geri koy, deste bitti, kalk) in a ⋯ menu, "Hile var!" pops up only after a suspicious-hands hint, a "Nasıl oynanır?" panel.

## Night session — Üsküdar kıraathane and online features (user request, 2026-10-06 night)
- **Bugs reported by the user:** camera jitter while walking (horizontal follow is now exact, only height is smoothed; time-based lerps), bodies stuck in colliders (shared `stepBody` depenetrates along the shallowest axis before sweeping), quick-chat bubbles turning the surroundings black (GTAO halo: bubbles/labels are excluded from AO), walking out of the venue (closed map edges, invisible sea wall, door gaps re-checked). The kahve camera now treats thin walls, the glass storefront and the door header as occluders.
- **Venue:** a *modern* kıraathane as asked (concrete-tile floor, brick wall, oak + black steel, pendant lamps) with 18 hall tables and a 4-table glass-railed terrace (22 tables), still with the çay ocağı and tavla corner. Max 60 players per salon.
- **"Make our small map exactly like Üsküdar":** read as the okey world outside the kıraathane (the user talked about leaving the kıraathane and seeing the sahil). Layout: kıraathane → terrace → street with parked cars → Salacak-style sahil promenade (plane trees, benches, simitçi, çay bahçesi with stools, fishermen, a low stone ledge to sit on) → the sea with Kız Kulesi, a passing vapur, gulls, and the historic peninsula skyline (Ayasofya, Sultanahmet, Topkapı, Süleymaniye, Galata) exaggerated in size so it reads at distance. Üsküdar houses and a hill mosque behind. The Saklambaç mahalle was left unchanged.
- **Market and cigarettes (deviation from the child-safety spirit, explicitly requested):** the bakkal sells virtual items (sigara, su, gazoz, çekirdek, çikolata, dondurma, gazete; the simitçi sells simit/çay/su). Cigarettes are play-money, purely cosmetic (smoke puff animation), carry an on-screen health warning ("Sigara içmek sağlığa zararlıdır. Sadece oyun içi, sanal bir eşyadır.") and give no gameplay advantage. Kept because the user asked for it for an adult kahvehane setting; flagged here so it can be removed with one line in `SHOP_ITEMS` if the audience turns out to be young.
- **Voice chat (deviation from "no voice chat", explicitly requested):** strictly opt-in (off by default, needs a click and microphone permission; listen-only without a mic), peer-to-peer WebRTC so no audio passes through or is stored on the server; the server relays signalling only between two players who both opted in. Groups: the four players of an okey table, otherwise players standing within ~14 m (kept until 18 m; volume falls off with distance). Every player can be muted individually; own mic mute; speaking indicators. Public STUN only; a TURN relay is an account/server task documented in Deploy.md.
- **Lobby system:** `GET /api/salons` lists public salons (named after Üsküdar neighbourhoods) with players/playing/waiting; "Hızlı oyna" seats you at the best table (people already waiting first); "Yeni salon aç" with an optional private flag (hidden from the list, link only — the in-game "Davet et" button shares it); in-salon table list with one-click seating; "Botlarla hemen başla" fills empty seats and deals.
- **Persistent play money without accounts:** an anonymous random device token (localStorage) keys a server-side JSON wallet (balance + last bonus time only; pruned after 60 days). Daily bonus 250 ₺ on the first visit of the day (20 h window). Still no names, no personal data.
- **Levels:** `levelOf(played, won) = 1 + ⌊√((10·played + 25·won) / 40)⌋` with Turkish titles (Çaylak … Efsane). Only finished matches with people count (bots keep no record); stored next to the device wallet; `GET /api/wallet?device=` lets the lobby show the player's own balance/level (the token is the only key).
- **Leaderboard:** online-only — each public salon publishes its five richest present players in room metadata and `GET /api/leaders` merges them. No historical ranking is stored (would need persisting nicknames).
- **NPC paths:** the çaycı plans an A* path on a 0.5 m grid over the kahve colliders (cached, string-pulled) so deliveries to the market, street or sahil never cut through walls.
- **Sahil activities:** feeding the gulls (a simit at the sea → Q throws a piece, the nearest gull dives for it; client-side visual triggered by the normal `used` broadcast) and fishing (rod from the bakkal, 30 ₺, 8 casts). Fishing is server-timed: cast only at the sea, a bite after 3–9 s, 1.7 s to pull, pulling early or late loses the cast, walking > 1.2 m reels in; catches are weighted (istavrit 45, çinekop 25, lüfer 15, palamut 10, an old shoe 5 for the laughs) and announced to the salon. Fish give no money, so fishing can't be farmed against the okey economy.
- **Spectating:** client-only — the public table view is already in the schema, so "İzle" just moves the camera to an empty corner of a running table (tiles oriented for that side, name tags hidden). Leaving: move, E, or the match ends.
- **Göstergeyi göster (added in the night session):** the common 101 house rule — on your own first turn (before your first discard), holding the twin of the gösterge, you may show it once for −101 (recorded as a negative penalty, so it is part of the hand score). Bots always show it.
- **Reload mid-match:** private messages sent before the UI's handlers exist are dropped, so the client sends `resync` once wired and the server re-sends the hand.

## Realism pass (user request: "make all models realistic", 2026-10-07 early morning)
- **Asset search:** the asset sites (kenney.nl, polyhaven.com, ambientcg.com, sketchfab, quaternius) are blocked from the build sandbox, only GitHub is reachable, so candidates were taken from GitHub repos with clear licences. Characters: Microsoft Rocketbox (MIT, 115 rigged, textured, realistic avatars made for research/VR) won over Mixamo (account + Adobe terms, no redistribution of raw files), MakeHuman exports (CC0 but needs the desktop app) and ReadyPlayerMe (service terms, account). MIT allows commercial use with the licence text shipped next to the files.
- **Characters:** only the kahvehane (adult world) uses the realistic avatars; Saklambaç keeps the painted Kenney children (cartoon kids fit the playful mode and stay tiny on phones). Nine avatars (6 men, 3 women) in everyday clothes: the player's avatar is picked from their look hash, so it stays the same across sessions and is the same on every client that loaded the same set. NPC regulars, the çaycı, the bakkal and the simitçi get fixed avatars. Phones (`low` quality) load the four-avatar subset; everyone else loads all nine (≈3.5 MB, only after choosing 101 Okey — the lobby still needs 137 KB). The same procedural animation drives the Biped bones; props are held in the palm, kept upright and the fingers curl around them.
- **Budget:** the 5 MB check now passes again (4.48 MB gzip for everything in `dist`) after dropping the unused devanagari font subsets and recompressing the avatars (WebP q72, 256² lash/hair opacity maps).
- **Kız Kulesi:** rebuilt from photos of the tower after its 2021–23 restoration (stone quay, two-storey stone building, square + octagonal tower, gallery, glazed lantern, lead ogee dome, gilded alem, flag). Procedural geometry with the world-space stone shader instead of a downloaded model: the free models found were either non-commercial (Sketchfab CC-BY-NC) or of unclear provenance.
- **Okey set:** rounded glossy cream tiles with engraved numbers (bump from a mask atlas), clearcoated solid-wood grain for tables/ıstakas/chairs, woven felt (ambientCG CC0), and the on-screen ıstaka/tiles drawn with real thickness, bevel and wood grain.
