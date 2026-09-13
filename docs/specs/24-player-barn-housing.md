# Player Barn Housing

- Status: implemented and database deployed with user authorization; dark rollout and acceptance gates remain (see [handoff](../handoffs/2026-09-06-barn-housing.md))
- Scope: one personal, customizable Barn Interior per player
- Written: 2026-09-06
- Successor to `docs/habitat.md`; [ADR 0008](../adr/0008-personal-barn-housing.md) records the implementation amendments to ADR 0003
- Companion execution goal: [`../goals/barn-housing-build-goal.md`](../goals/barn-housing-build-goal.md)

## Product definition

**2026-09-06 scope amendment:** the original 18-design catalog specified below
is preserved and expanded with the user's 100 additional furnishing designs.
All artwork, ten deterministic 4/8 collection reward tracks, a dedicated Shop
entry, and the next-login in-app announcement are implemented. The room retains
its existing six typed positions and three themes. See the
[expansion acceptance record](../handoffs/2026-09-06-barn-furnishing-expansion.md).

Player housing turns the Barn from a name for the Home tab into a place the
player can enter, arrange, and show to friends. Each player owns one Barn
Interior. It is a warm, fixed-camera, illustrated room containing Rosie, the
player's worn cosmetics, one room theme, and six typed furniture positions.

The first release is a focused decorating loop:

1. Enter through the Barn door from Home.
2. Receive a small starter arrangement on the first visit.
3. Tap **Decorate**, choose a position, and choose one compatible owned item.
4. Preview changes in the room, then save the whole arrangement.
5. Buy additional designs for Snouts or earn a few from clear milestones.
6. Enter a friend's Interior during an existing Barn Visit and see their saved
   arrangement around both pigs.

The room is a layered 2D scene built with the app's existing React Native image
and pig-rendering stack. It does not depend on a 3D engine, free camera,
physics, free-drag placement, or an unbuilt Adventures system.

The product promise is: **“This is my pig's place, I can change it quickly, and
my friends see the version I saved.”**

## Decision status

The build chat should distinguish inherited product decisions from defaults
this specification recommends.

**Founder-approved/project-established:** one personal Barn; Exterior and
Interior as two views of that Barn; entry through the Barn from Home; one room
theme plus six typed decor positions; slot-based placement rather than free
placement; Shop and deterministic earned sources; friends may see and inspect
the room but never modify it; no crates or random furniture in V1. These come
from the current request and the decisions recorded as locked in
`docs/habitat.md` / `docs/adr/0003-habitat.md`.

**Proposed implementation defaults:** the partial starter arrangement, exact
eighteen-design roster and prices, separate housing catalog, always-available
Barn Shop collection, normalized 2D cutaway, atomic whole-layout save,
revision-conflict behavior, transition timings, analytics, and file/module
shape below. A future build may tune these only when evidence or an explicit
product decision warrants it; it should not silently reopen the established
scope.

Three defaults deliberately propose superseding locked choices in ADR 0003:
partial starter arrangement instead of an empty room, dedicated housing tables
instead of reusing `hats`, and an always-available Barn collection instead of
daily-shop rotation. This document does not silently change that ADR. If the
defaults are adopted, the implementation must add or amend the decision record
in the same change, explaining the final choice and migration consequences.

## Goals

- Give every player one recognizable home they can personalize in a minute or
  two on a phone.
- Make furniture ownership durable and independent from the currently equipped
  layout. Removing an item from the room never consumes it.
- Give the current friend Visit a stronger identity payoff without changing its
  tickle economy, caps, cooldowns, guestbook, emotes, kindness cards, or Visit
  Streak rules.
- Support touch, VoiceOver, Switch Control, and keyboard users without requiring
  spatial hit testing or drag gestures.
- Keep the launch catalog small enough that every asset can be composed and
  checked by hand in every supported position.
- Give future deterministic or randomized reward systems one idempotent grant
  contract while keeping reward selection outside the housing module.

## Shipped baseline and proposed work

The distinction matters because earlier habitat documents describe an intended
system as though some parts already exist.

| Area                 | Exists now                                                                                                                                                                                                                                                                               | Proposed by this specification                                                                                                                                                                |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Home                 | `app/(tabs)/index.tsx` renders `components/Barn.tsx`. The screen is the Exterior-equivalent Home scene and owns tickling, counters, mood, cosmetics, effects, notices, and guestbook entry.                                                                                              | Add a consistent **Inside** affordance and a separate Interior route. Preserve the current Home interaction loop.                                                                             |
| Barn art             | `components/Barn.tsx` has a small decorative barn silhouette only when no cosmetic background is equipped. It is not an entry point.                                                                                                                                                     | Make the default painted barn door tappable and also provide a stable labeled **Inside** control that remains available with every equipped exterior background.                              |
| Interior/habitat     | Domain terms exist in `CONTEXT.md`; `docs/habitat.md`, `docs/adr/0003-habitat.md`, and `docs/wiki/barn-and-habitat.md` describe a six-slot intent. No habitat route, renderer, catalog, ownership table, placement table, or RPC ships.                                                  | Build the owner and visitor Interior, furniture catalog and ownership, revisioned persistence, editing flow, store surface, and launch content.                                               |
| Cosmetics            | `public.hats` + `public.user_hats`, `constants/hats.ts`, `constants/slots.ts`, `hooks/useShopCatalog.ts`, and `components/ClosetView.tsx` own pig wearables and exterior backgrounds. `user_hats` is owner-readable only.                                                                | Keep furniture in a housing catalog and inventory. Continue to render the pig's existing outfit inside the room.                                                                              |
| Visits               | `components/BarnVisitModal.tsx` renders the host and visitor together over the host's exterior background. `tickle_at_barn` and `barn_visit_status` remain server-authoritative.                                                                                                         | Add an **Inside** action and render the host's saved room. Looking around does not begin a visit, use a visit allowance, or start a cooldown; the first accepted tickle continues to do that. |
| Visit limits         | A fresh Visit rolls 3–7 taps; leaving forfeits unused taps; that visitor→friend pair is locked for 24 hours. A player can start three distinct Barn Visits per Wallow-scaled rolling window, from 8 hours at W0 to 3 hours at W5+. The server serializes concurrent tickles per visitor. | Reuse these results and refusal reasons. Housing must not calculate or persist a second visit limit.                                                                                          |
| Social traces        | Guestbook stamps, optional kindness cards, parting emotes, blocked-user filtering, and shared Visit Streaks already have their own tables/RPCs and UI.                                                                                                                                   | Keep their current eligibility and timing. Furniture taps do not credit any of them.                                                                                                          |
| Homegrown Adventures | `docs/homegrown-adventures-build-goals.md` defines a browser prototype in which the farm is the Barn Exterior. It explicitly does not replace the shipped Barn or add production persistence.                                                                                            | Keep Interior housing independent. Its room theme and furniture renderer must not require the prototype reducer, Farm stock, crops, Bag, or Adventure state.                                  |

