# Spooky Snouts — Halloween 2026 content brief

Working subtitle: **Moonlit Mischief**.

**Status:** Approved concept pending art and rollout. Each cosmetic unlock card
grants one matching wearable on its first copy, or permanently unlocks a place. The latest Old Wisp direction lets owned wearables be transferred or surrendered. No live dates, pack
odds, prices, or production grants are defined here.

## Assortment

Thirteen familiar, unlicensed Halloween looks provide two modular pieces each.
Three independent spooky extras add a hat, held lantern, and aura. One deliberately
over-the-top transformation, Hollow Jack, is a one-piece full-body costume rather
than a simulated hat or mask. The modular assortment still avoids complex cape
and neck-wrap geometry; the costume follows the separate transformation contract.

| Look | First piece | Second piece | Fit intent |
| --- | --- | --- | --- |
| Rosie Hedge Witch | Moonbrew Witch Hat (`hat`) | Hedge Broom (`held`) | Open face and ears; profile brim art required |
| Pepper Little Vampire | High Collar Scarf (`scarf`) | Pip Candle (`held`) | Flat front V/collar silhouette; face clear; no cape or back layer |
| Copper Patchwork Monster | Bolt Headband (`hat`) | Stitched Bow (`bow`) | Original soft-toy monster language; ears remain readable |
| Bandit Skeleton | Bone Mask (`mask`) | Crossbones Bow (`bow`) | Open eye/snout apertures; coat remains visible around mask |
| Pickles Mummy | Linen Knot Headwrap (`hat`) | Scarab Lantern (`held`) | Crown-only bandages; no body wrapping |
| Biscuit Pumpkin | Lantern Sprout Cap (`hat`) | Pumpkin Treat Pail (`held`) | Pumpkin cue without enclosing the pig's face |
| Rosie Friendly Ghost | Silly Sheet Ghost Hood (`hat`) | Spirit Glow (`aura`) | Optional more-covered hood plus a behind-pig glow; ears and snout still emerge |
| Copper Moon Howler | Moonpuff Wolf Ears (`hat`) | Moon Charm (`necklace`) | Pig ears and face remain readable; charm is one flat front layer |
| Bandit Halloween Pirate | Moonwake Tricorn (`hat`) | Toy Cutlass (`held`) | Low profile brim with authored side art; cutlass is blunt and visibly toy-like |
| Pickles Halloween Scarecrow | Patchwork Straw Hat (`hat`) | Straw Bow (`bow`) | Loose straw silhouette stays clear of eyes and ears; no body costume |
| Pepper Halloween Mad Scientist | Spark Goggles (`glasses`) | Bubbling Flask (`held`) | Open eye/snout registration; flask remains compact and whimsical |
| Biscuit Halloween Bat | Twilight Bat-Ear Cap (`hat`) | Bat-Wing Bow (`bow`) | Costume ears sit between visible pig ears; wing bow stays compact |
| Rosie Halloween Fortune Teller | Starlight Headwrap (`hat`) | Pocket Crystal Ball (`held`) | Crown-only wrap with authored profile; no neck/body drape |
| Hollow Jack | Hollow Jack (`costume`) | Complete one-piece look | Dedicated pumpkin-vine full-body transformation; never routed through the hat slot |
| Count Snout | Count Snout (`costume`) | Vampire hood and short vest romper | Burgundy/black, real face and hooves visible |
| Moonpuff | Moonpuff (`costume`) | Wolf hood and fuzzy romper | Warm gray, cream tuft, real pig ears inside wolf wraps |
| Little Reaper | Little Reaper (`costume`) | Hood and short robe romper | Charcoal/lilac, friendly face window, no skull or weapon |
| Patchwork Pal | Patchwork Pal (`costume`) | Plush monster hood and stitched romper | Sage hood, small side bolts, plum patches |
| Candy Corn | Candy Corn (`costume`) | Candy hood and striped romper | Cream/orange/yellow, short original pig proportions |

Cobweb Crown (`hat`), Ghostlight Lantern (`held`), and Little Haunt (`aura`) are
independent reusable spooky extras. They do not form a forced pair. Little Haunt
is a spectral painted bog-frog and a permitted friendly spirit; it must not be
built from a real pig sprite or pig base.

The original Silly Sheet Ghost Hood remains a modular head piece. Treat it as
optional in the final lineup if animation testing cannot keep its openings
registered. It ends above the shoulders and does not imitate the new costume
category. Hollow Jack is the scoped exception: a dedicated full-body system may
cover the whole source pig, while the player's selected pig identity remains
present in UI, ownership, and social surfaces. Art may leave a true face window
or a small pig-color seam beneath the face when that makes the pig easier to
recognize; neither is mandatory before frame testing.

Nine new places complete the assortment: Lantern Porch, Haunted Orchard,
Moonlit Graveyard, Witch's Wood, Cobweb Barn, and Candy Lantern Trail. They are
joined by Haunted Ship Deck, Harvest Moon Cornfield, and Whispering Crypt. All nine are distinct
from the existing `pumpkin_patch` background and from one another in setting,
silhouette, and dominant lighting.

