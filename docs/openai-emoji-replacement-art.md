# Emoji → Real Art — Prompts & Generation Record

The actual prompts used to generate the emoji-replacement icons (and
the idle-pig art basis), for re-running or reference. Pipeline: paste
the style anchor once, send each batch, slice the strip, knock-out
not needed (ChatGPT honors the transparent background).

**Not replaced** — font accents, not emoji: `★` kickers, `♥` counts,
`⚑`, `✦`. **Can't cleanly become art:** emoji mid-copy (the Schism
kicker, the "6 7! 🐷" toast), the `BuyCelebration` particle burst.

---

## 0. The idle pig — the art basis

The mascot. Everything else is styled to match it. 4-frame idle
animation (`idle_1.png` … `idle_4.png`).

```
A 4-frame idle-animation strip of a mobile game's mascot: a round,
plump, pink cartoon pig, front-facing, friendly and cheerful — big
soft cheeks, little ears, a snout, tiny hooves.

Whimsical children's-storybook illustration, bold ~3px black
outline, flat painted cel-shading (NO 3D, NO gradients, NO gloss),
soft warm pink, PURE transparent background.

The 4 frames are one gentle idle loop — same pig, same size and
position in every cell, only the body changes:
  frame 1 — neutral, resting
  frame 2 — a soft squash (settles down a touch, ears dip)
  frame 3 — neutral again
  frame 4 — a soft stretch (a little breath upward, ears lift)

A clean 4-cell horizontal strip, even spacing, side padding.
```

---

## Style anchor  *(paste once, before any batch)*

```
I'm generating small UI icons for a cozy 2D mobile game — a matched
SET. NO characters unless I ask, just the objects. Every icon: flat
children's storybook illustration, bold ~3px black outline; flat
painted cel-shading — NO 3D, NO gradients, NO gloss, NO shadows;
soft saturated colors; single icon centered with even margin; PURE
transparent background; must read at ~20px so keep it bold, chunky,
simple, no fine detail. Layout: a horizontal strip, one icon per
cell, even spacing + side padding. Confirm and I'll send the first
batch.
```

## Batch 1 — Inbox & trade  (5)

```
Batch 1 — a 5-cell strip, transparent background, icons in this
order: (1) trade — two cartoon pig hooves meeting in a handshake;
(2) blessed — a small fresh green herb sprig, leafy; (3) cursed — a
small dark goblin mask with a sly grin; (4) friend-request — a
friendly waving cartoon hand; (5) pig — a plump pink cartoon pig
head, front-facing and cheerful (a pig head IS intentionally
requested for this one). Clean 5-cell row, even spacing, side padding.
```
→ `assets/images/emoji/`: `trade` `blessed` `cursed` `friend-request` `pig`

## Batch 2 — Ritual icons  (8)

```
Batch 2 — an 8-cell strip, transparent background, same style, icons
in this order: (1) warm tea — a steaming mug of tea; (2) sun beam —
a bright cartoon sun with rays; (3) halo — a simple golden halo
ring; (4) gold coins — a small heap of gold coins; (5) snail — a
slow garden snail; (6) ghost — a little round cartoon ghost; (7)
green mist — a swirl of murky green mist cloud; (8) cracked coin — a
gold coin with a crack down the middle. Clean 8-cell row, even
spacing, side padding.
```
→ `warm-tea` `sun-beam` `halo-kiss` `bountiful-snouts` `sluggish-snout`
`phantom-itch` `goblin-whisper` `coin-pinch`

## Batch 3 — Achievement medallions  (8)

```
Batch 3 — an 8-cell strip, transparent background, same style,
achievement-medallion emblems in this order: (1) a hoof print; (2) a
pig snout with a small golden halo above it; (3) two crossed strips
of bacon; (4) a red heart wearing a small gold crown; (5) a cartoon
pig face with a wide hungry open mouth; (6) a wooden feeding trough;
(7) an empty round bowl; (8) a tall ornate gold crown. Clean 8-cell
row, even spacing, side padding.
```
→ `achv/`: `open-hoof` `snout-saint` `bacon-bountiful` `hog-of-hearts`
`hungry-hog` `trough-sniffer` `bottomless` `glutton-king`

## Batch 4 — Release-notes net-new  (5)

```
Batch 4 — a 5-cell strip, transparent background, same style, icons
in this order: (1) friends — two cheerful pink pig heads side by
side; (2) peek — a single friendly cartoon eye; (3) trophy — a
classic gold trophy cup; (4) bell — a golden notification bell; (5)
clipboard — a small wooden notice board with a tiny list on it.
Clean 5-cell row, even spacing, side padding.
```
→ `friends` `peek` `trophy` `bell` `clipboard`

## Batch 5 — Cosmetic categories  (9)

```
Batch 5 — a 9-cell strip, transparent background, same style,
cosmetic-category icons in this order: (1) a top hat; (2) round
glasses; (3) a ribbon bow; (4) a cozy scarf; (5) a face mask; (6) a
flowing cape; (7) a beaded necklace; (8) a magic wand; (9) a small
framed landscape picture. Clean 9-cell row, even spacing, side
padding.
```
→ `cat/`: `hat` `glasses` `bow` `scarf` `mask` `cape` `necklace`
`held` `background`

---

## Wiring per batch

| Batch | Wire-up |
|---|---|
| 1 | `Inbox.tsx` — row `emoji` fields + `cardEmoji` → `<Image>` |
| 2 | `RitualPicker` / `CleanseModal` — `dailyRitual` kind → asset map |
| 3 | `AchievementUnlockModal` + achievements grid — `icon` text → id→asset map |
| 4 | `ReleaseNotesModal` — per-item `emoji` field → asset key |
| 5 | `shop.tsx` wardrobe — category label glyphs |

Release-notes also reuse Batch 1-3 art (`trade`, `sun-beam`, the
crown, the alignment `pilgrim.png` for `⚖️`).
