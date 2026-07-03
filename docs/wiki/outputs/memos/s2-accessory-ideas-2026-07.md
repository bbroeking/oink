---
title: "Season 2 — new accessory ideas (the Hungerer's regalia, rooter's kit, apex Heirlooms)"
type: memo
date: 2026-07-03
tags: [mud-wars, season-2, cosmetics, accessories, ideation, rewards]
status: draft
---

# Season 2 — new accessory ideas

Founder ask: *"ideate on a couple new things we could add to the game as accessories and such."* Grounded against what exists so nothing double-covers.

**Coverage today:** the 25 war spoils live in hat ×5, held ×5, aura ×5, background ×6, + 4 derby items; Sheet E adds 6 held commemorative tokens; the recolor engine adds 16 SKUs. **Whitespace:** the war has NOTHING in `mask`, `glasses`, `scarf`, `necklace`, `bow`, `cape`, or `tickle_particle` (all real categories per `CATEGORY_ANCHORS`/`CATEGORY_OVERLAYS`, `constants/hats.ts:441-540`; `tickle_particle` per `:174`) — whole slots of the pig are un-warred. The FX engine (`constants/cosmeticFx.ts`) gives per-item `float/glow/shimmer/sparkles` recipes; anything below marked *FX* uses exactly that vocabulary.

Tier map (rewards spec): Muddy=common · Caked=uncommon · Prize=rare · Champion=epic · Heirloom=legendary. War items are never money- or snout-buyable — Exchange truffles, drops, milestones, stage commemoratives, finale only.

## (a) The Hungerer's regalia — "you took a piece of him" → **SET: The Hungerer's Table**

| # | Item | Slot | Tier | Earned | Art | Week |
|---|---|---|---|---|---|---|
| 1 | **The Hungerer's Crown** | hat | Heirloom | **Famished finale exclusive** (wearable counterpart to Sheet E's trophy token) | his tilted gold crown, one point dented — crop/redraw from `great_hungerer_boss_LOCKED.png`; *FX:* gold glow 2800ms + slow shimmer + 3 point-sparkles | finale |
| 2 | **His Bib** | scarf | Champion | Exchange marquee (500→ no; Champion 250) | comically oversized white dinner bib, giant knot, one proud mud splat | W6 |
| 3 | **Trough Splinter Charm** | necklace | Prize | win-drop pool addition | a splinter of his trough on twine, faint gold glow at the tip | W5 |
| 4 | **The Royal Wrapper** | held | Caked | Exchange cheap shelf | his giant snack wrapper folded into a paper boat-crown — reuses Sheet A cell 4 base | W3 |

*Set capstone:* collect 2–4 → the Crown is the capstone slot, but it only exists if the server reaches Famished — the set is completable only if the community wins. On-theme with "we beat him together."

## (b) The rooter's kit → **SET: Professional Rooter's Kit**

| # | Item | Slot | Tier | Earned | Art | Week |
|---|---|---|---|---|---|---|
| 5 | **Snout Guard** | mask | Prize | Exchange | little leather snout-cap with brass rivets, "professional rooter" energy | W5 |
| 6 | **Digger's Ribbon** | bow | Muddy | **consolation-pool addition** (loss drops need >3 items) | mud-flecked ribbon tied round one ear | W3 |
| 7 | **Truffle Satchel** | held | Prize | Exchange | burlap pouch bursting with truffles — reuses Sheet A cell 5 base | W5 |
| 8 | **Golden Snuffle Dust** | tickle_particle | Champion | **set capstone** (own 5/6/7/9) | gold mote puffs burst from every tickle — first war-exclusive tickle particle; tiny sprite, huge delight | W6 |
| 9 | **Rooter's Goggles** | glasses | Caked | Exchange | mud-speckled brass goggles pushed up on the brow | W4 |

## (c) Bog-war gear (empty-slot coverage)

| # | Item | Slot | Tier | Earned | Art | Week |
|---|---|---|---|---|---|---|
| 10 | **Reed-Woven Cape** | cape | Prize | Exchange | cattail-reed cloak, hem dipped in mud | W7 |
| 11 | **Warpaint of the Mire** | mask | Caked | win drop | two muddy finger-stripes per cheek, one on the brow — cheapest art in the pile | W3 |
| 12 | **Boglight Lantern** | held | Champion | Exchange | firefly lantern on a reed pole; *FX:* soft green-gold glow + 2 long-delay sparkles (fireflies blinking) | W6 |

## (d) Apex animated Heirlooms (top-of-ladder motion, per the "motion at the top" rule)

| # | Item | Slot | Tier | Earned | Art + FX | Week |
|---|---|---|---|---|---|---|
| 13 | **The Gorged Halo** | aura | Heirloom | Exchange 500, **evolving** (`evolve_stage` per war won) | ring of golden joy-motes around the pig; *FX today:* 6 sparkles on a circle with cascading delays (0/500/…/2500ms) + gold glow + shimmer — reads as orbit; *honest note:* true orbital drift needs a small `orbit` extension to `CosmeticFx`, worth it at this tier | W7 marquee |
| 14 | **Emberfly Crown** | hat | Heirloom | 2nd Heirloom marquee or Flashback | dark reed crown with living fireflies; *FX:* float amp 4 + green-gold glow + 4 randomized-delay sparkles | W8 |

## (e) Crew identity

| # | Item | Slot | Tier | Earned | Art | Week |
|---|---|---|---|---|---|---|
| 15 | **Pennant colors** ×4 | held | Caked | Exchange filler | `crew_pennant` recolors via `scripts/recolor.py` — free; "fly your colors" until real clan emblems land | W5 |
| 16 | **Rally Horn** | held | Prize | Exchange, golden-echo flavored copy ("for crews who dig together") | curled bog-cow horn on a strap | W8 |
| 17 | **Matching Mud Stripes** ×4 | mask | Muddy | consolation pool | recolors of #11 — free volume | W4+ |
| 18 | **Sty Banner** | flag | Prize | Exchange | tilted corner war-banner sticker; *note:* reuses the `flag` category (country-flag semantics today — confirm no collision before seeding) | W7 |

## Generate-next shortlist (max delight per art effort)

Six items, ONE new ChatGPT generation (**new brief batch: "Batch 9 — Sheet F: war accessories", anchor ①, 3×2 grid** — add to `docs/briefs/s2-art-chatgpt-briefs.md`):

1. **Golden Snuffle Dust** — one tiny mote sprite unlocks a whole new category of war delight.
2. **His Bib** — the funniest trophy in the pile; instant boss tie-in.
3. **Snout Guard** — first war mask; the "I'm a professional" flex.
4. **Warpaint of the Mire** — cheapest art, biggest identity; recolor-multiplies into #17 for free.
5. **The Hungerer's Crown** — the apex; half its art already exists in the LOCKED boss render.
6. **Boglight Lantern** — the FX-engine showcase on a simple sticker.

Items 4/7 reuse Sheet A bases (no new gen). Recolors (#15, #17) are script-only. Everything respects the isolation firewall (earned in-war only) and the taste standard (no emoji, sticker anchor, cozy names).

## Connects to
- [[mudwar-rewards-spec-2026-07]] — tiers, Exchange pricing, release calendar these slot into
- [[great-hunger-art-manifest]] (docs/great-hunger-art-manifest.md) — Sheets A/E these extend
- [[mudwar-hunger-arc-cadence-2026-07]] — the Famished-finale gate the Crown hangs on
