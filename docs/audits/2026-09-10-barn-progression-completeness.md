# Barn progression completeness audit

Date: 2026-09-10  
Scope: current Barn housing, permanent Wallow gifts, Season handoff, collection progression, and long-term furnishing goals. This is a code and design audit; it does not assert production deployment state.

## Assessment

The Barn is functionally substantial and safe enough to support progression, but its prestige loop is not yet emotionally complete. Players can start with a furnished room, buy and earn a large catalog, save layouts, show them to friends, and receive durable gifts for permanent Wallow ranks 1–6. The missing piece is a continuous reward story: the Season celebrates a Wallow as aura and regeneration, while the furnishing is silently reconciled later in the Barn. After rank 6, the Barn stops acknowledging further permanent ranks altogether.

The highest-value next step is therefore presentation and continuity, not more catalog volume. Make the rank-up tell the player which furnishing was earned and help them preview or place it. Then establish a bounded post-rank-6 prestige cadence with distinctive keepsakes. Saved room presets and friend-room discovery should follow because the existing 118-design catalog already exceeds what one seven-position room can express conveniently.

## Working features

### A durable, server-authoritative room

- The Interior has one required background plus six typed positions. Ownership is permanent and placement is revisioned; the product decision explicitly separates furnishings from wearable cosmetics and preserves whole-room atomic saves (`docs/adr/0008-personal-barn-housing.md:11-16`, `:23-32`).
- First provisioning grants four pieces and places three decorations, leaving meaningful empty positions rather than an empty-room failure state (`docs/adr/0008-personal-barn-housing.md:20-22`; `constants/habitat.ts:101-104`).
- The owner hook fetches on focus, falls back to starter claim when the room is absent, caches confirmed state, preserves offline drafts, and protects pending save/purchase recovery (`hooks/useHabitat.ts:281-401`). This gives prestige catch-up a reliable owner-entry seam.
- The editor supports typed placement, removal, undo, cancellation, conflict review, and explicit saving; the data model rejects category mismatches before save (`utils/habitat.ts:67-95`, `:412-430`; `hooks/useHabitat.ts:431-520`).

### Several clear acquisition loops

- The runtime contains 118 designs: 18 original designs plus ten themed collections of ten (`docs/adr/0008-personal-barn-housing.md:66-72`). Each collection has eight fixed-price purchases and deterministic rewards for owning four and eight paid pieces (`supabase/migrations/20260907010000_barn_furnishing_expansion.sql:135-177`).
- Three original earned milestones connect decorating and social play to the Barn: first custom arrangement, first full arrangement, and first received guestbook stamp (`supabase/migrations/20260906190000_player_barn_housing.sql:273-274`, `:309-321`). The collection explains those requirements in player language (`app/barn-collection.tsx:286-300`).
- The collection screen has search, collection filters, per-collection owned counts, automatic reward thresholds, room preview, affordability state, and retry-safe purchase handling (`app/barn-collection.tsx:151-178`, `:360-520`). This is enough infrastructure to support a long catalog without requiring daily rotation or randomness.

### Permanent Wallow ranks 1–6 now connect to the Barn

