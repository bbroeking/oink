# Mud Wars UI — integration map (progress surfaces + Hungerer staging)

How the export-only progress components mount into `app/mud-war.tsx`, what
feeds them today, and which props wait on future server reads. Companion to
`docs/wiki/outputs/memos/mudwar-progress-views-2026-07.md` (the design memo)
and the Truffle Patch build (which owns `app/mud-war.tsx` — this file is the
hand-off so the two builds don't collide).

## Already mounted

| Surface | Where | Gate |
|---|---|---|
| `GreatHungerMeter` (season boss vignette) | `app/(tabs)/season.tsx`, top of the scroll after `BountyBoard` | `useFeatureFlag("world_boss")` — visible in `__DEV__` for preview (same escape hatch as the intro chip). Server flag row is seeded by `20260704200000_hunger_meter.sql` (HELD — apply on explicit go). |

## Export-only — the parent mounts these in ActiveWar

Target order inside the `ScrollView` (per the progress-views memo §2):

```
siege chapter (+ HungerStageChip beside it)
countdown
rope
per-capita row
WarLedgerStrip            ← new
drain line (one Text)     ← new, pure client
CrewEffort                ← replaces the anonymous pips row
RivalSide                 ← new, slim
FrontBoard (unchanged)
feeding strip + Truffle Patch (the other build)
minigame (unchanged)
```

The two-line-per-surface diff for `app/mud-war.tsx`:

```tsx
import { WarLedgerStrip } from "@/components/mudwar/WarLedgerStrip";
import { CrewEffort } from "@/components/mudwar/CrewEffort";
import { RivalSide } from "@/components/mudwar/RivalSide";
import { HungerStageChip } from "@/components/mudwar/HungerStageChip";
import { useHungerMeter } from "@/hooks/useHungerMeter";

// inside ActiveWar():
const hunger = useHungerMeter();

// beside the siege-chapter line (only when the meter RPC is live):
{hunger.available && <HungerStageChip stage={hunger.stage} />}

// under the per-capita row:
<WarLedgerStrip
  totalDays={totalDays}
  currentDay={siegeDay(war.endsAt, totalDays)}
  ropeNorm={war.ropeNorm}
/>
<Text style={styles.drainLine}>
  {`Together you've pried ${war.mine.total + war.them.total} tickles off him this war.`}
</Text>

// replacing the pips row:
<CrewEffort
  members={war.mine.members}
  myUserId={myUserId /* ActiveWar already knows the caller */}
  leaderId={crew?.leader_id ?? null}
  windowDiggers={patch.windowDiggers /* Truffle Patch hook, when it lands */}
  artifact={/* MudFort / stamp card render, when it lands */ undefined}
/>
<RivalSide
  crewName={war.them.crew?.name ?? null}
  perCapita={war.them.perCapita}
  active={war.them.active}
  isBot={war.isBotWar}
/>
```

Suggested `drainLine` style (parent owns its stylesheet):
`{ fontFamily: FONTS.hand, fontSize: 12, color: WHIMSY.accent, textAlign: "center", marginTop: 4 }`

## Props that wait on future server reads

| Prop | Read | Where it must land |
|---|---|---|
| `WarLedgerStrip.dayLedger` | per-day notch history (`mud_war_day_notches` + `dayLedger` on `war_fronts_state`) | **MUST ride the Bog Weather M1 carry of `score_mud_war_days`/`war_fronts_state` (`20260703100001`)** — a separate migration would trip the carry-latest-def footgun. Until then the strip renders neutral settled knots + "Day N of M" (already graceful). |
| `CrewEffort.windowDiggers` | who rooted this feeding — the Truffle Patch build's read | comes back with `open_rooting`/its state read; pass user_ids through. |
| `CrewEffort.artifact` | none (render prop) | mount the kept-artifact render (fort stage / stamp card) when that component lands. |
| opponent-wire trim | `war_side` still ships opponent member names+mud; `RivalSide` deliberately doesn't render them | optional later privacy-hardening carry of `war_side` (latest def `20260647`). Flagged, not built. |

## Data gaps found vs the memo (nothing blocking)

- `constants/mudFights.ts` has no client mirror of the server's `ROUT=12`, so
  the ledger's rout-fray cue keys off `|ropeNorm| ≥ 0.75` (ropeNorm is already
  rout-normalized) and uses distance-agnostic copy ("Close to a rout — the
  rope frays.") instead of the memo's "three notches" phrasing. Add the mirror
  constant whenever `mudFights.ts` is next touched (it's owned by the Patch
  build right now).
- `hunger_meter()` thresholds are placeholders sized for the beta
  (40/100/200/340/520 cumulative mud); retune at flip via a carry of the
  function in `20260704200000` — that file IS the latest def.
- `app_config` stores booleans only, so the stage thresholds live as a
  commented constant array inside `hunger_meter()` rather than as config rows
  (the migration header documents the retune path).

## AwayDigest (surface ⑤)

Not built — it's the memo's own cut-first item and needs the Patch read
widened to the last 3 feeding windows. Revisit after the Patch lands.
