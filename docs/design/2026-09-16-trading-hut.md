# The Trading Hut — the Stranger's section (proposal, 2026-09-16)

Status: **spec, decisions resolved 2026-09-16 (see the end); flow on the design canvas https://claude.ai/code/artifact/69db9658-dfc5-4340-a5d4-980e50398d6c (`claude-design/hut-2026-09-16/`), awaiting founder flow review.** Extends `2026-09-16-finds-swaps-and-the-stranger.md`
§3.4 / §9 and **amends** one of its resolved answers: the Stranger was "at the
hedge only while you hold a set, never a fixture." Founder direction today:
the Stranger works out of a **secret trading hut** — a Zoltar-style shady
booth players *discover* — with its own dedicated section, onboarding and
payoff. The reconciliation: **the hut is scenery, the sheep is a state.** The
hut stands in the yard on every background (like the trees and fences already
do); the sheep shows in its hatch only when it has business, and the lantern
is how you know. Rosie's stage keeps its two corners and one button; the hut
is part of the painting, not a fourth control.

**One line:** *A crooked little hut in the yard; when its lantern is lit, the
hooded sheep inside will take three of a kind for tickles — no questions
asked, and none answered.*

---

## 1 · Discovery UX flow

Nothing announces the hut. It is found, not taught — the Burrow Book /
Field Guide rule (a thing is a mystery until you meet it).

| beat | what the player sees | what's happening |
|---|---|---|
| **Notice** | A small dark hut at the right edge of the yard, behind the fence line, on every background. Shutters closed, no light, no sign. It has been there since the first launch. | `TradingHut` mounts on the Exterior on Rosie's ground line (the `BuriedMound` pattern, right-anchored). State `dark`. |
| **First curiosity** | Tapping the dark hut: the shutters rattle, nothing opens. A one-line tag under it, in the mound's tag style: *"Shut. Someone's in there."* Dismisses itself. | No section yet. The tap is logged (`hut_tapped_dark`) so we learn whether players find it unprompted. |
| **The lantern** | The dig receipt lands a third pebble. On return to the yard the hut's lantern **lights** and the hatch shows the hooded bust looking out. No toast, no arrow. | State flips to `open` when `my_satchel()` reports any `set_ready` stack ∧ `stranger.sets_left > 0`. The walk-in/out from the earlier spec becomes **shutters open / shutters close** — cheaper art, same rule. |
| **Approach** | Tap the lit hut → the yard dims, the hut's door swings (the `HabitatDoorTransition` tempo), the **Hut** section fills the screen. | Route `/hut` (never in a tab, never in the Barn fan — the hut is the only door). |
| **Onboarding (first entry only)** | The sheep's first line, one screen, in its voice: *"Three of a kind, little pig. I take sets. You take tickles. Don't ask where they go."* Under it, the exact deal for the set you're holding: *3 river pebbles → +5 tickles*. One button: *Show me.* | Field Guide *the Stranger* entry lifts from silhouette (`satchel_met`-style `trader_met` row). The onboarding is the Field Guide reveal ceremony, reused. |
| **Payoff** | Hand over the set → the hatch's bust does its `take` beat, a **printed slip** slides out of a slot below the hatch (Zoltar's fortune card, repurposed as the receipt): *3 river pebbles · +5 tickles · "Come back with more."* The coin count-up plays on the slip. | `trade_with_stranger`; the tally is the dig-tally component. The slip is the receipt — no new mechanic, only the presentation. |
| **Return** | Later, with no sets: the hut is dark again, but now tapping it opens the section (you've met it) to a shuttered counter: *"Nothing for me today?"* and your stacks with *×2 — one more* hints. | State `known_dark`. The section is always reachable once met; the sheep is only *present* when it has business. |
| **Sold out** | Third sale of the day: the slip reads *"That's my lot till midnight."*, the shutters close behind it, lantern out. | `enough_for_today`; state `known_dark` with `resets_at`. |

Push: none. The lantern is the notification — you see it when you come home
from a dig, which is exactly when a set can complete.

---

## 2 · The section — what `/hut` contains

A single scrolling screen in the storefront's chrome family (the Shop's
"one place, one counter" shape), dim palette, one warm light source.

