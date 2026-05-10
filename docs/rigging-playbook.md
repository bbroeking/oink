# Rigging Rosie in Rive — End-to-End Playbook

Replaces `docs/rive-pig-rigging.md` and the deleted Photopea-cutting doc with a single 3-day playbook. Everything you need from "I have idle_1.png" to "the live app renders a Rive-rigged pig with cosmetics tracking bones automatically."

---

## What you're committing to

| Day | What | Hours |
|---|---|---|
| 1 | Cut `idle_1.png` into 13 layered PNGs in Photopea | 1-2 |
| 2 | Build skeleton in Rive editor + animate idle + wire one slot | 4-5 |
| 3 | Animate remaining 7 states + define all slots + export + integration | 8-10 |
| 3+ | Per-cosmetic Rive setup (drop PNG, attach to slot) | ~5 min/item |

If you fall off after day 1, you've still got cleanly-cut parts you can use elsewhere. If you fall off after day 2, you've got a working idle pig with a hat slot — the architecture is proven and you can add the rest later.

---

## Day 1 — Cut the pig (Photopea, 1-2 hours)

### Setup

1. Open [photopea.com](https://www.photopea.com) in a browser.
2. Drag `assets/images/sprites/rosie/idle_1.png` from Finder into Photopea.
3. The image opens. In the right-side **Layers** panel, you'll see one layer named "idle_1." Right-click → **Duplicate Layer**. Rename the copy `_master_reference`. Click the eyeball next to the original to hide it. We work on the duplicate; the original is untouched.

### What you're producing

13 transparent PNG files. Save each in a folder called `pig-parts/` somewhere on your machine. Final list:

| Filename | What | Note |
|---|---|---|
| `body.png` | Torso/belly only — no head, no ears, no limbs | Paint in pink where the head used to overlap |
| `head.png` | Head silhouette without ears, with eyes, snout, mouth | This is the big visible piece |
| `ear_l.png` / `ear_r.png` | Each ear separately | Lets ears wiggle independently |
| `arm_l.png` / `arm_r.png` | Front limbs | Needed for wave + arms_up animations |
| `leg_l.png` / `leg_r.png` | Back legs | Needed for walk + jump |
| `tail.png` | Curly tail behind body | Lets tail wag |
| `eye_l.png` / `eye_r.png` | Each eye separately | Needed for blink, surprise eye-widen |
| `mouth.png` | Mouth shape | Swappable for surprise (O-shape), happy (open), sad (downturned) |

### Cutting workflow per part (~5 min each)

1. **Select** the lasso tool (`L`). Use the Polygonal Lasso (click `L` twice if you got the freehand version) — it's straight-line segments, easier to trace cartoon outlines.
2. **Trace around the part** you want to extract. Click around the perimeter. Close the loop by clicking back on the start point or pressing Enter.
3. **Cut to new layer**: `Cmd/Ctrl + Shift + J`. The selection is removed from the duplicate and pasted into a new layer above.
4. **Rename the new layer** to match the filename (e.g., `head`).
5. **Paint underneath** if needed. When you cut the head out, the body underneath has a hole. Pick the body's pink color (eyedropper, `I`) and paint into the hole with a soft brush so the body looks complete on its own. This matters because in animation the head bone moves — if there's a hole behind it, you'll see the background through the gap.

### Order to cut in (matters)

Cut from the top of the z-stack downward — visible parts first:
1. `eye_l`, `eye_r` — small dark cuts inside the head
2. `mouth` — small cut inside the head
3. `head` — big cut, the rest of the visible head silhouette (no ears)
4. `ear_l`, `ear_r` — sticking up from the head's old position
5. `arm_l`, `arm_r` — front limbs (these may be very small or hidden in idle, OK to be approximate)
6. `tail` — small piece off to the side
7. `leg_l`, `leg_r` — back legs (also small in idle)
8. `body` — what remains, then paint to fill the head-shaped hole

### Export per part

For each layer:
1. **Hide all other layers** (alt+click the layer's eyeball to solo it).
2. `Image → Trim → Transparent Pixels`. Crops the canvas to just that part's bounds.
3. `File → Export As → PNG` → save as `pig-parts/<name>.png` with **alpha channel preserved**.
4. `Cmd/Ctrl + Z` to undo the trim.
5. Re-show all layers (alt+click the eyeball again).

When done you'll have 13 PNG files in `pig-parts/`.

**Sanity check**: stack them mentally. Head should overlap the body where the original pig's head sat. Ears stick up above the head. The body silhouette should be complete on its own (no head-shaped hole).

---

## Day 2 — Skeleton + idle animation in Rive (4-5 hours)

### Setup

1. Sign up at [rive.app](https://rive.app) (free for personal/indie projects).
2. New File → blank, **size 300×300** (matches our render target).
3. **File → Import → Image** for each of the 13 PNGs. Each becomes a separate visual asset.

### Hierarchy

In Rive's left panel, build this structure (drag-drop one element under another to nest):

```
root (auto)
└── body                   (the body PNG is the visual)
    ├── head               (head bone — moves up/down, pivots at neck)
    │   ├── ear_l
    │   ├── ear_r
    │   ├── eye_l
    │   ├── eye_r
    │   └── mouth
    ├── arm_l              (pivot at shoulder)
    ├── arm_r              (pivot at shoulder)
    ├── leg_l              (pivot at hip)
    ├── leg_r              (pivot at hip)
    └── tail               (pivot at base)
```

For each bone:
1. Click the part on the canvas to select it.
2. In the right panel, **set its origin** to the joint (where it should rotate around). Eg, the `head` bone's origin = the bottom-center of the head where it meets the neck. The `arm_l` bone's origin = the shoulder.
3. **Parent it** to the bone above (drag the layer under the parent in the Hierarchy panel). When you move the parent, the child moves with it.

### Animate idle (your first animation)

1. Switch to the **Animate** tab (top-right).
2. Click **+** under Animations → name it `idle`. Set duration **1.0s**, **looping** ON.
3. Set frame rate to 24 fps.
4. **Frame 0** (rest): everything at 0 transforms. Confirm the pig looks like the original idle_1.
5. **Frame 12** (mid): select `body`, change its translation Y by -4 (raise the body). Select `head`, change translation Y by -2. Select both ears, rotate slightly back. Auto-creates keyframes.
6. **Frame 24** (end-of-loop): same as frame 0. Rive's looping interpolates back.

Hit play. The pig should breathe.

### Define one slot (party_hat) + verify

1. In hierarchy, right-click the `head` bone → **Add Empty Group** named `slot_hat`.
2. Set its position to the head crown (bottom-center where the hat would sit).
3. Import `wizard.png` (or any hat PNG) → drag it into `slot_hat` so it's a child.
4. Position the wizard so its base aligns with the head crown.

Hit play. The wizard hat should now move with the head as it breathes.

🎉 **You've proved the architecture works.**

### Export checkpoint

`File → Export → Runtime File (.riv)` → save as `pig.riv` to your Desktop. Drop it into the project's `assets/rive/pig.riv`.

Tell me you have a `pig.riv` and I'll wire up the runtime swap. Don't continue to day 3 until day 2 is verified working in the app.

---

## Day 3 — Remaining animations + slots (8-10 hours)

After day 2 is committed, repeat the animate-and-keyframe pattern for each:

| Animation | Duration | Notes |
|---|---|---|
| `walk` | 0.8s loop | Front legs alternate, body rises 4px on passing frames |
| `run` | 0.5s loop | Faster walk, bigger body bounce |
| `jump` | 0.6s one-shot | Squat → takeoff → apex (body up 30px) → land squash |
| `happy` | 0.6s one-shot | Both arms up, body bounces, eyes squint closed |
| `sad` | 1.5s loop | Head droops 5px, ears flatten, body slumps slightly |
| `surprise` | 0.4s one-shot | Body recoils up, eyes widen (scale eye_l/eye_r 1.3x), mouth swap to O |
| `wave` | 0.7s loop | arm_r rotates from -10° to +30° back-and-forth |
| `arms_up` | 0.6s loop | Both arms raised, small bounce, sparkle particles |

### Slots to define on the head bone

Add empty group children of `head`:
- `slot_hat` — head crown (top-center)
- `slot_glasses` — eye line center
- `slot_mask` — face center
- `slot_bow` — head crown (in front of `slot_hat`'s z)

### Slots to define on the body bone

- `slot_neck` — base of head (for scarves, necklaces)
- `slot_cape` — upper back (BEHIND the body in z-order)
- `slot_aura` — body center (BEHIND the body)
- `slot_held_r` — right paw position

### State machine

In Rive's State Machine panel:
- Idle = entry state
- Triggers: `tickle` (random go to one of jump/happy/wave), `surprise`, `arms_up`
- Boolean: `sad` (when true, transitions to sad and holds)

### Final export

`File → Export → Runtime File (.riv)` → overwrite `assets/rive/pig.riv`.

---

## Day 3+ — Per-cosmetic setup (~5 min per item)

For each of the 100 cosmetics:
1. In Rive editor, import the cosmetic PNG.
2. Drag it into the appropriate slot (e.g., wizard.png → `slot_hat`).
3. Mark it **inactive** by default (eyeball off).
4. The state machine input `equip_hat: number` controls which child of `slot_hat` is visible (using Rive's "Solo" pattern — only one child visible at a time per slot).

Re-export `pig.riv` after each cosmetic add.

---

## What I do (runtime side, after day 2 export)

1. Uncomment the body of `components/ui/RivePig.tsx`.
2. Ensure `rive-react-native` is installed: `pnpm add rive-react-native` if missing.
3. Rebuild the dev client: `npx expo run:ios` (~10 min — required because the rive native module needs linking).
4. Replace `<SpritePig>` with `<RivePig>` in `components/SwipeElement.tsx`.
5. Wire `equipped` → `setEquip({ hat: id, glasses: id, ... })` so equipping in-game flips the right Rive number input.

---

## What you can ship without finishing all 3 days

| Stopped at | What you have | Acceptable? |
|---|---|---|
| Day 1 done | Layered PNGs | No — not yet running |
| Day 2 done | Idle animation rigged + 1 slot working | Yes for iteration; pig only does idle |
| Day 3 done (5/8 anims) | Most animations rigged | Yes; missing animations fall back to idle |
| All cosmetics added | Full system | Yes — done |

You can ship at the day-2 milestone if you want to feel real progress. The worst case is the pig only does idle — which is what 90% of the screen time is anyway.

---

## When you hit a wall

Tell me at which step + what you're seeing. Common stuck points:
- **Photopea lasso is jagged** → use the Pen tool (`P`) for smoother curves
- **Rive editor crashes on import** → reload, sometimes happens with PNGs over 2MB
- **Bones rotate around the wrong point** → set their origin/pivot in the right panel
- **Hat doesn't follow head** → check parenting in hierarchy: `slot_hat` must be a child of `head`
- **State machine doesn't trigger from RN** → check the input name matches exactly (case-sensitive)

I'll be here through the whole thing.