Useful source anchors:

- `components/Barn.tsx` — current Home orchestrator and pig tickle surface.
- `hooks/useHomeStats.ts` — current Home snapshot, including mood, pig outfit,
  exterior background, balances, and Streak.
- `components/ui/PigStage.tsx` — shared pig identity, mood, reaction, and wearable
  composition.
- `components/BarnVisitModal.tsx` — current two-pig Visit presentation and
  social actions.
- `components/Friends.tsx` — direct friend-row Visit entry, shared visit budget,
  pair locks, and Visit Streak display.
- `supabase/migrations/20260779000000_prestige_curve_and_visit_window.sql` —
  Wallow-scaled three-Barn window.
- `supabase/migrations/20260780500000_prestige_security_hotfix.sql` — serialized
  Visit mutation and client privilege hardening.
- `supabase/migrations/20260787000000_barn_guestbook_stamps.sql` and
  `20260829000000_contraptions_and_streaks.sql` — guestbook and Visit Streak
  contracts.
- `hooks/useFeatureFlags.tsx` and `utils/interactionAnalytics.ts` — current
  dark-launch and closed analytics vocabularies.

## The room

### Representation

Use one portrait, frontal cutaway at a 390 × 844 design viewport. The scene is
illustrated with modest perspective baked into the room theme. Items are
transparent 2D assets placed at normalized anchors and scaled with the scene.
Tablet layouts center the room in a bounded canvas and use the remaining width
for the inventory drawer.

This representation is deliberately grounded: a wall item sits on the back
wall, a hanging item hangs from the rafters, floor items stand on the left or
right floor, a rug or other centerpiece sits under the pigs, and a small object
sits on the shelf that is painted into every room theme. There are no arbitrary
coordinates, rotation handles, stacking, collision rules, or camera controls.

### Positions

| Position key          | Accepts               | Examples                       | Render layer              |
| --------------------- | --------------------- | ------------------------------ | ------------------------- |
| `interior_background` | `interior_background` | plank walls, whitewashed walls | full-frame back layer     |
| `wall`                | `wall_decor`          | framed sketch, pressed clover  | behind pigs               |
| `ceiling`             | `ceiling_decor`       | herb garland, firefly lantern  | behind or above pigs      |
| `floor_left`          | `floor_decor`         | crock, chair, hay bale         | beside/partly behind pigs |
| `floor_right`         | `floor_decor`         | lamp, chair, hay bale          | beside/partly behind pigs |
| `floor_centerpiece`   | `floor_centerpiece`   | rugs                           | under pigs                |
| `surface`             | `surface_decor`       | basket, radio, keepsake        | foreground shelf plane    |

`floor_left` and `floor_right` accept the same category. One owned design may
occupy only one position at a time in V1; selecting it for the other floor
position moves it. An item is an unlocked design, not a quantity or consumable.
This keeps ownership legible and avoids introducing furniture stacks.

The render order is room theme → wall → rafters → floor centerpiece → left and
right floor items → pig stage(s) → shelf item → tickle particles and UI. Each
theme must provide the same named safe regions, including a visible shelf, so a
furniture asset never needs theme-specific coordinates.

## Entry, viewing, and decorating

### Owner flow

The Home tab remains the Exterior. The default homestead background may make
the painted barn itself tappable. Every background also shows a 44 pt or larger
wooden-door control labeled **Inside**, placed in the existing in-flow controls
so the route never disappears behind a cosmetic background.

Opening the Interior pushes `app/barn-interior.tsx`; it does not add a bottom
navigation tab. Back or the labeled **Outside** door returns to the existing
Home state. Home stats refresh on return only when an Interior action changed a
balance or outfit-relevant state.

The normal Interior is a calm room, not a permanent editor. Its primary
controls are **Decorate**, **Outside**, and Rosie. Tapping Rosie uses the same
Home tickle action and feedback as the Exterior. Tapping furniture in view mode
shows its name and one-line story without opening edit mode.

### Touch editor

Tapping **Decorate** enters a draft session at the current server revision.

- The scene adds restrained outlines and plus markers to the seven positions.
- Tapping a position opens a bottom sheet filtered to compatible owned items.
- Each choice has art, name, rarity, `Place`/`Move here`, and `Remove` where
  relevant. Choosing updates the local preview immediately.
- The inventory sheet also links to **Find more for this spot**, which opens the
  Shop's Barn collection filtered to the compatible category.
