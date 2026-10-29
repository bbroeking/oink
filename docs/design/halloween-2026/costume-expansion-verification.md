# Five fitted Halloween costumes: acceptance record

Verified 2026-10-14 in the local card game at `http://127.0.0.1:4320/` and
integrated into the existing `app/card-packs-prototype.tsx` route.

Count Snout, Moonpuff, Little Reaper, Patchwork Pal and Candy Corn append cards
040–044. Spooky Snouts now has 44 cards: 29 modular wearables, 6 full-body
costumes and 9 places. Existing card identities/order are preserved. All 44
selected raster card illustrations are registered.

The existing [Claude Design canvas](https://claude.ai/design/p/aec2145f-9fe2-4416-ab82-50c0100f537d?file=Halloween+-+Spooky+Snouts.dc.html)
was extended with the selected Tickle the Pig Design System. Its radio rail,
Owned/Wearing versus Locked/Preview states, open face/ear windows, short romper
proportions and palettes guided implementation. [Saved design proof](claude-costume-expansion.png).

## Game flow

Both new and restored saves receive one unopened five-card costume packet.
Opening uses the existing ceremony, shared card renderer, receipts and album.
Each first card grants its matching local wearable. Reopening preserves the
original receipt, one copy of each card, the same five wearable grants and zero
base-set foil progress. The five card reveals and receipt were exercised in the
browser. [Receipt evidence](costume-expansion-unlock-receipt.png).

Locked costumes can be previewed and frame-stepped; Try on remains disabled.
Card detail routes to the chosen costume. Owned Try on changes the saved wearing
ID. All five costumes were worn. Candy Corn remained wearing after reload.
Take off restored the original Rosie on the same frame, and remained removed
after reload. Unknown/unowned wearing IDs are rejected during restoration.
An explicit card preview is transient: reopening the workshop selects the saved
wearing costume, rather than silently selecting the last inspected card.

## Visual and animation acceptance

Runtime artwork is ten separate transparent clothing assets, with true-alpha
face, ear and hoof apertures. Card paintings are never used as runtime pig
textures or source sprites. The shared React Native/browser renderer mounts the
unaltered source PNG, followed by hood and romper. All layers use one
`usePigPlayback` clock; crown position, tilt and head-width scale come from the
reviewed `PIG_ATTACHMENT_FRAMES` geometry. Removing clothing keeps that clock.

All five costumes were reviewed on Rosie `idle_1` through `idle_12`: **60 frames**.
At desktop game size the fitting stage is 360px, with the source pig at 300px.
Source-image filenames match each displayed frame. No floating, extra limbs,
seams from cropped artwork, exterior alpha halo, face replacement, or visible
hood jump was found in this family. Brows/forehead and some tail/upper-leg
coverage are intentional. Eyes, cheeks, snout, mouth, inner ears and original
hooves remain readable through clothing openings.

Frame evidence and contact sheets:

- [Count Snout](costume-expansion-frames/count-snout-sheet.png)
- [Moonpuff](costume-expansion-frames/moonpuff-sheet.png)
- [Little Reaper](costume-expansion-frames/little-reaper-sheet.png)
- [Patchwork Pal](costume-expansion-frames/patchwork-pal-sheet.png)
- [Candy Corn](costume-expansion-frames/candy-corn-sheet.png)
- [Per-frame source records](costume-expansion-frames/verification.json)

Each costume played at normal tempo across two observed 12→1 loops without a
visible attachment discontinuity. [Playback samples](costume-expansion-frames/playback.json).
Reduced motion held frame 1 across 800ms. Manual controls remain available.

Phone fitting is stacked below the selector, with controls and actions below the
scene. At 393px the scene bounds are x46.5–346.5 (300px); at 320px they are
x20–300 (280px). The complete scene scales coherently. An intermediate flex
layout that clipped the scene or overlapped controls was rejected and repaired.
[393px proof](costume-expansion-phone-393.png), [320px proof](costume-expansion-phone-320.png).

## Remaining exceptions / release gates

| Items | Pig / animation / frames | Boundary |
| --- | --- | --- |
| All five new costumes | Rosie `face_1–4`, `face_sit_1–4`, `walk_1–4`, `jump_1–4`, `happy_1–4`, `sad_1–4`, `tired_1–4`, `surprise_1–4`, `wave_1–4` | No fit acceptance; author pose-specific art/occlusion before use |
| All five new costumes | Rosie sit/bounce variants and transitions to non-idle poses | Movement and layer review pending |
| All five new costumes | Copper, Pepper, Bandit, Pickles and Biscuit: all 48 frames per pig | Distinct anatomy fit pending |
| All six costumes including Hollow Jack | Native device / live Closet, Home, Barn and Visit | Shared RN preview implementation exists; physical-device and cross-surface acceptance not performed |
| All six costumes | Live wardrobe ownership, transfer and consumption | Production instance ledger, trusted grants and equipment persistence remain gated; local card wardrobe and Old Wisp story are separate demo authorities |

There was no database push, deployment, distributable build, production inventory
write or live currency grant. The expansion is queued for release verification
as `halloween-fitted-costume-expansion`.

## Source and checks

Built-in `image_gen` produced five painted card illustrations, five hood assets
and five romper assets. Generated outputs were copied unchanged into
`assets/images/trading-cards/halloween-2026/` and
`assets/images/costumes/{count-snout,moonpuff,little-reaper,patchwork-pal,candy-corn}/`.
Exact prompts and source paths:

- [Card generation](costume-card-expansion-art-generation.json)
- [Hood generation and corrections](hood-expansion-art-generation.json)
- [Romper generation](romper-expansion-art-generation.json)
- [Independent integration review](costume-expansion-review.md)

13 focused card suites: **92 tests passed**. TypeScript, scoped ESLint, complete
art registration, preview build and diff whitespace checks passed.
`quality:check` still fails the existing repository contracts: 138 text clamps
exceed budget 91, and `20260916140000_my_drives_opener_pig.sql` lacks the required
default-role revoke for `my_drives`. The quality watcher hits the environment's
open-file limit. No unrelated failures were repaired in this change.