- The six gifts are Dried Herb Garland, Barn Bunting, Muddy Paw Rug, Reading Chair, Tiny Radio, and Midnight Rafters (`supabase/migrations/20260910120000_habitat_prestige_rewards.sql:11-23`). Together they cover rafters, wall, rug, side furniture, shelf, and room theme, so the ladder demonstrates every kind of decorating decision (`constants/habitat.ts:34-41`, `:50-65`).
- These remain normal paid items. A player may buy early or receive them free later; catalog price and availability are not replaced (`supabase/migrations/20260910120000_habitat_prestige_rewards.sql:1-3`).
- Grants are cumulative, receipt-backed, idempotent, and serialized on the existing per-player habitat lock (`supabase/migrations/20260910120000_habitat_prestige_rewards.sql:53-107`). Migration-time backfill catches existing permanent ranks, and later owner reads and starter provisioning reconcile missed ranks (`:109-149`, `:175-220`). Rank 7 and above safely retain all six current rewards because eligibility selects every configured rank at or below the player's permanent rank (`:86-97`).
- Granting does not place an item, spend/refund Snouts, or change the saved-room revision. Previously purchased items become valid prestige receipts without introducing quantities. This preserves player choice and avoids turning a rank-up into an unwanted layout mutation (`docs/handoffs/2026-09-10-barn-prestige-and-visits.md:18-22`).
- The client treats `prestigeRank` and `wallowRank` as optional, validating them when present while retaining compatibility with older cached/server payloads (`utils/habitat.ts:30-60`, `:131-162`, `:296-315`). The Wallow ladder only appears when live catalog metadata exists (`app/barn-collection.tsx:146-169`, `:366-414`).
- The collection currently shows permanent rank, owned gift count, the complete six-rank ladder, a Wallow filter, and the buy-early alternative (`app/barn-collection.tsx:366-380`, `:404-414`, `:509-512`; `components/habitat/HabitatItemPreviewModal.tsx:126-130`).

### The Season already has a strong prestige mechanic

- Wallow preserves accumulated rewards and overflow XP, advances permanent and season-local rank, and caps gameplay regeneration power at rank 2 while allowing public rank to continue (`docs/prestige-wallow-spec.md:10-23`).
- Repeat Prestige Paths have five rewards across a 30-tier lap, and the server refuses a Wallow while claimable rewards remain (`docs/prestige-wallow-spec.md:25-30`, `:43-59`).
- The Season UI gives successful Wallows sound, haptics, and a rank dialog that explains aura and regeneration (`app/(tabs)/season.tsx:1202-1230`). Tier increases also have their own banner, while initial tab load intentionally avoids false celebration (`app/(tabs)/season.tsx:1127-1137`, `:1181-1195`).

## Verified gaps

### P0: the furnishing reward misses the Wallow celebration

The successful Wallow response and dialog only mention rank, aura, regeneration reduction, and interval (`app/(tabs)/season.tsx:1212-1230`). The new furnishing is not named, pictured, or linked there. It is granted later when the owner opens or refreshes the Barn, and the Barn's reconciliation response does not identify which receipt was newly created (`supabase/migrations/20260910120000_habitat_prestige_rewards.sql:175-199`).

Practical effect: a player may complete the game's largest repeatable goal and never realize that the Barn changed. If they later discover the item in a 118-design collection, there is no dedicated new-item beat linking it back to the Wallow.

### P0: there is no first-placement path for a newly earned gift

Gifts correctly avoid automatic layout mutation, but the product offers no immediate bridge from “earned” to “try it.” The item modal says gifts are added when the Barn opens (`components/habitat/HabitatItemPreviewModal.tsx:126-130`), and the collection can preview an item in the room (`app/barn-collection.tsx:302-310`, `:514-520`), but there is no durable “new gift” state, direct preview action from the Wallow, or placement suggestion after reconciliation.

This is a presentation gap rather than an ownership gap. The correct behavior is opt-in preview/placement with an explicit Save, preserving the existing draft and revision rules.

### P1: Barn prestige progression ends at rank 6

The catalog has exactly six `prestigeRank` entries, and the collection copy explicitly says the first six ranks (`constants/habitat.ts:50-65`; `app/barn-collection.tsx:366-380`). The server eligibility query has no fallback reward or repeating cadence after the last configured rank (`supabase/migrations/20260910120000_habitat_prestige_rewards.sql:86-97`).

The wider prestige system deliberately allows ranks to rise forever and continues visual rank stages beyond the gameplay-power cap (`docs/prestige-wallow-spec.md:14-23`). That makes rank 7 the first visible contract break: Season says the permanent journey continues, but the Barn has no next goal or acknowledgment.

### P1: prestige gifts are useful, but not prestigious

All six gifts reuse original paid designs and explicitly add no exclusive art (`docs/handoffs/2026-09-10-barn-prestige-and-visits.md:7-20`). Reuse was a sensible first release because it immediately connects systems and rewards every slot type. It also means a rank-up can award something the player already bought, producing only a receipt and no new object, refund, variant, plaque, or visible distinction.