- **Undo**, **Cancel**, and **Save Barn** remain visible. Cancel restores the
  last server snapshot. Save writes the whole layout atomically.
- Buying an item from this flow returns to the same draft and selects the new
  item. Purchase and placement are separate confirmations; a successful buy is
  never rolled back because layout save later conflicts.

Free drag can be explored after launch, but it is not an alternate V1 save
format. All clients persist position keys only.

### Accessible list editor

An always-visible **Arrange as list** action opens a non-spatial editor with
the same draft. It lists `Room`, `Back wall`, `Rafters`, `Left floor`, `Right
floor`, `Center floor`, and `Shelf`, followed by the selected item and a
`Choose`, `Move`, or `Remove` button. It has complete functional parity with
the scene editor and uses the same save action.

Every interactive control is at least 44 × 44 pt, has a role, state, label, and
hint, and follows logical focus order. Furniture images have short descriptions
such as “a blue patchwork rug on the center floor.” Color, rarity tint, and
position are never the only way to identify a choice. Dynamic Type may expand
the sheets and list editor without shrinking the scene's touch targets.

With Reduced Motion, entering or leaving uses a short opacity transition of at
most 150 ms and furniture selection changes immediately. Screen-reader users
receive one concise announcement after purchase and one after a successful
layout save; preview taps are not announced as saved.

## Friend Visit integration

Keep `BarnVisitModal` as the owner of the Visit session. Add an **Inside**
control to its current exterior presentation and an **Outside** control inside.
The shared `HabitatScene` renders the host's room with the host pig in front and
the visitor pig slightly smaller and behind, preserving the existing two-pig
social read.

- The visitor sees the host's committed snapshot only. Owner drafts never leak.
- Looking at a room and tapping its furniture are read-only. They do not insert
  `barn_visits`, spend a visit allowance, start a pair cooldown, credit a Visit
  Streak, change alignment, grant XP, or unlock guestbook actions.
- Tapping either pig continues through the existing `tickle_at_barn` action.
  Its 3–7 cap, 24-hour pair lock, prestige-scaled three-Barn window, rewards,
  happiness, and refusal copy remain authoritative.
- The current guestbook prompt still appears after the first confirmed tickle.
  Kindness cards, the nap summary, parting emotes, buried-truffle behavior, and
  Visit Streaks keep their current rules and surfaces.
- Visitors can tap a placed item for its name and flavor line. They never see
  empty-position markers, prices, inventory, `Decorate`, `Remove`, or `Buy`.
- `view_habitat(host)` permits an accepted friend and rejects a blocked pair.
  If access changes, the next fetch fails closed and returns the visitor to the
  current Visit exterior with friendly unavailable copy.

No housing state is stored in `barn_visits`. The visit system supplies actor,
host, and session behavior; the housing module supplies one read-only scene
snapshot.

## Workshop cabinet and Mote integration

The Interior includes one fixed **workshop cabinet** outside the seven
customizable positions. It is utility chrome, not furniture inventory, and it
looks like part of every room theme. This is the only V1 integration with the
separate Mote/Contraption feature.

When the Mote Machine is available under its canonical gate (currently
`MOTE_MACHINE_VISIBLE` in `constants/featureFlags.ts`), the owner's cabinet
offers two 44 pt or larger actions:

- **Mote Machine** opens the existing `/mote-machine` route.
- **Workshop shelf** shows the current Auto-Tickler state—locked, available
  Clockwork Acorns, or active-until time—and opens `/contraptions` for inventory
  and activation.

Use `fetchContraptionInventory()` from `utils/moteMachine.ts`; do not copy its
types or RPC logic into housing. Fetch only for the owner, only while the
cabinet is available, and independently from the room snapshot so a
Contraption error cannot prevent decorating. The accessible list view includes
the same two actions under **Workshop**.

Visitors see a closed decorative cabinet. They cannot inspect the host's
Contraption inventory or enter a host-scoped machine. When the machine is
disabled, the cabinet remains an ordinary noninteractive part of the room and
there is no dead hotspot or loading request.

Housing never spends a Mote, spins the machine, activates an Auto-Tickler, or
selects a reward. A player with zero Motes and no unlocked Contraption can still
claim the starter room, buy every paid furnishing, earn every housing-native
item, edit, save, and visit normally. Random furniture rewards remain outside
both V1 features; a later machine reward may use the housing grant contract
only after its own server result is settled.

## Starter state and launch economy

The following are proposed defaults. They are specific enough to build and tune
without waiting for a second design pass.

### First entry

`claim_habitat_starter()` is an idempotent first-entry action. It grants and
places:

- **Warm Plank Barn** — default room theme; always available and worth 0 Snouts.
- **Rosie's Pencil Sketch** — starter `wall_decor`.
- **Sunflower Crock** — starter `floor_decor`, initially on the left.
- **Patchwork Rug** — starter `floor_centerpiece`.

The rafters, right floor, and shelf remain open goals. Owner edit mode shows
their plus markers. Normal owner view and friend view do not make empty places
look broken.

This intentionally changes the old empty-launch proposal in `docs/habitat.md`.
A partially furnished room proves the interaction and gives the player enough
pieces to rearrange immediately while leaving visible progression.

### Eighteen-design launch roster

