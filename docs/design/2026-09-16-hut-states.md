# The Trading Hut — sheep states, with sample data (2026-09-16)

Companion to `2026-09-16-trading-hut.md` and the flow canvas
(`claude-design/hut-2026-09-16/`). Eight copy-pastable states. Every JSON
block is the shape `my_satchel()` returns (spec §5 of the finds spec) plus a
`tally` the coin shows; **all values are SAMPLE data**, chosen to be
plausible, never real.

The framing, restated so the states can't drift:

- **The sheep is a state**, not a thing in the world. `stranger.present`
  is derived on the client: `any stack.set_ready` ∧ `stranger.sets_left > 0`.
  It is never stored and never pushed.
- **The hut is scenery.** The default overlay renders on every background
  in every state; only the lantern layer and the hatch change.
- **The slip is the receipt.** Every sale writes exactly one `slip`
  (`trader_sales` row); the section's Dealings list *is* the slip history.
- **Icon cells**: `stranger` draws the bust (hatch, Field Guide, Inbox);
  `hut` draws the place (Field Guide, Dealings header); `slip` draws the
  receipt (slot, Dealings rows). Until the sheet lands, all three are the
  inline SVG placeholders on the canvas.

Field key for the blocks below:

| field | meaning |
|---|---|
| `stacks[]` | bag as stacks: `find_id`, `count`, `set_ready` (`count ≥ 3`) |
| `stranger.met` | the first sale has happened (Field Guide lifted) |
| `stranger.want_find_id` | today's fancy on the slate; `null` when unmet (the slate is never shown before the first meeting) |
| `stranger.sets_sold` / `sets_cap` / `sets_left` | today's count, UTC |
| `stranger.resets_at` | next midnight UTC, only meaningful when `sets_left = 0` |
| `stranger.present` | client-derived; the lantern + bust |
| `last_slip` | the most recent `trader_sales` row, or `null` |
| `tally` | the coin's applied tickles before/after the last sale |

---

## 1 · `unmet_dark` — the hut nobody has noticed

| | |
|---|---|
| **Flow** | before any find becomes a set (the *find* stage) |
| **Yard** | default hut overlay, lantern dark, hatch shuttered; tap → shutters rattle + tag *"Shut. Someone's in there."* |
| **Section** | closed — `/hut` refuses (client never routes; server answers `not_met` if deep-linked) |
| **Sheep** | absent |
| **Slip** | none |
| **Icons** | none on screen; Field Guide shows the `hut` and `stranger` cells as silhouettes |

```json
{
  "stacks": [
    { "find_id": "river_pebble", "count": 2, "set_ready": false },
    { "find_id": "blue_feather", "count": 1, "set_ready": false },
    { "find_id": "old_key",      "count": 1, "set_ready": false }
  ],
  "stranger": { "met": false, "want_find_id": null, "multiplier": 2,
                "sets_sold": 0, "sets_cap": 3, "sets_left": 3, "resets_at": null, "present": false },
  "last_slip": null,
  "tally": { "before": 38, "after": 38 }
}
```

## 2 · `unmet_lit` — the first lantern