## Unlock behavior

The approved concept contains 44 stable cosmetic-unlock card identities mapped
one-to-one to 29 modular wearables, one full-body costume, and nine backgrounds.
The original 39 card IDs remain in their exact order; cards 040–044 are appended
as Hollow Jack, Cobweb Crown, Ghostlight Lantern, Little Haunt, and Whispering
Crypt. On a card's first copy, a wearable grants one owned garment instance;
a background remains a permanent scene entitlement. Card discovery stays in
the album, but usable wearable ownership is transferable and consumable under
the founder's later Old Wisp direction. This supersedes the earlier permanent
usable-wearable assumption for the proposed seasonal-instance model. Existing
live ownership is unchanged.

Trading a card copy does not move its garment. Trading the wearable itself
transfers it; giving that wearable to Old Wisp consumes it. First-card grant
receipts prevent replay or a new client nonce from replacing the garment.
Repeated cards stay copies and never mint another instance of the same first
acquisition. Replacement acquisition needs a separate accepted earned source.
See spooky-trader-loop.md for the explicit prospective ownership contract.

These are cosmetic unlock cards in the collection and reward flow. They do not
define gameplay-card actions, combat effects, tabletop stats, or balance
values. This is a content contract, not reward authority. The server-authored card
opening receipt remains the source of truth for ownership. If set completion is
introduced later, revise the approved mapping before implementation; do not
silently make the current individual-card IDs grant bundles.

## Art and fit contract

Use the established soft children's storybook language: bold ink outline,
painted saturated fill, rounded friendly silhouettes, restrained internal
shading, and strong recognition at an 86px shop-card size. Halloween should
feel cozy and playful. Avoid gore, photoreal bones, sharp threatening teeth,
and franchise-specific shapes.

The 29 modular wearables ship as transparent, accessory-only PNGs. Never bake
Rosie or another pig into a modular production asset. Concept composites may use
the `sourcePigForConcept` named in `content.json`, but the extracted deliverable
contains only the item. All modular pieces must work on Rosie, Bandit, Pickles,
Biscuit, Copper, and Pepper. Validate them across every animation family before
approval.

Hollow Jack uses transparent, registered full-body masks authored for each pig
and source frame. It may fully cover the source sprite, but it never replaces or
mutates that source art. It uses a shared frame clock with the pig and separates
behind-pig and in-front-of-pig costume regions where the silhouette needs honest
occlusion. Equipping it hides all other gear visually while preserving the
player's saved selections; removing it restores those selections. This is a
content and rendering target, not a claim that production fit or shipping art
already exists. See `transformation-contract.md`.

Pieces need authored front/profile art where `sideArt.required` is true, tested
across all six pigs. Preserve the existing calibrated production anchors, use
uniform scale, and keep each authored pivot stable through front/profile
transitions. Final coordinates come from placement tooling after art exists;
this brief does not guess them or require a full-canvas source size. Held
objects may mirror when facing changes, with the grip fixed to `hand_r`. The
High Collar Scarf and Moon Charm are trimmed, flat front accessories with no
split front/back rendering dependency. No modular item may pretend to be a
full-body slot; only `category: costume` enters the dedicated transformation path.

Backgrounds ship as opaque, character-free scenes. Each composition must leave
an uncluttered central ground and contrast-safe read area large enough for the
normal 300px pig stage. Put lanterns, stones, webs, candy, and other high-detail
props toward the margins; keep the pig silhouette and equipped items legible.

## Production checks

Before content integration:

1. Preserve the approved one-card-to-one-cosmetic first-copy mapping unless product direction explicitly changes.
2. Re-run catalog collision checks for all 44 cosmetic IDs and all 44 card IDs,
   and verify the first 34 card IDs and order remain unchanged.
3. Generate front and mandatory side/profile accessory art, then tune pivots in
   the placement studio without changing the shared pig landmarks.
4. Review all six pigs over all 48 source frames at normal game size, including
   loops and front/profile transitions. Hollow Jack requires a complete 6 × 48
   registration and occlusion scan before it can be called production-ready.
5. Verify transparent edges for accessories, full opacity for backgrounds, and
   the empty central ground/read area.
6. Verify costume equip hides and later restores every saved modular slot, and
   verify card-copy trading does not move garments, while wearable transfer or handover updates usable ownership without replay reminting.
7. Record any item, pig, animation, and frame exceptions before enabling the
   season content.

## Social proposal

The costume can serve **Connect** with one small, legible interaction: when a
player visits a friend while wearing Hollow Jack, the friend's pig gets a
special **Spook** reaction. It is presentation only by default: no score,
currency, drop-rate, streak, or combat benefit. Whether Spook belongs in the
first slice remains a product choice; the costume and unlock contract do not
depend on it.

The structured source of truth for this proposal is `content.json` beside this
brief.
