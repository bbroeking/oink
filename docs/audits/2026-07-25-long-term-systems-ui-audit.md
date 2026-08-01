# Long-term systems and UI audit

Date: 2026-07-25  
Scope: current React Native/Expo client, Supabase migrations through
`20260783000000_consolidate_referrals.sql`, and an iOS production export.

> Native UI scoring in this document is superseded by the stricter
> [2026-07-26 native UI re-audit](./2026-07-26-native-ui-reaudit.md), which
> scores app-wide migration coverage rather than foundation completion.

## Executive verdict

Tickle the Pig has a coherent game identity and a surprisingly broad set of
working systems. Its strongest architectural decisions are the server-owned
economy, the recent domain seams around seasons/rooting/shop/realtime, and a
distinctive native presentation.

The largest long-term risks are not missing features. They are:

1. permanent Wallow power compounds into future seasons and competitive score;
2. two Wallow edge cases can lie to or permanently block a player;
3. RPC failures are frequently collapsed into `null`, allowing unsafe or
   lossy fallbacks;
4. database authority is protected by point fixes rather than a schema-wide
   executable policy;
5. the visual system assumes a small portrait phone, standard text size, light
   appearance, and full motion;
6. large lists, full-size art, and hundreds of bundled assets will increasingly
   tax memory and startup as content grows.

Recommended strategic model: **Seasonal Gentle Wallow**. Keep permanent Wallow
rank, aura, frame, and cosmetics, but derive its capped mechanical benefit from
the current season. Use a fixed Barn-visit cadence and cap regeneration output
near 1.5×.

## Implementation status

Completed locally after the audit:

- Wallow readiness now uses server `can_wallow`; the final 100 XP is shown
  honestly instead of announcing readiness at 2,900 XP.
- Wallow power copy now says “wait reduced by X%” and shows exact intervals
  rather than making a mathematically incorrect “X% faster” claim.
- Cosmetic equip falls back to the legacy direct write only when PostgREST
  positively reports that the RPC is missing; other failures now fail closed.
- The while-away cursor no longer advances when any required event source
  fails.
- Popup CTA navigation now follows one release → teardown → navigate contract.
- A local, unpushed `20260784000000_wallow_truffle_overflow.sql` migration
  records capped Wallow rewards in recoverable server-owned overflow and still
  records the tier claim, removing the progression deadlock.

The first adaptive UI tranche is also complete locally:

- the shared Button now expands and wraps under Dynamic Type instead of forcing
  a fixed height, single line, and shrink-to-fit behavior;
- `AdaptiveModalScaffold` now provides safe-area-aware width and height,
  scrolling, optional keyboard avoidance, modal semantics, and a named 44pt
  close target;
- Alignment Explainer, Item Preview, and Pig Friends launch now use that
  scaffold;
- Page Background, Animated Background, Barn Visit, Lounge, and Closet geometry
  now reacts to the current window rather than module-load screen snapshots.

The first systemic motion tranche is complete locally:

- `useMotionPolicy()` is now the only reader of the iOS Reduce Motion setting
  and updates live from one shared subscription;
- shared duration, crossfade, and decorative-loop behavior gives screens one
  vocabulary for full and reduced motion;
- animated backgrounds, Great Hunger breathing, Lucky Pig rays/aura, Barn
  dig attraction, animated cosmetics and pig auras, skeletons, Tier Up, and
  the principal wobbling/spring modal entrances now stop, rest, or crossfade
  under Reduce Motion;
- the development UI audit lab can follow iOS or force either policy, preview
  perpetual/loading motion and Tier Up, and open fixture-backed modals without
  authentication.

The first performance tranche is complete locally:

- Friends and the global/pairs boards now render bounded FlatList windows;
- the alignment board uses SectionList, preserving independent side rankings;
- Closet chunks its category grids into virtualized three-item rows while
  retaining slot-to-section navigation and the inline Titles destination;
- Inbox virtualizes its up-to-100-item history feed;
- ten 1024px held-item masters now have 128px chip and 256px browse tiers,
  while PigStage and large previews retain the masters.

The first color-system tranche is complete locally:

- Expo and the checked-in iOS target now declare an honest light-only
  appearance instead of selecting an unimplemented dark navigation theme;