| Category          | Starter/default       | Deterministic earn                                                                                      | Always-available Shop                                   |
| ----------------- | --------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| Room themes (3)   | Warm Plank Barn       | —                                                                                                       | Spring Whitewash (100), Midnight Rafters (175)          |
| Wall decor (3)    | Rosie's Pencil Sketch | —                                                                                                       | Pressed Clover Frame (50), Barn Bunting (100)           |
| Ceiling decor (2) | —                     | Firefly Lantern: first saved fully furnished Barn                                                       | Dried Herb Garland (50)                                 |
| Floor decor (4)   | Sunflower Crock       | —                                                                                                       | Reading Chair (100), Hay Bale (50), Milk-can Lamp (175) |
| Centerpieces (3)  | Patchwork Rug         | —                                                                                                       | Braided Straw Rug (50), Muddy Paw Rug (100)             |
| Surface decor (3) | —                     | Apple Basket: first saved custom layout; Guestbook Keepsake: first post-launch guestbook stamp received | Tiny Radio (175)                                        |

All prices are Snouts. The full paid set costs 1,125 Snouts: four 50-Snout
common designs, four 100-Snout uncommon designs, and three 175-Snout rare
designs. These are launch tuning defaults, not remote configuration. Validate
them against current earning pace before migration data is finalized.

The three deterministic awards all cross the grant seam and a once-per-owner
milestone ledger. The first successful save whose positions differ from the
starter arrangement grants Apple Basket for milestone
`first_custom_layout:v1`. The first successful save with all six decor
positions filled grants Firefly Lantern for `first_full_layout:v1`. The first
post-launch guestbook row received by the owner grants Guestbook Keepsake for
`first_guestbook_received:v1`. The triggering stamp ID is audit metadata, while
the milestone key remains fixed so later stamps cannot grant another copy.

The Shop gets a **Barn** collection beside the current cosmetics/Closet
surfaces. These eleven paid designs are always available; they do not enter the
daily randomized cosmetic row. Item cards reuse the current rarity, preview,
affordability, purchase celebration, and Snout balance language. The room
preview replaces the pig product shot for furniture.

There are no crates, Motes, spins, duplicate conversion, paid random outcomes,
limited-time pressure, furniture stats, or set bonuses in V1. Earned designs
have exact requirements and never depend on the Homegrown Adventures prototype.

## Housing module and server interface

Housing should be a deep module with one client interface in
`utils/habitat.ts`. Callers should not know table shape, authorization queries,
category rules, revision arithmetic, or asset fallback rules.

Recommended client interface:

```ts
type HabitatPosition =
  | "interior_background"
  | "wall"
  | "ceiling"
  | "floor_left"
  | "floor_right"
  | "floor_centerpiece"
  | "surface";

type HabitatSnapshot = {
  ownerId: string;
  revision: number;
  positions: Record<HabitatPosition, HabitatPlacedItem | null>;
};

fetchMyHabitat(): Promise<RpcResult<{
  snapshot: HabitatSnapshot;
  owned: HabitatCatalogItem[];
}>>;
fetchFriendHabitat(ownerId: string): Promise<RpcResult<HabitatSnapshot>>;
saveHabitat(input: {
  expectedRevision: number;
  requestId: string;
  positions: Record<HabitatPosition, string | null>;
}): Promise<RpcResult<{ snapshot: HabitatSnapshot; replayed: boolean }>>;
buyHabitatItem(itemId: string, requestId: string): Promise<RpcResult<{
  item: HabitatCatalogItem;
  receipt: {
    snoutCost: number;
    balanceAfterPurchase: number;
  };
  currentSnouts: number;
  newlyOwned: boolean;
  replayed: boolean;
}>>;
```

`hooks/useHabitat.ts` owns fetch-on-focus, the local draft reducer, dirty state,
save state, conflict recovery, and returning from Shop. `HabitatScene` is a pure
renderer used by both the owner route and `BarnVisitModal`. `HabitatEditor`
owns edit chrome and delegates the equivalent non-spatial interaction to
`HabitatSlotList`.

Suggested files:

- `utils/habitat.ts` — public types, parsers, RPC wrappers, position/category
  validation, and pure draft transitions.
- `hooks/useHabitat.ts` — owner lifecycle and optimistic draft adapter.
- `constants/habitat.ts` — closed position catalog and bundled asset map.
- `components/habitat/HabitatScene.tsx` — shared owner/visitor 2D scene.
- `components/habitat/HabitatEditor.tsx` and `HabitatSlotList.tsx` — touch and
  accessible editing adapters over one draft.
- `components/habitat/HabitatWorkshopCabinet.tsx` — optional owner adapter over
  the existing Mote Machine and Contraption inventory routes.
- `app/barn-interior.tsx` — owner route.

Do not add housing fields to `useHomeStats`; Home needs only the entry point.
Do not make `Barn.tsx` fetch an Interior it is not rendering.

## Persistence model

Use dedicated housing tables rather than adding furniture categories to
`public.hats`. The old catalog-reuse proposal saves a migration but leaks
furniture through wearable-specific names (`HatRow`, `buy_hat`, `user_hats`,
`HAT_IMAGES`, `ClosetView`) and forces every cosmetic caller to exclude decor.
A separate catalog gives both systems a smaller interface.

Recommended logical schema:

```sql
habitat_items(
  id text primary key,
  name text,
  description text,
  category text,
  rarity text,
  asset_key text,
  snout_cost int,
  is_for_sale boolean,
  display_order int,
  active boolean
)

user_habitat_items(
  user_id uuid,
  item_id text,
  acquired_at timestamptz,
  primary key (user_id, item_id)
)

user_habitats(
  user_id uuid primary key,
  interior_background_item_id text not null,
  revision bigint not null default 0,
  starter_claimed_at timestamptz,
  updated_at timestamptz
)

user_habitat_slots(
  user_id uuid,
  position text,
  item_id text,
  updated_at timestamptz,
  primary key (user_id, position),
  unique (user_id, item_id)
)

habitat_grant_receipts(
  user_id uuid,
  source text,
  source_ref text,
  item_id text,
  newly_owned boolean,
  granted_at timestamptz,
  primary key (user_id, source, source_ref)
)

habitat_milestones(
  user_id uuid,
  milestone text,
  event_ref text,
  item_id text,
  completed_at timestamptz,
  primary key (user_id, milestone)
)

habitat_save_receipts(
  user_id uuid,
  request_id uuid,
  payload_hash text,
  resulting_revision bigint,
  result_snapshot jsonb,
  saved_at timestamptz,
  primary key (user_id, request_id)
)

habitat_purchase_receipts(
  user_id uuid,
  request_id uuid,
  item_id text,
  snout_cost int,
  balance_after_purchase bigint,
  purchased_at timestamptz,
  primary key (user_id, request_id)
)
```

