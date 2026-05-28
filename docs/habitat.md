# Habitat — Spec

The player's decoratable Interior of the Barn. Reached by tapping the barn structure on the [[Exterior]] view; opens with a door-swing animation; holds 6 typed decor slots plus an interior background. Items come from the existing shop + earned milestones, route to slots by category, and friends visiting can see + tap items but cannot modify.

Companion to ADR-0003 (`docs/adr/0003-habitat.md`), which captures the design rationale.

Related: ADR-0001 + `docs/pig-happiness.md` (Visit screen renders the host's interior too); ADR-0002 + `docs/streak.md` (Garden lives in the Exterior, not the Interior).

---

## Decisions (locked via grill-with-docs)

| # | Decision |
|---|---|
| 1 | **Bifurcate the Barn.** Current "Barn" tab becomes the Exterior; the Interior is a discrete view reached by tapping the barn structure. |
| 2 | **Slot-based placement.** 6 typed slots — no free-drag, no grid-snap. Items route by category. |
| 3 | **Door-swing transition.** ~600ms full-screen swap on enter and exit. Reuses route infrastructure. |
| 4 | **6 slots + 1 interior background.** Categories: `wall_decor`, `ceiling_decor`, `floor_decor` (×2 slots), `floor_centerpiece`, `surface_decor`, `interior_background`. |
| 5 | **Shop + earned sourcing.** Habitat items appear in the daily Shop alongside cosmetics; some unlocked via alignment / bounty / season-pass milestones. Crate-sourced items deferred to item #3. |
| 6 | **Friend visibility — see + tap, no modify.** Visitors enter your Interior, tap items for flavor tooltips, can tickle Rosie. Cannot place / move / remove. |
| 7 | **Empty launch.** No starter pack. Empty slots show hint markers; tapping one CTAs the player into the Shop pre-filtered by category. |
| 8 | **Catalog reuse.** Habitat items live in the existing `hats` catalog with new category values. Equipped state in a new `user_habitat_slots` table. |
| 9 | **Technical name `habitat`.** Player-facing surface = "the Barn" (the building). The feature itself doesn't get a brand name in UI. |

---

## Slot anatomy

| Slot name | Category | Notes |
|---|---|---|
| `wall` | `wall_decor` | Posters, paintings, wreaths, clocks. Anchored to the back wall. |
| `ceiling` | `ceiling_decor` | Chandeliers, mobiles, bunting. Anchored to ceiling-center. |
| `floor_left` | `floor_decor` | Chairs, lamps, plants. Anchored bottom-left. |
| `floor_right` | `floor_decor` | Same category as `floor_left`. Player picks which item goes where. |
| `floor_centerpiece` | `floor_centerpiece` | Rugs, large items. Anchored floor-center, occupies the visual middle. |
| `surface` | `surface_decor` | Small mantel/shelf piece. Anchored to a small flat surface (a shelf or table edge). |

Plus one **environmental** slot:

| Slot name | Category | Notes |
|---|---|---|
| `interior_background` | `interior_background` | Wallpaper + floor combo. Single full-frame image, same as exterior backgrounds today. Picked from collection like the existing `active_background_id`. |

---

## Scene anatomy

The Interior renders, back-to-front:

```
┌──────────────────────────────────────────────────────┐
│ 1. interior_background image (full frame)            │
│ 2. wall slot     (anchored back-wall position)       │
│ 3. ceiling slot  (anchored ceiling-center)           │
│ 4. floor_centerpiece (mid-ground floor)              │
│ 5. floor_left + floor_right (left + right ground)    │
│ 6. Rosie (the pig sprite with full cosmetics)        │
│ 7. surface slot  (foreground or upper-side accent)   │
│ 8. tickle particles, heart floats (top UI layer)     │
└──────────────────────────────────────────────────────┘
```

Anchor coordinates follow the existing HAT_REL pattern: percentages of the visible frame, resolved at render time to absolute positions. One anchor map per scene type; the interior has its own anchor set distinct from the pig-stage hat anchors.

---

## Schema

### New category values (data migration)

```sql
-- No structural change to public.hats — just new valid category strings.
-- Existing CHECK constraint on category may need updating; verify before deploy.
```

### Equipped state

```sql
CREATE TABLE public.user_habitat_slots (
    user_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    slot_name text NOT NULL CHECK (slot_name IN (
        'wall', 'ceiling',
        'floor_left', 'floor_right', 'floor_centerpiece',
        'surface', 'interior_background'
    )),
    item_id   text NOT NULL REFERENCES public.hats(id) ON DELETE CASCADE,
    placed_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, slot_name)
);

ALTER TABLE public.user_habitat_slots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View own habitat" ON public.user_habitat_slots
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "View friend habitat" ON public.user_habitat_slots
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.friendships f
                WHERE f.status = 'accepted'
                  AND ((f.user_a = auth.uid() AND f.user_b = user_habitat_slots.user_id)
                    OR (f.user_b = auth.uid() AND f.user_a = user_habitat_slots.user_id)))
    );

GRANT SELECT ON public.user_habitat_slots TO authenticated;
```

The friend-visibility RLS policy assumes the existing `friendships` table shape — verify column names at implementation time.

A row is present only when a slot is filled. Empty slots = no row. Saves space + makes "is this slot empty" a trivial check.

---

## Backend RPCs

### `equip_habitat_slot(slot_name text, item_id text)` — set a slot

```sql
-- 1. Auth caller_id := auth.uid()
-- 2. Verify caller owns the item (user_hats join)
-- 3. Verify item.category matches slot_name's expected category
-- 4. INSERT ... ON CONFLICT (user_id, slot_name) DO UPDATE SET item_id = ...
-- 5. Return jsonb { ok: true, slot, item_id }
-- Failure cases:
--   - 'unauthenticated'
--   - 'item_not_owned'
--   - 'category_mismatch'
--   - 'invalid_slot'
```

### `unequip_habitat_slot(slot_name text)` — clear a slot

```sql
-- DELETE FROM user_habitat_slots WHERE user_id = caller AND slot_name = $1;
-- Returns jsonb { ok: true, slot }.
```

### `habitat_for(uid uuid)` — render-data fetch

Returns the user's complete habitat state for rendering. Used by:
- The player's own Interior view (when they enter their Barn)
- The Visit screen (when a friend enters the host's Interior)

```sql
RETURNS jsonb
-- Shape:
-- {
--   slots: {
--     wall: { item_id, name, image_path, rarity, ... },
--     ceiling: { ... } | null,
--     floor_left: { ... } | null,
--     ...
--   },
--   interior_background: { ... } | null
-- }
-- Empty slot = the field is null (not omitted).
```

Authorization: caller must be uid (own habitat) OR be friended with uid (per RLS policy).

### Shop integration

No new RPCs. Habitat items are bought via the existing `buy_hat(item_id)` flow, which already:
- Checks the caller's snouts balance
- Validates the catalog row exists
- Deducts the cost
- Inserts into `user_hats`

The new category values flow through this RPC without modification. The daily-shop rotation may need an audit pass to ensure habitat items appear in the rotation in addition to cosmetics — verify at implementation time.

---

## UI surfaces

### Exterior view (`app/(tabs)/barn.tsx` — repositioned)

- The current Barn screen. Continues to render Rosie + cosmetics + exterior background + Garden + Hoofprints + ambient effects.
- **New element:** a clickable **barn structure** sprite. Anchored to a position on the exterior that doesn't conflict with the Garden corner. Tap target generous (hitSlop 12).
- Tap → fires the door-swing transition → routes to the Interior screen.

### Interior view (`app/(tabs)/barn-interior.tsx` — new)

- Full-screen view. Renders the slot scene per the anatomy above.
- Rosie is present (same sprite + cosmetics as the Exterior).
- Tickle interaction works in here too: tapping Rosie fires the same `update_profile_and_item_count` RPC, same hearts, same sounds.
- An exit affordance (back arrow, or a tap on the door / wall edge) triggers the reverse door-swing → back to Exterior.

### Empty-slot CTA

- Empty slots render a translucent placeholder marker — a dashed outline shape or a small "+" sticker — sized roughly to a typical item for that category.
- Tapping an empty slot opens the Shop modal pre-filtered by the slot's category. Player can scroll, preview, and buy.
- A buy that lands while the player is in this flow can auto-equip the new item to the originating slot. (Implementation note: pass the slot name through the buy modal; on success, call `equip_habitat_slot` with that slot.)

### Filled-slot interaction (player's own habitat)

- Tap a filled slot opens an item-detail sheet: item name, description, rarity, "Replace" + "Remove" buttons.
- Replace opens the slot's Shop filter again, with the current item highlighted.
- Remove clears the slot (calls `unequip_habitat_slot`).

### Friend-visit Interior

- Friend taps your barn structure on their Visit screen → same door-swing → renders your Interior with `habitat_for(host_uid)`.
- Filled slots respond to tap with a **flavor tooltip** only: item name + small description ("Cottage Wreath — Spring Festival 2026 reward"). No Replace / Remove buttons. No modification path.
- Empty slots show no marker for visitors (so the host's space doesn't advertise its emptiness).
- Tickle Rosie button is present — fires the existing `tickle_friend_pig` RPC (defined in the happiness spec, Phase 3).

### Shop integration

- Daily Shop card grid now includes habitat items alongside cosmetic hats. Same card design, same purchase flow.
- A category filter or sub-tab appears in the Shop UI so players browsing for decor can narrow. Recommended: tab strip on the Shop screen ("All / Cosmetics / Habitat") rather than mixing them invisibly.

---

## Anti-spam + edge cases

- **Category mismatch protection** — `equip_habitat_slot` rejects items whose category doesn't match the slot. Client-side guard mirrors this.
- **Self-only writes** — only the caller can modify their own habitat. Enforced by SECURITY DEFINER RPC + `auth.uid()` checks.
- **Removed items** — if an item is removed from the catalog (extremely unusual), `ON DELETE CASCADE` clears the slot. Player sees an empty slot on next entry. Acceptable.
- **Cap on owned items** — none. Same as cosmetics today; collection grows freely.
- **Pre-launch player state** — existing players get zero `user_habitat_slots` rows at deploy time. All slots empty. Entering the Interior for the first time post-launch surfaces the empty-slot CTAs.

---

## Migration phases

### Phase 1 — Schema + RPC stubs (silent)

- New category check-constraint values on `hats`.
- New `user_habitat_slots` table + RLS policies.
- `equip_habitat_slot` / `unequip_habitat_slot` / `habitat_for` RPCs.
- No UI yet. Buying habitat items just adds them to `user_hats` invisibly.

### Phase 2 — Interior view + slot system

- `app/(tabs)/barn-interior.tsx` (new route).
- Door-swing transition (one-time art: the doors).
- Interior scene anchor map + slot rendering.
- Empty-slot markers + tap-to-shop CTA flow.
- Filled-slot detail sheet + Replace/Remove flow.

### Phase 3 — Exterior barn structure

- Sprite for the clickable barn building on the exterior.
- Tap target + transition trigger.
- One-time art (the building exterior).

### Phase 4 — Shop integration polish

- Shop UI tab/filter for habitat vs cosmetics.
- Audit daily shop rotation: confirm habitat items appear in the rotation.

### Phase 5 — Visit-screen integration (depends on happiness #4)

- Friend's barn structure on the Visit screen is tappable.
- Friend Interior render uses `habitat_for(host_uid)`.
- Flavor tooltip on filled-slot taps, no modify path.

### Content phases (parallel to dev phases)

- **Launch content:** 2-3 items per category × 5 decor categories + 2-3 interior backgrounds = ~15-18 items.
- **Earned items:** Wire ~3 habitat items into existing milestones (alignment, season pass, bounty completion).
- **Subsequent content drops:** Habitat items rotated into daily shop alongside cosmetics; new earn paths added per season as designed.

---

## Tests

- **`__tests__/habitat.test.ts`** — pure / UI helpers:
  - Slot anatomy: each slot maps to exactly one category (or is the shared `floor_decor` category for left/right).
  - Empty-slot detection: returns true when `user_habitat_slots` has no row for that slot.
  - Anchor-map resolution: given screen size, slot positions resolve to non-overlapping rects.
- **SQL (pgTAP or manual):**
  - `equip_habitat_slot` rejects category mismatch.
  - `equip_habitat_slot` rejects unowned items.
  - `unequip_habitat_slot` is idempotent (no-op when slot is already empty).
  - RLS: a non-friended user cannot SELECT another user's `user_habitat_slots` rows.
- **Manual / TestFlight:**
  - Tap barn structure → door swing → Interior renders.
  - Place item in each slot, swap items, remove items.
  - Friend Visit → tap their barn → renders their Interior, items tap-for-flavor only.
  - Empty-slot tap → Shop opens with category filter applied; buy → auto-equips to originating slot.

---

## Heads-up

- **Empty-launch is an explicit bet.** If first-week placement rate is below ~40%, the empty hint markers aren't doing enough work. Have a starter-pack contingency designed and a feature flag ready to swap to it. Telemetry must include `[habitat] first_item_placed at +N days post-signup` per user.
- **Art budget is meaningful.** Launch content (15-18 items), the barn structure sprite, the door animation, interior background images (~3), interior anchor map. Largest single feature in the art pipeline since season 1 launch. Sequence: structure + first interior background → 1 item per category (5 items) → expand over weeks.
- **Visit screen scope creep.** Happiness #4's Visit screen is now load-bearing for habitat's social loop. If Visit ships before habitat, the friend-Interior link is a "coming soon" placeholder. If habitat ships before Visit, friends can't see each other's interiors at all — flag this in phase planning.
- **Garden + barn structure share the Exterior canvas.** Make sure the Garden's ambient corner (ADR-0002, Phase 2) is chosen with the barn-structure anchor in mind. Pick non-overlapping zones; both should be visible simultaneously without crowding Rosie.
- **No interactive items in v1.** Future-proof the slot schema for it (extensible `item_id` reference) but resist adding behavior until habitat lands and players ask. If interactivity becomes a goal later, add an `interactions` column on `hats` and dispatch on item tap in the Interior view.
- **Cross-feature dependency tracking.** The Happiness spec already references the Visit screen as a Phase 3 dependency; habitat now also references the Visit screen for its Phase 5. Implementation sequencing recommended: happiness Phases 1-2 → habitat Phases 1-2 → Visit screen (happiness #4) → habitat Phases 3-5 → happiness Phase 3 mood overlays.
