# Spooky Snouts — Halloween 2026

Spooky Snouts now has 44 collection cards: 29 modular wearables, six full-body
costumes, and nine backgrounds. The [content brief](content-brief.md)
and [structured catalog](content.json) define the fit and unlock requirements.
All 44 have selected raster card illustrations. Cards 001–034 retain their IDs
and numbers; Night Two adds cards 035–039 and the fitted costume expansion appends 040–044.

## Latest correction: fitted Rosie and Old Wisp

The founder rejected the humanoid pumpkin outfit and stale Bandit picture.
Hollow Jack now uses a broad pumpkin hood with a real face opening, a short
pig-shaped romper and visible original hooves. The new selected card illustration
is v2; the discarded v1 stays in generation history. The live fitting study uses
untouched Rosie frames under painted clothing layers. The approved Bandit v2
portrait replaces the jagged old model in the local workshop.

[Old Wisp's daily wearable errand](spooky-trader-loop.md) is the updated mini-game
direction and an isolated playable prototype: each player gets a personal daily
request, friends exchange actual wearables, and handover consumes the requested
garment for a draft Tickle receipt. The founder explicitly chose wearable items,
not spare cards or Satchel Finds. This changes the earlier permanent usable
wearable assumption: historical discovery stays recorded, but a surrendered
item is unavailable to equip and opening replay does not replace it. Live
entitlements are unchanged; production requires separate instance ownership.

The earlier card-copy exchange workbench remains labelled as an earlier
experiment. It is a separate demo authority and is not the new wardrobe economy.
See [trader review](spooky-trader-review.md),
[Bandit asset audit](bandit-asset-audit.md), and
[Rosie fit notes](rosie-costume-fit.md).

## Five more fitted costumes

Count Snout, Moonpuff, Little Reaper, Patchwork Pal and Candy Corn each have a dedicated costume card (040–044), painted card artwork, and separate transparent hood/romper assets. The [expansion contract](costume-expansion.md) records identities and ownership rules. The [updated Claude Design direction](claude-costume-expansion.png) guides the selectable fitting room. A five-card local packet grants their first wearable copies through the existing opening and album system; try-on is gated by local ownership. Full production activation still requires live wearable-instance ownership and complete pose/pig acceptance.

## Night Two: costumes, exchanges and Spook

The [Claude Design canvas](https://claude.ai/design/p/aec2145f-9fe2-4416-ab82-50c0100f537d?file=Halloween+-+Spooky+Snouts.dc.html)
now includes a full-body showpiece, five new card concepts, and before/ready/done
trade compositions using the project's selected design system. Saved evidence:
[costume concept](claude-night-two-desktop.png) and
[trade direction](claude-night-two-trade-desktop.png).

Hollow Jack is a pumpkin-and-vine creature suit with a dedicated costume
category. Cobweb Crown, Ghostlight Lantern, Little Haunt (a spectral bog frog),
and Whispering Crypt add more spooky variety. The selected v2 card illustration shows Rosie wearing a broad hood and short romper; it is a fit reference, not a certified sprite family. The
[transformation contract](transformation-contract.md) specifies per-pig,
per-frame front/back masks, preserved identity and saved gear hide/restore.

The local preview's **Halloween Workshop** demonstrates a real two-party
exchange authority: Rosie offers a standard Moonbrew Witch Hat spare and
simulated Pippin offers a standard Hollow Jack spare. Exact finishes,
revision-bound confirmations, cancellation/expiry, all-or-nothing commit and
permanent first-copy unlocks are implemented in the isolated demo. Only validated
committed receipts are persisted. [Trading contract](trading-contract.md) and
[targeted review](trading-review.md) document the boundary. Client-editable local
receipts are not production account authority.

The browser fit study now renders an unchanged 300px Rosie under separate transparent hood and romper art, with one shared clock, pause and twelve-frame stepping. The earlier whole-silhouette texture mask was rejected. Other pigs, non-idle poses, full front/back occlusion and live equipment integration remain pending; the expansion adds a shared native/browser prototype renderer with device acceptance still pending. See the [latest verification and exceptions](wearable-trader-fit-verification.md).
**Spook** is the provisional transformation benefit: a playful friendly spirit
reaction with no currency, score or streak boost. The workshop reaction is local.

## Collection direction

Witch, vampire, mummy, skeleton, patchwork monster, pumpkin, sheet ghost, and
werewolf are the recognizable starting points. Pirate, scarecrow, mad scientist,
bat, and fortune teller add five more looks. Most costumes leave the pig's
face, coat, and silhouette readable. The short sheet ghost is the deliberately
more-covered option. Pieces can be mixed across looks and used on all six pigs.

The backgrounds are Lantern Porch, Haunted Orchard, Moonlit Graveyard, Witch's
Wood, Cobweb Barn, Candy Lantern Trail, Haunted Ship Deck, Harvest Moon
Cornfield, and Whispering Crypt. Each leaves the central standing
area clear and puts its strongest shapes and props toward the scene edges.
They are new settings rather than recolors of the existing pumpkin patch.

The selected Tickle the Pig Design System guides the private
[Claude Design board](https://claude.ai/design/p/aec2145f-9fe2-4416-ab82-50c0100f537d?file=Halloween+-+Spooky+Snouts.dc.html).
The board is a concept review using original pig sprites and draft illustrated
costume overlays. It does not certify production placement or final artwork.
Only the new Halloween page is owned by this task; the other card-design pages
are preserved.

Saved board views: [first four costumes](claude-costumes-first-four.png),
[remaining costumes](claude-costumes-second-four.png),
[original six backgrounds](claude-backgrounds.png), and
[card unlock specimen](claude-card-unlock.png).

The updated board compares seasonal specimens against the unchanged Mud Shovel
card. The implemented cards reuse the shared `CollectibleCard` geometry, cocoa
outline, Fredoka name plate, Nunito rules, art window, lower band, and footer.
Lilac identifies SSN; ITEM/PLACE replaces gameplay categories, and COLLECTION
CARD replaces Training. Seasonal cards print no invented stats or Rank.

## Playable card integration

The later [card magic deep dive](card-magic-deep-dive.md) critiques this
baseline and defines the next visual/motion slice. Its recommendations and
Claude Design workshop are exploratory; the runtime described below still
uses the current shared frame and opening.

Open the [local card preview](http://127.0.0.1:4320/). The separate Spooky Snouts
packet reveals Moonbrew Witch Hat, Hedge Broom, and foil Lantern Porch. The first
copy records its matching local cosmetic unlock; receipt replay is idempotent,
and a repeated card copy does not create another cosmetic. The saved album
switches between the original 88 cards and the additive 44-card seasonal set.
Opening, receipt, album, and details use the same renderer and selected raster
art. The seasonal set stays outside constructed decks and Hedge Run.

Review [the new card specimens](new-card-preview-393.png),
[the base/seasonal comparison](base-seasonal-family-comparison.png),
[previous 34-card contact sheet](card-contact-sheet-393.png), and
[the unlock receipt](preview-unlock-receipt-393.png).
[Verification notes](card-integration-verification.md) record playback,
reload, narrow-phone, and source checks. [Art QA](art-qa.md) covers selected
versions and rejected attempts; [generation provenance](art-generation.json)
saves the prompts and sources.

```sh
node scripts/build-seasonal-card-art.mjs --require-complete --check
node scripts/prototypes/card-packs/build.mjs
python3 -m http.server 4320 --bind 127.0.0.1 --directory artifacts/card-packs-preview
```

## Cards and wearable grants

Working rule: the first owned copy records discovery and grants its matching wearable or costume once; a background remains a permanent entitlement. The later Old Wisp direction allows actual wearables to be traded or surrendered. Historical discovery does not replace surrendered clothing. Another copy remains in the album and does
not grant the same item again. A finish changes presentation, not the unlock.
A modular look combines pieces the account already owns; acquiring one modular
card does not grant the entire look. Hollow Jack is a separate one-piece costume
whose own card grants that costume entitlement.

Halloween is modeled as a separate card collection alongside the existing
Great Hunger pass. The pass currently extends through November 12, 2026; this
work does not move its end date or consume existing pass rewards. Collection
activation dates, earned pack sources, and final assortment remain draft.

See [unlock integration](unlock-integration.md) for the locally authored
server ownership, receipt, and client repository boundary. Card openings and
cosmetic receipts in the prototype remain local demo ownership.

## Reusing the placement tools

The project skill is
[pig-accessory-placement](../../../.agents/skills/pig-accessory-placement/SKILL.md).
The detailed [placement process](../../placement-process.md) covers authoring
and the production-renderer audit preview.

```sh
npm run accessory:studio
npm run accessory:sheets
npm run accessory:preview:build
npm run accessory:preview:serve
npm run accessory:validate
```

Use the studio to save authored item pivots and per-pose fits. Use the audit
preview to inspect every source frame and normal-size playback on all six pigs.
Regenerate measured crown landmarks only when source pig art changes; item
fitting should preserve that shared anatomy calibration.

## Activation work

The 44 selected card illustrations pass card-art QA. They are not automatically production
wearable sprites or a normal-size pig placement certification. Prepare and
register shipping wearable assets, author required front/profile fits,
and run the complete placement audit. Then seed validated item/card mappings,
connect eligible server-earned pack grants and the client receipt flow, choose
collection dates, and verify account ownership across devices.

The database migration is local and requires the project's explicit database
push authorization before application. No Halloween content is activated by
this design handoff. Post-release verification is queued as
`seasonal-card-cosmetic-unlocks` and `halloween-fullbody-and-card-exchange`.

Latest [Night Two verification](night-two-verification.md) includes the new five
card previews, trade/replay, Spook, and all twelve source/mask idle frames.

## Earlier 34-card verification on October 14

- The reusable placement command completed export, a focused contact sheet,
  preview build, and all fifteen attachment geometry tests. It also handles
  invalid IDs, unknown commands, invalid ports, and invocation outside the
  repository. Preview serving binds only to localhost.
- The final focused card run passed seven suites and 45 tests, including the
  34-card mapping, persisted unlock integrity, renderer, opening playback, and
  gameplay exclusions. TypeScript, targeted ESLint, and diff checks pass.
- A fresh disposable PostgreSQL 17.6 database passed the migration and
  `73_seasonal_card_unlocks_smoke.sql` /
  `74_seasonal_card_concurrency_smoke.sql`. Checks cover routine privileges,
  source conflicts, null/empty payload rejection, wrong-owner access, duplicate
  copies, immutable reward mappings, replay after deactivation, account
  deletion, and overlapping packs in opposite card order. The container was
  removed after testing; the live database was not contacted.
- All thirty-four draft mappings resolve to unique proposed items, with no
  existing item/card ID collisions. All 34 selected art files load in actual
  300 × 420 card details at a 393px phone viewport. Card 034 also fits at 320px.
  Full-motion three-card playback, inspect/resume, receipt replay, reload, and
  set switching were verified. These checks do not replace pig-frame fitting
  or live backend activation.
- `quality:loop` hits the host's `EMFILE` watch limit. `quality:check` still fails
  on the prior baseline: 138 line clamps against a budget of 91 and the missing
  default-role revoke contract in
  `20260916140000_my_drives_opener_pig.sql`. The new migration adds no reported
  security-contract violation.
- The skill frontmatter was parsed and inspected; the bundled skill validator
  could not run because the available Python environments lack PyYAML.

Rerun the focused database contracts with Docker running and the official
`postgres:17.6` image already available locally:

```sh
bash scripts/db-harness/run-seasonal-cards.sh
```

The runner exposes no ports, disables container networking, applies only the
stub and seasonal-card migration, and removes its disposable container on exit.