1. **The counter** (hero, top ~40 %): the hut interior — a hatch with the
   hooded bust (the 256 glyph, animated by a 4-frame `hatch` family: rest ·
   lean-in · take · shutter), a lantern, and a **chalk slate** beside the hatch
   showing *today's fancy* as a find glyph with a small *×2* (no text on the
   art; the glyph and the multiplier are UI). The sheep's line under the hatch
   rotates from `app_settings.trader_lines`.
2. **The slot**: below the hatch, where slips print. Empty until a sale.
3. **Your stacks**: the bag as stacks, set-ready lifted with the exact deal on
   the chip (*3 → +5*), partials dimmed with *one more*. Tap a lifted stack →
   confirm pill *Hand over 3 river pebbles · +5 tickles* → sale.
4. **Today**: *2 of 3 sold · resets at midnight*.
5. **Dealings**: a quiet ledger of past slips (find · tickles · day), newest
   first, the last 20. This is the "proof you were there" — Collect.
6. **The rule, once**: a single footnote line, *Sets only. Three of one find.*
   — the one sentence, and nothing else to explain.

Not in the section: anything about swaps, asks, friends, or the shop. The hut
is one deal. Field Guide entry links here once met.

---

## 3 · Placement — and how to choose per scene

| option | cost | fit | verdict |
|---|---|---|---|
| **A · painted into every background** | 47 backgrounds × an inpaint each (+ every future background), and the tap target moves per scene | best "it belongs to this place" feel | **No** — fails lens #5 (the art pipeline can't feed it) and creates 47 anchors to maintain |
| **B · one overlay hut in the yard slot, every background** | one sprite (2 states), one anchor rule, one tap target | Rosie and the mound already sit on the painterly scenes as cartoon overlays — the hut joins that layer | **Yes** — this is what "the hut is scenery" means in this codebase |
| **C · B plus bespoke variants for scenes that fight it** | B + a handful of alternates | e.g. `cosmic_drift`, `moonlit_ballroom`, `library_nook` have no ground for a hut | **Later, by rule** — see below |

**The rule per scene.** The hut plants its base on the yard's ground line at
the right edge, mirrored to the mound's left-edge slot, at the mound's scale
band (the mound is 54×24 pt; the hut is ~96×88 pt, roughly two mounds wide —
readable, never competing with Rosie). Backgrounds are 354×887 portrait with
a consistent ground band, so one anchor works for the pasture/forest/beach
family. For a background whose ground line isn't a ground (cosmic, ballroom,
library, the five `frostlight_dome` interiors), the same overlay still
renders — a crooked hut floating in a nebula *is* the joke of an
off-the-books trader — and a bespoke variant is a per-scene art ticket only
if the founder dislikes a specific one on the sim. `constants/animatedBackgrounds.ts`
gets an optional `hutVariant` key; absent = default.

**Interior:** no hut. **Visit screen:** no hut — it's *your* hedge; a friend's
yard shows theirs dark, untappable (the spec's rule that the Stranger never
appears on a visit).

---

## 4 · The interaction loop — the shady trade

| | |
|---|---|
| **You bring** | exactly **three of one find** (oldest three leave the bag). Never singles, never mixed, never a find in someone's ask. |
| **It pays** | **applied tickles** by rarity — common 5 · uncommon 12 · rare 30 — doubled when the find is *today's fancy*. Score and lifetime counter, never the bank, never Snouts. |
| **You also get** | the **slip** (the receipt, kept in *Dealings*), the Field Guide reveal on the first sale, and the *dealings* count. |
| **The limit** | three sets a day per pig; the shutters close on the third. |
| **The shade** | is *tone*, never *terms*: the exact tickles are on the chip before you confirm (the charter: numbers honest and small), the price is server-set, there is no haggling, no random payout, no "sometimes it pays more." What the sheep won't say is where the finds go. |

Loop: dig → a set completes → lantern → hut → slip → coin ticks → back to the
yard, hut dark → dig. With friends: ask → swap → set → lantern. The hut is the
end of the find's life and the only place it becomes a number.

---

## 5 · Art & sprite requirements

**Icon sheet (this run — one row, magenta key, sliced to 256×256 glyphs)**

