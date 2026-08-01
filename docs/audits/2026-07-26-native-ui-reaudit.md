# Native UI re-audit

Date: 2026-07-26  
Scope: current React Native / Expo iOS client after the adapt, animate,
optimize, colorize, and polish tranches.

This is a strict source-level re-audit against the Impeccable native rubric.
It supersedes the milestone score in the 2026-07-25 audit. The lower score does
not indicate a regression: the prior score credited the presence of new
foundations, while this pass scores how consistently the whole production
surface uses them.

## Platform conformance verdict

**Pass, with reservations.** Tickle the Pig reads as a deliberately branded
native iPhone game, not a web port. Expo Router uses native Stack and Tabs,
there are five real top-level tab destinations, the native edge-back gesture
is not disabled, safe areas are present on main screens, system haptics and
share sheets are used, and Reduce Motion is respected in the most expressive
surfaces.

The remaining off-platform behavior is concentrated in older hand-built
modals and sheets. Several draw a native-looking grabber without interactive
dismissal, many do not share safe-area, keyboard, focus, or escape behavior,
and deep routes still replace native navigation chrome with text-built
headers.

## Audit health score

| # | Dimension | Score | Key finding |
|---|---|---:|---|
| 1 | Accessibility | 2/4 | Scaling remains structurally fragile and several important custom controls omit names or state |
| 2 | Performance | 2/4 | Inbox has a serial hydration waterfall; Lounge rerenders the whole scene at 8 fps |
| 3 | Appearance & Theming | 2/4 | The light-only contract is honest, but semantic token coverage remains partial |
| 4 | Platform Conformance | 2/4 | Native foundations are sound; modal, header, sheet, and icon vocabularies still drift |
| 5 | Adaptivity | 2/4 | Core primitives adapt, but legacy modal geometry remains fixed and unbounded |
| **Total** | | **10/20** | **Acceptable — significant systemic migration remains** |

Severity: **P0 0 · P1 6 · P2 7 · P3 0**

## Executive summary

The five completed tranches fixed real problems: there is no longer accidental
dark appearance, text no longer shrinks below the 11pt floor, core controls
have 44pt contracts, the highest-cardinality tabs are virtualized, Reduce
Motion has one policy, and the worst thumbnail decodes are tiered.

The fresh audit changes the priority order. The next highest-value work is not
another broad visual sweep. It is:

1. remove the Inbox network waterfall and coalesce realtime refreshes;
2. move Lounge's remote animation off whole-screen React reconciliation and
   stop eagerly decoding every pig pack;
3. migrate the legacy modal families onto safe-area, scrolling, keyboard, and
   VoiceOver-owned primitives;
4. make essential status layouts respond to accessibility text sizes;
5. finish accessible names, roles, states, and targets on custom controls.

## P1 findings

### P1 — Inbox hydration is a serial network waterfall

**Location:** `components/Inbox.tsx:116-237`, `:255-300`  
**Category:** Performance

`load()` awaits trades, friendships, profile hydration, blessings and their
profiles, curses and their profiles, balance, accepted friendships, and a
second profile hydration in sequence. Six realtime subscriptions can each
start the same unthrottled full reload.

**Impact:** A cold Inbox focus can require roughly 8-10 dependent round trips.
A burst of social changes can overlap full reloads, waste bandwidth and
renders, and allow a stale request to finish last.

**Recommendation:** Run independent reads concurrently, consolidate the
hydrated read model behind one server contract where practical, and coalesce
realtime invalidations behind one in-flight refresh.

**Suggested command:** `$impeccable optimize components/Inbox.tsx`

### P1 — Lounge reconciles the full scene eight times per second

**Location:** `app/lounge.tsx:432-473`, `:576`  
**Category:** Performance

A 125 ms interval increments React state to select remote walk frames. Each
tick recreates occupancy collections and rerenders the peer scene even though
the local movement path already uses Reanimated shared values.

**Impact:** Continuous JS-thread work competes with gestures, presence traffic,
and navigation. Its cost grows with peer count and is most visible on older
iPhones.

**Recommendation:** Put time-based remote animation in UI-thread derived
values, or isolate remote actors in a tightly memoized ticking subtree that
does not reconcile the entire Lounge.

**Suggested command:** `$impeccable optimize app/lounge.tsx`

### P1 — Dynamic Type still breaks essential status layouts

**Location:** `constants/theme.ts:116-139`;
`components/ui/ProfileIdentity.tsx:38-52`;
`app/race-standings.tsx:653-664`;
`components/season1/YourTakeStrip.tsx:101-192`  
**Category:** Accessibility / Adaptivity

React Native scaling is enabled, and the recent pass removed all production
shrink-to-fit labels and sub-11pt literal sizes. However, production source
still contains 559 numeric font-size declarations and 91 one/two-line clamps.
Shared roles use fixed point sizes and fixed line heights. Profile identity,
standings status, and the three dense Your Take cells clamp information a
player needs to act.