- splash, navigation, transition, status-bar, sheet, and paper surfaces now
  share the same warm-paper contract;
- `UI_COLORS` separates semantic interface roles from the WHIMSY primitives;
- accent, secondary text, disabled controls, purple CTAs, blessing/status
  indicators, and shared chrome now meet explicit contrast thresholds;
- automated checks lock the native appearance settings and WCAG contrast pairs.

The first polish tranche is complete locally:

- `IconButton` now guarantees a named 44pt target even when the visible badge
  is smaller, and `SegmentedControl` provides selected radio semantics;
- Feedback, Lounge, Closet, and Leaderboard now use those shared controls;
- the shared Page Header exposes a named 44pt back action, and the Pig Friends
  launch CTA now uses the shared Button;
- three larger semantic text roles cover recurring body/display needs;
- player-facing source now has no literal font sizes below 11pt and no
  shrink-to-fit labels.

Post-change checks: TypeScript passes; 92 Jest suites / 1,100 tests pass; the
overflow migration passed an isolated PostgreSQL execution rehearsal. A debug
iOS build completed and launched on an iPhone simulator at normal and
accessibility XXXL text settings. The audit lab also resolved both real iOS
motion modes correctly after simulator preference changes. The optimization
tranche also completed a simulator-free iOS Metro export with all new tier
assets resolved; the color and polish tranches repeated that export against the
new native appearance and control contracts. The native UI score is now
**14/20**: adaptive, motion, list-scaling, appearance, and control foundations
are credible, while app-wide AppText adoption, remaining modal families,
single-line truncation, and broader image/cache policy remain open.

## System map

| System | Player promise | Main authority/seam | Audit state |
|---|---|---|---|
| Identity/auth | A persistent pig/profile and handle | Supabase auth, profiles, root layout | Stable; root startup controller is overloaded |
| Home/Barn | Tickle, earn, care for, and dress the active pig | `Barn`, home stats, tickle RPCs | Strong core loop; orchestrator remains large |
| Tickle bank/regen | Tickles replenish according to active effects | Server regen functions + home stats | Authoritative, but Wallow curve is too strong |
| Happiness/mood | Care changes the pig's visible idle mood | Happiness utilities/server state, sprite renderer | Clear show-don't-tell model |
| Streak/Garden | Consistency grows an ambient Garden | Server streak state + Barn presentation | Coherent secondary retention loop |
| Friends/visits | Visit and tickle friends' pigs | Friendship layer, Barn visit RPCs/modal | Valuable social loop; cadence inherits Wallow unfairness |
| Sounder | A persistent crew and co-op identity | Crew hooks/RPCs and Sounder screens | Coherent; naming is now clearer in domain docs |
| Feeding/Truffle Patch | Time-windowed cooperative digging | Rooting RPCs, `useRooting`, rooting kernel | Strong rules seam; component action state is still coupled to effects |
| Great Hunger | Shared season-wide cooperative objective | Hunger hook/RPCs and Season UI | Strong thematic spine |
| Season Pass | XP unlocks Free/Premium rewards | `useSeason`, `seasonPass`, season RPCs | Good server routing; first-Wallow claim UX is fragmented |
| Wallow | Repeat the path, keep rewards, raise prestige | Wallow migrations and Season UI | Needs correctness fixes and a fairness redesign |
| Race/Dig-Off | Competitive season standings | Race utility/hook/screens | Good extracted read model |
| Currency/economy | Snouts buy cosmetics; Golden Truffles buy rarities | Server actions, Shop/Exchange | Snout inflation and GT-cap deadlock need attention |
| Shop/cosmetics | Buy, preview, equip, and collect looks | Shop catalog hook, cosmetics utility | Better availability states; equip fallback is fail-open |
| Pig roster/Pen | Members recruit and switch a companion pig | Roster RPCs/hook/Pen UI | Clean new vertical seam |
| Membership/IAP | Slop Club unlocks benefits | RevenueCat adapter + entitlement hooks | Adapter boundary is sound |
| Rituals/Hoofprints | Bless or curse friends; receive visible effects | Active-effects provider and ritual utilities | Good receiver-side seam |
| Alignment | Actions express Greedy/Generous identity | Server score and alignment utilities | Clear social identity layer |
| Trade | Asking profits; fulfilling is generous | Server trade actions and Inbox | Deliberately asymmetric, thematically legible |
| Lucky Pig | Random temporary bonus moments | `useLuckyPig` + pure utility | Good testable math seam |
| Achievements/titles | Long-term goals grant identity and rewards | Achievement RPCs/screens | Useful evergreen progression |
| Field Guide | Discover economy objects through play | Field Guide utility/config and reveal UI | Strong discovery framing |
| Burrow Book | Discover seasonal relics | Dig collection and reward state | Clear seasonal counterpart to Field Guide |
| Trough drives | Collective reward drives | Trough hook/RPCs and Shop surface | Auto-claim migration reduces missed rewards |
| Lounge | Synchronous social presence and emotes | Presence/broadcast hook and Lounge screen | Distinct mechanic; fixed world geometry is brittle |
| Notifications/while-away | Return to a trustworthy recap and route | Routing table, root startup reads, popup queue | Route table is strong; cursor can skip failed reads |
| Referrals/redemption | Invite or redeem once for rewards | Referral/redemption utilities and RPCs | Consolidated migration is now live |
| Popup ceremonies | One orderly modal/ceremony at a time | PopupQueue and priority registry | Strong state machine; consumers can violate teardown timing |
| Developer/release tooling | Reproducible tests, migrations, and releases | scripts, checklist, build docs | Good release discipline; no single executable CI boundary |