| cell | id | what | used by |
|---|---|---|---|
| 1 | `stranger` | hooded sheep **bust**, framed exactly like `pigface.png` (head fills the frame, thick warm-brown outline, painterly cel shading), three-quarter turn to the viewer's left, eyes hidden by the hood, muzzle + nose + ear-tips through the fabric, satchel strap crossing the bottom edge | hatch, Field Guide, Inbox rows, section header |
| 2 | `hut` | the trading hut as an icon: crooked plank hut, tarp roof, one hanging lantern (unlit), shutters, same outline weight and scale-in-frame as `pigface.png` | Field Guide entry, the Dealings header, any "where" reference |
| 3 | `slip` | a small printed ticket, curled corner, one stamp mark, no letters | the receipt slot, Dealings rows |

Refs: `assets/images/glyphs/pigface.png` (icon treatment: framing, outline,
shading) + `assets/images/sprites/rosie/face_1.png` (Rosie's line and palette,
the three-quarter head turn). Prompt names the palette in hex: fleece cream
`#F3E9D8`, hood indigo `#3E4A6B`, strap brass `#B98B3E`, outline brown
`#4A2E1E`. The silhouette state is derived in code (ink tint at ghost
opacity), never generated.

**Yard hut (sprite lane, after the icon is approved — the icon is its `-i` ref)**

- One PNG on the 370×383 canvas family, base on the baseline, ~96×88 pt
  rendered; **two layers**: `hut_dark.png` and `hut_lantern.png` (the glow +
  lit hatch as an additive overlay), so "lit" is one image on top, not a
  second hut.
- **Readable silhouette at 96 pt**: one crooked roofline, one lantern, one
  hatch, one door. No signage text, no letters, no arrows. Off-the-books
  reads through *material*: mismatched planks, a tarp held by a rope, a
  crate as a step.
- **Sits on the scenes**: the overlay layer Rosie and the mound already use;
  painted, not flat vector; internal shading only; **no ground disc, no cast
  shadow** (the strip scripts run on it as on every sprite).
- **Hatch family** (4 frames, section only): rest · lean-in · take · shutter,
  drawn as the *bust in the hatch* so the icon and the animation are the same
  face. Own frame map (`constants/strangerFrames.ts`); never a `PigId`.
- Consistency lock: `glyphArt.test.ts` asserts `stranger`, `hut`, `slip` are
  registered and 256×256; `strangerFrames.test.ts` locks the hatch count and
  `"stranger" ∉ PIG_IDS`.

Dropped from the earlier §9: the `walk` and `face` families (the hut replaces
the walk-in; the hatch bust replaces the yard turn). Kept: `take`, `shake` as
hatch beats.

---

## Codex command — the icon sheet

Run from the repo root. Prompt file first, then one Codex call; the sheet
lands in `assets/images/glyphs/stranger/_sheet/`, PIL slices to the three
glyphs, and the prompt is kept beside the art like `finds/prompt.txt`.

```bash
mkdir -p assets/images/glyphs/stranger/_sheet
cat > assets/images/glyphs/stranger/prompt.txt <<'EOF'
Create ONE final PNG image: a sprite sheet of three small game icons for a cozy
cartoon pig game. Use the two input images ONLY as visual style references:
image (1) is a pig-face icon — match its framing exactly (the subject fills
the square cell, head-and-shoulders bust, thick warm dark-brown #4A2E1E ink
outline, rounded chunky shapes, soft painterly cel shading, warm highlight
patches, no text). Image (2) is the game's pig character — match its line
quality, palette warmth and its three-quarter head turn. Neither the pig face
nor the pig itself may appear.

Layout: landscape canvas 1536 x 512. STRICT invisible grid of 3 columns by
1 row, all cells the same size, every subject centered in its cell at the
same apparent scale and outline weight, generous even margins, nothing
touching a neighbouring cell. No visible grid, frames or separators.

Cell 1 — a mysterious hooded SHEEP, bust only, turned three-quarter toward
the viewer's left: cream fleece #F3E9D8 showing at the cheeks and chest, a
deep indigo #3E4A6B hood pulled low so the EYES ARE COMPLETELY HIDDEN in
shadow — only the pale muzzle, a small dark nose and two ear-tips poking
through the hood are visible; a brass #B98B3E satchel strap crosses the
bottom edge. Calm, secretive, a little sly; not scary.
Cell 2 — a tiny crooked wooden trading hut: mismatched planks, a rope-tied
tarp roof, closed shutters, one small unlit hanging lantern, a crate as a
step. Same outline and painterly shading as cell 1. No signs, no letters.
Cell 3 — a small printed paper slip or ticket with one curled corner and one
round ink stamp mark. No letters, no numbers.

CRITICAL BACKGROUND: the WHOLE image, edge to edge, every margin and gutter,
must be perfectly uniform flat solid pure magenta #FF00FF (RGB 255,0,255) —
it is a chroma key. No gradient, vignette, texture or lighting on the
background. No ground, no drop shadows, no cast shadows, no halos. Internal
painted shading only. No text, labels, numbers, letters or watermark.
Exactly three subjects, each once. Produce just ONE sprite sheet.
EOF

codex exec --skip-git-repo-check --enable image_generation \
  --sandbox workspace-write \
  -C assets/images/glyphs/stranger/_sheet \
  -i assets/images/glyphs/pigface.png \
  -i assets/images/sprites/rosie/face_1.png \
  - < assets/images/glyphs/stranger/prompt.txt
```

