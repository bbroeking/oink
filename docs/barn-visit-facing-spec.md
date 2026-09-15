# Visiting a Barn — the host's pig is the one you tickle

Status: **built 2026-09-14** (build 185); **the turn, the room sizes and the
empty base room 2026-09-15**. `components/BarnVisitModal.tsx`,
`components/ui/PigStage.tsx` (`facing`), `components/habitat/HabitatScene.tsx`
(`PIG_SPOTS`). The Satchel (`satchel-spec.md`) sits on top of these rules.

**Before:** both pigs were tap targets calling `tickle_at_barn`; each success
bumped both tallies after the round trip; the cap-hitting tap fired a toast and
silently disabled both pigs, which were deliberately set to `happy`, never
tired. The visitor sat back-left/small, the host front-right/large, both drawn
from the same front-facing sprite (tail viewer-left) — two pigs staring at the
camera. After the toast faded nothing on screen said why taps were dead.

## 1. Tickle rule — the host's pig is the only target

| | Host pig | Your pig |
|---|---|---|
| Tap while open | `tickle_at_barn`; optimistic +1 on both tallies and the visit count; rollback on refusal; reconcile to `tap_cap − taps_left` | No RPC. `wave` reaction; the first tap shows *"You're the guest — tickle {host}'s pig."* once |
| Tap after spent | No RPC; light haptic; the "tickled out" tag wobbles | `wave`, no hint |
| a11y | `button`, "Tickle {host}'s pig", `disabled` when spent | `button`, "Your pig", hint says it waves |

One tickle in flight, one queued: fast taps never drop and the count never
waits on the round trip. `busy` no longer disables the pig.

## 2. "Tickled out" — durable, not a toast

On the cap-hitting tap (server `taps_left === 0`):

- Host pig → `pigMood="tired"` (the tired sprite set; every pig has one), a
  `zzz` over its head.
- The **count chip** under the host pig ("3 tickles") becomes the **"tickled
  out"** tag (`Tag tone="sun" glyph="zzz"`). One slot changes meaning; no
  chrome is added.
- Your pig stays `content` (it was `happy` once a heart was shared until
  2026-09-15: the happy mood plays from the front frames and turned the guest
  back to the camera on the first tap; the shared hearts are the floats). The
  one you can't tickle is the one asleep.
- Action bar → "Head home" (unchanged). The toast stays but is no longer the
  only signal.
- Arriving at a resting barn keeps the nap card; the host renders tired
  there too.

## 3. Count

- The per-visit count lives on the pig you tap (the chip). The header's two
  tallies and rising "+1 ♥" are unchanged; "N of N visits left" stays the
  barn budget and never mixes with the tap count.
- Optimistic on tap; rollback on `!ok`; reconciled to the server's
  `tap_cap − taps_left`.

## 4. Facing each other

- One ground line (`bottom: 9%`), visitor left at 0.54, host right at 0.62,
  each shifted 86pt to its own side (the Outside diorama; 74 before the turn — a turned snout reaches its canvas edge). Inside, the room
  places the pair itself (`HabitatScene` `PIG_SPOTS`: guest at 0.30, host at
  0.70, the host 0.44 of the canvas wide, the guest 0.36) and TapPig hands it
  the bare 300pt canvas (`stage="room"`) — the two scales used to compound
  into a 60pt pig (2026-09-15).
- **The two turn toward each other** (2026-09-15, supersedes the mirror-only
  rule). `PigStage facing` now means *which way the pig looks*: the guest is
  `facing="right"`, the host `facing="left"`. At rest a facing pig takes the
  **three-quarter families** — `face` (standing, the Outside) and `face_sit`
  (seated, the Inside) — four frames each: rest, breath in, blink, breath out,
  on the seated rest's 4 s cadence, so the pair rests in step. They are drawn
  looking toward the viewer's right; the host's are mirrored (`scaleX: -1` on
  the stage wrapper beside the ritual flip, as before), so raster and Rive
  agree and every anchored cosmetic rides the canvas. A mood or a reaction
  (the tired nap, a wave, the delivery's surprise) plays from the front
  families, mirrored so the tilt stays toward the friend. No `facing` — the
  Barn's own pig, the Closet, every list — means no turn and no mirror.
- The turned families carry their own anchors (`PIG_FRAME_ANCHORS.face` /
  `.face_sit`; tune in the Placement Studio's Pig mode): a hat sits on a
  turned crown, glasses on a foreshortened eye line. On the turn only
  eye-bound items take the eye-line scale; a hat or a scarf keeps its size
  and just takes the tilt (`resolveWearablePose`).
- Accepted: asymmetric worn items swap sides on the host. No worn item
  carries readable text. The guest's mood never leaves `content`, so it
  holds the turn for the whole visit.

## Assets

- `assets/images/sprites/<pig>/face_{1..4}.png`, `face_sit_{1..4}.png` for
  all six pigs — one 4×2 magenta-keyed Codex ImageGen sheet per pig
  (Rosie from her sprite + turnaround + lounge sit; the recruits from their
  `idle_1` with Rosie's finished sheet as the pose reference), sliced by
  `scripts/pig-tweens/slice_face_sheet.py` at one shared scale so sitting
  reads as a pose, never a shrink. Sheets, prompts and contact strips in
  `docs/reviews/pig-facing-2026-09-15/`.
- `tired` / `wave` / `surprise` sets exist for all six pigs; `zzz` / `heart`
  glyphs exist.
- The base room `warm_plank_barn` was repainted **empty** the same day (no
  shelf, no wardrobe): `assets/images/habitat/source/imagegen-warm-plank-barn-empty-v1.png`
  → `warm_plank_barn.png` + thumbnail via `scripts/habitat/generate-art.mjs`.
  Spring Whitewash and Midnight Rafters got the same treatment the same day;
  the Shelf decorating spot draws its own plank (`shelf_plank.png`).