## Wallow and economy audit

### Current power curve

The configured percentage reduces the interval; it is not a percentage increase
in output. The UI currently calls it “faster,” which materially understates the
benefit.

| Wallow | Interval reduction | Base interval | Output | Visit window |
|---:|---:|---:|---:|---:|
| W0 | 0% | 60m | 1.00× | 8h |
| W1 | 25% | 45m | 1.33× | 7h |
| W2 | 50% | 30m | 2.00× | 6h |
| W3 | 55% | 27m | 2.22× | 5h |
| W4 | 60% | 24m | 2.50× | 4h |
| W5 | 65% | 21m | 2.86× | 3h |
| W6 | 70% | 18m | 3.33× | 3h |

With five taps per visit, neutral regeneration, enough friends, and perfect
consumption, the current lanes provide roughly:

- W0: 69 personal score and 162 XP/day;
- W6: 200 personal score and 480 XP/day;
- W6: about 2.9× W0's combined score capacity;
- a nominal 3,000-XP lap: about 18.5 days at W0 versus 6.25 days at W6.

Happiness, alignment, blessings, and war-winner effects can multiply this
advantage further. Permanent prestige therefore accelerates competitive score,
season XP, and the next permanent prestige rank.

### P0 — none found

No immediately exploitable issue remains in the three migrations just applied.
The `202607805` security hotfix closes the arbitrary-XP and concurrent-visit
paths found in the previous pass.

### P1 — Golden Truffle cap can permanently block Wallow

Location:
`supabase/migrations/20260769000000_prestige_wallow.sql:295`,
`:428`; `supabase/migrations/20260704300000_truffle_exchange.sql:189`.

A Golden Truffle reward is rejected when it would exceed the 999 cap. Wallow
requires every current-lap reward to be claimed. The Exchange contains one-time
items and refuses owned items. A player who owns the Exchange and has a full
pouch can therefore never claim the reward and never Wallow again.

Recommendation: record the claim and place excess in recoverable overflow, or
create a genuinely evergreen Golden Truffle sink. Do not silently destroy
premium currency.

### P1 — Tier 30 announces readiness 100 XP early

Location:
`supabase/migrations/20260769000000_prestige_wallow.sql:169`,
`:193`, `:261`; `app/(tabs)/season.tsx:1720`.

Tier 30 appears at 2,900 XP (`floor(xp / 100) + 1`), while Wallow requires
3,000 XP. The UI uses the displayed tier to say “Ready to raise your Wallow
rank,” even when the server says `can_wallow = false`.

Recommendation: retain the 3,000-XP lap for compatibility, render a final
“Finish the lap” meter, and reserve readiness language for `can_wallow`.
Longer term, add an explicit `completion_xp` field.

