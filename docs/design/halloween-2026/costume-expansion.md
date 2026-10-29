# Spooky Snouts costume expansion

## Catalog contract

Cards 040–044 append five dedicated, one-piece costumes to the existing 39-card
Spooky Snouts order. Cards 001–039 keep their IDs and printed numbers.

| No. | Card ID | Costume item ID | Name | Theme |
| --- | --- | --- | --- | --- |
| 040 | `halloween_2026_card_count_snout_costume` | `halloween_2026_count_snout_costume` | Count Snout | Friendly vampire |
| 041 | `halloween_2026_card_moonpuff_costume` | `halloween_2026_moonpuff_costume` | Moonpuff | Friendly werewolf |
| 042 | `halloween_2026_card_little_reaper_costume` | `halloween_2026_little_reaper_costume` | Little Reaper | Friendly grim reaper |
| 043 | `halloween_2026_card_patchwork_pal_costume` | `halloween_2026_patchwork_pal_costume` | Patchwork Pal | Friendly patchwork monster |
| 044 | `halloween_2026_card_candy_corn_costume` | `halloween_2026_candy_corn_costume` | Candy Corn | Candy-corn onesie |

Every card has the `costume` category and the same first-copy rule as Hollow
Jack. The first-ever card acquisition grants its matching wearable once. A
replayed opening returns the original receipt and does not mint the wearable
again. After the grant, the card and wearable have separate lifecycles: card
copies may be traded, and the wearable may be consumed or traded by a future
wearable system without erasing the first-acquisition record or causing a new
grant. Background unlocks remain permanent.

## Art and fit boundary

The selected card files are:

- `040-halloween-2026-count-snout-costume-card-v1.png`
- `041-halloween-2026-moonpuff-costume-card-v1.png`
- `042-halloween-2026-little-reaper-costume-card-v1.png`
- `043-halloween-2026-patchwork-pal-costume-card-v1.png`
- `044-halloween-2026-candy-corn-costume-card-v1.png`

All five costumes now have separate transparent hood and romper art, a configurable fit registry, and a shared React Native/browser fitting-room renderer. All twelve Rosie front-idle frames have browser acceptance. Other pigs and non-idle poses, complete front/back occlusion, live Closet/equipment integration and native device acceptance remain pending. See [verification](costume-expansion-verification.md).

The production target remains a registered `per_pig_per_frame_mask` for each
source pig and frame. Each mask preserves the source pig as the identity and
rendering authority, hides other equipped gear while worn, and restores saved
gear when removed.

## Integration state

The draft catalog remains inactive. This change adds collection identities,
first-copy mappings, selected card art registration, and focused domain/card
coverage. It does not push a database migration, activate packs, deploy, build
a distributable binary, or claim native shipping readiness.
