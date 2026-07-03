---
title: "The Truffle Patch — the single-player dig minigame (research + spec)"
type: memo
date: 2026-07-03
tags: [mud-wars, great-hunger, minigame, truffle-dig, season-2, design, research]
status: draft
---

# The Truffle Patch — the dig minigame

Founder direction (2026-07-03): *"Is there some gameplay type thing we can take from an old Flash game, where digging up truffles? Not multiplayer — single-player, and additive [each member's solo digs sum for the clan]. Keep it chill."* Fiction locked in [[mudwar-hunger-arc-cadence-2026-07]]: the Hunger buries truffles, gorges at his trough every 8h — distracted — and you dig while he feeds.

## 1. Research — digging mechanics, evaluated against "chill, 15–45s, one-hand, no hard fail, additive"

| Game | Core loop | Steal | Drop | Fit |
|---|---|---|---|---|
| **Pokémon Sinnoh Underground mining** (DS/BDSP) | Battleship-style hidden grid in a rock wall; pick (small, precise) vs hammer (big, cracks the wall faster); 2–4 buried multi-tile items; iron blocks as inert obstacles; wall collapses on a hit budget — you keep what you dug | The whole skeleton: hidden layout, **two-tool tension**, multi-tile buried shapes, keep-what-you-found ending | The collapse as a *fail* (ours ends gracefully — see §2); the daily radar hunt | ★★★★★ |
| **Minecraft archaeology brush** (2023, but the purest form of the gesture) | Hold-brush a suspicious block ~5s; the artifact **gradually emerges** as you brush | The rub-to-reveal texture: item silhouettes emerging stroke by stroke | Single-block scope (no board) | ★★★★★ |
| **Animal Crossing fossils** | 4 star-cracks/day, shovel always succeeds, identify later | The no-fail spirit + the daily-marks cadence (ours: 3 windows/day) | No interaction depth at all | ★★★★ |
| **Motherload** (Flash) | Dig-sell-upgrade; fuel = session budget; deeper = richer | **Deeper-richer escalation across the war week**; fuel-as-session-budget → our stir meter | The whole upgrade meta-economy (violates cap-and-flatten) | ★★★ |
| **Treasure Madness** (Facebook/Flash) | Energy-gated grid digging across island maps; usually nothing, sometimes treasure | Map-across-days progression flavor | "Usually nothing" — our sessions must ALWAYS pay; energy gates | ★★ |
| **Gold Miner** (Flash) | Timing a swinging claw; 60s money quota | The junk-vs-treasure comedy (worthless boot vs golden truffle) | Timing pressure + quota fail — the opposite of chill | ★★ |
| **Diamond Digger Saga** (King) | Tap-match-3 clears dirt, water flows down | Nothing structural — different genre | — | ★ |

**The recommended hybrid: a Pokémon-Underground board played with a Minecraft-brush gesture and an Animal-Crossing heart.** Hidden truffle shapes in a small mud grid, two chunky tools, rub-to-reveal strokes — and the collapse meter inverted from a threat into a graceful, cozy session-ender that never takes anything away.

