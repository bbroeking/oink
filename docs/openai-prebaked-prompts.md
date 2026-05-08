# Pre-Baked Accessory Prompts

For hero / legendary items where you want the pig and the accessory drawn together rather than composited at runtime. Use the same ChatGPT conversation that generated the base pig sprites so the character stays identical.

Drop each saved strip into `~/Downloads/ttp_anim/` named like `prebaked-<item_id>-<animation>.png` (e.g., `prebaked-crown-idle.png`). Tell me which file is which item and I'll add a JOBS entry to `slice_ttp_anim.py`, route the frames into `assets/images/sprites/prebaked/<item_id>/`, and wire up `ITEM_PREBAKED` in `constants/prebaked.ts`.

Recommended starter list (~5 items): the highest-rarity items in the catalog where placement matters and players will see them most.

- `crown` (epic, 8000)
- `halo` (rare, 1200)
- `viking_helmet` (rare, 600)
- `royal_cape` (epic, 2200)
- `vampire_cape` (rare, 1100)
- `holy_aura` (epic, 2400)

---

## Prompt template (substitute the <ITEM> + <DESC> bits)

```
PRE-BAKED <ANIM> for the pig wearing <DESC>. 4 frames horizontal,
1024×256 total. Use the SAME pink cartoon pig from previous
generations — identical proportions, eyes, snout, line weight,
colors. The accessory is rendered AS IF the pig is wearing it,
not floating separately.

Animation: <ANIM_DESCRIPTION_FROM_BASE_DOC>

The accessory must:
- Stay attached to the pig in EVERY frame (no detachment, no
  drift; if the pig's head bounces, the accessory bounces with it)
- Stay the same color, scale, and orientation across all 4 frames
- Look natural on the pig — touching the right anatomy point
  (hat sits on head crown; halo above head; cape hangs from back;
  aura surrounds entire body)

Background — CRITICAL:
- Pure transparent PNG (alpha channel)
- All non-character pixels fully transparent (alpha = 0)
- No fill, no gradient, no vignette, no shadow, no glow (unless
  the accessory IS a glow/aura), no ground line, no border
- The pig + accessory silhouette is the ONLY visible content

If you cannot output transparent PNG, stop and tell me — do NOT
substitute a white or colored background.
```

### Crown — IDLE

```
PRE-BAKED IDLE for the pig wearing a Royal Crown. 4 frames,
1024×256. Same pink pig as before; crown is gold with red velvet
inside and gem accents, sitting square on top of the head between
the ears.

Animation: idle breathing loop.
- Frame 1 (rest): neutral standing pose, crown level
- Frame 2 (inhale): body lifted 4px, crown tilts back 2 degrees
- Frame 3 (rest): same as frame 1
- Frame 4 (exhale): body lowered 4px, crown tilts forward 2 degrees

Crown stays attached to the head in every frame. Pure transparent PNG,
no fill behind anything.
```

### Halo — IDLE

```
PRE-BAKED IDLE for the pig wearing a glowing golden Halo. 4 frames,
1024×256. Halo is a flat bright ring floating ~20px above the head
between the ears.

Animation: idle breathing loop. Halo gently bobs up/down 2px in
opposition to the body — it stays in the air while the pig inhales
and exhales below it.
- Frame 1: rest, halo at baseline above head
- Frame 2: body lifts 4px, halo holds (relative gap closes)
- Frame 3: rest
- Frame 4: body drops 4px, halo holds (relative gap widens)

Pure transparent PNG, no fill.
```

### Viking helmet — IDLE

```
PRE-BAKED IDLE for the pig wearing a Viking helmet. 4 frames,
1024×256. Helmet is silver metal with two curved horns, sitting
snug on the head with the horns clear of the ears.

Animation: idle breathing loop. Helmet stays rigidly attached to
the head — when the head bobs in idle, the whole helmet (with
horns) moves with it.
- Frame 1 (rest)
- Frame 2 (inhale): body + helmet lift 4px together
- Frame 3 (rest)
- Frame 4 (exhale): body + helmet drop 4px together

Pure transparent PNG, no fill.
```

### Royal cape — IDLE

```
PRE-BAKED IDLE for the pig wearing a Royal Cape. 4 frames,
1024×256. Cape is purple velvet with gold trim and ermine collar,
draped over the back. Cape is BEHIND the pig in z-order.

Animation: idle breathing loop. Cape sways gently in a 4-frame
loop — bottom edge of cape drifts left ~3px on inhale and right
~3px on exhale to suggest air movement.
- Frame 1: cape centered, body at rest
- Frame 2: body inhales (lifts 4px), cape edge drifts left 3px
- Frame 3: cape centered, body at rest
- Frame 4: body exhales (drops 4px), cape edge drifts right 3px

Pure transparent PNG, no fill behind cape or pig.
```

### Vampire cape — IDLE

```
PRE-BAKED IDLE for the pig wearing a Vampire Cape with red interior.
4 frames, 1024×256. Cape is black outside, crimson inside lining,
sharp pointed collar. Cape behind the pig.

Same idle motion as the royal cape — gentle sway 3px each direction
in opposition to body bounce. Pure transparent PNG.
```

### Holy aura — IDLE

```
PRE-BAKED IDLE for the pig surrounded by a Holy Aura. 4 frames,
1024×256. Aura is a white-and-gold soft halo of light beams
radiating outward, encircling the entire pig (not just the head).

Animation: aura gently pulses while the pig idles.
- Frame 1: aura at full brightness, pig at rest
- Frame 2: aura slightly dimmer, pig inhales (body lifts 4px)
- Frame 3: aura at full brightness
- Frame 4: aura slightly brighter (peak), pig exhales (drops 4px)

Pure transparent PNG except for the aura's own glow.
```

---

## After generation: import flow

For each strip:
1. Save as `~/Downloads/ttp_anim/prebaked-<item_id>-<anim>.png`.
2. Tell me which file is which.
3. I'll:
   - Add a JOBS entry to `scripts/slice_ttp_anim.py`
   - Slice into `assets/images/sprites/prebaked/<item_id>/<anim>_1.png` … `<anim>_4.png`
   - Add `require(...)` entries for each frame to `FRAMES` in `components/ui/SpritePig.tsx`
   - Add the item to `ITEM_PREBAKED` in `constants/prebaked.ts`
4. Hot-reload — equip the item in-game and the pig swaps to the prebaked sprite set.

Animations not provided fall back to the regular pig + compositional overlay. So a `crown` with only `idle` prebaked still walks/jumps using the base pig + the crown PNG overlay.

---

## When NOT to do this

- For common/uncommon items — the per-frame anchor system is good enough. Save the time + tokens.
- When you want users to mix & match — prebaked is exclusive (only one prebaked item visible at a time).
- For items you might tweak the art on — every art change requires regenerating all 4+ frames.

Pick maybe 5–10 items total. Diminishing returns past that.
