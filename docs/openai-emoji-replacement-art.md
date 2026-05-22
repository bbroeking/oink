# Emoji → Real Art — Generation Brief

Replace the app's emoji with drawn icons. ~36 assets, batched by
priority. Same pipeline as the alignment emblems (`openai-alignment-icons.md`).

**Not in scope** — these are font glyphs / accents, *not* emoji, and
stay as text: `★` (section kickers everywhere), `♥` (tickle counts),
`⚑`, `✦`. Leave them.

**Flagged — art doesn't cleanly fit, handled per-case, not here:**
- Emoji *inside copy* — the Schism kicker "🟢 …goblin nature…🟢", the
  Barn toast "6 7! 🐷", the phantom-itch toast "👻 …". You can't put
  an `<Image>` mid-sentence; these just lose the emoji (or stay).
- `BuyCelebration` particles (⭐✨💎🪙💫) — an animated burst; needs
  sprite particles, a separate job.

## Workflow

1. Fresh ChatGPT image-gen conversation, paste the **style anchor**.
2. Send a batch; slice the strip into individual PNGs.
3. Save to `assets/images/emoji/<name>.png`.
4. Claude wires each (`<Image>` swaps + an id→asset map where needed).
5. Batches are priority-ordered — Batch 1 is the highest-visibility.

---

## Style anchor (paste once)

```
I'm generating small UI icons for a cozy 2D mobile game — a matched
SET. NO characters unless asked, just the objects.

Every icon:
- Flat children's storybook illustration, bold ~3px black outline
- Flat painted cel-shading — NO 3D, NO gradients, NO gloss, NO shadows
- Soft saturated colors, single icon centered, even margin
- PURE transparent background
- Must read at ~20px — bold, chunky, simple; no fine detail

Layout: a horizontal strip, one icon per cell, even spacing + side
padding. Confirm, then I'll send batches.
```

## Batch 1 — Inbox & trade  *(highest visibility)*

`assets/images/emoji/` → `trade.png` `blessed.png` `cursed.png`
`friend-request.png` `pig.png`

```
BATCH 1 — a 5-cell strip:
1. trade — two pigs' hooves meeting in a handshake/shake
2. blessed — a small sprig of green herb with a soft glow
3. cursed — a little dark goblin mask, sly grin
4. friend-request — a friendly waving cartoon hand
5. pig — a plump pink cartoon pig head, front-facing, cheerful
```

## Batch 2 — Ritual icons  *(8 — bless + curse kinds)*

`warm-tea.png` `sun-beam.png` `halo-kiss.png` `bountiful-snouts.png`
`sluggish-snout.png` `phantom-itch.png` `goblin-whisper.png` `coin-pinch.png`

```
BATCH 2A — blessings, a 4-cell strip:
1. warm-tea — a steaming mug of tea
2. sun-beam — a bright sun with warm rays
3. halo-kiss — a glowing golden halo ring
4. bountiful-snouts — a small heap of gold coins

BATCH 2B — curses, a 4-cell strip:
1. sluggish-snout — a slow garden snail
2. phantom-itch — a little cartoon ghost
3. goblin-whisper — a swirl of murky green mist
4. coin-pinch — a gold coin with a crack / a pinching hand
```

## Batch 3 — Achievement tier icons  *(8)*

The Trade Masters ladders. `assets/images/emoji/achv/` →
`open-hoof.png` `snout-saint.png` `bacon-bountiful.png` `hog-of-hearts.png`
`hungry-hog.png` `trough-sniffer.png` `bottomless.png` `glutton-king.png`

```
BATCH 3 — an 8-cell strip, achievement medallions. Each a simple
emblem (not text): hoof print, haloed snout, a bacon ribbon, a heart
crown / a hungry open-mouth pig, a snuffling trough, a bottomless
bowl, a gluttonous crown. Bronze→gold feel across the set.
```
*(Wiring: the `achievements.icon` text column → an id→asset map.)*

## Batch 4 — Release-notes item icons

Mostly **reuse** Batches 1-3 (`trade`, `pig`, `sun-beam`, trophy…).
Net-new only: `friends.png` (two pig heads), `peek.png` (an eye),
`bell.png` (a notification bell), `scales.png` (reuse the alignment
`pilgrim.png`), `clipboard.png` (a bounty board), `crown.png`.

## Batch 5 — Cosmetic category icons  *(9, lowest priority)*

`cat/` → `hat.png` `glasses.png` `bow.png` `scarf.png` `mask.png`
`cape.png` `necklace.png` `held.png` `background.png` — one clean
object each, matching the wardrobe's existing accessory art style.

---

## Wiring per batch

| Batch | Wire-up |
|---|---|
| 1 | `Inbox.tsx` — the row `emoji` fields + `cardEmoji` `<Text>` → `<Image>` |
| 2 | `RitualPicker` / `CleanseModal` — `dailyRitual` kind → asset; `utils/rituals` keeps the kind, a new map resolves art |
| 3 | `AchievementUnlockModal` + the achievements grid — `icon` text → id→asset map |
| 4 | `ReleaseNotesModal` — the per-item `emoji` field → an asset key |
| 5 | `shop.tsx` wardrobe — the category label glyphs |

A generic trophy (`trophy.png`) covers the `🏆` fallback in
`Account.tsx` + `AchievementUnlockModal`.