**Impact:** Accessibility text sizes can truncate rewards, ranks, state, and
identity rather than reflowing them.

**Recommendation:** Introduce a scalable text-role primitive, define
accessibility-size layout variants for dense rows, and remove clamps from
essential state before migrating decorative copy.

**Suggested command:** `$impeccable adapt`

### P1 — Legacy modal geometry can hide content and actions

**Location:** `components/SeasonEndModal.tsx:205-247`, `:479-493`;
`components/UserSheet.tsx:479-755`, `:985-993`;
`components/GreatHungerIntroModal.tsx:94-153`  
**Category:** Adaptivity / Platform Conformance

The tree contains 43 native Modal occurrences across 39 production files.
Only three consumers use `AdaptiveModalScaffold`; 23 modal files have no
scroll path and 34 do not consume safe-area insets. Season End pins an
unscrollable card and CTA stack to the bottom. User Sheet can render a long
profile, action, and moderation stack without a maximum height or ScrollView.

**Impact:** Compact-height phones, Display Zoom, the home indicator, and large
text can push the only dismissal or primary action offscreen.

**Recommendation:** Define three intent-owned primitives—task sheet,
celebration cover, and alert dialog—on the adaptive scaffold contract. Migrate
the dense and bottom-anchored families first and prohibit raw Modal outside an
explicit allowlist.

**Suggested command:** `$impeccable adapt`

### P1 — Modal VoiceOver behavior is not primitive-owned

**Location:** `components/ui/AdaptiveModalScaffold.tsx:75-123`;
`components/UserSheet.tsx:477-505`;
`components/HoofprintsSheet.tsx:89-108`  
**Category:** Accessibility / Platform Conformance

The adaptive scaffold supplies modal containment and accessibility escape.
Legacy sheets instead expose unlabeled full-screen dismissal Pressables and
have no shared initial-focus, escape, or backdrop-hiding contract.

**Impact:** The two-finger scrub may not dismiss, focus can enter a meaningless
backdrop, and focus restoration depends on each caller.

**Recommendation:** Put containment, initial focus, escape dismissal,
background hiding, and focus restoration in the modal primitives rather than
individual screens.

**Suggested command:** `$impeccable polish`

### P1 — Important custom controls still omit names, roles, or state

**Location:** `app/lounge.tsx:759-786`;
`components/Inbox.tsx:511-527`;
`components/BuriedTruffleSheet.tsx:204-236`;
`components/Account.tsx:1303-1331`  
**Category:** Accessibility

Lounge emote choices and the menu button are icon-only with no label, button
role, or expanded state. Inbox's decline control is an unnamed X.
Buried-truffle stake choices and feedback-kind choices do not expose
radio/selected state.

**Impact:** VoiceOver users cannot reliably determine what the controls do or
which choice is active.

**Recommendation:** Migrate icon actions to `IconButton`, mutually exclusive
choices to `SegmentedControl` or a radio primitive, and require accessible
state in the component interface.

**Suggested command:** `$impeccable polish`

## P2 findings

### P2 — Lounge eagerly decodes every pig animation pack

**Location:** `app/lounge.tsx:64-92`, `:181-198`, `:540`  
**Category:** Performance

Six packs of 22 256×256 frames are instantiated before membership admission is
resolved: 132 frames, roughly 33 MiB of decoded RGBA before texture overhead.

**Recommendation:** Gate the heavy scene behind admission, load the local pig
first, and lazily load only pig IDs currently present.

**Suggested command:** `$impeccable optimize app/lounge.tsx`

### P2 — Root launch work is spread across twenty effects

**Location:** `app/_layout.tsx:302-455`, `:510-765`  
**Category:** Performance

Independent launch checks repeat auth reads, perform unrelated network work,
and commit many root-level state updates after the shell appears.

**Recommendation:** Introduce one launch coordinator consuming
`sessionUserId`, batch independent reads, and commit one typed launch result.

**Suggested command:** `$impeccable optimize app/_layout.tsx`

### P2 — Secondary render, gesture, and bundle hot paths remain

**Location:** `app/achievements.tsx:213-245`;
`components/mudwar/TrufflePatch.tsx:383`, `:716-748`;
`components/ui/Icon.tsx:13`  
**Category:** Performance

Achievements mounts every filtered card in a ScrollView, and the Truffle Patch
continuous pan/hit-test path plus charge animation remain JS-thread-bound.
The current Icon barrel also causes the latest verified IPA to carry all 19
vector-icon fonts—about 3.7 MiB uncompressed—although the app uses only
Material Community Icons and Feather through that adapter.

**Recommendation:** Virtualize Achievements. Move continuous gesture
recognition and telegraph motion to Gesture Handler/Reanimated worklets,
crossing to JS only for completed actions. Use family-specific icon imports or
replace the delegated subset with local SVG paths, then compare the next IPA
manifest.

**Suggested command:** `$impeccable optimize`

### P2 — Frequent controls still miss the 44pt target contract

