# World Cup flag cosmetics — ChatGPT image-gen brief

Generates the **flag cosmetics for the 48 World Cup 2026 teams** (minus the
sanctioned **Iran** → **47 flags**), in Tickle the Pig's cozy paper-sticker
style, via the `icon-gen` Chrome-connector pipeline.

**Pipeline:** real flag references staged in `~/Desktop/ttp-refs/world-cup-flags/`
(pulled from flagcdn) → drag the batch's flags into ChatGPT → generate a
cartoony paper-sticker version of each. References keep colors/emblems
accurate; ChatGPT only stylizes the rendering.

**Batch 1 is a 6-flag TEST** to lock the look before scaling. **Rate-limit
reality:** ChatGPT caps image creation per day, so the 5 batches will likely
span a couple of sessions.

---

## Style anchor (paste once)

```
We're making FLAG cosmetics for a cozy storybook mobile game about dressing up
a pet pig. The art style is a HAND-DRAWN PAPER-STICKER look:

- Each flag is a small WAVING FAN-PENNANT on a tiny pole — a PURE 2D PAPER
  CUTOUT viewed straight from the front.
- Flat, soft, warm storybook coloring. A clean 2–3px INK-BROWN outline
  (#2a1f15) around each pennant. A HARD drop shadow (solid, offset down-right,
  NO blur).
- Gentle cloth wave/ripple, but NO 3D rendering, NO glossy highlights, NO
  metallic gradients. Think: a sticker glued to a flat surface.
- Keep each country's real flag colors and emblems ACCURATE — use the dragged
  reference images. Stylize the rendering, never the design.
- Items in a single horizontal row, evenly spaced, equal size, consistent pole
  length, on a transparent (or plain cream #fffaf0) background.

Reply that you understand the style. Do not generate yet.
```

## Batch 1 of 5 — TEST (6)

```
Generate a horizontal strip of 6 flag-pennant stickers in the established
paper-sticker style, left to right, evenly spaced, equal size. Use the dragged
references for accurate colors/emblems:

Brazil, Argentina, France, Japan, Mexico, United States

Each is a small waving fan-pennant on a tiny pole, flat 2D paper cutout, ink
outline, hard drop shadow. Transparent/cream background. No 3D, no gloss.
```

## Batch 2 of 5 — UEFA (11)

```
Same paper-sticker flag-pennant style, same rules (flat 2D cutout, ink
outline, hard shadow, accurate from references, no 3D/gloss). Horizontal strip,
left to right, equal size:

Spain, England, Portugal, Germany, Netherlands, Belgium, Croatia, Switzerland,
Austria, Scotland, Norway
```

## Batch 3 of 5 — UEFA + CONMEBOL + CONCACAF (10)

```
Same paper-sticker flag-pennant style, same rules. Horizontal strip:

Sweden, Türkiye, Czechia, Bosnia and Herzegovina, Colombia, Ecuador, Uruguay,
Paraguay, Canada, Panama
```

## Batch 4 of 5 — CONCACAF + CAF (10)

```
Same paper-sticker flag-pennant style, same rules. Horizontal strip:

Haiti, Curaçao, Morocco, Senegal, Egypt, Tunisia, Algeria, South Africa,
Côte d'Ivoire, Ghana
```

## Batch 5 of 5 — CAF + AFC + OFC (10)

```
Same paper-sticker flag-pennant style, same rules. Horizontal strip:

Cape Verde, DR Congo, Korea Republic, Australia, Uzbekistan, Jordan, Qatar,
Saudi Arabia, Iraq, New Zealand
```

---

## Excluded

- **Iran** — qualified, but on the sanctions denylist (`world-cup-countries.md`).
  Do not generate. (Russia is FIFA-suspended; not a WC team anyway.)

## Post-processing (after batches land)

- Slice each strip into per-flag PNGs (per-item bbox; the canvas often returns
  wider than asked — expected).
- Name by country, wire into the World Cup shop cosmetics.
- Re-paste the SAME style anchor + converged retry language on every batch so
  ChatGPT doesn't relearn the look.