The current ladder is best understood as a catch-up/value benefit, not a status reward. The Barn needs at least one furnishing that can only mean “this player achieved something” if it is expected to carry prestige identity during friend visits.

### P1: the catalog has breadth without a Barn-wide completion goal

Ten collection cards expose progress toward their own 4/8 thresholds (`app/barn-collection.tsx:455-474`), and the Wallow card exposes 0–6 gift ownership (`:366-380`). There is no aggregate “Barn collection” completion measure, cross-collection achievement, reward for completing several sets, or final goal for all ten sets. Search copy communicates the size—118 designs—but not the player's progress through it (`:384-389`).

This leaves advanced players with many parallel shopping checklists but no answer to “what am I building toward?” The room itself can show only seven items at once, so completion must be represented through a meta-object, title, room feature, or profile record rather than expecting all ownership to be visible simultaneously.

### P1: one room cannot express the catalog economically or creatively

The system has seven positions and 118 designs (`constants/habitat.ts:10-18`; `docs/adr/0008-personal-barn-housing.md:68-72`). There are no named saved-room presets; this is still listed as a future proposal (`docs/handoffs/2026-09-10-barn-prestige-and-visits.md:38`). A player who completes multiple collections must overwrite the same room to use them.

Without presets, every additional purchase has decreasing practical visibility. That weakens both the creative goal and the Snout sink: acquiring a second or third coherent theme creates more manual switching work rather than more expressive capacity.

### P2: friend visits show results but do not create acquisition intent

Friend rooms authorize and render the host's committed layout, but the planned inspect-to-wishlist-to-own loop is not implemented (`docs/handoffs/2026-09-10-barn-prestige-and-visits.md:24-38`). A visitor cannot inspect exact source requirements, save a wishlist item, or jump to the matching design in their own collection.

This matters for long-term progression because the best natural advertisement for rare Barn items is another player's room. The current flow supports status display, but not discovery-driven goals.

### P2: the economic effect is defined structurally, not measured

The expansion supplies 80 paid designs and 20 collection rewards, while six original paid items become eventual free gifts (`docs/adr/0008-personal-barn-housing.md:68-72`; `supabase/migrations/20260910120000_habitat_prestige_rewards.sql:11-23`). The product has purchase and acquisition analytics, but this audit found no Barn-specific dashboard or decision thresholds for:

- how many players buy a future prestige gift early;
- whether a later free grant feels rewarding or disappointing after purchase;
- Snouts spent per rank and per collection;
- time from acquisition to first placement;
- collection completion and room-preset usage;
- friend inspection to wishlist/purchase/placement conversion.

The economy cannot be called balanced from source inspection alone. The catalog is a substantial Snout sink, but rank gifts reduce eventual spend on six items and the current implementation offers no replacement value when those items were already owned.

## Product recommendations

### 1. Complete the Wallow-to-Barn handoff before adding more ranks

On a successful Wallow, return the configured furnishing reward summary with the same authoritative result: item ID, name, whether it was newly owned, and permanent rank. Present it in the existing Wallow success sequence after the aura/regeneration message. Offer **Preview in my Barn** and **Later**. Preview should create an unsaved draft with the compatible position highlighted; the player must still tap Save.

If the design was bought earlier, celebrate that the rank made it a permanent Wallow keepsake and mark the rank complete without implying a duplicate. Do not refund automatically: that changes the buy-early proposition retroactively and could create an exploitable currency loop.

### 2. Add a small exclusive prestige series beyond rank 6

Use a bounded cadence rather than promising unique furniture forever. Recommended first series:

- Rank 7: a small shelf or wall keepsake that is unmistakably Wallow-earned.
- Rank 10: a room-level accent or plaque with a visible rank mark.
- Every fifth rank after 10: advance one reusable prestige object or visual variant rather than adding a brand-new catalog row each time.

This gives rank 7 an immediate next goal, gives rank 10 a memorable landmark, and avoids an unbounded art commitment. Keep gameplay power capped as designed; these should be social/creative status rewards.

