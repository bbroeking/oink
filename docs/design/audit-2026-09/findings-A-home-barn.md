# Findings — Area A · Home / Barn / Habitat

Auditor A · 2026-09-11 · audited from source, 36 files (~11,900 lines).
Full ten prompts run on the three largest: `components/BarnVisitModal.tsx` (2,190),
`components/Barn.tsx` (1,448), `app/barn-collection.tsx` (805). Every other file got a P4 token grep and a
P5 inventory row.

---

## 1. Area summary

This area is the game's front door: the Barn tab (`app/(tabs)/index.tsx` → `components/Barn.tsx`), the
chips and trays that ride above Rosie, the visit-a-friend overlay, and the Habitat (Barn interior +
furnishing collection). **The paper-craft DNA is genuinely strong on the Barn surface itself** — the
`PaperTicket` stat cards with `Tape` + `Sticker` + hand tilt, the tilted `BarnUpdatesTray` with its
pressed-offset shadow collapse, `BarnBountyChip`, `BarnSounderChip`'s sanctioned bark panel, and
`HoofprintsSheet`'s `SlideUpSheet` + `SectionHeader` + `EmptyState` composition are as good as the taste
standard gets. Only the two sanctioned shadow tiers appear anywhere in the area (0 soft shadows), and
raw hex is nearly extinct (13 sites, 11 of them in dead code or SVG art/mask channels).

**The single biggest systemic gap is that this area contains two different design systems.** The Barn
cluster (Barn, the chips, the ritual/effect sheets) is taste-rich and accessibility-thin. The Habitat
cluster (`barn-interior`, `barn-collection`, `components/habitat/*`) is the mirror image: meticulously
labelled for VoiceOver — the best-labelled code in the area by a wide margin — but built from a completely
different visual vocabulary: borderless panels, translucent white pills, `MaterialCommunityIcons`, flat sun
rectangles for buttons, bare `ActivityIndicator`, and zero shadow tier. `app/barn-collection.tsx` is the
clearest case: 805 lines, one shared primitive (`PageHeader`), and a design-specificity verdict of **FAIL** —
an unrelated furniture-shopping app could ship it unchanged. The second gap is that the *product* identity
leaks at the seams: an emoji renders on the Barn's most-looked-at chip (P0), and the same concept — an active
blessing/curse — is drawn three different ways in three components.

Counts: **1 P0 · 9 P1 · 10 P2 · 7 P3**.

---

## 2. Inventory table (P5)