The migration must enforce closed category/position checks, foreign keys,
non-negative prices, owner/item uniqueness, and one-position-per-owned-design.
The required `interior_background` lives as the non-null FK on
`user_habitats`; `user_habitat_slots` stores only the six nullable decor
positions. The save payload and snapshot still expose one seven-position map,
but `save_habitat` writes the theme column and six placement rows atomically and
rejects a null background. If corrupt legacy data somehow cannot resolve its
theme, the client renders Warm Plank Barn as an explicit recovery fallback and
asks the next successful save to repair it; the fallback is never presented as
already persisted.
`asset_key` resolves through a bundled static map; the database does not send a
path for React Native to load dynamically.

Tables use RLS and expose no client mutation policies. Catalog rows may be
authenticated-readable. Inventory, placement, grant receipts, and purchase
receipts are owner-readable only if direct reads are needed; prefer RPC
snapshots so visitor authorization stays in one place. Client roles receive no
execution privilege on internal grant helpers.

### RPC behavior

All mutations use one lock order. First lock any row already owned by the
calling domain—`profiles` for a Snout purchase, a guestbook/stamp row for its
existing social transaction, or the Mote wallet/spin row for a future machine
reward. Next acquire the per-user habitat transaction advisory lock; then lock
or create `user_habitats`; then lock/check housing receipt or milestone keys,
ownership, and slots as needed. A housing transaction must never acquire a
profile, wallet, or social row after taking the habitat lock. Pure starter/save
actions begin at the habitat advisory lock. This lets existing social and
wallet mutations call the grant seam without creating a profile↔habitat or
social↔habitat lock cycle.

| Mutation            | Required lock/check order                                                                                                                                             |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Starter             | habitat advisory → `user_habitats` → four fixed grant receipt keys/ownership → initial theme and slots                                                                |
| Save                | optimistic save-receipt read → habitat advisory → save-receipt recheck → `user_habitats` → milestone/grant keys as applicable → theme and slots → durable save result |
| Purchase            | optimistic purchase-receipt read → `profiles` wallet row → habitat advisory → purchase-receipt recheck → grant key/ownership                                          |
| Save milestone      | already holds habitat advisory and habitat row → milestone key → grant key/ownership; it takes no external lock                                                       |
| Guestbook milestone | existing social insert/row lock → habitat advisory → habitat row → milestone key → grant key/ownership                                                                |
| Future Mote grant   | existing Mote wallet/spin locks → habitat advisory → habitat row → grant key/ownership                                                                                |

The first optimistic receipt reads take no lock and do not change this order.
They are replay fast paths; every miss is rechecked after the relevant locks.

A guestbook or external grant may arrive before first Interior entry. It may
create ownership and milestone rows under the advisory lock without creating
a room or placing anything. First-entry initialization later adds its starter
grants/layout and preserves all previously earned inventory. A missing habitat
row is not a reason to lose or defer an otherwise valid earned item.

`claim_habitat_starter()` creates the habitat row, idempotently grants the three
starter items plus default theme, installs the initial layout, and returns the
owner snapshot. Concurrent first opens serialize on the habitat advisory lock
and return the same arrangement. Its four grant receipt references are fixed
and distinct:

- `starter:v1:interior_background:warm_plank_barn`
- `starter:v1:wall:rosies_pencil_sketch`
- `starter:v1:floor_left:sunflower_crock`
- `starter:v1:floor_centerpiece:patchwork_rug`

Each uses source `habitat_starter`. This fits the one-item-per-grant-receipt
shape without relying on one batch reference to represent four items.

`my_habitat()` returns all seven positions explicitly, the current revision,
the owner's inventory, and catalog/store metadata. Missing positions are
`null`, never omitted.

`view_habitat(p_owner)` returns only the committed snapshot and the metadata
needed to render placed items. It permits self or an accepted friend, refuses a
blocked pair, and exposes no inventory, prices, receipts, or owner draft.

`save_habitat(p_expected_revision, p_request_id, p_positions)` computes a
SHA-256 hash from a contract-version tag, expected revision, and the normalized
seven-position payload in fixed key order with explicit nulls, then:

1. looks up `habitat_save_receipts` before taking a lock or validating the
   revision, allowing the common confirmed-retry path to replay immediately;
2. takes the per-owner habitat advisory lock and repeats the receipt lookup so
   concurrent first attempts cannot pass together;
3. when the request ID exists with the same hash, returns its stored resulting
   revision and snapshot; when it exists with another hash, returns
   `idempotency_mismatch` and writes nothing;
4. locks `user_habitats` and compares its revision;
5. validates the exact seven-key payload, required non-null owned background,
   ownership, category compatibility, and duplicate placement;
6. updates the required theme, replaces the six decor placement rows,
   increments the revision once, hydrates the result, and stores its
   hash/revision/snapshot receipt in the same transaction.

A stale expected revision returns `revision_conflict` with the current
snapshot and writes nothing. The UI preserves the local draft, offers **Review
latest**, and requires a fresh explicit save after the player reapplies it.
Visitors can therefore see the old complete arrangement or the new complete
arrangement, never half a save.