### P1 — permanent power undermines season fairness

Location:
`supabase/migrations/20260779000000_prestige_curve_and_visit_window.sql:78`,
`:163`, `:223`.

Permanent `profiles.wallow_count` controls both regeneration and Barn cadence.
It also accelerates the XP that earns more Wallow ranks. New players enter each
season behind in both progression and leaderboard capacity.

Recommendation: adopt **Seasonal Gentle Wallow**:

- keep permanent public rank, aura, frame, and six exclusive cosmetics;
- derive mechanical rank from the current season's Wallow count;
- use interval reductions `8/15/21/26/30/33%` for a maximum output near 1.49×;
- use a fixed three-Barn/six-hour visit window;
- expose permanent rank and seasonal power rank as separate server fields.

### P2 — first Wallow requires a hidden two-track cleanup

Location:
`supabase/migrations/20260769000000_prestige_wallow.sql:277`;
`supabase/migrations/20260773000000_claim_season_consolidation.sql:175`;
`app/(tabs)/season.tsx:1210`.

An entitled member must claim Free rewards, switch tracks, claim Premium
rewards, and then Wallow. Claim-all sweeps one resolved track and the error only
says rewards are waiting.

Recommendation: show exact pending counts by track and provide direct claim
actions in the pre-Wallow surface.

### P2 — power copy is mathematically misleading

Location: `app/(tabs)/season.tsx:136`, `:144`, `:1221`, `:1695`, `:2483`.

“70% faster” ordinarily means 1.7× output; the implementation produces 3.33×.
Use “wait reduced by 70%” or show “one tickle every 18 minutes.”

### Currency notes

Each repeat path pays 375 snouts, four Golden Truffles, and a Mystery Hat Box.
Snouts are increasingly inflationary because their primary sinks are finite
cosmetics. Once the Mystery Hat Box exhausts unowned hats, it converts into
another 150 snouts. Golden Truffle issuance is conservative relative to
Exchange prices, but the lack of an evergreen sink creates the cap deadlock.

## Architecture and backend audit

### P1 — cosmetic equip fallback is fail-open

Location: `utils/cosmetics.ts:14`, `:87`; migration
`20260774000000_equip_cosmetic.sql:14`.

Every RPC failure—including offline, permission, transport, and SQL failures—
falls back to a direct profile update. The direct update error is ignored and an
optimistic patch is returned. This can display an equip that never persisted,
and the legacy direct-update policy leaves ownership enforcement client-side.

Recommendation: only compatibility-fallback on a positively identified
missing-function error, propagate write failure, then retire the direct policy
behind a minimum-client-version plan.

### P1 — failed launch reads can permanently skip away events

Location: `utils/rpc.ts:49`; `app/_layout.tsx:565`, `:689`.

Root treats failed sources as empty arrays and advances the local seen cursor
when the combined result is empty. An offline launch can therefore acknowledge
events it never fetched.

Recommendation: only advance after every source explicitly succeeds. Prefer one
server read contract such as `my_launch_inbox(after_cursor)` plus an acknowledge
action.

### P1 — popup consumers bypass teardown timing

Location: `components/ui/PopupQueue.tsx:58`; `app/_layout.tsx:1133`, `:1184`,
`:1209`.

The queue documents a hide/teardown gap, and push routing honors it. Several
other CTAs release and navigate immediately, recreating the iOS
navigation-under-modal-teardown race.

Recommendation: queue-own a `releaseThen(action)` /
`dismissThenNavigate(route)` primitive.

### P1 — function authorization has no global schema policy

Location:
`supabase/migrations/20260780500000_prestige_security_hotfix.sql:12`.

Security-definer functions occur throughout a long migration history. The
recent hotfix correctly repairs a known list, but PostgreSQL's default function
EXECUTE behavior and ACL-preserving renames make future omissions likely.

Recommendation:

- revoke default function EXECUTE from PUBLIC for the migration owner/schema;
- explicitly grant each client RPC;
- maintain a generated RPC manifest classified as query/action/internal/admin;
- fail CI when internal/admin functions are executable by client roles;
- assert hardened `search_path`, public-schema CREATE policy, RLS, and final
  function signatures after a fresh replay.

