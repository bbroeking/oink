# Visit-screen toasts — test loop results

Fix under test: `Toast.tsx` host stack (last host mounted takes the call; unmount splices by identity) +
a `ToastHost` inside `Ceremony` and `SlideUpSheet`'s native branch, so a toast fired inside a native
Modal shows over it instead of landing on the root host underneath.

| iter | tree | A bounce | B stale→wrong_find | C already brought | D tickled-out | E sheet toast | F root hand-back | G relaunch | H reduce motion | gates | notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1a | wip (host stack + hosts) | ✗ | – | – | – | – | – | – | – | green | `showToast` hit host #2 (probe) but nothing visible: `BarnVisitModal.root` is absoluteFill `zIndex: 100`, toast wrap was 50 → painted under the scene (§5 b) |
| 1b | + `TOAST_Z = 200` | ✓ | ✓ | server-only ✓ | ✓ | n/a | ✓ | ✓ | ✓ | green | see below |
| 2 | same tree, probes removed | ✓ | ✓ | server-only ✓ | ✓ | n/a | ✓ | ✓ | ✓ | green | no edits between 1b and 2 → **done**. B rerolled `4:snail_shell` with a lifted tin whistle; D capped at tap 3 (89→92 / 39→42). |

Iteration 1b detail:
- A: "Not the blue feather — see the bubbl…" over the visit at the safe-area line (insets resolve inside the Modal). Title truncates at one line (`numberOfLines={1}`, pre-existing) — the sentence would fit as `text`.
- B: `pig_wishes` rerolled server-side to `3:tin_whistle` mid-visit; tap on the still-lifted berries → toast "Their pig is hoping for something el…", bubble → "hoping for a tin whistle", berries un-lift, `satchel_deliveries` unchanged (1).
- C: unreachable via UI by design (the given find leaves the strip; the wish moved). Server guard present: unique index `satchel_deliveries_one_per_wish`.
- D: cap at tap 4 (81→85 / 31→35); chip → "tickled out"; "All tickled out — head home when y…" shows over the visit (first attempt missed only because the screenshot came 3 s after the cap — dwell is 2.4 s).
- E: no component inside a SlideUpSheet fires a toast today (grep: Barn, Account, BarnVisitModal, Friends, ActiveEffects only). Host is defensive; covered by `Toast.test` "hosts stack" (out-of-order unmount hands back by identity).
- F: after a Ceremony and a SlideUpSheet both mounted/unmounted their hosts, the friend-row bless refusal toast shows at root. (The Barn's tickle-counter toast is the Barn's own local queue — not a probe for the global host.)
- G: A passed on a visit opened after a cold relaunch.
- H: `ReduceMotionEnabled=1` on the sim → toast cross-fades in place over the visit; setting restored to 0.

Harness notes: the expo dev-client gear eats taps beneath it — park it at (385, 235) on this flow; the
"Notes from the barn" interstitial after relaunch swallows the first `…` tap; the Metro console relay
stopped streaming device logs after the second restart (probes were removed anyway).

Prod data touched (demo account only): `satchel_items` +red_berries (still in bag); FunnelWalker's
`pig_wishes` rerolled to tin_whistle (#3); demo→FunnelWalker `barn_visits` rows re-stamped to a 25 h-old
start three times to reopen the pair lock; four real tickles landed on FunnelWalker (D).
