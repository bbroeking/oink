# Visiting a Barn — the host's pig is the one you tickle

Status: **built 2026-09-14** (build 185). `components/BarnVisitModal.tsx`,
`components/ui/PigStage.tsx` (`facing`). The Satchel (`satchel-spec.md`) sits
on top of these rules.

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
- Your pig → `happy` once a heart has been shared. The one you can't tickle
  is the one asleep.
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
  each shifted 74pt to its own side.
- `PigStage facing="right"` mirrors the **host** (`scaleX: -1` composed on the
  stage wrapper next to the ritual flip). Rosie's tail sits viewer-left and
  her head tilts left, so un-mirrored visitor + mirrored host puts both tails
  outboard and both faces inboard. Cosmetics ride the canvas (RelSpec anchors
  mirror with it — nothing to re-place); raster and Rive agree; the nametag,
  chip, bubble, floats and ground shadow live outside the stage and never
  mirror.
- The Interior room gets the same `facing="right"` on the host.
- Accepted: asymmetric worn items swap sides on the host. No worn item
  carries readable text.

## Assets

None new. Sprites are front-facing and near-symmetric (the flip is a
transform); `tired` / `wave` / `surprise` sets exist for all six pigs;
`zzz` / `heart` glyphs exist. A 3/4-turn "glance" set was deliberately not
generated: it would break every RelSpec anchor for a cue the mirror already
gives.