### P1 — whole-function SQL replacements carry old behavior forward

Current history redefines `tickle_at_barn` 21 times,
`update_profile_and_item_count` 16 times, `daily_shop` 16 times,
`submit_rooting` 14 times, and `regen_secs_for` 10 times. The repo already
records stale replacements resurrecting or deleting policy.

Recommendation: extract stable, revoked internal helpers and keep public RPC
facades short. Begin with Barn visit admission: pair lock, shared budget, and
session creation should complete before reward/XP/announcement decoration.

### P2 — generic RPC transport erases failure meaning

Location: `utils/rpc.ts:1`; `hooks/useSeason.ts:254`;
`hooks/useHomeStats.ts:162`; `hooks/useShopCatalog.ts:122`.

Absence, offline, authorization failure, server error, and valid null all become
`null`. Compatibility fallbacks consequently run for failures they were not
designed to handle, including legacy mutations after a current mutation fails.

Recommendation: introduce:

```ts
type RpcOutcome<T> =
  | { kind: "success"; data: T }
  | { kind: "missing_function" }
  | { kind: "offline" }
  | { kind: "unauthorized" }
  | { kind: "server_error"; error: unknown }
  | { kind: "no_data" };
```

Domain gateways may choose a missing-function fallback. Mutations must never
fallback on offline, unauthorized, or server errors.

### P2 — verification is not an authoritative final-schema gate

The fast DB harness intentionally applies a curated subset and omits some smoke
files. A clean local `supabase db reset` currently stops at
`20260579000000_judgement_day_cron.sql` when the local service lacks the `cron`
schema.

Recommendation: retain the fast feature harness and add a slower full-chain
environment with compatible extensions, followed by final ACL/RLS/signature and
old/current-client contract checks. Add deterministic `check`, `test:ci`,
`typecheck`, and `db:verify` scripts and run the same boundary in CI and release
preflight.

### P2 — highest-value module seams

Do not split files merely by line count. Deepen these boundaries:

1. `launchInboxGateway/useLaunchInbox` — complete fetch, normalization, and
   acknowledgement;
2. Popup `releaseThen` and an `UnmanagedModal` wrapper that acquires a hold;
3. `useInbox/inboxGateway` — rendering consumes typed sections/actions;
4. server Barn-admission helper — public RPC decorates an admitted visit;
5. pure `trufflePatchEngine` reducer — returns state plus audio/haptic/submit
   commands;
6. `useExternalEntryRouting` — owns referrals, redemption links, and push
   routes.

## Native UI audit

Platform verdict: **purpose-built native game, not a web port**. Its interaction
style, haptics, share sheets, safe-area use, and visual voice feel native. Its
paper-craft layer is nevertheless built around small-phone, portrait,
fixed-point assumptions that do not honor the full iOS adaptability contract.

### Score

| Category | Score | Summary |
|---|---:|---|
| Accessibility | 3/4 | Core semantics and high-impact Reduce Motion behavior are covered; text scaling and smaller bespoke controls remain inconsistent |
| Performance | 3/4 | High-cardinality tabs are virtualized and the worst tiny-image decodes are tiered; broader bundle/cache policy remains |
| Appearance/Theming | 3/4 | Honest light-only contract, semantic roles, and tested contrast; raw legacy colors still need opportunistic migration |
| Platform conformance | 3/4 | Native game feel plus shared header, modal, button, icon-action, and segmented-choice contracts; older screens still vary |
| Adaptivity | 2/4 | Shared buttons, core backgrounds, selected scenes, and three dense modals now adapt; broad screen and text-role coverage remains |
| **Total** | **14/20 — Good** | Adaptive, motion, scaling, appearance, and control foundations are credible; broad typography and modal consistency remain incomplete |

No UI P0 issue was found.

### What is already working

- The Truffle Patch and home pig now expose meaningful VoiceOver actions.
- The shared Button and hanging tab bar expose roles and states.
- Tab bar, Spotlight, and PigStage consult Reduce Motion.
- Safe-area insets are used in custom tab chrome.
- Race standings uses a virtualized list.
- Native haptics, navigation, and share behavior reinforce the game feel.
- Theme and rarity tokens provide a useful base for consolidation.
- The new Feeding CTA is authoritative: **Dig now** when open and
  **Opening in _duration_** when closed.