A replayed save snapshot proves what that request saved; it may predate a
second device's subsequent save. After recovery, refresh `my_habitat()` before
presenting the current room, and never replace a higher known revision with
a lower replay/read revision. Keep the replay receipt distinct from the latest
displayed snapshot.

`buy_habitat_item(p_item_id, p_request_id)` first performs an optimistic
purchase-receipt lookup. It then locks the caller's profile, takes the habitat
advisory lock, and repeats the receipt lookup before checking current funds,
non-ownership, or catalog sale state. When the request ID exists for another
item, it returns `idempotency_mismatch`. When it exists for the same item, it
returns the historical purchase result without another deduction or grant.

For a new request it validates the item is active and for sale, verifies funds
and non-ownership, deducts the stored price, calls the grant seam below, and
stores `snout_cost` plus historical `balance_after_purchase`. Its grant uses
source `habitat_purchase` and the purchase request UUID as `source_ref`. Every
response also reads and returns a separate fresh `current_snouts` value after
receipt resolution. The client reconciles its wallet from `current_snouts`,
never from the historical receipt balance, because later rewards or spending
may have changed the wallet before a retry.

### Stable grant contract

All non-purchase acquisition routes call one internal function:

```sql
grant_habitat_item(
  p_user_id uuid,
  p_item_id text,
  p_source text,
  p_source_ref text
) -> { ok, item_id, newly_owned, granted_at }
```

The helper acquires the habitat advisory lock itself; callers already holding
that transaction lock may call it reentrantly. It looks up the receipt key
before catalog state or ownership validation. A matching receipt replays even
if the item later became inactive. A new grant validates an active catalog
item, records one idempotent receipt, and inserts ownership with `ON CONFLICT DO
NOTHING`. It does not choose an item, deduct currency, convert duplicates,
place furniture, animate a reveal, or know about Motes. `p_source_ref` is a
stable event/receipt ID, not free-form display copy.

The same `(user, source, source_ref)` with the same item returns its existing
receipt. Reusing it for another item returns `idempotency_mismatch`. A grant of
an inactive item is refused. An item becoming inactive later does not revoke
ownership and does not prevent that owner from placing, moving, removing, or
rendering it.

Housing-native milestones, future season rewards, and a future Mote feature may
call this function after their own server-authoritative eligibility or result
selection. A randomized caller owns its odds and duplicate policy. Housing
remains fully usable when no such caller exists.

Milestones also require one durable completion per owner. The saving path locks
the habitat, inserts `habitat_milestones` for `first_custom_layout:v1` or
`first_full_layout:v1`, and only the successful first insert calls the grant
function with that fixed milestone key as its source reference. The guestbook
path starts from the already-created stamp row, then takes the host's habitat
lock and inserts `first_guestbook_received:v1` with the stamp ID only as
`event_ref`; its fixed grant source reference is
`first_guestbook_received:v1`. Later stamp IDs encounter the milestone primary
key and cannot grant again. Event-level receipt deduplication alone is not the
milestone guard.

## Concurrency, recovery, and offline behavior

- Owner edits are local drafts. A network failure leaves the draft intact and
  shows retry; it never claims the layout was saved.
- The last confirmed snapshot may be cached for fast owner display, labeled as
  offline when the refresh fails. Editing may continue, but Save remains queued
  only in memory and requires connectivity. V1 does not background-sync layout
  mutations.
- Friend rooms require a successful authorized fetch. Do not show a disk-cached
  friend's room after sign-out, unfriend, or block.
- Before sending Save or Buy, persist the account-scoped command, request ID
  and exact payload locally. A timeout or relaunch recovers that same command;
  clear it only after a confirmed receipt or definite rejection. Ordinary
  unsaved drafts are local previews, not background mutation jobs.
- A purchase timeout also retries the same purchase request ID. Never infer a
  refund from a lost response. Pending commands belonging to another signed-in
  account must never be executed or shown.
- A catalog item later made inactive remains owned, placeable, movable,
  removable, and renderable. It disappears from new purchases and grants.
- A missing bundled asset renders a neutral furniture placeholder with its
  accessible name and emits an error; it does not make the snapshot invalid.

## Art and animation scope

V1 art consists of:

- three full-frame room themes sharing one camera and the same seven safe
  regions;
- fifteen transparent furniture images, producing eighteen catalog designs
  including themes;
- one barn-door entry control that reads over every exterior background;
- a two-panel door transition or short illustrated door sequence;
- one fixed workshop cabinet treatment, with enabled and quiet/disabled states;
- Shop thumbnails derived from the same approved source art;
- static placeholders for missing assets and owner-only empty positions.

Author furniture at enough resolution for a 390 × 844 phone viewport and export
transparent PNG/WebP assets with consistent light direction, contact shadows,
and perspective. The item image includes its own contact shadow when needed.
Do not rely on runtime skew, arbitrary rotation, or per-theme retouching.

The full-motion door transition targets 400–500 ms: press response, doors open,
room crossfade, controls settle. Furniture selection uses a single 140–180 ms
scale/fade and optional light haptic. Rosie continues through the existing
`PigStage` mood/reaction contract. No furniture has a bespoke interaction
animation in V1; visitor taps show a compact paper label only.

Reduced Motion follows `hooks/useMotionPolicy.tsx`. The room is functional if
the door animation or pig Rive renderer fails. Housing must not add video, GIF,
frame-sequence, or 3D runtime dependencies.

Performance budgets:

- at most seven room layers plus the existing pig stage(s) and interaction UI;
- no off-screen rendering of the whole catalog behind the room;
- load the committed theme and placed items before revealing the scene, then
  lazy-load the inventory sheet;