Slice (the finds lane's approach — magenta key, 3×1 grid, 256×256, hooves
of nothing to worry about here so plain centre-fit):

```bash
python3 - <<'EOF'
from PIL import Image; import glob, os
src = sorted(glob.glob('assets/images/glyphs/stranger/_sheet/*.png'))[-1]
im = Image.open(src).convert('RGBA'); W, H = im.size
px = im.load()
for y in range(H):
    for x in range(W):
        r, g, b, a = px[x, y]
        if r > 200 and b > 200 and g < 90: px[x, y] = (0, 0, 0, 0)   # chroma key
ids = ['stranger', 'hut', 'slip']; cw = W // 3
for i, name in enumerate(ids):
    cell = im.crop((i * cw, 0, (i + 1) * cw, H)); bb = cell.getbbox(); cell = cell.crop(bb)
    s = 232 / max(cell.size); cell = cell.resize((round(cell.width * s), round(cell.height * s)), Image.LANCZOS)
    out = Image.new('RGBA', (256, 256), (0, 0, 0, 0)); out.paste(cell, ((256 - cell.width) // 2, (256 - cell.height) // 2), cell)
    out.save(f'assets/images/glyphs/stranger/{name}.png'); print(name, cell.size)
EOF
```

Then: register the three in `components/ui/Glyph.tsx` (`stranger`, `hut`,
`slip`), show all three to the founder (memory: always show generated
images), and only after approval fire the yard-hut sprite run with
`glyphs/stranger/hut.png` + `face_1.png` as its refs.

The chroma threshold in the slicer is the same soft key the finds lane needed
(ImageGen's magenta drifts a few values); fringe check the three outputs on a
white and a dark card before registering.

---

## Decisions (resolved 2026-09-16)

1. **Amendment accepted.** "The hut is scenery, the sheep is a state" replaces "no fixture in the yard"; the earlier spec's decision-log draft gains that clause.
2. **Icon sheet = three cells**: `stranger`, `hut`, `slip`. The section needs a Field Guide mark and a receipt mark; one run covers all three.
3. **The slip is the receipt.** Zoltar's card as presentation of the existing tally — no new mechanic, no new number.
4. **Dealings ledger ships in v1** — last 20 slips, newest first; it is the section's Collect proof.
5. **Once met, the section opens even when dark** — stacks with *one more* hints; the sheep is only present when lit.
6. **Default overlay on every background**; a `hutVariant` is commissioned only for a scene the founder rejects on the sim.
7. **Palette as prompted**: cream `#F3E9D8` · indigo `#3E4A6B` · brass `#B98B3E` · outline `#4A2E1E`.

## Hut states (the state machine the design must show)

| state | yard | tap | section |
|---|---|---|---|
| `unmet_dark` | hut, shutters closed, no light | shutters rattle + tag *"Shut. Someone's in there."* | — |
| `lit` (any `set_ready` ∧ `sets_left > 0`) | lantern lit, bust in the hatch | door-swing → `/hut` | first time: onboarding line + the deal; after: counter open |
| `known_dark` (met, no sets or none left) | hut dark, no bust | door-swing → `/hut` | counter shuttered: *"Nothing for me today?"* / *"That's my lot till midnight."*; stacks with *one more* |

Sources of truth: `my_satchel().stacks[].set_ready`, `stranger.sets_left`, `stranger.met`. Presence is derived on the client, refreshed on focus and after every dig / swap receipt.