### P1 — app declares a dark appearance it does not implement

Location: `app.json:6`; `app/_layout.tsx:1058`; `constants/theme.ts`.

The app requests automatic appearance and selects the dark navigation theme,
while screens remain cream/ink with hardcoded light colors. Dark system settings
can produce incorrect status/navigation chrome and dark transition flashes.

Recommendation: immediately declare a light-only interface. If dark mode is a
real product goal, first define semantic light/dark roles and derive navigation
and status-bar style from that single palette.

Suggested command: `$impeccable colorize`

Status: **addressed.** Expo and the native iOS target now declare Light;
React Navigation uses one paper/ink theme; status-bar content is explicitly
dark; native and configured splash backgrounds match the app canvas.
`UI_COLORS` provides semantic surface, text, action, state, separator, and
scrim roles. Regression tests verify the configuration and core contrast pairs.
A future true dark mode remains a separate designed feature, not an accidental
system toggle.

### P1 — Dynamic Type is enabled but layouts defeat it

Location: `constants/theme.ts:88`; `components/ui/Button.tsx:40`, `:96`;
`components/Account.tsx:2763`;
`components/ui/HangingSignsTabBar.tsx:503`.

The audit found 564 literal font sizes, 41 below the iOS 11pt floor, 91
single-line truncations, and eight shrink-to-fit labels. The central Button has
fixed heights, one line, and can shrink to 70%. Dense rows and fixed line
heights will clip at accessibility sizes.

Recommendation: introduce semantic `AppText` roles, test all screens at
accessibility sizes, make Button use minimum height plus padding/wrapping, and
remove sub-11 text.

Status: **substantially addressed.** Shared Button now uses minimum height,
padding, and wrapping without shrink-to-fit. The eight audited shrink-to-fit
labels have been removed, and a source guard keeps player-facing literal text
at or above 11pt. Three larger text roles cover recurring body/display needs.
Semantic AppText adoption, the 91 single-line truncation decisions, and a
screen-wide accessibility-size pass remain.

Suggested command: `$impeccable adapt`

### P1 — device geometry is captured once and cannot reflow

Location: `components/ui/PageBackground.tsx:16`, `:78`;
`components/ui/AnimatedBackground.tsx:22`, `:126`;
`components/ClosetView.tsx:41`; `app/lounge.tsx:39`.

The app intentionally supports portrait iPhone only, but module-scope
`Dimensions.get` snapshots also fail Display Zoom, live window changes, and
compact-height scenarios. Lounge additionally assumes a fixed 432×910 world.

Recommendation: replace snapshots with `useWindowDimensions`, compact-width
tokens, and recomputed scene transforms. Keep the portrait/no-tablet product
decision explicit.

Status: **core hotspots addressed.** Page Background, Animated Background,
Barn Visit, Lounge, and Closet now derive geometry from the current window.
Further screen-level compact-height testing remains.

Suggested command: `$impeccable adapt`

### P1 — Reduce Motion covers only a small subset of animation

Thirty-nine files contain meaningful motion; five consult the system setting.
Uncovered loops include background crossfades, Hunger breathing, Lucky Pig
rays/aura, modal wobble, Barn Visit bob/pulse, cosmetic loops, skeleton pulse,
and the Tier Up transition.

Recommendation: create one `useMotionPolicy()` and shared loop/transition
helpers. Remove perpetual decoration and replace large transforms with
crossfades when reduced motion is enabled.

Suggested command: `$impeccable animate`

Status: **systemic foundation and high-impact migration complete.**
`useMotionPolicy()` is the sole iOS preference reader. Animated backgrounds,
Great Hunger, Lucky Pig, Barn attraction, cosmetics/auras, skeletons, Tier Up,
and the principal wobble/spring modal entrances now rest or crossfade under
Reduce Motion. Smaller local feedback animations should migrate opportunistically
as their owning surfaces are polished.

### P1 — high-cardinality screens render eagerly