### 3. Add three named room presets

Presets turn catalog breadth into usable expression. Each preset should store the same exact seven-position snapshot plus its own revision or receipt semantics. The active preset remains the only room friends see. Switching presets must be explicit, conflict-safe, and must never mutate ownership.

Three slots are enough to support “current favorite,” a complete themed collection, and a prestige/social display without turning room management into inventory administration.

### 4. Create a Barn-wide mastery track

Add server-derived progress for paid designs owned, collection rewards earned, collections completed, prestige gifts earned, and milestone designs earned. Reward meaningful thresholds, especially completing 3, 5, and 10 themed collections. Prefer one exclusive display object or title per major threshold over more currency.

The mastery track should explain the next nearest goal and deep-link to the relevant filtered collection. It should not require owning prestige gifts before their rank or count inactive catalog rows.

### 5. Connect friend-room inspection to personal goals

Implement the already-proposed item detail and wishlist flow. A visitor should see the furnishing's public source and exact unlock condition from their own authorized catalog, then save it to a local/server wishlist or open that design in their own collection. Track the explicit funnel from inspection through placement.

### 6. Instrument the economy before changing prices or adding refunds

Record rank at purchase, item source, newly-owned versus already-owned prestige grant, days from purchase/grant to placement, collection completion time, and aggregate Snouts spent on housing. Define review thresholds before launch—for example, excessive early-purchase regret or very low first-placement rates—then adjust copy, celebration, or reward shape based on evidence.

## Bounded implementation work packages

### Package A — authoritative rank-up reward handoff (P0, backend + Season UI)

Scope: make `wallow()` grant/reconcile the rank's configured habitat reward in the same transaction without introducing profile/habitat lock inversion; return a structured reward summary; update Season presentation.

Acceptance criteria:

- A successful rank 1–6 Wallow returns the exact configured furnishing and `newlyOwned` state.
- Replaying/retrying cannot duplicate ownership, receipts, currency, or celebration state.
- A previously purchased item is reported as already owned and receives no refund or second quantity.
- Rank 7+ succeeds with an explicit no-current-furnishing result until later catalog entries exist.
- Lock-order/concurrency tests cover Wallow racing with habitat purchase, owner refresh, and save.
- The Season success flow names and pictures the reward and offers Preview/Later without changing the saved room.

### Package B — new-gift inbox and guided placement (P0, habitat client)

Scope: persist unpresented acquisition receipt IDs, show one accessible acquisition sheet on owner Barn entry, and open a compatible unsaved preview.

Acceptance criteria:

- Offline/relaunch behavior presents each confirmed new gift at most once per account.
- Catch-up of several ranks groups gifts into one summary and permits browsing each item.
- Preview never auto-saves, overwrites a draft, or changes a revision.
- Existing dirty drafts get a clear choice to keep the draft or start the gift preview.
- Reduced Motion, VoiceOver labels, small-screen layout, and interruption recovery are verified.

### Package C — post-rank-6 exclusive keepsake slice (P1, product/art/backend/client)

Scope: design, produce, and ship the first exclusive reward at rank 7 plus a visible rank-10 target; define the reusable cadence beyond 10.

Acceptance criteria:

- Reward source is prestige-only (`is_for_sale=false`) and cannot enter collection purchase counts.
- Catalog and ladder show the next reward for ranks 6–10.
- Backfill and lazy reconciliation grant eligible historic ranks idempotently.
- Assets include room art, thumbnail, accessible description, and placement checks on supported devices.
- The product document states the finite cadence and does not imply unique art at every future rank.

### Package D — three room presets (P1, schema/API/client)

Scope: add three named saved layouts, designate one active visitor-facing preset, and migrate the current layout into preset one.

Acceptance criteria:

- Existing rooms migrate with identical active appearance and revision safety.
- Create/rename/save/activate operations are idempotent and authorized to the owner.
- Concurrent devices receive actionable conflicts without losing either draft.
- Friend views expose only the active committed preset and no owner inventory metadata.
- Switching among three themes takes fewer actions than manually replacing all seven positions.