Sources: [Bulbapedia — Underground](https://bulbapedia.bulbagarden.net/wiki/Underground) · [Game8 — BDSP digging rules](https://game8.co/games/Pokemon-Brilliant-Diamond-Shining-Pearl/archives/346280) · [Minecraft wiki — Archaeology](https://minecraft.wiki/w/Archaeology) · [Nookipedia — Shovel/fossils](https://nookipedia.com/wiki/Shovel) · [Motherload review](https://jayisgames.com/review/motherload.php) · [Treasure Madness wiki](https://treasuremadness.fandom.com/wiki/Treasure_Madness_Wiki) · [Gold Miner review](https://jayisgames.com/review/gold-miner.php) · [Diamond Digger Saga guide](https://www.withoutthesarcasm.com/posts/beginners-guide-diamond-digger-saga/)

## 2. The spec — "The Truffle Patch" (a session = "a Rooting")

**Entry:** the war screen's feeding strip shows *"He's gorging — the patch is soft. (2h 10m left in this feeding)"*. Tap it → the Truffle Patch card opens. One Rooting per member per 8h window (the heartbeat, unchanged).

**The board.** A **6×5 grid** of mud tiles, each 1–3 layers deep (three mud tints). Buried, server-seeded per player per window:
- **2 truffle clusters** (blob shapes of 2–3 tiles, Pokémon-style — a silhouette starts peeking through as its tiles thin)
- **0–1 golden shimmer spot** (a mote pocket — pure drain-meter sparkle + flavor)
- **2–3 stones** (inert, Pokémon-iron style: dull thunk, nothing lost)
- **1 cozy junk slot** (his discarded snack wrappers, a lone old boot — worth nothing but a Patrick-Hand giggle line; Gold Miner's comedy without its punishment)

**The verbs (both chill, no timing):**
- **Rub** — scratch back and forth on a tile (PanResponder: ≥2 direction reversals inside the tile = one rub). Clears 1 layer there + a half-layer splash on orthogonal neighbors. Quiet: **+1 stir**.
- **Snout-shove** — press-hold ~400ms, release. A big scoop: 2 layers in a plus-shape. Loud: **+3 stir**. (The pick/hammer tension, gestured.)

**The stir meter — the collapse, made cozy.** As you dig, the Hunger's gorging slows: a small vignette of him (existing gloat→idle sprite frames) stirs as the meter fills (budget **20 stir** ≈ 14–20 actions ≈ 30–45s). At full stir he lifts his snout and blinks around — the session **ends gracefully between actions, never mid-gesture**: every find already uncovered auto-pops into your pouch. *"He stirred — you trotted off with your armful."* Nothing is ever lost, and the board is tuned so an unhurried session uncovers both truffles (a sloppy all-shove session might get one — soft skill, no fail).

**Scoring — same caps, better delivery.** The minigame REPLACES the flat dig numbers as the delivery of the *same* capped values (it does NOT raise the war ceiling):
- 1st truffle: **+1 war mud, +1 Golden Truffle** (currency)
- 2nd truffle: **+1 war mud**
- Golden echo (2+ crewmates rooted in the same window — still async, purely additive, no co-play): your best truffle gilds retroactively → **+1 bonus Golden Truffle**
- Mote pocket: +drain-meter sparkle (season meter only, no mud)
- Hard caps unchanged: ≤2 mud/window, ≤6 mud/day from digging; skill loop cap (21/day) untouched. Rewards-spec dig source reconciles 1:1 ([[mudwar-rewards-spec-2026-07]]).

**Anti-cheat wire.** Layout seed = `hashtext(war_id || ':' || window_index || ':' || user_id)` (per-player boards, server-reproducible — the shipped chart pattern, plus the user term since boards are personal). Open: `open_rooting(war_id)` stamps the window row and returns the seed. Submit: client sends only the **find-id enum list + action count**; the server regenerates the layout from the seed, checks claimed finds exist on that board and actions ≤ stir budget, then mints. Exploit ceiling = a perfect session, which the tiny caps make barely better than a casual one — cap-and-flatten does the real work, same philosophy as the rhythm war's bands-only wire.

**Escalation across the week (flavor-first, values flat):** Tend days = shallow teaching boards (1–2 layers). Hold days = full depth, +1 stone, hungerlings scurry across cosmetically. Day 7 = **"His Personal Stash"** — richer art, one guaranteed golden shimmer, and the week's cozy-junk slot replaced by a dig-stamp toward dupe insurance. Mud values never inflate late-week (inflation would break the fold's per-capita fairness).

**The additive clan view:** every Rooting's mud feeds the existing per-capita/rope/fort surfaces unchanged — the Patch is single-player; the clan sees it as hoofprint pips + fort growth. (Clan-vs-clan progress viewing is adjacent scope, handled separately.)

## 3. Integration levels (founder pick)

| | What the dig is | Effort delta vs flat-dig H1/H2 | Risk |
|---|---|---|---|
| **L1 — heartbeat only (recommended)** | The Patch IS the 8h Dig; Slop Toss (Tend) + rhythm runs (Hold) stay the skill loop | **+3.0d** (board RPC 1.5 + board component/gestures/anims 3.5 + content 0.5, replacing the 2.5d flat version) | Low — validated war spine untouched |
| **L2 — also replaces Slop Toss** | Tend-phase throws become Roootings (budget remapped onto the 21/day cap) | +2.0d more (throw_mud carry rewire — same carry-latest-def hazard as Bog Weather M1) | Medium — discards shipped, art-complete Slop Toss; but "dig by day, sing by night" is coherent |
| **L3 — the only loop** | Rhythm stack shelved; dig becomes the war | Not a delta — a redesign (new fold + re-sim, ≥2 weeks) | High — discards the Blotto deploy layer, the co-defend concentration fold, and the Monte-Carlo-validated balance |

**Recommendation: L1 now.** It delivers exactly the founder ask — a chill single-player Flash-game dig that sums additively into the clan war — without touching the validated spine. Instrument dig-vs-toss completion rates after the flip; promote to L2 mid-season only if the Patch clearly wins hearts.

## 4. Art / audio / components

- **Art (ChatGPT pipeline, no emoji):** mud tile texture ×3 layer tints, truffle + golden truffle sprites, stone, 2 junk items, shimmer/mote sparkle, dig-fleck particles, "His Personal Stash" board dressing. Boss stir vignette = existing v2 sprite pack (gloat→idle) — zero new boss art.
- **Haptics/audio:** light impact per rub stroke ("shk shk"), medium on layer break, success notification + plop on truffle pop, heavier + shimmer on golden, soft grunt + warning haptic on stir-end (expo-audio, SwipeElement pattern).
- **Components:** `components/mudwar/TrufflePatch.tsx` (board + PanResponder rub/shove detection + stir meter), find-pop animation inline; mounts from the feeding strip in `app/mud-war.tsx` (the H2 slot in [[mudwar-hunger-arc-cadence-2026-07]] §4). Gesture grammar sits beside tap-to-tickle (core) and tap-N-times (barn): rub-to-root is the war's touch.

## 5. Cost reconciliation

Current path ([[mudwar-rewards-spec-2026-07]]): ≈19–20 dev-days to flip. The Patch at L1 replaces the flat-dig items (2.5d) with 5.5d → **new total ≈ 22–23 dev-days to a bounded-cohort flip.** L2 adds ~2 more if chosen later.

## Connects to
- [[mudwar-hunger-arc-cadence-2026-07]] — the heartbeat this implements
- [[mudwar-rewards-spec-2026-07]] — Golden Truffle sources reconciled here
- [[mudwar-scope-a-weathered-2026-07]] — the A-v1 build this rides with