Location: `components/Friends.tsx:247`, `:441`;
`components/Leaderboard.tsx:703`; `components/ClosetView.tsx:332`;
`components/Inbox.tsx`.

Friends, Leaderboard, Closet, and Inbox use ScrollView and map every loaded row.
Leaderboard paginates the network but not rendering.

Recommendation: move these surfaces to FlatList/SectionList with stable keys and
memoized rows.

Suggested command: `$impeccable optimize`

Status: **addressed.** Friends, global/pairs Leaderboard, Closet category grids,
and Inbox history now use bounded FlatList windows; Alignment uses SectionList.
Stable keys and bounded initial/batch/window settings are explicit. The Inbox's
small actionable/outgoing prelude remains in the list header, while its
100-event history is virtualized.

### P1 — oversized source art is decoded as tiny UI art

Location: `constants/hats.ts:5`; `components/ClosetView.tsx:523`.

Ten imported held-item PNGs are 1024² but may render at 30×30. Each can decode
near 4 MB in memory before compositing.

Recommendation: generate 128/256 thumbnail tiers, reserve masters for pig
composition/large previews, virtualize the owning grids, and adopt an explicit
image loading/cache policy.

Suggested command: `$impeccable optimize`

Status: **primary hotspot addressed.** All ten 1024² held-item masters now have
128² and 256² tiers. Closet chips use 128px; Closet and Shop browse grids use
256px; PigStage and large previews keep masters. Worst-case decoded pixels for
all ten fall from about 40 MiB to 0.625 MiB in chips or 2.5 MiB in grids.
Broader cache policy and other large asset families remain future work.

### P1 — dense modals are not adaptive

The source contains 45 native Modal uses across 41 files; only 14 of those files
also contain a ScrollView. Dense examples include Alignment Explainer,
Item Preview, and the Pig Friends launch modal.

Recommendation: build one `AdaptiveSheet/ModalScaffold` with safe-area maximum
height, scrollable body, keyboard avoidance, 44pt close target, and the shared
motion policy.

Status: **foundation and first migration complete.** `AdaptiveModalScaffold`
now owns safe bounds, scrolling, optional keyboard avoidance, modal semantics,
and a 44pt close target. Alignment Explainer, Item Preview, and Pig Friends
launch are migrated; the remaining modal families are still open.

Suggested command: `$impeccable adapt`

### P2 — small icon controls and chips recur

Confirmed examples include 30–40pt close/back/remove/emote controls in Item
Preview, Pig Friends, Feedback, Race Standings, Lounge, and Closet. Several have
no explicit accessible name or selected state.

Recommendation: add `IconButton`, `Chip`, and `SegmentedControl` primitives
that enforce a 44pt hit target and require label/state props.

Suggested command: `$impeccable polish`

Status: **primary hotspots addressed.** `IconButton` guarantees a named 44pt
target around smaller visuals; `SegmentedControl` exposes a labeled radiogroup
with selected state and 44pt options. Feedback close, Lounge exit, Closet
remove, Closet swatches, and Leaderboard scope now use the shared contracts.
Add a dedicated Chip only when a repeated interactive-chip contract emerges;
an unused abstraction would not improve the product.

### P2 — custom headers drift

All stack headers are hidden and screens recreate back controls. The native edge
gesture may remain, but size, semantics, and placement vary.

Recommendation: centralize a `PageHeader` while preserving the native stack
gesture.

Suggested command: `$impeccable polish`

Status: **foundation complete.** Shared `PageHeader` now provides a named 44pt
back action while navigation remains in the native stack. Remaining bespoke
headers should migrate when their screens are next touched.

### P2 — visual tokens leak

The audit found 160 raw hex literals in `app/` and `components/`, despite a
strong theme base.

Recommendation: consolidate semantic roles before attempting dark mode.

Suggested command: `$impeccable colorize`

Status: **foundation complete, migration ongoing.** `UI_COLORS` owns interface
roles and the polish tranche removed additional raw surface/accent values from
Lounge and Pig Friends. Legacy decorative hex values should move
opportunistically rather than through a risky undifferentiated rewrite.

## Prioritized roadmap

### Phase 0 — correctness and authority