**Location:** `app/race-standings.tsx:803-818`, `:861-878`;
`components/PigRosterPicker.tsx:352-364`;
`components/BattlePassSaleModal.tsx:167-173`  
**Category:** Accessibility / Platform Conformance

Dig-Off period tabs are 38pt, compact metric radios are 30pt, pig-roster
actions are 38pt, and the Season Pass close control is 30pt without
compensating hit slop.

**Recommendation:** Make 44pt the primitive-owned minimum and remove local
compact variants that shrink interaction geometry.

**Suggested command:** `$impeccable polish`

### P2 — Friends search lacks keyboard-aware result geometry

**Location:** `components/Friends.tsx:657-674`;
`app/(tabs)/friends.tsx:141-212`  
**Category:** Adaptivity

Friends is the visible text-input flow without keyboard avoidance or automatic
keyboard insets.

**Recommendation:** Add keyboard-aware insets and verify that focus, results,
feedback, and Add actions remain visible above the keyboard.

**Suggested command:** `$impeccable adapt`

### P2 — Theme governance remains partial

**Location:** `constants/theme.ts:55-81`;
`components/ui/Button.tsx:43-92`;
`components/ui/HangingSignsTabBar.tsx:395-467`  
**Category:** Appearance & Theming

The light-only semantic contract is honest and tested. A production-only scan
still finds roughly 120 raw color occurrences across 48 files after excluding
the large custom Icon artwork, development overlays, and prototypes.
Functional button states and tab materials still own local ramps.

**Recommendation:** Move functional control, material, and effect roles into
the theme. Keep genuinely illustrative SVG/art colors local.

**Suggested command:** `$impeccable colorize`

### P2 — Sheet, header, and utility-icon vocabularies still drift

**Location:** `components/CrewSheet.tsx:96-109`, `:141-148`;
`components/UserSheet.tsx:517-522`, `:995-1003`;
`components/ui/PageHeader.tsx:43-87`;
`app/race-standings.tsx:165-191`;
`components/ui/Icon.tsx:1-13`, `:68-88`, `:686-705`  
**Category:** Platform Conformance

Some sheets draw a grabber without swipe dismissal. Deep routes replace native
navigation chrome with text-built back rows, and the public Icon component
mixes custom SVG, filled Material Community Icons, and outline Feather icons.

**Recommendation:** Either implement interactive sheet dismissal or remove
the false grabber; centralize one navigation-header adapter; normalize utility
icons to one family and weight while preserving storybook Glyphs for game
nouns.

**Suggested command:** `$impeccable polish`

## Systemic patterns

- The new shared primitives are good, but migration coverage is low:
  `IconButton` has three production consumers, `SegmentedControl` has one, and
  `AdaptiveModalScaffold` has three.
- The remaining accessibility failures cluster around hand-built controls and
  older modal families, so interface-enforced semantics will outperform
  screen-by-screen patching.
- Performance risk has moved from eager list rendering to orchestration,
  realtime invalidation, animation ownership, and asset admission.
- The app intentionally supports portrait iPhone only. Fourteen remaining
  `Dimensions.get` calls are acceptable only while that decision remains; they
  must be removed before iPad, multitasking, or broader window support.

## Positive findings

- No production text disables scaling, shrinks to fit, or uses a literal size
  below 11pt.
- Shared Button uses content-driven height and wrapping.
- IconButton guarantees a named 44pt target.
- SegmentedControl exposes radiogroup and selected semantics.
- AdaptiveModalScaffold owns live geometry, safe area, scrolling, keyboard
  avoidance, modal escape, and a named close action.
- Reduce Motion is centralized and covers the high-impact animated surfaces.
- Friends, Leaderboard, Closet, and Inbox history are virtualized with bounded
  windows; Closet and Shop use thumbnail tiers.
- Appearance is explicitly light-only through Expo, the native target,
  navigation transitions, splash, and status bar.
- The custom five-tab rail supplies labels, selected state, safe-area inset,
  badges, and reduced-motion behavior.
- Popup collision handling is unusually explicit through PopupQueue and
  unmanaged-modal holds.

## Recommended actions

1. **P1 — `$impeccable optimize components/Inbox.tsx app/lounge.tsx`:**
   remove the Inbox waterfall/realtime overlap and Lounge's whole-scene ticker
   and eager pack loading.
2. **P1 — `$impeccable adapt`:** migrate dense legacy modal families and
   essential Dynamic Type layouts onto shared adaptive contracts.
3. **P1 — `$impeccable polish`:** complete control semantics, modal VoiceOver
   behavior, and 44pt targets.
4. **P2 — `$impeccable optimize`:** consolidate root launch reads, virtualize
   Achievements, move the dig gesture path off JS, and trim unused icon fonts.
5. **P2 — `$impeccable colorize`:** finish functional token governance.
6. **Final — `$impeccable polish`:** normalize headers, sheets, and utility
   icon vocabulary after the systemic work.

You can ask me to run these one at a time, all at once, or in any order you
prefer.

Re-run `$impeccable audit` after fixes to see the score improve.