- scene open and owner edits must remain responsive on the oldest currently
  supported iPhone and current mobile web target.

## Analytics and rollout

Add a `habitat` feature flag to the closed key union in
`hooks/useFeatureFlags.tsx` and server configuration. While loading or disabled,
the Interior route redirects to Home and Home/Visit render no entry control.

Extend the closed analytics vocabulary rather than emitting arbitrary events:

- `habitat_opened` — owner or friend surface;
- `habitat_edit_started`;
- `habitat_layout_saved` — count of filled positions only;
- `habitat_item_acquired` — content ID and source token;
- `habitat_shop_opened` — originating position/category token;
- `habitat_save_conflicted`.

Never send room JSON, usernames, or display copy. The first product check is the
share of exposed players who save one custom change within seven days. Proposed
healthy signal: at least 50%. Also inspect friend-Interior opens per completed
Visit and save-conflict/error rates before expanding the catalog.

Because this is a major player system and database/economy change, its
implementation must be enqueued in `docs/release-followups.json` while authored
and attached to the first distributable build that contains it, per
`AGENTS.md`.

## MVP boundary

Included:

- one room per player;
- one room theme and six fixed furniture positions;
- fixed owner-only cabinet actions for the enabled Mote Machine and Auto-Tickler
  inventory, isolated from room loading and furnishing;
- eighteen launch designs with the acquisition routes and default prices above;
- first-entry starter claim and initial placement;
- durable unique ownership, an always-available Barn Shop collection, preview,
  purchase, place, move, remove, cancel, undo, and atomic save;
- shared owner/visitor renderer with current pig outfit and mood;
- friend-only visitor viewing inside the existing Visit flow;
- touch editor and functionally equivalent list editor;
- revision conflict handling, idempotent purchase/save/grant behavior, feature
  flag, analytics, Reduced Motion, and fallback assets.

Excluded:

- multiple rooms, floors, Barn upgrades, expansions, or saved loadouts;
- free placement, grids, rotation, scaling, stacking, item quantities, trading,
  gifting, selling, refunds, crafting, storage limits, or furniture stats;
- visitors moving, buying, gifting, or leaving furniture;
- interactive furniture, NPC routines, pet needs, farming, Farm stock,
  Adventures, or a day/night simulation;
- 3D, isometric navigation, avatars walking around the room, synchronous
  multiplayer, presence, or realtime co-editing;
- crates, Motes, spins, random furniture grants, duplicate conversion, or any
  furnishing dependency on the separate Mote feature;
- new Visit rewards, limits, cooldowns, streak rules, guestbook rules, or
  notification types.

## Implementation workstreams

1. **Contract and migration.** Finalize the seven positions and eighteen item
   IDs; add tables, constraints, grants, owner/friend read RPCs, starter claim,
   atomic revisioned save, idempotent purchase, internal grant seam, generated
   database types, and database-harness coverage. Name the migration after the
   latest applied version at implementation time. Do not push it without the
   user's explicit “go.”
2. **Content and scene.** Produce the three compatible room themes, fifteen
   furniture assets, static asset map, anchor/safe-region fixtures, and shared
   `HabitatScene`. Validate every design in every compatible position with both
   Rosie and the largest supported companion/outfit silhouette.
3. **Owner flow.** Add the Home entry, route, starter ceremony, `useHabitat`,
   draft reducer, spatial editor, list editor, undo/cancel/save, conflict UI,
   offline recovery, and Reduced Motion behavior.
4. **Acquisition.** Add the Shop Barn collection, room/item previews,
   idempotent purchases, return-to-origin flow, housing-native deterministic
   milestones, and acquisition analytics.
5. **Visit integration.** Add authorized friend snapshot loading and
   Inside/Outside transitions to `BarnVisitModal`, preserving its existing
   session state and all current server actions.
6. **Workshop integration.** Add the fixed cabinet adapter, gate its two owner
   actions with the Mote feature's canonical availability, show Auto-Tickler
   state from the existing inventory interface, and keep all failures local to
   the cabinet.
7. **Rollout and acceptance.** Dark-launch by account, run layout/API quality
   loops, test poor network and two-device conflicts, complete device and
   accessibility acceptance, then attach the release follow-up to the first
   distributable build.

Workstreams 2 and the client-side pure draft reducer can begin against fixtures
after the contract is fixed. Visit integration should consume the same scene
and snapshot types rather than build a second renderer.

## Test plan

### Pure and client tests

- Every position accepts exactly its declared category; left/right floor share
  only `floor_decor`.
- Snapshot parsing fills missing positions with `null`, rejects unknown keys,
  and maps missing assets to a safe placeholder.
- Draft place/move/remove/undo transitions never duplicate one design in two
  positions and never mutate the confirmed snapshot.
- Cancel restores the confirmed snapshot; successful save replaces it and
  advances the revision once.
- A stale save preserves the local draft and presents the returned current
  snapshot for review.
- Owner and friend modes share layer order, while friend mode has no edit,
  price, empty-marker, or purchase action.
- Returning from a purchase restores the originating draft and compatible
  position.
- Feature-flag loading/off states do not flash or deep-link into housing.
- Reduced Motion bypasses door travel and item flourish.
- Spatial and list editors expose the same seven choices and produce identical
  save payloads.
- A disabled Mote Machine performs no cabinet inventory fetch and exposes no
  dead action. Enabled owner actions route to the machine and Contraption
  inventory; a failed inventory fetch leaves the room and editor usable.
- Visitor mode never fetches or reveals the host's Contraption inventory.

### Database harness