1. Resolve Golden Truffle overflow so Wallow cannot deadlock.
2. Gate “ready” copy on `can_wallow` and expose the final 100 XP.
3. Stop advancing the away cursor after failed reads.
4. Make cosmetic equip fail closed.
5. Introduce typed RPC failure outcomes.
6. Add the schema-wide RPC/ACL manifest and full-chain verification gate.
7. Centralize popup release-then-navigation.

### Phase 1 — settle the progression contract

1. Approve Seasonal Gentle, Cosmetic, or Permanent Blaze explicitly.
2. If Seasonal Gentle is selected, add server-owned seasonal power rank and
   update regen/visit functions.
3. Separate permanent identity from seasonal mechanics in the API and UI.
4. Replace “faster” copy with exact intervals/wait reduction.
5. Surface and claim pending Free/Premium rewards in one pre-Wallow flow.
6. Model evergreen currency sinks before adding more repeatable grants.

### Phase 2 — adaptive UI foundation

1. Make the honest light/dark appearance decision. **Complete: light-only.**
2. Add AppText, IconButton/Chip/SegmentedControl, PageHeader, and AdaptiveSheet.
   **IconButton, SegmentedControl, PageHeader, and AdaptiveModalScaffold
   complete; AppText and a proven Chip contract remain.**
3. Apply Dynamic Type and compact-height tests to core tabs and launch modals.
4. Add one Reduce Motion policy and migrate perpetual/full-screen animation.
5. Replace fixed screen snapshots with reactive layout tokens.

### Phase 3 — scale and deep modules

1. Virtualize Friends, Leaderboard, Closet, and Inbox. **Complete.**
2. Generate thumbnail asset tiers and define image caching. **Tiers complete;
   broader cache policy remains.**
3. Extract launch-inbox, Inbox, and external-routing gateways.
4. Characterize then extract Barn visit admission.
5. Move Truffle Patch transitions into a pure replay-tested engine.

## Verification record

- Remote migrations applied:
  - `20260781000000_member_pig_roster.sql`
  - `20260782000000_auto_claim_trough_rewards.sql`
  - `20260783000000_consolidate_referrals.sql`
- Remote/local migration ledger matches through `20260783000000`.
- Linked database lint at error level: clean.
- Previous implementation tranche: TypeScript clean; 85 Jest suites and 1,011
  tests passed; changed UI lint had zero errors.
- Adaptive UI tranche: TypeScript and changed-file lint clean; 88 Jest suites
  and 1,036 tests passed; debug iOS build completed with zero errors and
  launched on an iPhone 16e simulator at normal and accessibility XXXL text
  settings.
- Motion tranche: TypeScript and changed-file lint clean; 89 Jest suites and
  1,059 tests passed. The development audit lab followed the actual simulator
  motion setting and its forced full/reduced fixture modes.
- Optimize tranche: TypeScript clean; focused changed-file lint has no errors;
  90 Jest suites and 1,069 tests passed. A simulator-free iOS Expo export
  bundled 3,228 modules and resolved all 20 new thumbnail assets.
- Color tranche: TypeScript clean; focused changed-file lint has no errors
  beyond pre-existing warnings; 91 Jest suites and 1,096 tests passed. The
  appearance/contrast suite covers 27 configuration and palette assertions.
- Polish tranche: TypeScript and focused changed-file lint clean; 92 Jest
  suites and 1,100 tests passed. Source guards found no player-facing literal
  text below 11pt and no remaining shrink-to-fit labels.
- iOS Expo export: 3,230 modules, 822 bundled assets, 9.13 MB Hermes bundle,
  approximately 71 MB uncompressed export directory. This is not an IPA size,
  but it confirms that asset and JavaScript growth are real concerns.
- Full local migration replay is not currently a passing gate because the local
  service used for the audit does not provide the `cron` schema required by
  `20260579000000_judgement_day_cron.sql`.

Recommended Impeccable sequence:

1. `$impeccable adapt` — foundation complete
2. `$impeccable animate` — foundation complete
3. `$impeccable optimize` — primary hotspots complete
4. `$impeccable colorize` — appearance contract complete
5. `$impeccable polish` — primary hotspots complete

Re-run `$impeccable audit` for a fresh score and the next highest-value
cross-system tranche.