### Package E — Barn mastery summary (P1, backend + collection UI)

Scope: server-derived aggregate progress and milestones across collections, original milestones, and prestige gifts.

Acceptance criteria:

- Counts are computed from authoritative ownership/catalog metadata and ignore inactive/unavailable rows.
- The UI shows overall owned/available, completed collections, and the nearest deterministic reward.
- Major thresholds use durable receipts and cannot be double-granted.
- Each next-goal action opens the correct collection/filter/item.
- Tests cover purchases received free later, collection rewards, historic backfill, and catalog expansion.

### Package F — friend discovery and wishlist (P2, social + habitat client/API)

Scope: inspect placed items in a friend's room, resolve public acquisition requirements against the visitor's catalog, save wishlist entries, and deep-link home.

Acceptance criteria:

- Inspection never exposes the host's inventory, receipts, balance, or draft.
- Requirements distinguish purchase, collection threshold, milestone, starter, and Wallow rank.
- Wishlist writes are idempotent and separate from purchase/placement.
- Deep links preserve the target design and compatible position filter.
- Analytics cover inspect → wishlist → acquire → place with account-safe attribution.

### Package G — launch telemetry and economy review (P2, analytics)

Scope: define events, a query/dashboard, and a post-launch review checkpoint before tuning prices or compensation.

Acceptance criteria:

- Dashboard segments by permanent rank and reports purchase, grant, already-owned grant, first placement, collection completion, and Snout-spend distributions.
- Event contracts avoid item descriptions or other unnecessary payload data.
- A written review rubric identifies what evidence would trigger copy changes, reward changes, price changes, or no action.
- The first public build containing prestige gifts is tied to the existing release follow-up before analysis is treated as complete.

## Suggested parallel ownership

These packages have clean file and decision boundaries:

1. Progression/backend agent: Package A server contract and concurrency harness; owns migration/RPC and DB smokes only.
2. Season presentation agent: Package A client response parsing, Wallow celebration, and focused tests; owns `hooks/useSeason.ts`, Season screen/components, and tests only.
3. Habitat experience agent: Package B guided presentation and placement; owns habitat hooks/components and local persistence tests only.
4. Product/art agent: Package C reward concepts, cadence decision, assets, and catalog copy; no schema edits until IDs and placement categories are accepted.
5. Presets agent: Package D as a separate vertical slice after Package B stabilizes; owns preset schema/API/routes and dedicated UI.
6. Social discovery agent: Package F after public acquisition metadata is settled by Packages A/C/E.
7. Analytics agent: Package G contracts and dashboard/query, coordinated with all packages before implementation so event names remain stable.

Package A backend and Season UI can proceed in parallel against an agreed response fixture. Package B can prototype against the same fixture. Package C's art direction can run concurrently, but its migration should land after the rank-up response supports arbitrary catalog-configured ranks. Packages D and F should not share habitat screen files concurrently.

## Unknowns requiring product or production evidence

- Whether `20260910120000_habitat_prestige_rewards.sql` is deployed in the environment players use. This audit assesses repository behavior and intentionally does not inspect or mutate production.
- Current rank distribution, especially the number of players already above rank 6 and the urgency of a rank-7 reward.
- How many players already own each of the six gifts, and whether “already owned” feels neutral, positive, or disappointing.
- Actual Snout earning velocity and housing spend. Source-defined prices alone cannot establish whether 80 paid expansion items are too slow, too fast, or appropriately aspirational.
- Whether players understand that Wallow rank is permanent while Prestige Path lap progress is seasonal/current-lap state.
- Whether players enter the Barn after Wallowing often enough for lazy catch-up to be perceptible without an immediate Season handoff.
- Device-level visual and accessibility quality of the full 118-design catalog, especially scan cost, preview clarity, and VoiceOver traversal.
- Whether players want multiple authored rooms, faster theme swapping, or primarily completion/status display; preset design should be validated with usage or interviews.
- The desired status language and art budget for exclusive prestige rewards beyond rank 6.