- Starter claim is idempotent under concurrent requests and produces exactly
  four owned catalog items and four filled positions: the default theme plus
  three placed decor items.
- Owner snapshot exposes inventory; friend snapshot exposes only placed item
  render data.
- Stranger, pending friend, blocked pair, anonymous caller, and invalid owner
  cannot read another player's room.
- Direct client table mutations and internal grant execution are denied.
- Save rejects unowned/unknown, category-mismatched, duplicate, null-background,
  and malformed layouts without partial writes. An inactive but already-owned
  design remains placeable and movable.
- Two saves at one revision yield one success and one `revision_conflict`.
- Replaying a save request ID returns the original result without a second
  revision increment, even after the current revision advances. Reusing that ID
  with another revision/layout hash returns `idempotency_mismatch`.
- Purchase is atomic with the Snout deduction, refuses insufficient funds and
  repeat ownership, and replays one receipt without charging twice. A retry
  returns the historical balance separately from a freshly read wallet, and
  the client reconciles from the fresh value.
- A purchase retry after ownership exists resolves from its matching receipt
  rather than returning `already_owned`; reuse of its ID for another item
  returns `idempotency_mismatch` before any wallet change.
- Grant receipts are idempotent by `(user, source, source_ref)`, reject reuse
  for another item, and never place the granted item. Starter claim creates four
  distinct stable item receipts.
- Each deterministic milestone completes once per owner. Multiple new
  guestbook stamps cannot regrant the first-received keepsake.
- Concurrent save, purchase, starter, and guestbook-milestone transactions
  finish without a deadlock and preserve every independently valid result.
- Inactivating a sale item blocks new purchases without deleting ownership or
  an existing placement.

### Manual device and accessibility acceptance

- On small and large supported phones, the Interior opens from Home with every
  exterior background equipped and returns without losing Home state.
- A new and an existing account receive the same one-time starter arrangement.
- Place, move, remove, undo, cancel, buy, return, and save work for all seven
  positions; relaunch shows the committed arrangement.
- A second device cannot silently overwrite a newer layout.
- A friend sees the committed layout and both pigs, can inspect an item and
  tickle normally, and cannot discover a modification path.
- With the machine enabled, the owner can open the machine and Auto-Tickler
  inventory from the cabinet. With it disabled or unavailable, every furnishing
  action still works and the cabinet has no false affordance.
- Merely entering a friend room does not change Visit allowance, pair lock,
  Visit Streak, XP, alignment, guestbook eligibility, or balances.
- Unfriending or blocking removes access on the next fetch.
- VoiceOver can enter, inspect the room summary, arrange every position in list
  mode, buy, save, resolve a conflict, and leave. Switch Control and hardware
  keyboard can reach the same actions without a drag gesture.
- Dynamic Type at the largest accessibility size keeps action text visible in
  scrollable sheets; touch targets remain at least 44 pt.
- Reduced Motion, offline open, lost save response, lost purchase response, and
  one missing asset all recover without data loss or a false success message.

Run `npm run quality:loop` while changing the player-facing layout or RPC
contract and `npm run quality:check` before handoff. Run the database harness
and the relevant focused Jest suites before any database push. The release-grade
`npm run quality:check:full` and the manual gates in
`docs/RELEASE_CHECKLIST.md` remain required before a distributable build.

## Done criteria

V1 is complete when all of the following are true:

- The feature-flagged owner journey works from first entry through purchase and
  a persisted custom arrangement using production RPCs.
- The exact same committed room renders in the owner route and a currently
  authorized friend's Visit, with the proper one-pig/two-pig composition.
- Housing cannot change current Visit accounting except when the player uses
  the existing tickle action.
- Server constraints and RPCs own funds, ownership, compatibility,
  authorization, idempotency, and revisions; the client never writes housing
  tables directly.
- The touch and list editors have functional parity and pass VoiceOver,
  Dynamic Type, Switch Control/keyboard, and Reduced Motion acceptance.
- All eighteen designs have approved bundled art, thumbnails, accessible
  descriptions, and checked placement in every compatible slot/theme.
- Focused Jest tests, migration harness, `quality:check`, and the relevant
  release gates pass, and the release-followup entry is attached to the first
  containing build.

## Open product decisions

The defaults above let a future build chat proceed. Change them only with an
explicit product decision:

1. **Catalog separation.** Recommended: dedicated housing catalog/inventory.
   The older draft reused `hats`; doing so is faster initially but keeps
   wearable terminology and exclusion rules in every Shop/Closet consumer.
2. **First-entry generosity.** Recommended: auto-grant and auto-place three
   starter designs plus the base room. The older draft opened empty.
3. **Store cadence.** Recommended: all eleven paid launch designs are always
   available in the Barn collection. Moving them into `daily_shop()` adds
   acquisition randomness and makes an empty position harder to fill.
4. **Visit entry.** Recommended: preserve the current Visit exterior and add an
   Inside action. Opening directly into the Interior would make decoration more
   prominent but discard the host's equipped exterior background as a social
   identity surface.
5. **Price tune.** Proposed total is 1,125 Snouts. Confirm against current
   median balance and earning rate immediately before seeding production data;
   keep the relative 50/100/175 tiers unless the economy review finds a clear
   problem.

## Onboarding amendment — 2026-09-08

The user requested starter gifts and interior-first friend visits. Provision the
existing four starter designs at eligible login or first authorized friend room
inspection. Preserve all prior ownership and saved layouts. Lead the announcement
with the free furnished room and an owner-entry action; explain decorating and
Friends. A friend visit opens directly into the committed room with host and
visitor pigs. Retain all Visit rules and the Outside/unavailable fallback.
See `docs/handoffs/2026-09-08-barn-starter-onboarding.md` for implementation evidence.
