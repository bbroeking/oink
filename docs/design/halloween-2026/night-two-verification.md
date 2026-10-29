# Night Two verification — October 14, 2026

The Claude Design Night Two output guided the costume showpiece, seasonal card
labels, paper trade mat, ready seals and playful Spook preview. The owned canvas
preserves the existing card magic exploration.

## Implemented and checked

- Catalog and art: 39 unique cards and selected PNGs, preserving 001–034 IDs and
  numbering. Costume 035 prints COSTUME; scene 039 prints PLACE. The art registry
  generator passes `--require-complete --check`. Every new card 035–039 loads in
  the real detail renderer at a 393 × 852 viewport with the existing card frame.
- Exchange: Rosie offers one exact-finish Witch spare, simulated Pippin offers
  one Hollow Jack spare. Browser checks show edits clear both seals; second
  same-revision confirmation commits both transfers. Completion shows first-copy
  unlocks and retained inventories of 2 standard + 1 foil on both sending sides.
  Browser cancellation and expiry leave both inventories untouched. A completed
  receipt survives reload and final confirmation replay returns the
  same receipt. Unit contracts also cover last-copy protection, reservations,
  cancellation, expiry, blocked players, malformed storage and conservation.
- Persistence: only committed receipts restore in the scoped workshop key.
  A pending offer or confirmation is discarded on reload. Reconstruction is
  schema validation of local demo state, not production authentication.
- Spook: Little Haunt appears between Rosie and Bandit after the button and
  disappears when sent home. No friend invitation, visit call or reward is sent.
  The effective prototype reduced-motion override now reaches both the Spook
  animation and mask clock.
- Masking study: all twelve Rosie idle frames were stepped at a 300px stage.
  In every observation the displayed source PNG equals the CSS alpha-mask PNG;
  frame 12 wraps to frame 1, and normal 6fps playback resumes. Reduced motion
  holds frame 1. The paint texture is a static feasibility surface, not fitted
  Hollow Jack art. No face window or front/back occlusion is claimed.
- Narrow view: the 320px workshop has no observed content outside the viewport.
  The 393px phone and 1000px comparison views were checked; original and mask
  stages remain 300px rather than being scaled for screenshots.

The [12-frame contact sheet](mask-study-contact-sheet.png) and
[per-frame screenshots / observations](mask-proof-frames/verification.json)
make the mask proof reviewable. Other evidence:
[completed exchange](workshop-complete-desktop.png),
[phone trade](workshop-trade-phone.png),
[phone mask and Spook](workshop-mask-phone.png), and
[new cards 035–039](card-035-phone.png).

## Verification gates

72 focused card/domain/playback/workshop tests pass across nine suites (including
four card-render checks and three workshop checks). TypeScript, scoped ESLint,
preview bundling and art-registry checks pass. Targeted trading review resolved
the expiry and stored-receipt findings.

`quality:loop` cannot watch on this host (`EMFILE`). `quality:check` remains
blocked by the unchanged repository baseline: 138 line clamps against budget91,
and the missing default-role revoke for my_drives in
20260916140000_my_drives_opener_pig.sql. These are not new Halloween findings.

## Remaining exceptions and production boundary

| Item | Pig / animation / frame | Remaining work |
| --- | --- | --- |
| Hollow Jack 035 | All six pigs; idle1–12; face, face_sit, walk, jump, happy, sad, tired, surprise, wave1–4; derived sit/bounce | Fitted front/back costume masks and face-window/occlusion art are unauthored. Rosie idle proof checks alpha masking only. |
| Hollow Jack 035 | Native Barn, Visit, Closet and compact portraits; all frames | Dedicated costume catalog/entitlement/equipped slot, saved modular gear hide/restore and native rendering are not implemented. |
| Cobweb Crown 036 | All six pigs and all source frames | Card artwork exists; shipping front/profile sprites and authored head placement are pending. |
| Ghostlight Lantern 037 | All six pigs and all source frames | Card artwork exists; hand pivot and held-item fit are pending. |
| Little Haunt 038 | All six pigs and all source frames | Card artwork and local Spook composition exist; behind-pig aura registration is pending. |
| Whispering Crypt 039 | Native backgrounds and every pig stage | Card scene exists; production scene registration and full-stage composition remain pending. |
| Seasonal card exchange | Real friends, accounts and devices | Local seeded workbench only. It is separate from the packet-demo album; no live card inventory is moved. Production requires authenticated server transactions, trusted time, durable reservations and cross-device receipts. |
| Spook | Real friend visits | Local visual benefit preview only; live interaction is pending. |

No database push, live activation, distributable build or deployment occurred.
Post-release acceptance is queued as halloween-fullbody-and-card-exchange.

This is a historical 39-card verification record. The later five-costume expansion appends cards 040–044; see `costume-expansion.md` and `costume-expansion-verification.md` for current scope.