| # | Element | File | Primitive / hand-rolled | States present | Duplicated elsewhere as |
| --- | --- | --- | --- | --- | --- |
| 1 | Tab screen wrapper | `app/(tabs)/index.tsx` | — (bare `View flex:1`) | n/a | — |
| 2 | Stat ticket (×2) | `Barn.tsx:200` `PaperTicket` | `Sticker` + `Tape` + `Glyph` | default, ribbon, streak-badge | `season1/YourTakeStrip` stat cells |
| 3 | Streak badge | `Barn.tsx:283` | hand-rolled pill | default, pressed, disabled | — (emoji, see A-01) |
| 4 | Lucky ribbon | `Barn.tsx:1425` `ticketRibbon` | hand-rolled sun pill + `Glyph` | default only | `BarnSounderChip` kicker band |
| 5 | Heart-float particles | `Barn.tsx:105` `HeartFloats` | `glyphSource` images | spawning only; **no Reduce-Motion still** | `BarnVisitModal` `floats` (second impl) |
| 6 | Barn toast | `Barn.tsx:829` | `Sticker` + `Glyph` | default, tappable, non-tappable | `PurchaseToast` (global, different look) |
| 7 | Barn silhouette shortcut | `Barn.tsx:919` | raw `Svg` + `COLORS.barn` | default, disabled (flag off) | `HabitatEntry` (same destination, different look) |
| 8 | Boot-recovery chip | `Barn.tsx:952` | hand-rolled card + `Icon` | error only | — |
| 9 | Ad refill offer slot | `Barn.tsx:1001` | delegated to `features/rewarded-ads` | gated on `itemCount===0` | — |
| 10 | Updates tray | `BarnUpdatesTray.tsx` | hand-rolled, token-clean + tilt + `SHADOW_SM` | default, pressed, expanded, **embedded (chrome stripped)** | — |
| 11 | Active-effect chip | `BarnActiveEffectsStrip.tsx:32` | hand-rolled + `RitualIconWell` | default, pressed; **no a11y** | see #12, #13 — **3 looks, 1 concept** |
| 12 | Active-effect row | `ActiveEffects.tsx:52` | `Sticker` + `SectionHeader` + corner pill | default, bless, curse; empty = `null` | see #11, #13 |
| 13 | Effect detail card | `HoofprintsSheet.tsx:148` `EffectCard` | `Sticker` + `RitualIconWell` | bless, curse | see #11, #12 |
| 14 | Cleanse pill (spend) | `ActiveEffects.tsx:126`, `HoofprintsSheet.tsx:112` | hand-rolled ×2 | default, pressed; **no a11y** | each other |
| 15 | Cleanse confirm dialog | `CleanseModal.tsx:65` | raw `<Modal>` + `Sticker` | default, busy, error; **no a11y** | `ConfirmDialog` primitive exists |
| 16 | Ritual cast panel | `RitualPicker.tsx:119` | fully hand-rolled (no primitive) | ready, sent, done, capped, error, busy | — |
| 17 | While-away recap | `WhileAwayModal.tsx:116` | raw `<Modal>` + `Sticker` + `Button` | 5 row kinds, tappable row | `Inbox` activity rows |
| 18 | Bounty chip | `BarnBountyChip.tsx:52` | `Sticker` + `Glyph` | default, pressed; self-hides at 0 | `BarnSounderChip` (same slot shape) |
| 19 | Sounder / Great-Hunger chip | `BarnSounderChip.tsx:110` | hand-rolled bark panel | taste, join, dismissed | `season1/SounderHomeCard` |
| 20 | Guestbook placard | `BarnGuestbook.tsx:198` | pressable + `Tape` (no `Sticker`) | default, pressed, compact, swipe-dismiss; **launch unlabelled** | `BarnUpdatesTray` toggle |
| 21 | Guestbook sheet | `BarnGuestbook.tsx:240` | `AdaptiveModalScaffold` + `Sticker` | default, loading (bare text), no empty | `HoofprintsSheet` (uses `SlideUpSheet`) |
| 22 | Visit overlay root | `BarnVisitModal.tsx:926` | hand-rolled absolute-fill | loading (`LoadingBeat` ✓), live, inside, nap | — |
| 23 | Visits-left chip | `BarnVisitModal.tsx:996` | hand-rolled + `IconText`/`Glyph` | ≥2, 1, 0 (color-coded) | `BarnBountyChip` |
| 24 | Leave pill | `BarnVisitModal.tsx:1673` | hand-rolled pill + `SHADOW_SM` | default | `Button variant="ghost"` |
| 25 | Heart tally | `BarnVisitModal.tsx:1453` `HeartTally` | hand-rolled + `Glyph` | default, +1 tick | — |
| 26 | Tap pig | `BarnVisitModal.tsx:1485` `TapPig` | `PigStage` + nametag | default, tired, disabled, rive/sprite | `SwipeElement` (Barn home, labelled ✓) |
| 27 | Nap screen | `BarnVisitModal.tsx:1231` | hand-rolled scrim + card | rested-on-arrival, tired-out, locked | `AdaptiveModalScaffold` |
| 28 | Guestbook stamp offer | `BarnVisitModal.tsx:1289` | hand-rolled scrim + card | offer, sending, sent, error, kindness | #27, #29 |
| 29 | Parting-note sheet (VIP) | `BarnVisitModal.tsx:1385` | hand-rolled scrim + card | offer, sending, sent, error | #27, #28 |
| 30 | Barn overlay washes | `ui/BarnOverlay.tsx` | pure `View` tints (documented exception) | angel, goblin, cursed, neutral=null | — |
| 31 | Pig stage | `ui/PigStage.tsx` | `Glyph` + anchor resolution, `useMotionPolicy` ✓ | idle, reaction, aura, rive/sprite | — |
| 32 | Tickle icon | `ui/TickleIcon.tsx` | raw `Svg` (5 raw hex, intentional art) | single | `SnoutCoin` |
| 33 | Coach-mark spotlight | `ui/Spotlight.tsx` | raw `<Modal>` + `Sticker` card; `useMotionPolicy` ✓ | active, wiggle, dismissable; **no a11y** | — |
| 34 | Purchase / app toast | `PurchaseToast.tsx` | hand-rolled + `STICKER_SHADOW` + `Icon` | success, fail, cost chip; **not announced** | `Barn.tsx` toast (#6) |
| 35 | Barn-interior screen | `app/barn-interior.tsx` | `Button` only; MCI icons | loading, error, view, editing, offline, dirty, saved | — |
| 36 | Interior top controls | `app/barn-interior.tsx:298` | hand-rolled translucent pills | default, pressed, disabled | `IconButton` primitive exists |
| 37 | Barn collection screen | `app/barn-collection.tsx` | `PageHeader` only | loading, error, retry, filtered, empty, owned, locked | `app/(tabs)/shop.tsx` (same job, full system) |
| 38 | Collection item card | `app/barn-collection.tsx:594` | hand-rolled card | owned, buyable, unaffordable, earned, new | `components/ItemPreviewModal` cards |
| 39 | Filter chips | `app/barn-collection.tsx:484` | hand-rolled borderless pills | default, selected | `SegmentedControl` primitive exists |
| 40 | Habitat scene | `habitat/HabitatScene.tsx` | hand-rolled + `SHADOW_SM` on marker | view, editing, placed, empty slot | — |
| 41 | Habitat editor chrome | `habitat/HabitatEditor.tsx` | hand-rolled translucent pills + MCI | editing, saving, disabled, offline, tools sheet, conflict | `HabitatSlotList` actions |
| 42 | Habitat slot list | `habitat/HabitatSlotList.tsx` | hand-rolled rows | filled, empty, selected, disabled | #38 |
| 43 | Habitat entry chip | `habitat/HabitatEntry.tsx` | `Button` | compact, full | `Barn.tsx` silhouette (#7) |
| 44 | Starter welcome | `habitat/HabitatStarterWelcome.tsx` | raw `<Modal>`, hand-rolled CTA | single | `ConfirmDialog` / `Button variant="gold"` |
| 45 | Gift reveal | `habitat/HabitatGiftReveal.tsx` | `AdaptiveModalScaffold` + `Button` | reveal, dismissed | `MysteryHatReveal` |
| 46 | Item preview modal | `habitat/HabitatItemPreviewModal.tsx` | `AdaptiveModalScaffold` + `Sticker` + `Button` | owned, buyable, busy, error, room-preview, wishlist | `components/ItemPreviewModal` |
| 47 | Inspection sheet | `habitat/HabitatInspectionSheet.tsx` | `AdaptiveModalScaffold` + `Sticker` + `Button` | default | #46 |
| 48 | Preset sheet | `habitat/HabitatPresetSheet.tsx` | `AdaptiveModalScaffold` + `Button` | loading (bare spinner), saved, empty | — |
| 49 | Expansion discovery | `habitat/HabitatExpansionDiscovery.tsx` | `AdaptiveModalScaffold` + `SHADOW_SM` | loading (bare spinner), choice, saving | — |
| 50 | Workshop cabinet | `habitat/HabitatWorkshopCabinet.tsx` | hand-rolled + `SHADOW_SM` | default; **`Alert.alert` debug path** | — |
| 51 | Friend room | `habitat/HabitatFriendRoom.tsx` | `LoadingBeat` ✓ | loading, loaded, unavailable | — |
| 52 | Door transition | `habitat/HabitatDoorTransition.tsx` | `Animated` + `useMotionPolicy` ✓ | enter, exit | — |
| 53 | Owner pig slot | `habitat/HabitatOwnerPig.tsx` | provider wrapper | n/a | — |
| 54 | Dev route stubs | `app/barn-housing-preview.tsx`, `app/barn-visit-preview.tsx` | `Redirect` guard (correct) | n/a | — |

---

## 3. Findings

### [P0] A-01 · Emoji renders on the Barn's most-looked-at chip

**Location** `components/Barn.tsx:299` (render), `components/Barn.tsx:786` (share sheet)
**Prompt(s)** P2 design specificity, P10 charter compliance (d), P3 learnability
**Evidence**

    <Text style={styles.streakBadgeText}>🔥 {streak} DAY{streak === 1 ? "" : "S"}</Text>
    message: `I'm on a ${stats.currentStreak}-day tickle streak in Tickle the Pig 🔥`,

**Expected standard** Taste standard: *"No emoji in UI, ever. Use `Glyph` (hand-drawn art) or `Icon` (SVG).
An emoji character in a render is an automatic taste failure."* The flame is already drawn — `Glyph name="flame"`
renders **twice, twelve lines above**, flanking the ticket value (`Barn.tsx:271, 279`).
**Gap** One component draws the same flame three times: two hand-drawn glyphs and one system emoji, stacked
vertically. The emoji renders at the platform's own size and color and matches neither glyph. `Barn.tsx` is one
of only three files in the app with this problem.
**Recommendation** Replace with `<Glyph name="flame" size={11} />` inside an `IconText` wrapper (the pattern
`BarnVisitModal` already uses for kicker + glyph rows). Drop the emoji from the share string too — the rule is
cheaper to enforce with no exceptions. Then add the lint gate (System asks #20) so the other two sites can't regrow.
**Pillar** Collect (the Streak is the Barn's loyalty badge) / craft.

---

### [P1] A-02 · `app/barn-collection.tsx` is off-system end to end — design specificity FAIL

**Location** `app/barn-collection.tsx:404-805` (whole screen), styles at `:742-804`
**Prompt(s)** P2 specificity verdict, P3 all five categories, P5 inventory, P10 (g)(h)(i)(j)
**Evidence** 805 lines. One shared primitive in the file (`PageHeader`). The stylesheet has **no `borderWidth`
on any button, no `STICKER_SHADOW`, no `SHADOW_SM`, no tilt, no `Glyph`**:

    buy:      { minHeight: 44, backgroundColor: WHIMSY.sun, borderRadius: 10, marginTop: SPACE.sm },
    disabled: { backgroundColor: UI_COLORS.surfaceStrong },
    filter:   { minHeight: 44, paddingHorizontal: SPACE.md, borderRadius: 22, backgroundColor: WHIMSY.paper },

plus `<ActivityIndicator accessibilityLabel="Loading" />` (`:54`) and `<ActivityIndicator
accessibilityLabel="Loading Barn collection" />` (`:439`), and an empty state that is a bare string:
`<Text accessibilityRole="alert" style={styles.body}>No furnishings match this search.</Text>` (`:727`).
**Expected standard** Taste standard rules 1, 4, 5 and the 2026-07-07 decision-log entry (*"waiting/cooldown
states keep the control's shape — you mute the fill, you never dissolve the outline"*). The shop — the screen
doing the identical job for cosmetics — is cited in the standard as a cohesive redesign.
**Gap** P2's question asked directly: *could an unrelated product use this composition unchanged?* Yes. A
furniture app, a plant store, a sticker shop. Nothing on this screen says Tickle the Pig except the word
"Snouts". The Buy button is a rounded sun rectangle with no ink outline; the disabled Buy loses its fill and
keeps no outline at all, so a locked item renders as a grey slab.
**Recommendation** Rebuild from primitives, not by adding decoration: `Sticker` for the item card (rotate from
`ROW_TILTS[i % 8]`), `Button variant="gold"` for Buy and `variant="locked"` for unaffordable/inactive (the one
variant that already implements the no-crush ruling), `SegmentedControl` for the ownership filter row,
`EmptyState glyph="pigface"` for no-match, `LoadingBeat label="opening the collection"` for both spinners,
`Glyph` for the rarity mark. Replace `paddingBottom: 80` (`:742`) with `TAB_SAFE`.
**Pillar** Collect — this is the collection screen; it should be the most collectible-feeling surface in the app.

---

### [P1] A-03 · The Habitat interior chrome is a second, flatter design language

**Location** `app/barn-interior.tsx:475-623` (styles), `components/habitat/HabitatEditor.tsx:475-553`,
`components/habitat/HabitatSlotList.tsx:196-265`, `components/habitat/HabitatStarterWelcome.tsx:88-122`
**Prompt(s)** P2 specificity, P3 layout + button usability, P8 Von Restorff + Fitts, P10 (i)(j)
**Evidence**

    // HabitatEditor.tsx:494 + :507 — the editor's entire floating control set
    editingPill:     { borderRadius: 22, backgroundColor: "rgba(255, 250, 240, 0.92)" },
    floatingControl: { borderRadius: 22, backgroundColor: "rgba(255, 250, 240, 0.94)" },
    floatingSave:    { borderRadius: 22, backgroundColor: WHIMSY.sun },   // the primary action
    disabled:        { backgroundColor: UI_COLORS.surfaceStrong },
    // HabitatSlotList.tsx:264
    disabled: { opacity: 0.5 },
    // HabitatStarterWelcome.tsx:114 — the player's first look at the Barn interior
    button: { backgroundColor: WHIMSY.sun, borderWidth: 2, borderColor: WHIMSY.ink, borderRadius: 14 },

`HabitatEditor.tsx` has **zero** `STICKER_SHADOW`/`SHADOW_SM` references; so do `HabitatSlotList.tsx`,
`HabitatStarterWelcome.tsx`, `app/barn-collection.tsx`, and `components/RitualPicker.tsx`.
**Expected standard** Two hard shadow tiers on every sticker surface; a disabled control keeps its outline
(2026-07-07); `Button` is the button.
**Gap** Von Restorff fails in the editor: Save (the only lose-your-work action) and Cancel wear identical pill
chrome, differing only in fill. Fitts fails too — both sit in opposite bottom corners at 44pt while the canvas
between them is the real target. And `HabitatStarterWelcome` is the *first* screen a player sees inside their
Barn: full-screen, borderless list cards, no `Sticker`, no `Glyph`, no tilt.
**Recommendation** One rule: **every floating control in the Habitat is an `IconButton` or a `Button`.**
`floatingControl`/`cancelControl`/`moreControl`/`undoControl` → `IconButton`; `floatingSave` →
`Button variant="gold"` with the disabled path on `variant="locked"`; `HabitatSlotList.disabled` and
`barn-collection`'s disabled fill likewise. Rebuild `HabitatStarterWelcome` on `AdaptiveModalScaffold` +
`Sticker` + `Button variant="gold"`, one `Glyph` per starter item.
**Pillar** Collect (the Barn is where collectibles live) / craft.

---

### [P1] A-04 · Icon-set drift: raw `MaterialCommunityIcons` in this area only

**Location** `app/barn-interior.tsx:11, 310, 327, 349`; `components/habitat/HabitatEditor.tsx:10, 222, 242, 261, 285`
**Prompt(s)** P6 accessibility (icon-set consistency), P2 specificity, P9 naming consistency
**Evidence**

    import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
    <MaterialCommunityIcons name="chevron-left" size={24} color={UI_COLORS.action} />
    <MaterialCommunityIcons name="briefcase-outline" | "pencil-outline" | "close"
                            | "dots-horizontal" | "undo" | "content-save-outline" ... />

**Expected standard** `components/ui/Icon.tsx` is the single consumer surface for vector icons — its own
comment says so: *"Added during the no-emoji sweep so call sites stay `<Icon name="crown" />` and we keep one
consumer surface."* It already delegates to MCI/Feather behind `VECTOR_ICON_MAP`.
**Gap** A repo-wide grep for `@expo/vector-icons` returns exactly three files: `Icon.tsx` (sanctioned) and
these two. Seven call sites mix a Material outline vocabulary into screens whose neighbours use ink-outline
storybook art. `Icon` already exposes `x`, `plus`, `edit`, `arrowRight`, `chevronDown` — four of the seven need
no new art at all.
**Recommendation** Route all seven through `Icon`. Add to `VECTOR_ICON_MAP`: `more` → mci `dots-horizontal`,
`undo` → mci `undo`, `save` → mci `content-save-outline`, `chevronLeft` → feather `chevron-left`; map
`briefcase-outline` onto existing art or add `furnishings`. Then make the raw import a lint error outside
`components/ui/Icon.tsx`.
**Pillar** Craft / governance.

---

### [P1] A-05 · Spend and cast paths are invisible to VoiceOver

**Location** `components/CleanseModal.tsx:96, 112` (4 pressables, 0 accessibility props in the whole file);
`components/ActiveEffects.tsx:126`; `components/HoofprintsSheet.tsx:112`; `components/RitualPicker.tsx:189`;
`components/BarnActiveEffectsStrip.tsx:32`; `components/BarnGuestbook.tsx:160`
**Prompt(s)** P6 accessibility, P1 heuristics 4 + 5, P7 high-stakes reassurance
**Evidence**

    // CleanseModal.tsx:96 — spends 5 snouts
    <Pressable testID="cleanse-confirm" onPress={onPress} disabled={busy} style={...}>
    // RitualPicker.tsx:189 — casts an irreversible once-per-day social action
    <Pressable testID="ritual-cast" onPress={cast} disabled={busy || remaining === 0} style={...}>
    // ActiveEffects.tsx:126 / HoofprintsSheet.tsx:112 — opens the 5-snout spend
    <Pressable onPress={() => setCleanseOpen(true)} hitSlop={{...}} style={...}>

Pressable-vs-label counts: `CleanseModal` 4/0, `RitualPicker` 1/0, `ActiveEffects` 1/0, `HoofprintsSheet` 2/0,
`BarnActiveEffectsStrip` 1/0, `BarnGuestbook` 3/1 (the ✕ is labelled; the placard that opens the sheet is not).
**Expected standard** Baseline: 70 of 98 files with pressables carry an accessibility prop. The Habitat cluster
*in this same area* is exemplary (`barn-collection` 10 pressables / 14 labels; `HabitatEditor` 17/16) with
`accessibilityState={{ disabled }}` and consequence-naming hints on every destructive control.
**Gap** A VoiceOver player reaches the Cleanse button and hears "button" — no price, no target, no disabled
state. The cast button gives no hint that the action is once-per-day and irreversible.
**Recommendation** A system rule: **any control that spends currency, sends something to another player, or
cannot be undone carries `accessibilityRole="button"`, an `accessibilityLabel` naming the cost or target, an
`accessibilityHint` naming the consequence, and `accessibilityState={{ disabled }}`.** Encode it by moving
these five onto the `Button` primitive (which can carry the props once) rather than patching five hand-rolled
`Pressable`s. Add the rule to the standard's decision log.
**Pillar** Connect (rituals are the social loop) / craft.

---

### [P1] A-06 · The purchase toast is never announced and never respects Reduce Motion

**Location** `components/PurchaseToast.tsx:97-140` (render), `:57-92` (animation)
**Prompt(s)** P6 accessibility, P7 emotional journey (peak-end), P10 (e)
**Evidence** 10 `Animated.*` calls, zero `useMotionPolicy`, zero `accessibilityLiveRegion`, zero
`AccessibilityInfo.announceForAccessibility`, zero `accessibilityRole`. It auto-dismisses on a hard-coded
timer and is mounted once at app root, so it is the sole confirmation for every purchase in the game —
including `app/barn-collection.tsx:387`'s furnishing buy.
**Expected standard** `hooks/useMotionPolicy.tsx` exposes `reduceMotion`, `allowDecorativeMotion`,
`largeTransition`, `duration(standardMs, reducedMs)`. `LoadingBeat` already models the announcement pattern
(`accessibilityRole="progressbar"` + `accessibilityState={{ busy: true }}`).
**Gap** Buying something is the peak of the Collect loop, and it ends with a card a screen reader never
mentions and a Reduce-Motion user watches fly in anyway.
**Recommendation** Wrap the card in `accessibilityLiveRegion="polite"` + `accessibilityRole="alert"` and call
`AccessibilityInfo.announceForAccessibility(title + ". " + text)` on show; route both timings through
`motion.duration(220)` / `motion.duration(180, 0)`. Same for `Barn.tsx`'s local toast (#6) — or better, delete
the local toast and route the Barn through `showAppToast` so the game has one toast.
**Pillar** Collect / craft.

---

### [P1] A-07 · `Barn.tsx` ignores the Reduce Motion policy the file next door uses

**Location** `components/Barn.tsx:105-216` (`HeartFloats`), `:661-700` (toast slide) — 18 `Animated.*` sites, 0 motion-policy references
**Prompt(s)** P6 accessibility (Reduce Motion), P10 (e)
**Evidence**

| File | `Animated.*` | motion policy |
| --- | --- | --- |
| `components/Barn.tsx` | 18 | **0** |
| `components/PurchaseToast.tsx` | 10 | **0** |
| `components/BarnVisitModal.tsx` | 23 | 3 |
| `components/ui/PigStage.tsx` | 15 | 7 |
| `components/BarnUpdatesTray.tsx` | 0 (LayoutAnimation) | 2 ✓ |
| `components/ui/Spotlight.tsx` | 5 | 2 ✓ |
| `components/habitat/HabitatDoorTransition.tsx` | 5 | 2 ✓ |

**Expected standard** Taste standard rule 6 plus the prompt set's Reduce-Motion requirement: every decorative
loop needs a still or crossfade alternative. The hook is adopted six files away in the same area.
**Gap** The Barn is the screen a player opens most. Every tickle spawns a staggered burst of scaling,
drifting, rotating particles with no reduced path.
**Recommendation** `const motion = useMotionPolicy()` in `Barn`; gate `HeartFloats`' spawn on
`motion.allowDecorativeMotion` (render one static glyph fading via `motion.duration(600, 150)` when reduced);
route the toast's translate/opacity through `motion.duration`. Make it a rule: **a component that imports
`Animated` imports `useMotionPolicy`** — lintable as an import pairing.
**Pillar** Craft / accessibility.

---

### [P1] A-08 · `BarnVisitModal` hand-rolls three full-screen dialogs, two with no close path

**Location** `components/BarnVisitModal.tsx:1231` (nap), `:1289` (guestbook stamp), `:1385` (parting note);
styles `:1685-1760`, `:1755-1800`, `:2120-2180`
**Prompt(s)** P5 inventory, P8 Jakob, P1 heuristic 3 (user control and freedom), P6 (obvious close)
**Evidence** Three near-identical scrim + card + kicker + title + body + choices + skip structures, each with
its own style block, none using `AdaptiveModalScaffold`, `SlideUpSheet`, `DialogCloseRow`, or `Button`:

    partingScrim: { ...StyleSheet.absoluteFill, zIndex: 200, backgroundColor: MODAL_BACKDROP_BG, ... }
    stampScrim:   { ...StyleSheet.absoluteFill, zIndex: 43,  backgroundColor: MODAL_BACKDROP_BG, ... }
    napScrim:     { ...StyleSheet.absoluteFill, ... }

The nap card's only exit is the hand-rolled `napBtn`; the stamp card's only exit is `stampSkip` which renders
**only when `!stampSent`** (`:1339`); neither scrim dismisses on a backdrop tap, and because the whole overlay
is a plain `View` (not a `Modal`), no hardware/gesture back reaches them.
**Expected standard** 13 files app-wide use `AdaptiveModalScaffold`; `DialogCloseRow` and `ConfirmDialog` exist
for exactly this. Jakob: a phone user expects a scrim tap or back gesture to dismiss a card.
**Gap** After sending a stamp the player sits on a card with no visible way out until a 600 ms timer fires —
and if `schedule` is cancelled by a session change (`sessionIsCurrent`, `:210`) it never fires at all.
**Recommendation** Collapse all three onto `AdaptiveModalScaffold` (`bare` + `Sticker`, the pattern
`BarnGuestbook.tsx:240` already uses in this area), with `DialogCloseRow` for the skip/close row and `Button`
for the primary action. Rule: **no new scrim styles — a card over a dim is `AdaptiveModalScaffold`.** Deletes
~120 lines of style and grants all three a backdrop-tap close for free.
**Pillar** Connect (the visit is the Connect pillar's flagship) / craft.

---

### [P1] A-09 · The coach-mark spotlight is inaccessible and can strand a VoiceOver player

**Location** `components/ui/Spotlight.tsx:306-395` (the `Modal`), `:556-568` (the dismiss)
**Prompt(s)** P6 accessibility, P1 heuristic 3, P7 cognitive load
**Evidence** Zero `accessibility*` props in the entire 651-line file.

    onRequestClose={() => onDismiss?.()}          // :313 — optional; undefined on most call sites
    <Pressable onPress={onDismiss} hitSlop={8} style={...}>
      <Text style={styles.skip}>maybe later ›</Text>
    </Pressable>                                   // :561 — no role, no label; renders only if onDismiss exists

The scrim is a hit-test responder, not a mask (`:275-296`), so nothing sets `accessibilityViewIsModal` and
VoiceOver focus can still walk the screen behind it.
**Expected standard** `HabitatStarterWelcome.tsx:33` sets `accessibilityViewIsModal` on its `Modal` — the
pattern exists in this area. Reduce Motion is already honoured here (`:220, 234, 252`), so the file clearly
knows about accessibility; only AT is missing.
**Gap** A coach mark exists to teach. If VoiceOver never reads the caption it teaches nothing, and without
`onDismiss` there is no labelled exit.
**Recommendation** `accessibilityViewIsModal` on the `Modal`; `accessibilityRole="alert"` +
`accessibilityLabel={caption}` on the caption card; `accessibilityRole="button"` +
`accessibilityLabel="Skip this tip"` on the dismiss; announce the caption via
`AccessibilityInfo.announceForAccessibility` on mount; and make `onDismiss` **required** so every spotlight has
a labelled exit.
**Pillar** Craft / onboarding comprehension.

---

### [P1] A-10 · One concept, three drawings: the active blessing/curse

**Location** `components/BarnActiveEffectsStrip.tsx:32-73`, `components/ActiveEffects.tsx:52-138`,
`components/HoofprintsSheet.tsx:148-172`
**Prompt(s)** P5 state coverage, P3 learnability, P9 naming consistency, P2 specificity
**Evidence** Three components render the same `Effect` object from the same `effectMeta()` helper in three
visual languages:

| | Container | Kind marker | Sender | Countdown | Tilt |
| --- | --- | --- | --- | --- | --- |
| `BarnActiveEffectsStrip` chip | hand-rolled `View` + `SHADOW_SM` | background color only (lilac/cream) | 16px initial dot | inline in `meta` text | ±0.8° inline |
| `ActiveEffects` row | `Sticker` | text corner pill "Blessing"/"Curse" | 24px avatar + "X blessed you" | right column, colored | `ROW_TILTS` |
| `HoofprintsSheet` `EffectCard` | `Sticker` | `RitualIconWell` badge | "from X · 3h left" inline | inline | `rotate={0}` |

`ActiveEffects.tsx:46` and `HoofprintsSheet.tsx:84` render the **identical** header strings:
`<SectionHeader kicker="left by your friends" title="Hoofprints on you" />`.
**Expected standard** The 2026-07-13 dingbat ruling's underlying principle — *one concept, one drawing.*
**Gap** Three reads of the same state teach three mental models, and the strip's version — the one on the Barn,
seen most — is the only one with no `Sticker` and no a11y.
**Recommendation** Extract one `EffectCard` into `components/ui/` with a `size` prop
(`"chip" | "row" | "detail"`) owning the `Sticker`, the `RitualIconWell`, the sender line and the countdown.
All three sites compose it; `ActiveEffects` and `HoofprintsSheet` then differ only in `SlideUpSheet` vs inline.
**Pillar** Connect (rituals are what friends do to each other) / craft.

---

### [P2] A-11 · The `#D5E4C9` curse tint the token sweep was supposed to retire is still inline, twice

**Location** `components/CleanseModal.tsx:147`, `components/RitualPicker.tsx:123`
**Prompt(s)** P4 token triage, P3 color contrast
**Evidence**

    curseRow: { ... backgroundColor: "#D5E4C9", ... }                                // CleanseModal:147
    style={[styles.wrap, { backgroundColor: isBless ? WHIMSY.sun : "#D5E4C9" }]}     // RitualPicker:123

**Expected standard** `constants/theme.ts:40-46` names this exact literal in the comment that introduced
`WHIMSY.bless`/`WHIMSY.curseGreen`: *"Five files hand-mixed this pair off-palette (#C99B23 / #5E7E49 /
#7BA266 / **#D5E4C9** / #5b8a4a); tokenized once so 'matches Barn' is matched by token, not by copy-paste."*
**Gap** The sweep tokenized the two *countdown text* hues but never the pale *surface* the pair also needs, so
the surface literal survived in the two ritual files. These are 2 of only 4 raw hex sites in the area that are
neither dead code nor intentional SVG art.
**Recommendation** Add `WHIMSY.curseSurface: "#D5E4C9"` beside `bless`/`curseGreen`, documented as the pale
companion to `curseGreen` the way `slopBand` companions `slopGold`. Consider `WHIMSY.blessSurface` too so the
`isBless ? WHIMSY.sun : ...` ternary reads as a matched pair rather than one token and one literal. Contrast
is fine (ink on `#D5E4C9` = 12.08:1) — this is pure governance.
**Pillar** Craft / governance.

---

### [P2] A-12 · `TYPE.cardTitleSm` reinvented as a `fontSize` override in the file that needs it

**Location** `components/BarnGuestbook.tsx:358, 436`
**Prompt(s)** P4 token triage, P3 text readability
**Evidence**

    launchTitle: { ...TYPE.sectionTitle, fontSize: 15, color: WHIMSY.ink },
    entryName:   { ...TYPE.sectionTitle, fontSize: 15, color: WHIMSY.ink },

**Expected standard** `constants/theme.ts:139` — *"Small card title — the sanctioned 15px Caprasimo used on
gear/card/dupe/bestiary chips (**replaces the `...TYPE.cardTitle, fontSize: 15` overrides**)."*
**Gap** The token was added precisely to kill this pattern and it came back — with `sectionTitle` (22/24) as
the base instead of `cardTitle` (18/22), so it also inherits a 24px `lineHeight` under a 15px glyph.
`BarnSounderChip.tsx:172` gets it right (`...TYPE.cardTitleSm`) in the same area, so the token is known here.
**Recommendation** Swap both to `...TYPE.cardTitleSm`. Same file, same treatment: `intro` (`:405`,
`FONTS.hand/14/19` → `TYPE.hand` 14/20) and `closeText` (`:469`, `FONTS.whimsy/14` → `TYPE.cardTitleSm`).
Rule: **a `fontSize` key inside a spread of a `TYPE` role is a smell — if no role fits, add one.**
**Pillar** Craft / hierarchy.

---

### [P2] A-13 · Legacy `COLORS.*` on three live surfaces

**Location** `components/PurchaseToast.tsx:113`, `components/BarnVisitModal.tsx:876`, `components/Barn.tsx:927`
**Prompt(s)** P4 token triage, P3 color contrast
**Evidence**

    { backgroundColor: isSuccess ? COLORS.successText : WHIMSY.accent }   // PurchaseToast:113
    const visitsColor = vLeft > 1 ? COLORS.successText : ...              // BarnVisitModal:876
    <Polygon ... fill={COLORS.barn} ... />                                // Barn.tsx:927

**Expected standard** `UI_COLORS` is the semantic role layer; `COLORS` is the legacy palette (14 uses app-wide).
**Gap** `COLORS.successText` (`#5A8338`) and `UI_COLORS.successText` (`#476436`) are *different values*, so the
app ships two greens meaning "success". Against paper that is 4.26:1 vs 6.42:1 — the legacy one clears the 3:1
non-text bar for the toast's icon disc but **fails AA when used for a label**, which is exactly what
`BarnVisitModal:876` does (it colors the "2 of 3" count text over a photo background).
**Recommendation** Swap both to `UI_COLORS.successText`. `COLORS.barn` is a genuine one-off art hue with no
token — promote it to `WHIMSY.barnRed` and drop the `COLORS` import from `Barn.tsx` entirely (its only use).
**Pillar** Craft / governance.

---

### [P2] A-14 · Semantic marks drawn as text glyphs in slots whose siblings use art

**Location** `components/PurchaseToast.tsx:115`, `components/WhileAwayModal.tsx:165`,
`components/RitualPicker.tsx:127`, `components/habitat/HabitatScene.tsx:114`,
`components/habitat/HabitatWorkshopCabinet.tsx:28`
**Prompt(s)** P2 specificity, P3 learnability, P9 dingbat ruling
**Evidence**

    {isSuccess ? <Icon name="check" size={16} .../> : <Text style={styles.iconGlyph}>!</Text>}  // PurchaseToast:115
    <View style={styles.systemGlyphWell}><Text style={styles.systemGlyph}>★</Text></View>       // WhileAwayModal:165
    {isBless ? "✦ today's blessing" : "☁ today's curse"}                                        // RitualPicker:127
    <Text allowFontScaling={false} ...>{placed ? "✎" : "+"}</Text>                               // HabitatScene:114
    <Text style={styles.gear}>⚙︎</Text>                                                          // HabitatWorkshopCabinet:28

**Expected standard** The 2026-07-13 dingbat ruling: *"`✦` and `·` are SANCTIONED as label typography …
`✓`, `✕`, and `♥` are SEMANTIC — they carry meaning … and must render through the `Icon`/`Glyph` primitives …
never as a raw `Text` glyph."* The ruling's test is *"the same concept the app already draws as art elsewhere
in the same file."*
**Gap** All five fail that test sharply. `PurchaseToast` draws success with `Icon` and failure with a
typographic `!` **inside the same 32px disc**. `WhileAwayModal` puts `★` in a `systemGlyphWell` whose sibling
wells hold `<Icon name="bell">`, `<Glyph name="heart">` and `<RitualIconWell>`. `RitualPicker` pairs the
sanctioned `✦` against an unsanctioned `☁` as the curse's identity mark, when the curse has real art
(`CURSE_META[kind].icon`) four lines below.
**Recommendation** `Icon name="x"` (or a new `alert`) for `!`; `Icon name="star"` for the row well; the
`BLESSING_META`/`CURSE_META` glyph for the ritual kickers; `Icon name="edit"` / `Icon name="plus"` for the
scene markers; `Icon name="gear"` for the cabinet. All five names already exist in `IconName`.
**Pillar** Craft / governance.

---

### [P2] A-15 · Disabled states dissolve the control instead of muting the fill

**Location** `components/RitualPicker.tsx:193`, `components/CleanseModal.tsx:100`,
`components/habitat/HabitatSlotList.tsx:264`, `components/habitat/HabitatEditor.tsx:541`,
`app/barn-collection.tsx:799`, and the primitive itself at `components/ui/Button.tsx:141`
**Prompt(s)** P10 (j), P3 button usability, P1 heuristic 6
**Evidence**

    (pressed || busy || remaining === 0) && { opacity: 0.7 }    // RitualPicker:193
    (pressed || busy) && { opacity: 0.7 }                       // CleanseModal:100
    disabled: { opacity: 0.5 }                                  // HabitatSlotList:264
    disabled: { backgroundColor: UI_COLORS.surfaceStrong }      // HabitatEditor:541, barn-collection:799 — no outline
    opacity: disabled && variant !== "locked" ? 0.5 : 1         // ui/Button.tsx:141

**Expected standard** 2026-07-07 decision log: *"waiting/cooldown states keep the control's shape — you mute
the fill, you never dissolve the outline."* Plus: **pressed** and **disabled** must be distinguishable —
`RitualPicker` and `CleanseModal` render them identically at `opacity: 0.7`.
**Gap** The ruling landed on exactly one `Button` variant (`locked`) and never propagated. Five sites here
still crush; the two Habitat sites drop the outline entirely so a locked item reads as a grey slab rather than
a sleeping button.
**Recommendation** Promote the `locked` treatment to `Button`'s *default* disabled behaviour (mute fill to
`paper3`, text to `ink4`, keep the 2px outline, no opacity change) and delete the `variant !== "locked"`
carve-out at `ui/Button.tsx:141`; then move the four hand-rolled controls onto `Button`. Give **pressed** its
own token — the translate-by-shadow-offset pattern at `BarnUpdatesTray.tsx:131` and `BarnVisitModal.tsx:1913`
(`translateX/Y 2` + `shadowOpacity: 0`) — so pressed and disabled can never collide.
**Pillar** Craft / comprehension.

---

### [P2] A-16 · Home's live status is collapsed by default and loses its chrome when embedded

**Location** `components/BarnUpdatesTray.tsx:35` (`useState(false)`), `:103-113`
(`embeddedTray`/`embeddedToggle`), `components/Barn.tsx:1023` (the only Home mount, `embedded`)
**Prompt(s)** P1 heuristic 1 (visibility of system status), P7 cognitive load, P2 specificity
**Evidence**

    const [expanded, setExpanded] = useState(false);
    embeddedToggle: {
      marginHorizontal: 0, borderWidth: 0, borderRadius: RADII.sm,
      backgroundColor: "transparent", transform: [], shadowOpacity: 0, elevation: 0,
    },

`BarnActiveEffectsStrip` and `BarnSounderChip` render **only** inside `expanded` (`:88-92`), and
`BarnUpdatesTray` is their only mount site in the app.
**Expected standard** Visibility of system status; plus the paper-craft DNA — the standalone `toggle` has a
2px ink border, `SHADOW_SM`, a `-0.4°` tilt and a paper fill, every one of which `embeddedToggle` zeroes out.
**Gap** When a curse is active, `BarnOverlay` washes the whole screen murky green — but the curse's *name*, its
effect, who sent it and how to clear it are two taps deep inside a collapsed dropdown the player has no reason
to open. Meanwhile the only variant that ships on Home is the one with no sticker chrome, so the Barn's most
functional control is its least TTP-looking element.
**Recommendation** (a) Default `expanded` to `true` whenever `effects.length > 0` — the tray earns its collapse
only when the news is ambient. (b) Delete `embeddedToggle`'s chrome-stripping; let the embedded variant differ
only in `marginHorizontal`. If Home genuinely needs a quieter control, that is `Button variant="ghost"`, not a
same-name-different-skin branch.
**Pillar** Connect (a curse is a message from a friend) / craft.

---

### [P2] A-17 · `Alert.alert` inside the Barn workshop

**Location** `components/habitat/HabitatWorkshopCabinet.tsx:82`
**Prompt(s)** P10 (f), P2 specificity, P1 heuristic 8
**Evidence** `Alert.alert("Workshop", state, [...])`
**Expected standard** The severity scale calls a system `Alert` in a spend path a P0; this one is a status
read, so it lands at P2. 9 files app-wide still use `Alert.alert`.
**Gap** A system dialog in the game's warmest room — grey iOS chrome over a paper-craft barn.
**Recommendation** `ConfirmDialog` (single-action mode) or `AdaptiveModalScaffold` + `Sticker`. Rule:
**`Alert.alert` is not a TTP surface** — put it on the lint list beside emoji and `@expo/vector-icons`.
**Pillar** Craft.

---

### [P2] A-18 · Visit-screen title relies on a text shadow to survive a player-chosen background

**Location** `components/BarnVisitModal.tsx:1668-1675`
**Prompt(s)** P3 color contrast, P6 accessibility
**Evidence**

    title: { ...TYPE.sectionTitle, color: WHIMSY.paper, marginTop: 1,
             textShadowColor: "rgba(0,0,0,0.55)", textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 3 },

drawn over `bgSrc` — `HAT_IMAGES[barn.active_background_id]`, i.e. **whatever cosmetic background the host
equipped** — with only `topFade` (`rgba(36,24,14,0.45)` → transparent, `:951`) behind it.
**Gap** `#fffaf0` on a mid-tone photo is ~4.0:1, below AA for 22px non-bold text, and a light background
cosmetic (snow, pale sky) drops it far further. The text shadow is the only mitigation and it is the sole
`textShadow` in this area (21 app-wide, 6 files).
**Recommendation** Two system-shaped options: (a) put the header on a `Sticker`/bark panel so the text sits on
a known surface — `interiorHost` (`:1621`) does exactly this a few lines away and reads cleanly; or (b) raise
`topFade`'s first stop to `UI_COLORS.scrim` and add a `WHIMSY.bark` band behind the title column. Either way
add the rule: **text over a player-supplied image sits on a token surface, never on the image.**
**Pillar** Connect / accessibility.

---

### [P2] A-19 · Bare loading and empty text where `LoadingBeat` / `EmptyState` exist

**Location** `components/BarnGuestbook.tsx:307`, `app/barn-collection.tsx:54, 439, 727`,
`app/barn-interior.tsx:51, 174`, `components/habitat/HabitatExpansionDiscovery.tsx:237`,
`components/habitat/HabitatPresetSheet.tsx:38`
**Prompt(s)** P10 (h), P3 learnability, P7 emotional journey
**Evidence**

    {loading && entries.length === 0 && <Text style={styles.empty}>Opening the guestbook…</Text>}  // BarnGuestbook:307
    <ActivityIndicator accessibilityLabel="Loading" />                                             // barn-collection:54
    <ActivityIndicator accessibilityLabel="Setting up your Barn" />                                // barn-interior:174
    <Text accessibilityRole="alert" style={styles.body}>No furnishings match this search.</Text>   // barn-collection:727

**Expected standard** Taste standard rule 4 and roadmap item 2 (marked ✓ done): *"A `Sticker` with a `Glyph`
and a warm line — never a bare gray string or a naked spinner. (Barn's 'saddling up' beat is the bar.)"*
`EmptyState` is adopted in 30 files; `BarnVisitModal.tsx:958` and `HabitatFriendRoom` already use `LoadingBeat`
in this same area.
**Gap** 5 naked spinners and 2 bare strings, all in the Habitat cluster plus the guestbook. The *copy* is
already warm ("Setting up your Barn", "Opening the guestbook…"); only the container is utilitarian.
**Recommendation** Swap each to `LoadingBeat label="<the existing string, lowercased>" glyph="pigface"`, and
the no-match case to `EmptyState glyph="pigface" title="Nothing matches that." sub="Try another word, or clear
the filters."` Keep the `accessibilityLabel` strings — `LoadingBeat` already carries
`accessibilityRole="progressbar"`.
**Pillar** Craft / warmth.

---

### [P2] A-20 · `WHIMSY.slopBand` (the Slop Club identity gold) used as a generic kicker color

**Location** `components/BarnVisitModal.tsx:1667`
**Prompt(s)** P4 token triage, P9 naming consistency
**Evidence** `kicker: { ...TYPE.kicker, letterSpacing: 1.2, color: WHIMSY.slopBand }` — the "VISITING" kicker
above the host's barn name, for every player, member or not. The same file's `partingKicker` (`:1703`) uses
`slopBand` **correctly**: that sheet *is* the Slop Club parting note.
**Expected standard** `constants/theme.ts:30-34`: *"Slop Club gold — the **members-only identity hue** …
`slopBand` is the soft band tint behind the members header row."*
**Gap** Using a membership-identity token for ordinary chrome means the hue stops reading as "this is a Slop
Club thing," and a future Slop Club palette change silently restyles the visit header.
**Recommendation** Use `WHIMSY.sun` (the sanctioned kicker-on-dark hue per the `bark` token comment), or add
`WHIMSY.kickerOnArt` if the visit header needs its own value. Rule: **identity tokens (`slopGold`, `slopBand`,
`angel`, `goblin`) appear only where that identity is the message.**
**Pillar** Craft / governance.

---

### [P3] A-21 · ~90 lines of dead styles in `Barn.tsx` carrying the area's only black surfaces

**Location** `components/Barn.tsx:1200-1382` — `coinSymbol`, `toastIconText`, `floatChar`, `dev67`,
`dev67Text`, `devOnboarding`, `devAlign`, `devAlignText`, `devAnchor`, `devLucky`, `devLuckyText` (11 keys,
0 references). Plus `components/BarnSounderChip.tsx:144-186` — `digChip`, `digChipOpen`, `digChipResting`,
`digChipPressed`, `digArt`, `digTitle`, `digDetail`, `note` (8 keys, 0 references).
**Prompt(s)** P4 token triage, P10 (f)
**Evidence** These dead keys hold **every** remaining raw hex in `Barn.tsx` (`"#00E5FF"` `:1353`, `"#FFB000"`
`:1365, 1369`) and all five `"rgba(0,0,0,0.7)"` black chip backgrounds — the only black surfaces anywhere in
the area, in a game whose standard says *"Every screen is cream/paper — no black wrappers."*
**Recommendation** Delete both blocks. The area's raw-hex count drops from 13 to 8, and 5 of the remaining 8
are `TickleIcon`'s intentional SVG art. Worth doing before any token sweep so the numbers stop lying.
**Pillar** Craft / governance.

---

### [P3] A-22 · A missing `TYPE` role, duplicated verbatim in two neighbouring chips

**Location** `components/BarnBountyChip.tsx:101`, `components/BarnSounderChip.tsx:218`
**Evidence** Identical in both files:

    line: { fontFamily: FONTS.bodyExtra, fontSize: 13, color: <ink|barkText>, lineHeight: 17 },

**Expected standard** `TYPE.label` is bodyExtra/12/0.3; `TYPE.bodySm` is body/13/18. Neither is bodyExtra 13/17.
**Gap** The two chips that share the Barn's in-flow band copy-paste the same type spec. A third near-miss sits
at `BarnActiveEffectsStrip.tsx:135` (bodyExtra/11) and a fourth at `Barn.tsx:1186` (bodyExtra/11/1.4).
**Recommendation** Add `TYPE.labelLg: { fontFamily: FONTS.bodyExtra, fontSize: 13, lineHeight: 17 }` and adopt
it in both chips. It is the "chip line" role the Barn's band language needs.
**Pillar** Craft / hierarchy.

---

### [P3] A-23 · `const sticker = SHADOW_SM` names the small tier after the big one

**Location** `components/BarnVisitModal.tsx:1605-1606`
**Evidence** `const INK = WHIMSY.ink;` / `const sticker = SHADOW_SM;`, then `...sticker` at 10 style sites.
**Gap** The system's two tiers are `STICKER_SHADOW` (4,4) and `SHADOW_SM` (2,2). A local alias named `sticker`
that resolves to the *small* tier makes every grep for shadow-tier drift in the largest file in the area come
back empty, and invites a future reader to assume `...sticker` is `STICKER_SHADOW`.
**Recommendation** Delete both aliases; spread the tokens directly. Rule: **no local aliases for theme
tokens** — the token name is the documentation.
**Pillar** Craft / governance.

---

### [P3] A-24 · Three different scrim dims

**Location** `constants/theme.ts:210` (`MODAL_BACKDROP_BG` = `UI_COLORS.scrim` = `rgba(40,30,20,0.55)`),
`components/ui/Spotlight.tsx:356` (`fill={WHIMSY.ink} opacity={0.68}`),
`components/BarnVisitModal.tsx:948` (`["rgba(36,24,14,0.45)", "rgba(36,24,14,0.12)", "transparent"]`)
**Gap** Three warm-ink dims at 0.45 / 0.55 / 0.68 for three purposes (legibility fade, modal backdrop,
coach-mark focus) with only one of them tokenized.
**Recommendation** Name the tiers: `SCRIM.soft` (0.45, legibility fades), `SCRIM.modal` (0.55, the existing
token), `SCRIM.focus` (0.68, coach marks), all derived from `WHIMSY.ink`. `BarnVisitModal`'s gradient then
reads `[SCRIM.soft, SCRIM.softFade, "transparent"]` and `Spotlight` stops carrying a naked `0.68`.
**Pillar** Craft / governance.

---

### [P3] A-25 · No opacity or border-width tokens, and the area proves it

**Location** area-wide (36 files)
**Evidence** 14 distinct raw opacity values — `0.7`×9, `0.5`×3, `0.45`×3, `0.92`×2, `0.85`×2, `0.8`, `0.72`,
`0.6`, `0.55`, `0.4`, `0.18`, `0.14`, `.76` — and `borderWidth: 2` (56) vs `1.5` (24) with no rule for which.
**Gap** Matches the app-wide baseline exactly (0.7 dominant, no token). In this area `0.7` means *pressed* in
five places and *disabled* in three, so one value carries two meanings (see A-15).
**Recommendation** `OPACITY = { pressed: 0.85, disabled: 0.5, ghost: 0.7, wash: 0.45 }` and
`BORDER = { sticker: 2, hairline: 1.5 }` with a documented rule — 2 for anything pressable or content-holding,
1.5 for inner wells and dividers. Cheap, and it converts a judgement call into a lookup.
**Pillar** Craft / governance.

---

### [P3] A-26 · Tab-clearance and offset literals bypass `TAB_SAFE`

**Location** `app/barn-collection.tsx:742` (`paddingBottom: 80`), `components/BarnVisitModal.tsx:960`
(`marginTop: 120`), `:1655` (`paddingTop: 56`), `:1765` (`paddingBottom: 34`),
`components/PurchaseToast.tsx:147` (`top: 56`), `components/Barn.tsx:1272` (`bottom: 160`), `:1285` (`bottom: 40`)
**Evidence** No file in the area imports `TAB_SAFE` or `useBottomTabBarHeight`.
**Expected standard** `constants/theme.ts:202` — *"The single scroll `paddingBottom` for tab-bar clearance …
Replaces the per-screen 80/100/110/120 values."*
**Gap** `barn-collection`'s `80` is precisely one of the values `TAB_SAFE` was introduced to replace. The `56`s
are status-bar offsets on overlays with no `SafeAreaView` — `BarnVisitModal:1654` documents why, which is the
right call, but `PurchaseToast:147` repeats the literal with no comment.
**Recommendation** `TAB_SAFE` in `barn-collection`. For the overlay offsets add a `STATUS_SAFE` token, or route
through `useSafeAreaInsets` (which `barn-interior:300, 341` already does correctly), so the two 56s are one
decision instead of two guesses.
**Pillar** Craft / governance.

---

### [P3] A-27 · Sanctioned raw values, one documented and one not

**Location** documented: `components/ui/BarnOverlay.tsx:85-93`; undocumented: `components/ui/Spotlight.tsx:343, 352`
and `components/ui/TickleIcon.tsx:10-25`
**Evidence** `BarnOverlay` carries an explicit carve-out comment (*"Sanctioned scene-wash exception … they
don't map to a palette token, so they stay as raw rgba on purpose (not token leak)"*). `Spotlight`'s
`fill="#fff"` / `fill="#000"` are SVG **mask channels** — not colors at all — and `TickleIcon`'s five hexes are
gradient stops and pupils; neither carries such a note, so every future hex audit re-flags them.
**Recommendation** Copy `BarnOverlay`'s comment style onto both. Rule: **a raw literal that survives an audit
carries the comment explaining why** — that is what makes the next grep cheap.
**Pillar** Craft / governance.

---

## 4. Heuristic scorecard (P1, 0–4)

### `components/Barn.tsx` — the Barn tab

| # | Heuristic | Score | Note |
| --- | --- | --- | --- |
| 1 | Visibility of system status | 2 | Tickets + ribbon excellent; active curses / Sounder hidden in a collapsed tray (A-16) |
| 2 | Match to the real world | 4 | Paper tickets, tape, barn silhouette, hearts — exemplary |
| 3 | User control and freedom | 3 | Toast dismisses by timer only; a tickle needs no undo |
| 4 | Consistency and standards | 2 | Emoji + `Glyph` for the same flame (A-01); local toast duplicates `PurchaseToast` |
| 5 | Error prevention | 4 | `ticklesAvailableRef` synchronous admission gate; over-cap "banked" copy |
| 6 | Recognition over recall | 3 | The ribbon anchors the lucky window to the stat it modifies — good |
| 7 | Flexibility / efficiency | 3 | Tap-the-ticket regen breakdown is a nice power path, but undiscoverable |
| 8 | Aesthetic and minimal design | 4 | Deliberately restrained; the removed placard/sign comments show real editing |
| 9 | Error recovery | 4 | `barnRecovery` chip for a failed boot fetch is a genuinely thoughtful state |
| 10 | Help and documentation | 2 | No "how tickling works" entry from Home |
| — | **Accessibility (added)** | **1** | 4 pressables / 2 labels; 18 `Animated` / 0 motion policy (A-07) |

### `components/BarnVisitModal.tsx` — visit a friend

| # | Heuristic | Score | Note |
| --- | --- | --- | --- |
| 1 | Visibility of system status | 4 | Visits-left chip, energy, nap reason, dig note — every state is explained |
| 2 | Match to the real world | 4 | Diorama depth, nametags, ground shadow, "knocking on the barn door" |
| 3 | User control and freedom | 2 | Nap / stamp / parting cards have no backdrop or back dismiss (A-08) |
| 4 | Consistency and standards | 2 | Three hand-rolled dialogs; `COLORS.successText`; `slopBand` misuse (A-13, A-20) |
| 5 | Error prevention | 4 | The `sessionIsCurrent` token guard on every async path is excellent |
| 6 | Recognition over recall | 3 | "Sign the guestbook" appears contextually; "Inside/Outside" is a bare ghost `Button` |
| 7 | Flexibility / efficiency | 3 | Tap either pig, no button — the right call, documented at the top of the file |
| 8 | Aesthetic and minimal design | 3 | Strong, but the title fights the host's background (A-18) |
| 9 | Error recovery | 4 | Dig cooldown / already-dug / transient each get distinct warm copy |
| 10 | Help and documentation | 3 | "How visiting works" exists; unreachable from the nap screen |
| — | **Accessibility (added)** | **3** | 10 pressables / 8 labels; `useMotionPolicy` present at `:391` |

### `app/barn-collection.tsx` — the Barn collection

| # | Heuristic | Score | Note |
| --- | --- | --- | --- |
| 1 | Visibility of system status | 4 | Snouts available, Wallow progress, per-collection reward thresholds, offline |
| 2 | Match to the real world | 1 | Nothing here is Tickle the Pig (A-02) |
| 3 | User control and freedom | 4 | Preview-in-room before buying, wishlist, explicit "placement and saving are separate" |
| 4 | Consistency and standards | 1 | One primitive in 805 lines; no `Sticker`, `Button`, `Glyph`, `EmptyState` |
| 5 | Error prevention | 4 | Purchase confirmation modal, `purchaseBusy` ref, pending-change retry |
| 6 | Recognition over recall | 3 | Filters are good; 4 ownership + N collection chips is past Hick's comfortable range |
| 7 | Flexibility / efficiency | 4 | Search + two filter axes + "View N designs" collapse |
| 8 | Aesthetic and minimal design | 1 | Flat borderless cards, sun rectangles, grey disabled slabs |
| 9 | Error recovery | 4 | Two distinct retry affordances, with hints about not double-charging |
| 10 | Help and documentation | 3 | `itemEarnCopy` explains unearned items inline |
| — | **Accessibility (added)** | **4** | 10 pressables / 14 labels, `accessibilityState` throughout — best in the area |

The split is the story: `barn-collection` scores 4/4/4/4 on the engineering heuristics and 1/1/1 on the craft
heuristics; `Barn.tsx` is the exact inverse.

---

## 5. Token triage (P4)

| File | hex | `rgba(` | bare `fontSize` | bare `borderRadius` | bare pad/margin/gap | `COLORS.*` | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `app/(tabs)/index.tsx` | 0 | 0 | 0 | 0 | 0 | 0 | clean |
| `components/Barn.tsx` | 3 | 5 | 14 | 8 | 17 | 1 | all 3 hex + all 5 rgba are **dead code** (A-21); `ticketValue`'s 30/17 pairing is documented as intentional; `COLORS.barn` → A-13 |
| `components/BarnUpdatesTray.tsx` | 0 | 0 | 0 | 0 | 2 | 0 | clean (both are `0` resets) |
| `components/BarnActiveEffectsStrip.tsx` | 0 | 0 | 4 | 1 | 3 | 0 | `13` → `cardTitleSm`-ish, three `11`s → `labelLg`/`kicker`; `borderRadius: 8` → `RADII.sm` |
| `components/BarnBountyChip.tsx` | 0 | 0 | 1 | 0 | 2 | 0 | the `13` is A-22's missing role; `gap: 10` → `SPACE.md` |
| `components/BarnSounderChip.tsx` | 0 | 0 | 2 | 0 | 2 | 0 | `kicker` 11/1.4 override is documented; `line` 13 → A-22 |
| `components/BarnGuestbook.tsx` | 0 | 0 | 4 | 3 | 6 | 0 | two are A-12; `18` → `RADII.xl`; `25`/`22` are circle radii → `RADII.pill` |
| `components/BarnVisitModal.tsx` | 0 | 4 | 9 | 2 | 17 | 1 | rgba: spotlight wash, ground shadow, top fade (A-24), text shadow (A-18); `borderRadius: 150` is a true ellipse |
| `app/barn-interior.tsx` | 0 | 0 | 0 | 4 | 0 | 0 | `10`/`12`×2/`16` → `RADII.sm`/`md`/`xl`; otherwise token-clean |
| `app/barn-collection.tsx` | 0 | 0 | 0 | 6 | 1 | 0 | radii `10,12,12,14,22,22` → `RADII.sm/md/lg/pill`; `paddingBottom: 80` → `TAB_SAFE` (A-26) |
| `app/barn-housing-preview.tsx` | 0 | 0 | 0 | 0 | 0 | 0 | clean (dev redirect) |
| `app/barn-visit-preview.tsx` | 0 | 0 | 0 | 0 | 0 | 0 | clean (dev redirect) |
| `components/ActiveEffects.tsx` | 0 | 0 | 7 | 1 | 11 | 0 | `15` → `cardTitleSm`; four `11`s → `kickerPill`/`labelLg`; `borderRadius: 9` is a near-dupe of `RADII.sm` |
| `components/HoofprintsSheet.tsx` | 0 | 0 | 0 | 0 | 5 | 0 | `padding: 18` → `PAGE_PAD`; `gap: 8` → `SPACE.sm`; `radius={12}` prop → `RADII.md` |
| `components/CleanseModal.tsx` | **1** | 0 | 6 | 2 | 13 | 0 | `#D5E4C9` → A-11; every size has a role; `padding: 28`/`22`/`26` off-scale |
| `components/RitualPicker.tsx` | **1** | 0 | 9 | 2 | 13 | 0 | `#D5E4C9` → A-11; `fontSize: 11.5` (`:281`) is the only fractional size in the area |
| `components/WhileAwayModal.tsx` | 0 | 0 | 5 | 5 | 11 | 0 | radii `12,20,20,20,16`; the three `20`s are circle wells → `RADII.pill` |
| `components/PurchaseToast.tsx` | 0 | 0 | 4 | 2 | 5 | **1** | `COLORS.successText` → A-13; `18/15/13/15` all map to roles |
| `components/ui/BarnOverlay.tsx` | 0 | 4 | 0 | 1 | 0 | 0 | **sanctioned** — documented carve-out at `:85` |
| `components/ui/PigStage.tsx` | 0 | 0 | 0 | 0 | 0 | 0 | clean — and the area's best motion-policy adoption (7 refs) |
| `components/ui/TickleIcon.tsx` | 6 | 0 | 0 | 0 | 0 | 0 | **sanctioned art** (gradient stops + pupils); add the comment (A-27) |
| `components/ui/Spotlight.tsx` | 2 | 0 | 0 | 0 | 0 | 0 | **sanctioned** — SVG mask channels, not colors; needs the comment (A-27) |
| `habitat/HabitatDoorTransition.tsx` | 0 | 0 | 0 | 0 | 0 | 0 | clean |
| `habitat/HabitatEditor.tsx` | 0 | 2 | 0 | 4 | 0 | 0 | `rgba(255,250,240,0.92/0.94)` = `WHIMSY.paper` at alpha → `OPACITY` + token; radii `22,22,22,10` |
| `habitat/HabitatEntry.tsx` | 0 | 0 | 0 | 0 | 2 | 0 | clean (`0` resets) |
| `habitat/HabitatExpansionDiscovery.tsx` | 0 | 0 | 0 | 0 | 0 | 0 | clean |
| `habitat/HabitatFriendRoom.tsx` | 0 | 0 | 0 | 0 | 0 | 0 | clean |
| `habitat/HabitatGiftReveal.tsx` | 0 | 0 | 0 | 0 | 0 | 0 | clean |
| `habitat/HabitatInspectionSheet.tsx` | 0 | 0 | 0 | 0 | 0 | 0 | clean |
| `habitat/HabitatItemPreviewModal.tsx` | 0 | 0 | 0 | 0 | 0 | 0 | clean — best-composed file in the Habitat cluster |
| `habitat/HabitatOwnerPig.tsx` | 0 | 0 | 0 | 0 | 0 | 0 | clean |
| `habitat/HabitatPresetSheet.tsx` | 0 | 0 | 0 | 2 | 0 | 0 | `14` → `RADII.lg`, `10` → `RADII.sm` |
| `habitat/HabitatScene.tsx` | 0 | 3 | 0 | 2 | 1 | 0 | `rgba(255,250,240,0.14)` edit wash; `22` → `RADII.pill`, `14` → `RADII.lg` |
| `habitat/HabitatSlotList.tsx` | 0 | 0 | 0 | 4 | 1 | 0 | `12,10,10,12` → `RADII.md`/`sm` |
| `habitat/HabitatStarterWelcome.tsx` | 0 | 0 | 0 | 2 | 0 | 0 | both `14` → `RADII.lg` |
| `habitat/HabitatWorkshopCabinet.tsx` | 0 | 0 | 1 | 2 | 1 | 0 | `fontSize: 15` inside a `TYPE.label` spread (the A-12 pattern) |
| **Area total** | **13** | **18** | **56** | **45** | **90** | **3** | 8 of 13 hex are sanctioned art/mask; 5 of the rest are dead code |

Cross-cutting clusters, named as *missing* tokens rather than violations:
`fontSize` — `11` ×9 (mostly `kickerPill`/`kickerPillSm`), `13` ×6 (→ **new `TYPE.labelLg`**, A-22), `12` ×11
(→ `label`/`bodySm`), `15` ×6 (→ `cardTitleSm`, which already exists).
`borderRadius` — `22` ×5 (→ `RADII.xxl` or `pill` for capsules), `10` ×7 (→ `RADII.sm`; a near-duplicate of 8
that deserves a ruling rather than a new token), `14` ×8 (→ `RADII.lg`).
Spacing — `10` ×19 and `1` ×15 dominate; `10` sits between `SPACE.sm`(8) and `SPACE.md`(12) and should resolve
to one of them, not become a token.

---

## 6. What's working — keep and replicate

1. **`PaperTicket`** (`Barn.tsx:200-316`) is the area's best composition: `Tape` + `Sticker` + `Glyph` + hand
   tilt + an anchored `ticketRibbon` hanging off the bottom edge. The comment at `:1215` explaining why
   `ticketValue`'s 30/17 pairing stays explicit is exactly the governance behaviour the standard wants — a
   documented exception, not a silent bypass.
2. **`BarnUpdatesTray`** (`:117-140`) is the reference implementation for an interactive sticker: 2px ink
   outline, `SHADOW_SM`, `-0.4°` tilt, and a **pressed state that translates by exactly the shadow offset while
   zeroing the shadow** (`togglePressed:131`). That is the pressed token the area needs (A-15). It also gates
   `LayoutAnimation` on `reduceMotion` (`:49`).
3. **`BarnOverlay`'s documented carve-out** (`:85-93`) — three raw rgba washes with a comment stating they are
   scene tints, not palette hues, and therefore deliberately untokenized. The model for A-27. Its
   `pointerEvents="none"` + `zIndex: 1` layering also avoids the build-99 dead-touch footgun.
4. **`HoofprintsSheet`** (`:60-137`) composes four shared primitives (`SlideUpSheet`, `Sticker`,
   `SectionHeader`, `EmptyState`) into one warm surface. Its empty state — *"Nothing on your snout right now."*
   — is warm-not-shame per P10(c).
5. **`BarnSounderChip`'s bark panel** (`:192-225`) uses the sanctioned dark-surface trio
   (`bark`/`barkText`/`sun` kicker) correctly and comments *why* the kicker's size and tracking stay
   overridden. 9.85:1 and 12.3:1 contrast. The "one sanctioned dark surface" rule working as designed.
6. **The Habitat cluster's accessibility** is the best in the codebase — `barn-collection` and `HabitatEditor`
   carry `accessibilityLabel` + `accessibilityHint` + `accessibilityState` on every destructive control, with
   hints that explain consequences in plain language (*"Shows a temporary preview. Your saved room stays the
   same."*, *"Opens purchase confirmation. Placement and saving are separate."*). Lift this verbatim onto the
   Barn cluster (A-05).
7. **Shadow governance holds everywhere.** Zero soft shadows across 36 files; only `STICKER_SHADOW` (via
   `Sticker`) and `SHADOW_SM` appear. The "no new shadow tiers" rule has not eroded once.
8. **`BarnVisitModal`'s session-token discipline** (`:209-212`, applied on every async path) plus its warm
   failure copy (`dig_cooldown` → *"You've dug here recently — come back in 2h"*, never *"Error"*) implements
   P10(c)'s warm-loss rule at the data layer, not just the copy layer.
9. **`app/barn-housing-preview.tsx` / `barn-visit-preview.tsx`** guard dev screens behind `__DEV__` with a
   `require` so the assets never ship — the right pattern, documented in the file.

---

## 7. System asks

The tokens, primitives, variants and rules this area must be able to rebuild itself from.

**New tokens**

1. `WHIMSY.curseSurface` (`#D5E4C9`) — and for symmetry `WHIMSY.blessSurface`. The pale companions to the
   existing `bless`/`curseGreen` countdown hues. Retires A-11's two literals and the ternary asymmetry.
2. `WHIMSY.barnRed` — promote `COLORS.barn` so `Barn.tsx` can drop the legacy palette import entirely (A-13).
3. `TYPE.labelLg` — `{ fontFamily: FONTS.bodyExtra, fontSize: 13, lineHeight: 17 }`. The "chip line" role,
   duplicated verbatim in `BarnBountyChip` and `BarnSounderChip` today (A-22).
4. `OPACITY = { pressed, disabled, ghost, wash }` — 14 distinct raw values in this area, with `0.7` carrying
   two different meanings (A-25).
5. `BORDER = { sticker: 2, hairline: 1.5 }` plus a rule for which (A-25). 80 border declarations, no token.
6. `SCRIM = { soft, modal, focus }` derived from `WHIMSY.ink` — three dims exist, one is tokenized (A-24).
7. `STATUS_SAFE` — the counterpart to `TAB_SAFE` for overlays that have no `SafeAreaView` (A-26).

**New / extended primitives**

8. `EffectCard` with `size: "chip" | "row" | "detail"` in `components/ui/` — one drawing for the
   blessing/curse concept that three components currently draw three ways (A-10).
9. `Icon` name additions: `more`, `undo`, `save`, `chevronLeft`, `furnishings`, `alert` — the six names that
   let the Habitat cluster drop its raw `@expo/vector-icons` imports (A-04).
10. A **pressed** treatment on `Button` / `IconButton` / `Sticker` that translates by the shadow offset and
    zeroes the shadow, matching `BarnUpdatesTray.togglePressed` — so pressed stops being spelled `opacity: 0.7`.

**Rule changes to existing primitives**

11. **`Button`'s default disabled state becomes the `locked` treatment.** Delete the `variant !== "locked"`
    opacity carve-out at `ui/Button.tsx:141`. The 2026-07-07 ruling says a disabled control keeps its outline;
    today exactly one variant honours it and five hand-rolled controls in this area copy the old crush (A-15).
12. **`Spotlight`'s `onDismiss` becomes required**, and the component gains `accessibilityViewIsModal` plus a
    caption announcement (A-09).
13. **`AdaptiveModalScaffold` + `DialogCloseRow` become the only way to put a card over a dim.** No new
    `*Scrim` / `*Card` style pairs. Deletes ~120 lines from `BarnVisitModal` alone (A-08).

**Rules for the taste standard's decision log**

14. **Spend / send / irreversible controls carry the full a11y quartet** — `Role`, `Label` naming the cost or
    target, `Hint` naming the consequence, `State.disabled` (A-05).
15. **A file that imports `Animated` imports `useMotionPolicy`** (A-07). Lintable as an import pairing.
16. **Text never sits directly on a player-supplied image** — it sits on a token surface (A-18).
17. **Identity tokens (`slopGold`, `slopBand`, `angel`, `goblin`) appear only where that identity is the
    message** (A-20).
18. **No local aliases for theme tokens** (A-23).
19. **A raw literal that survives an audit carries the comment explaining why** — `BarnOverlay:85` is the
    model (A-27).
20. **Lint gate for the three automatic failures**: an emoji codepoint in a `.tsx` render, an
    `@expo/vector-icons` import outside `components/ui/Icon.tsx`, and `Alert.alert` anywhere in `app/` or
    `components/` (A-01, A-04, A-17). All three currently have 2–3 offenders app-wide, which makes this the
    cheapest possible moment to close the door.

---

## Conformance pass — 2026-09-11 (wave 3, section A)

**Result: 556 → 0 `ttp/*` warnings across 27 files; lint flipped to error for the area in `.eslintrc.js`.**
Five parallel passes (Barn core · visit flow · effects + rituals · Habitat interior · Habitat sheets), each against
`03-section-pass-brief.md`. No `eslint-disable` was added anywhere; every surviving literal is a named, commented
drawing constant. Full suite 205/205 green.

**Findings closed:** A-02, A-03 (the Habitat cluster is rebuilt on `Sticker`/`Button`/`Sheet`/`ListRow`/`Chip`/`Tag`/
`TextField`/`LoadingBeat`/`EmptyState` with its VoiceOver labelling kept verbatim — the specificity FAIL is gone),
A-05, A-07, A-08, A-10 (one `EffectCard` drawing on the strip, the effects list and the Hoofprints sheet), A-11, A-12,
A-13, A-14, A-15, A-18, A-19, A-20, A-21, A-22, A-23, A-24, A-26.

**Primitive growth the section forced (landed in `components/ui` / `theme.ts`):** `DialogButtonRow.confirmHint/
cancelHint`; `Sheet.kicker`, `Sheet.keyboardAware`, `Sheet`/`SlideUpSheet` `presentation="inline"`;
`EffectCard.icon` as image + `blurb`; `toEffectCardEffect` beside `effectMeta`; `BodyLg`; `EmptyState` forwards
`accessibilityRole` (error → alert); `ListRow.fill`/`disabled`/selected state; `Sticker.hitSlop` + `accessibilityValue`/
`State`; `Button`/`IconButton` `accessibilityValue`; `SegmentedControl` per-option `accessibilityLabel/Hint`; tokens
`STATUS_SAFE`, `ART_SIZE`, `TINT.paperVeil/sunVeil`.

**Deliberate calls to keep in mind:** the Barn tickle counter stays Caprasimo (`TYPE.hero` remains reserved until a
ceremony numeral wants it); the effects strip's chip drops the inline blurb/sender dot (both survive in the spoken
label); the per-curse Cleanse pills consolidated to one control per surface (`cleanse_curses` is one charge).
