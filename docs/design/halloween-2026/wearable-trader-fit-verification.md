# Personal wearable errands and Rosie costume verification

Verified locally on 2026-10-14 in the Halloween Workshop at `http://127.0.0.1:4320/`.
The existing Claude Design Spooky Snouts canvas and selected project design
system guided the hood/romper proportions and four-step Old Wisp errand. Its
concept placeholders are not production fitted sprites.

## Actual wearable flow

The requested objects are owned wearable items, following the user's explicit
clarification. They are not spare card copies. Today the local fixture asks
Rosie for Moonwake Tricorn and Bandit for Bone Mask. Switching viewer retains
each personal ask. Both ready marks must agree before an atomic swap. Reviewing
the offer clears both marks. Handover removes the requested garment and records
one draft reward; receipt replay neither consumes nor rewards again. Historical
first-card discovery cannot re-mint the surrendered wearable.

Browser acceptance exercised those steps and the ownership captions before
swap, after swap and after handover. The final receipt is saved in
[old-wisp-receipt-phone.png](old-wisp-receipt-phone.png).
The new Old Wisp story resets on reload/day change. Its quantity ledger and
simulated friend response are local fixtures, not persistent account authority.
The earlier card-copy exchange remains labeled as a separate experiment.

## Rosie and Bandit visual acceptance

Selected garment art: complete `rosie-hood-v1.png` and true-alpha
`rosie-romper-v3.png`. The rejected card v1, combined crop bands, and brown-halo
romper v1/v2 are retained only as generation history. Selected Hollow Jack card
art is v2; the 39-card registry is complete and unchanged in identity/order.

All `idle_1` through `idle_12` were stepped and visually reviewed. Original and
dressed views use the identical source PNG in every frame. The hood reads
measured per-frame crown position, tilt and head width. The short romper fits
the actual body and its cuffs sit over Rosie's real hooves, with no extra legs,
cut seams, source-face replacement or exterior alpha halo. Headroom keeps the
stem/vines within the stage. The hood intentionally covers the brows and much
of the forehead; some tail/leg coverage is part of this costume fit. Eyes,
cheeks, snout, mouth, inner ears and hooves remain the source pig.

The full twelve-frame sequence and its source-image equality records are in
[rosie-fit-frames/verification.json](rosie-fit-frames/verification.json), with a
[contact sheet](rosie-fit-contact-sheet.png). Normal-speed samples crossed
12→1 twice at a 300px source-pig size without a visible attachment jump. Reduced
motion stayed on frame 1 across an 800ms check; manual frame stepping still works.

At 393px phone width the source pig remains 300px; at 320px the entire dressed
scene scales together to a 280px stage, preventing clipping. Narrow-screen DOM
measurement confirmed page width 320 and stage bounds x20–300. Saved evidence:
[normal-size playback](rosie-fit-playback.png), [phone](rosie-fit-phone.png), and
[narrow](rosie-fit-narrow.png).

The local workshop and trader use `normalized/bandit-v2.png`, matching the
approved portrait selection. The stale `normalized/bandit.png` was removed from
these surfaces. Production animated Bandit already uses its separate approved
sprite pack and was not changed. Claude did not have v2 in its existing project
assets, so its old Bandit pictures were replaced with art-pending placeholders.

## Remaining exceptions

| Item / system | Pig and animation / frame | Remaining work |
| --- | --- | --- |
| Hollow Jack | Rosie `face_1–4`, `face_sit_1–4`, `walk_1–4`, `jump_1–4`, `happy_1–4`, `sad_1–4`, `tired_1–4`, `surprise_1–4`, `wave_1–4` | Author garment fit and front/back occlusion; no acceptance implied by idle fit |
| Hollow Jack | Copper, Pepper, Bandit, Pickles, Biscuit: all 48 authored source frames per pig | Separate anatomy/pose fit required |
| Hollow Jack | Rosie sit/bounce playback variants and transitions into non-idle families | Review body motion, layer ordering and loop/transition boundaries |
| Hollow Jack | Native renderer / costume equipment slot | Browser proof only; no native shipping costume support yet |
| Other new seasonal wearables | Every pig/animation/frame | Raster card artwork is not equipped accessory artwork or placement acceptance |
| Old Wisp | Live ownership and rewards | Unique instance ledger, earned mint provenance, trusted day/time zone, locked mutual-confirmation transaction and atomic reward required; permanent entitlement booleans cannot support consumption unchanged |

The economy/player-system change is queued as
`halloween-personal-wearable-trader` in release followups. No database push,
production mutation, distributable build or deployment was performed.

## Checks

- 12 targeted card/trader/costume suites: **85 tests passed**.
- TypeScript and scoped source ESLint: passed.
- Complete seasonal art registry check and browser preview build: passed.
- `quality:check`: blocked by existing repository-wide contracts: 138 text
  clamps exceed budget 91; `20260916140000_my_drives_opener_pig.sql` lacks the
  required default-role revoke for `my_drives`. These are unrelated to this patch.
- The quality watcher previously hit the environment's open-file limit.


This is a historical 39-card verification record. The later five-costume expansion appends cards 040–044; see `costume-expansion.md` and `costume-expansion-verification.md` for current scope.
