# Barn Visit plan audit

Date: 2026-09-12
Baseline: the uncommitted working tree before the Dynamic Type implementation fix
Plan: `docs/design/2026-09-12-barn-visit-simplify-plan.md`, §§2–5

This is a source audit, not a visual or pixel test. Jest has no Yoga layout engine,
so native verification at default and accessibility-medium text remains required.
The three-band/full-screen-room restructure predates this task; its author and
founder approval are unknown. The recommendation below is based on the plan's
Connect goal and the project's craft rules, not on inferred provenance.

## Deviations and implementation additions

| Kind | Plan requirement | Current implementation | Judgment | Reason |
| --- | --- | --- | --- | --- |
| Direct · §2 layout, §5 stage | The active Outside or Inside scene occupies the middle `flex: 1` stage between header and action bar ([plan lines 19–35, 89](../design/2026-09-12-barn-visit-simplify-plan.md#2-revised-layout-top--bottom-390pt)). | The exterior diorama still occupies that stage ([`BarnVisitModal.tsx` lines 1074–1183](../../components/BarnVisitModal.tsx)), but the Inside `HabitatScene` renders full-screen and receives the entire visit UI through `overlay` ([`BarnVisitModal.tsx` lines 1549–1609](../../components/BarnVisitModal.tsx); [`HabitatFriendRoom.tsx` lines 139–170](../../components/habitat/HabitatFriendRoom.tsx)). | **(a) Keep** | Giving the decorated room the full viewport better serves the plan's stated aim that the screen be the friend's barn; the generic overlay also keeps the inspection sheet above visit controls. |
| Implicit · §2 diagram | The diagram visually bounds scenery below the header and above the bottom bar. | The exterior background image paints edge-to-edge behind all three bands, while the pigs and shovel remain correctly bounded by the stage ([`BarnVisitModal.tsx` lines 1616–1631](../../components/BarnVisitModal.tsx)). | **(a) Keep** | Continuous host scenery is more immersive and does not change the planned interaction layout. |
| Implementation addition · §4 component list | `HabitatFriendRoom` is named as the active room scene; no overlay API is listed. | `HabitatFriendRoom` adds `overlay?: ReactNode` and renders it above loading/room content but below `HabitatInspectionSheet` ([lines 28–50, 129–199](../../components/habitat/HabitatFriendRoom.tsx)). | **(a) Keep** | The slot is generic composition plumbing and establishes the correct z-order without teaching the inspection sheet about visit controls. |
| Implicit · §2 layout | No contrast veil is specified. | A token-derived 190pt top gradient sits above host scenery and below controls ([`BarnVisitModal.tsx` lines 1023–1031, 1800](../../components/BarnVisitModal.tsx)). | **(a) Keep** | Arbitrary equipped backgrounds need a stable legibility field for floating chrome. |
| Direct · §5 header | The bark plaque uses `RADII.md` ([plan line 86](../design/2026-09-12-barn-visit-simplify-plan.md#5-spacing-and-typography-rules)). | `VisitHeader` uses `RADII.lg` ([lines 39–43](../../components/visit/VisitHeader.tsx)). | **(b) Revert** | This is an exact token mismatch with no documented functional need and makes the compact plaque slightly softer/larger than specified. |
| Illustrative · §2 wireframe | The wireframe depicts `Leave ✕` ([plan line 23](../design/2026-09-12-barn-visit-simplify-plan.md#2-revised-layout-top--bottom-390pt)). | The supported `Button.icon` slot renders the primitive icon before the label: `× Leave` ([`VisitHeader.tsx` lines 62–72](../../components/visit/VisitHeader.tsx)). | **(a) Keep** | The prose requires the primitive x icon, not a trailing-icon API; the implementation satisfies that direct requirement. |
| Direct · §§2, 4, 5 status geometry | Heart Tags use 24pt avatars, sit at about 28pt, and produce an approximately 136pt header ([plan lines 24–25, 71, 87–88](../design/2026-09-12-barn-visit-simplify-plan.md#2-revised-layout-top--bottom-390pt)). | Both avatars use `AVATAR_SIZE[0]`, currently 32pt, and produce a measured 35pt Tag (32pt avatar plus two 1.5pt borders) ([`BarnVisitModal.tsx` lines 1050–1066](../../components/BarnVisitModal.tsx); [`VisitStatusRow.tsx` lines 27–29, 147–149](../../components/visit/VisitStatusRow.tsx)); the header is about 143pt (56 + 44 + 8 + 35), not the 140pt claimed by its comments. | **(a) Keep** | 32 is the smallest sanctioned `AVATAR_SIZE` token and remains recognizable; an exact 24pt avatar would first need a semantic theme token. |
| Direct · §§2, 4 toggle | The floating control is 32pt / `size="sm"` ([plan lines 27, 72](../design/2026-09-12-barn-visit-simplify-plan.md#2-revised-layout-top--bottom-390pt)). | `SegmentedControl` has no `size` prop and each segment has `minHeight: TAP_MIN` plus track padding; the caller sets only an absolute minimum width ([`BarnVisitModal.tsx` lines 1188–1216](../../components/BarnVisitModal.tsx); [`SegmentedControl.tsx` lines 139–172](../../components/ui/SegmentedControl.tsx)). | **(a) Keep** | A 44pt minimum meets the ratified touch-target rule; the plan's 32pt control/API is stale. |
| Direct · §5 typography | Only the single-line plaque title explicitly has `maxFontSizeMultiplier={1.3}`; other roles normally scale to 200%, and status Tags wrap at large text ([plan lines 86–87](../design/2026-09-12-barn-visit-simplify-plan.md#5-spacing-and-typography-rules); design-system spec §§1.2 and 5). | The shared 1.3 cap is also passed to the Leave label, every status label/float, the toggle labels, and bottom action ([`VisitHeader.tsx` line 67](../../components/visit/VisitHeader.tsx); [`VisitStatusRow.tsx` lines 67–76, 101–117](../../components/visit/VisitStatusRow.tsx); [`BarnVisitModal.tsx` lines 1188–1216](../../components/BarnVisitModal.tsx); [`VisitActionBar.tsx` lines 98–117](../../components/visit/VisitActionBar.tsx)). | **(b) Revert outside the title** | Controls and status must render whole through correct remeasurement, wrapping, or growth; the audited plan authorizes truncation/capping only for the plaque title. |
| Direct · §5 status type | Status-row numbers use `TYPE.label`, never a title role ([plan line 87](../design/2026-09-12-barn-visit-simplify-plan.md#5-spacing-and-typography-rules)). | The heart totals use the Tag's label role, but the rising `+1` uses `cardTitleSm` ([`VisitStatusRow.tsx` lines 101–108](../../components/visit/VisitStatusRow.tsx)). | **(b) Revert** | A transient increment should not be typographically louder than the compact status capsule it belongs to. |
| Direct · §5 card titles | Dialog titles use `TYPE.cardTitle` ([plan line 91](../design/2026-09-12-barn-visit-simplify-plan.md#5-spacing-and-typography-rules)). | Nap uses `pageTitle`; guestbook, kindness, and parting use `sectionTitle` ([`BarnVisitModal.tsx` lines 1259–1261, 1317–1321, 1364–1366, 1473–1475](../../components/BarnVisitModal.tsx)). | **(b) Revert** | The larger roles restore hierarchy noise that this simplification explicitly removes. |
| Direct · §5 card bodies | Dialog bodies use `TYPE.hand` (14/20) ([plan line 91](../design/2026-09-12-barn-visit-simplify-plan.md#5-spacing-and-typography-rules)). | Nap, guestbook, and the parting success line use `body` (15/21) ([`BarnVisitModal.tsx` lines 1264–1271, 1367–1376, 1479–1487](../../components/BarnVisitModal.tsx)). | **(b) Revert** | The implementation loses the specified hand voice and exact type role. |
| Implementation addition · §§4–5 dialogs | Existing scaffolds remain and each flow keeps the listed CTA/link structure ([plan lines 76–77, 91](../design/2026-09-12-barn-visit-simplify-plan.md#4-component-changes)). | Nap, guestbook, and parting cards also use a 44pt `DialogCloseRow` x control ([`BarnVisitModal.tsx` lines 1253–1257, 1306–1310, 1457–1460](../../components/BarnVisitModal.tsx)). | **(a) Keep** | The persistent visible escape follows the current dialog primitive standard and remains available when a sent-state link disappears. |
| Implicit · §3 parting copy | The parting card table specifies the pre-send title, removes its static body, and retains the perk band ([plan line 65](../design/2026-09-12-barn-visit-simplify-plan.md#3-exact-copy-changes)). | After sending, the existing confirmation title and the chosen emote's dynamic send line remain ([`BarnVisitModal.tsx` lines 1473–1487](../../components/BarnVisitModal.tsx)). | **(a) Keep** | The plan does not replace the post-send state; immediate outcome feedback is useful and does not restore the removed static body. |
| Implementation addition · §4 `VisitStatusRow` | The listed props are heart counts, visit counts, and two avatars ([plan line 71](../design/2026-09-12-barn-visit-simplify-plan.md#4-component-changes)). | The component also accepts `hostName` and `tickStyle` ([`VisitStatusRow.tsx` lines 31–49](../../components/visit/VisitStatusRow.tsx)). | **(a) Keep** | `hostName` is used only in explicitly permitted screen-reader copy, and `tickStyle` lets the component own the required tally float. |
| Implementation addition · §4 `VisitActionBar` | Visible action selection is a pure function of `{tickled, tired, stampSent}` ([plan line 74](../design/2026-09-12-barn-visit-simplify-plan.md#4-component-changes)). | The pure helper returns label/test ID; the component accepts callbacks and `hidden` for arrival-nap state ([`VisitActionBar.tsx` lines 27–75, 98–107](../../components/visit/VisitActionBar.tsx)). | **(a) Keep** | Handlers cannot derive from booleans alone, and `hidden` enforces the plan's arrival-napping exception without changing the pure state mapping. |
| Implicit · §5 bottom spacing | The bottom bar specifies horizontal page padding and bottom inset plus `SPACE.md` ([plan line 90](../design/2026-09-12-barn-visit-simplify-plan.md#5-spacing-and-typography-rules)). | It additionally uses `paddingTop: SPACE.md` ([`VisitActionBar.tsx` lines 124–131](../../components/visit/VisitActionBar.tsx)). | **(a) Keep** | One token step keeps the floating pill clear of scene content while the reserved slot prevents layout movement. |
| Direct · §§2, 4 behavior documentation | A tired player still sees `Leave a hoofprint` until it is sent; only then can the bottom slot become `Head home` ([plan lines 43, 74](../design/2026-09-12-barn-visit-simplify-plan.md#2-revised-layout-top--bottom-390pt)). | Runtime behavior conforms, but the top comments in both `BarnVisitModal` and `VisitActionBar` say the slot becomes `Head home` simply when tired ([`BarnVisitModal.tsx` lines 15–17](../../components/BarnVisitModal.tsx); [`VisitActionBar.tsx` lines 5–9, 43–53](../../components/visit/VisitActionBar.tsx)). | **(b) Revert comments** | Stale documentation contradicts the pure function and invites a future behavioral regression. |
| Direct · §4 tests | `barnVisitActions.test.ts` positively asserts the new `visits left` vocabulary ([plan line 80](../design/2026-09-12-barn-visit-simplify-plan.md#4-component-changes)). | The test checks only that retired strings are absent and reads `BarnVisitModal`, while the positive wording now lives in `VisitStatusRow` ([`barnVisitActions.test.ts` lines 18–26](../../__tests__/barnVisitActions.test.ts)). | **(b) Revert** | A disappearance of the counter would pass a negative-only test; the new visible contract needs a positive assertion. |
| Direct · §§4–5 test documentation | The shovel moves to bottom-left ([plan lines 30, 89](../design/2026-09-12-barn-visit-simplify-plan.md#2-revised-layout-top--bottom-390pt)). | The implementation is bottom-left, but the relevant test title still says “upper-left” ([`barnVisitActions.test.ts` line 10](../../__tests__/barnVisitActions.test.ts); [`BarnVisitModal.tsx` lines 1885–1907](../../components/BarnVisitModal.tsx)). | **(b) Revert test title** | The stale test name misstates the intended layout even though its assertion passes. |

`NAMETAG_MAX_W` is not a deviation. It remains used by the retained visitor-only
“you” nametag (`BarnVisitModal.tsx` lines 141, 1780, 1883), so §4's instruction to
delete it “if unused” does not apply.

## Exact-copy and structural confirmations

The §3 copy pass is otherwise complete:

| Copy contract | Confirmation |
| --- | --- |
| Title kicker removed; `{name}'s Barn` is the only visible host name | `VisitHeader.tsx` lines 45–54; host pigs use `tag={null}` in `BarnVisitModal.tsx` lines 1133–1139 and 1593–1600. Host names remain in accessibility labels, which §2 explicitly permits. |
| Visit vocabulary | `VisitStatusRow.tsx` lines 64–76 renders only `{n} of {cap} visits left` or `0 visits left`. |
| Scoreboard labels, pulse emblem, Inside plaque, and host nametag removed | The three compact status Tags and avatar identities replace them; the visitor's `you` tag remains. |
| Outside / Inside | The single flag-gated `SegmentedControl` uses the exact two labels (`BarnVisitModal.tsx` lines 1188–1216), and the inactive exterior diorama is unmounted. |
| Tired message | `BarnVisitModal.tsx` lines 637–650 emits exactly “All tickled out — head home when you're ready.” once as a Toast; no tired bubble remains. |
| Guestbook action and card | Bottom action says “Leave a hoofprint”; card title, body, sent title/body, and “Not this time” match §3 (`BarnVisitModal.tsx` lines 1306–1376). |
| Kindness card | “Tuck in today's {blessing}?”, `Add {blessing}`, “Hoofprint's enough”, and “Left with the hoofprint.” match §3; the old body is absent (`BarnVisitModal.tsx` lines 1311–1360). |
| Arrival nap card | “This barn is napping”, “Wakes in {until}. You have {n} of {cap} visits left.”, and “Head home” match §3; old kicker, variants, and stats are gone (`BarnVisitModal.tsx` lines 1230–1283). |
| VIP parting | The Slop Club band remains; “Leave a goodbye?” and “Just head home” match §3; the old static body is absent (`BarnVisitModal.tsx` lines 1439–1542). |
| Room unavailable | The exact Toast “Their room isn't open right now.” is used (`BarnVisitModal.tsx` lines 1569–1574). |

The remaining §§2–5 requirements also conform: `VisitHeader`, `VisitStatusRow`,
and `VisitActionBar` exist and use shared primitives; header Leave exits directly
except for the existing VIP parting perk; the nap card is arrival-only; the shovel
is Outside-only at `PAGE_PAD` / `SPACE.lg`; the toggle is absolutely centered at
`SPACE.md` with no full-screen touch-catching wrapper; the bottom slot reserves
`TAP_MIN` and fades with `useMotionPolicy`; and the required housing, guestbook,
and motion-policy test changes are present.

## Competing later guidance

The audited plan and runtime action helper put the hoofprint ahead of the tired
exit until the hoofprint is sent. A newer entry in `docs/design/taste-standard.md`
lines 252–269 says the opposite: “Tired outranks the errand.” That entry also
authorizes a 1.3 cap across all visit chrome and prescribes `anchor="bottom"` plus
transparent door ground for a short-stage room. Those statements conflict with
the audited plan, the 200% Dynamic Type rule, and the current full-screen-room
structure. They appear to come from the overlapping session work and should be
reconciled explicitly rather than treated as silent authority over this audit.