| | |
|---|---|
| **Flow** | a dig receipt lands the third pebble (*find → set*) |
| **Yard** | lantern layer on, hatch open with the `stranger` bust; no toast, no arrow |
| **Section** | tap → door-swing → **onboarding card** (the sheep's line + the exact deal), then the counter |
| **Sheep** | present, first appearance |
| **Slip** | none yet; the slot is empty |
| **Icons** | `stranger` in the hatch (placeholder SVG until the sheet lands) |

```json
{
  "stacks": [
    { "find_id": "river_pebble", "count": 3, "set_ready": true },
    { "find_id": "blue_feather", "count": 1, "set_ready": false },
    { "find_id": "old_key",      "count": 1, "set_ready": false }
  ],
  "stranger": { "met": false, "want_find_id": null, "multiplier": 2,
                "sets_sold": 0, "sets_cap": 3, "sets_left": 3, "resets_at": null, "present": true },
  "last_slip": null,
  "tally": { "before": 38, "after": 38 },
  "onboarding_deal": { "find_id": "river_pebble", "qty": 3, "tickles": 5 }
}
```

## 3 · `lit_ready` — the counter, a common set on the chip

| | |
|---|---|
| **Flow** | met before; a set is ready (*set → sale*) |
| **Yard** | lantern on, bust in hatch |
| **Section** | counter open: slate shows today's fancy, the ready stack is lifted with *3 → +5*, partials read *one more* / *two more*; tap → confirm pill *Hand over 3 river pebbles · +5 tickles* |
| **Sheep** | present, `rest` frame; `lean-in` on the confirm pill |
| **Slip** | previous slips in Dealings; slot empty |
| **Icons** | `stranger` (hatch), `slip` (Dealings rows) |

```json
{
  "stacks": [
    { "find_id": "river_pebble", "count": 3, "set_ready": true },
    { "find_id": "wool_tuft",    "count": 2, "set_ready": false },
    { "find_id": "pinecone",     "count": 1, "set_ready": false },
    { "find_id": "marble",       "count": 1, "set_ready": false }
  ],
  "stranger": { "met": true, "want_find_id": "honeycomb", "multiplier": 2,
                "sets_sold": 0, "sets_cap": 3, "sets_left": 3, "resets_at": null, "present": true },
  "last_slip": { "find_id": "pinecone", "qty": 3, "tickles": 5, "was_want": false, "day": "2026-09-15" },
  "tally": { "before": 38, "after": 38 }
}
```

## 4 · `lit_fancy` — the set is today's fancy, ×2

| | |
|---|---|
| **Flow** | same as 3, but the ready stack matches the slate (*set → sale, doubled*) |
| **Yard** | as 3 |
| **Section** | the ready stack's deal chip reads *3 → +24* and wears the slate's `×2` mark; the slate itself is unchanged |
| **Sheep** | present |
| **Slip** | on sale, `was_want: true` and the slip prints *×2* under the amount |
| **Rule** | `was_want` is decided server-side at the tx's UTC day — the client's chip is a preview, the slip is the truth |

```json
{
  "stacks": [
    { "find_id": "honeycomb",    "count": 3, "set_ready": true },
    { "find_id": "river_pebble", "count": 1, "set_ready": false },
    { "find_id": "wool_tuft",    "count": 2, "set_ready": false }
  ],
  "stranger": { "met": true, "want_find_id": "honeycomb", "multiplier": 2,
                "sets_sold": 1, "sets_cap": 3, "sets_left": 2, "resets_at": null, "present": true },
  "last_slip": { "find_id": "river_pebble", "qty": 3, "tickles": 5, "was_want": false, "day": "2026-09-16" },
  "tally": { "before": 43, "after": 43 },
  "deal_preview": { "find_id": "honeycomb", "qty": 3, "tickles": 24, "was_want": true }
}
```

## 5 · `slip_printed` — just after a sale (transient)

| | |
|---|---|
| **Flow** | the *receipt* stage |
| **Yard** | not visible (you're in the section); on return, lantern on only if another set remains |
| **Section** | the `take` beat plays, the slip slides out of the slot with the tally counting up (*38 → 43*), the sold stack is gone, Dealings gains a row at the top |
| **Sheep** | present, `take` → `rest` |
| **Slip** | `last_slip` is this sale; the slip stays in the slot until the section is left |
| **Rule** | the slip is the only receipt — no toast, no Inbox row; `nonce` replay returns this same slip |

```json
{
  "stacks": [
    { "find_id": "wool_tuft", "count": 2, "set_ready": false },
    { "find_id": "pinecone",  "count": 1, "set_ready": false },
    { "find_id": "marble",    "count": 1, "set_ready": false }
  ],
  "stranger": { "met": true, "want_find_id": "honeycomb", "multiplier": 2,
                "sets_sold": 1, "sets_cap": 3, "sets_left": 2, "resets_at": null, "present": false },
  "last_slip": { "find_id": "river_pebble", "qty": 3, "tickles": 5, "was_want": false,
                 "day": "2026-09-16", "line": "Come back with more.", "nonce": "8f2c…-sample" },
  "tally": { "before": 38, "after": 43 }
}
```

## 6 · `known_dark_no_sets` — met, nothing to sell

| | |
|---|---|
| **Flow** | between sets (*find*, again) |
| **Yard** | lantern dark, hatch shuttered — but the hut is now *known* |
| **Section** | opens (met): counter shuttered, line *"Nothing for me today?"*, slate shows the fancy (a target to build toward), stacks all dimmed with *one more* / *two more*, Dealings intact |
| **Sheep** | absent (shutters) |
| **Slip** | history only |
| **Rule** | the section is reachable without the sheep; the sheep is never reachable without a set |

```json
{
  "stacks": [
    { "find_id": "wool_tuft",   "count": 2, "set_ready": false },
    { "find_id": "honeycomb",   "count": 1, "set_ready": false },
    { "find_id": "blue_feather","count": 2, "set_ready": false }
  ],
  "stranger": { "met": true, "want_find_id": "honeycomb", "multiplier": 2,
                "sets_sold": 1, "sets_cap": 3, "sets_left": 2, "resets_at": null, "present": false },
  "last_slip": { "find_id": "river_pebble", "qty": 3, "tickles": 5, "was_want": false, "day": "2026-09-16" },
  "tally": { "before": 38, "after": 43 }
}
```

## 7 · `known_dark_sold_out` — three of three

| | |
|---|---|
| **Flow** | after the day's third *receipt* |
| **Yard** | lantern dark, shuttered, even though a set may still be in the bag |
| **Section** | opens: shutters, line *"That's my lot till midnight."*, top tag *3 of 3 · resets at midnight*, slate blank (*tomorrow · ?*), ready stacks lifted but their deal chips read *tomorrow* |
| **Sheep** | absent until `resets_at` |
| **Slip** | the third slip stays in Dealings; `enough_for_today` if a stale client taps |
| **Rule** | `present` = false because `sets_left = 0`, regardless of `set_ready` |

```json
{
  "stacks": [
    { "find_id": "pinecone",     "count": 3, "set_ready": true },
    { "find_id": "wool_tuft",    "count": 1, "set_ready": false }
  ],
  "stranger": { "met": true, "want_find_id": "honeycomb", "multiplier": 2,
                "sets_sold": 3, "sets_cap": 3, "sets_left": 0,
                "resets_at": "2026-09-17T00:00:00Z", "present": false },
  "last_slip": { "find_id": "honeycomb", "qty": 3, "tickles": 24, "was_want": true, "day": "2026-09-16" },
  "tally": { "before": 48, "after": 72 }
}
```

## 8 · `stale_short_stack` — the client thought it had a set

| | |
|---|---|
| **Flow** | a *swap* on a visit gave one pebble away after the yard last refreshed (*find ↔ swap* crossing the sale) |
| **Yard** | showed lit; on the tap the server answers `short_stack` with the real count |
| **Section** | the sheep's `shake` beat, the stack drops to *×2 — one more*, the lantern goes out if nothing else is ready, line *"That's two, little pig."* |
| **Sheep** | present → absent in one beat |
| **Slip** | none written — nothing moved |
| **Rule** | presence is re-derived from the server's answer, never from the tap; the refusal is a shake, never a toast |

```json
{
  "request":  { "find_id": "river_pebble", "nonce": "3b91…-sample" },
  "response": { "ok": false, "reason": "short_stack", "count": 2, "need": 3 },
  "stacks_after": [
    { "find_id": "river_pebble", "count": 2, "set_ready": false },
    { "find_id": "old_key",      "count": 1, "set_ready": false }
  ],
  "stranger": { "met": true, "want_find_id": "honeycomb", "multiplier": 2,
                "sets_sold": 0, "sets_cap": 3, "sets_left": 3, "resets_at": null, "present": false },
  "last_slip": null,
  "tally": { "before": 43, "after": 43 }
}
```

---

## Presence, in one expression

```ts
// client-derived, never stored — SAMPLE shape
const present =
  satchel.stranger.sets_left > 0 &&
  satchel.stacks.some((s) => s.set_ready);
const canOpenSection = satchel.stranger.met || present;
```

States 2–5 have the sheep; 1, 6, 7 do not; 8 is the one that flips mid-beat.
