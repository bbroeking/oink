# Pig angle audit — 2026-09-15

Every worn cosmetic on Rosie at the five rest angles (Front, Front sit, Turn R,
Turn L, Turn L sit), on the shipping renderer, via `ticklethepig://pig-angle-audit`
(`?bare=1&from=N&count=5`, 30 pages; hats and face items re-shot at larger cells).
The question: which items need to **swing with the head** when the pig turns,
and what fixes each.

## Verdict in one line

Placement is not the problem — the front RelSpec lands on the turned families'
anchors correctly for nearly everything. What breaks is **art that has a
front**: anything with a brim, a visor, a face opening, an emblem, or a pair of
lenses stays camera-facing on a three-quarter head and reads pasted on. Those
need a side sprite (`tools/gen_side_items.py`). Symmetric things (crowns,
wreaths, cones, bows, scarves, most held tools) turn fine as they are.

The six existing side sprites (acorn_bow, astronaut, aviator_sunglasses,
cowboy, tophat, wizard) all sit right, standing and seated.

## Queue A — needs a SIDE SPRITE

### Face (31 — every front-only face item)

All 31 front-only Face items read as a flat cut-out on the turned head; the
masks worst (they cover the whole face), lenses next. Priority order:

1. Full masks: `venice_mask vr_headset skull_mask sleep_mask carnival_mask
   cat_mask hero_mask robber_mask domino midnight_eye_mask masquerade`
2. Glasses / goggles: `three_d_glasses swim_goggles safety_goggles galaxy_shades
   heart_sunglasses pixel_glasses nerd_glasses round_glasses frost_spectacles
   cocoa_sheen_specs coconut_shell_shades jam_jar_lenses knight_visor_specs
   lollipop_specs petal_specs wallow_bronze_specs`
3. One-eyed: `monocle royal_pince_nez opera_lorgnette slop_club_monocle_crest`
   — these ALSO land on the far eye on the turn: give the side sprite its own
   pivot on the near eye in the placement studio.

### Hats with a front (13)

`pirate_tricorn messenger masquerade_plume_hat silver_plume_helm
aurora_glow_hood wallow_rookie_cap squire_feather_cap viking_helmet
slop_club_signet_visor muddy_cap ticket_takers_cap paper_boat bog_helmet`

Roughly in that order: tricorn (skull emblem), messenger + rookie cap (visor),
plume hat (a top hat — same case as `tophat`), plume helm + aurora hood (face
opening), then the brimmed caps.

### Held — optional (5)

Flat, camera-facing held art is tolerable because the hoof is in front of the
body either way; these are the ones that would gain from a turn, lowest
priority: `archery_bow crew_pennant festival_pennant feathered_fan balloon`.

## Queue B — PLACEMENT only (no new art)

- `slop_club_signet_visor` — floats above the head even face-on; RelSpec pivot.
- `magic_wand` — tiny in every view (widthFrac).
- `balloon` — on the turn the balloon sits inside the belly, not in the hoof;
  check `hand_r` on `face` / `face_sit`.
- `prize_sash` — sits at the belly on the turn; fine face-on.
- Monocle family — near-eye pivot, see above.

## Fine as-is (~100)

Crowns and circlets (crown, ermine_coronet, frost_monarch_crown,
frosted_cupcake_crown, ganache_truffle_crown, hungerers_crown, release_party_crown,
slop_club_signet_crown, sovereign_jewel_crown, swamp_crown, wallow_marsh_crown,
candlelit_circlet), wreaths (daisy_flower_crown, hibiscus_sun_crown, leaf_crown,
moth_waltz, slop_club_laurel_cap), symmetric hats (beanie, chef_toque, party,
reed_hat, halo, mushroom_cap, slop_bucket_hat, slop_pail_topper,
pineapple_tiki_hat, ringed_planet_hat, watering_can_hat, whipped_swirl_cap,
crescent_moon_cap, cherry_pop_bow, bunny_ears, cat_ears, devil_horns), every
bow, every neck item, and the held tools/food (mug, cone, pizza, shovel, bucket,
sword, scepters, trowels, ball, wand, pencil, magnifier, lantern, cup, card,
buckler, truffle, umbrella, flowers, corn, controller).

## Tool note

The first pass of the sheet reported every hat as "squashed" on the turn. That
was the audit tool, not the art: a hat on the `face` families rides above the
300pt canvas top and the cell clipped it (`clipped-cells-before-fix.png`).
Cells now scale the canvas to 82% with the headroom above; the hats were
re-shot and the verdicts above are from the corrected sheet. Lesson for the
standard: a review surface must show the whole stage, never the canvas box.

## Next

```sh
# Queue A, in priority order, three codex lanes:
python3 tools/gen_side_items.py venice_mask vr_headset skull_mask sleep_mask carnival_mask cat_mask hero_mask robber_mask domino midnight_eye_mask masquerade
python3 tools/gen_side_items.py pirate_tricorn messenger masquerade_plume_hat silver_plume_helm aurora_glow_hood wallow_rookie_cap squire_feather_cap
```

Then re-run the sheet with `?side=1` to check placement of the new sprites, and
the placement studio for the monocle family's near-eye pivot.

## Follow-up — same day

Queue A generated and reviewed on the pig (50 side sprites now: 28 face,
17 hats, 5 originals). Two renderer rulings fell out of it:

- The three-quarter camera is stated from the pig's geometry (near side =
  viewer's LEFT); the generator had it inverted. Eye-line items get a
  lens / mask / one-eye addendum (`tools/gen_side_items.py`).
- An item on the `eyes` anchor of the turned families sits back
  `TURNED_EYE_SHIFT` (16 canvas px) so its bridge is over the nose — the
  midpoint of a near eye and a foreshortened far eye is not where a bridge
  goes. Single-eye anchors are already on their eye and take no shift.

`slop_club_monocle_crest` now anchors `eye_l` with its pivot on the lens.
