# Rigging Rosie in Rive

End-to-end guide: take the flat sprite sheet → cut layered parts → rig + animate in Rive editor → export `.riv` → drop into the RN app.

---

## 1. Cut the pig into parts (Photoshop / Pixelmator / Affinity / Procreate)

Pick **one** clean reference frame from the sheet — `idle_1` is best. Open it as your master file and split into the layers below. Each layer should be a transparent PNG with **as little extra empty space as possible** — Rive uses each part's own bounding box as its origin.

| Layer name        | Notes                                                                           |
| ----------------- | ------------------------------------------------------------------------------- |
| `body`            | Torso + belly, but **not** the head. The body bone will be the parent.          |
| `head`            | Just the head shape, no ears. Ears go on top as separate bones for ear-wiggle.  |
| `ear_l`, `ear_r`  | Each ear separately so they can wiggle/flop independently.                      |
| `eye_l`, `eye_r`  | Each eye separately if you want blink animation; otherwise one combined `eyes`. |
| `snout`           | The pink snout disk + nostrils. Sits on top of the head.                        |
| `mouth`           | Mouth/smile shape. Separate so it can swap (open mouth for surprise/cheer).     |
| `cheek_l`, `cheek_r` | Optional, for the blush tints. Keeps you flexible later.                     |
| `leg_fl`, `leg_fr`, `leg_bl`, `leg_br` | Front-left, front-right, back-left, back-right.       |
| `tail`            | Curly tail behind the body.                                                     |
| `arm_l`, `arm_r`  | Only needed if you plan to do `wave` / `clap` / `arms_up`. Optional otherwise.  |

**Pivot guidance** (where the part rotates around — Rive lets you set this in the editor):

- `head` → **bottom-center** of the head silhouette (where it meets the neck).
- `ear_*` → **base of the ear** where it meets the head.
- `arm_*` → **shoulder joint**.
- `leg_*` → **hip joint**.
- `tail` → **base where it attaches to the body**.

Rule of thumb: pivot at the joint, not the center of the part.

---

## 2. Skeleton plan (in Rive editor at [rive.app](https://rive.app))

Rive is free for indie use. Sign up, create a new file, set canvas to **300 × 300** (matches our `<SpritePig>` render size).

Bone hierarchy:

```
root
└── body                    (the body PNG is the visual for this bone)
    ├── head                (translates up/down for breathing, jump)
    │   ├── ear_l
    │   ├── ear_r
    │   ├── eye_l
    │   ├── eye_r
    │   ├── snout
    │   │   └── slot:hat         ← cosmetic items attach here
    │   └── slot:glasses          ← items
    ├── leg_fl
    ├── leg_fr
    ├── leg_bl
    ├── leg_br
    ├── tail
    ├── slot:scarf
    ├── slot:cape (behind body in z-order)
    └── slot:held (in front, attached to a forward-facing arm)
```

**Slots** in Rive are achieved by adding **empty target nodes** at the right anchor positions. We treat them like attachment points — at runtime we'll position the item PNG onto the slot's world transform.

---

## 3. Animate

Re-create each animation with bone keyframes. Reference the original sprite sheet for timing — the symbol legend already calls out **highest point**, **lowest point**, and **key pose** frames, so use those as your keyframes and let Rive interpolate between.

| State machine state | Source on sheet      | Suggested duration |
| ------------------- | -------------------- | ------------------ |
| `idle`              | IDLE 12 frames       | 1.0s loop          |
| `walk`              | WALK 12 frames       | 0.8s loop          |
| `run`               | RUN 12 frames        | 0.5s loop          |
| `jump`              | JUMP 12 frames       | 0.6s one-shot      |
| `fall`              | FALL 8 frames        | 0.5s loop          |
| `roll`              | ROLL FORWARD         | 0.6s one-shot      |
| `attack`            | ATTACK 10 frames     | 0.4s one-shot      |
| `happy`             | HAPPY/CHEER 8 frames | 0.6s one-shot      |
| `hurt`              | HURT 6 frames        | 0.4s one-shot      |
| `sleep`             | SLEEP 8 frames       | 1.5s loop          |
| `wave`              | WAVE 8 frames        | 0.7s one-shot      |
| `clap`              | CLAP 8 frames        | 0.5s loop          |
| `surprise`          | SURPRISE 6 frames    | 0.4s one-shot      |

`idle` is the default. Everything else is reachable via state-machine **trigger inputs**.

---

## 4. State machine schema (this is what the RN app talks to)

In Rive, build a state machine called `pig` with these inputs:

| Input name        | Type    | Used by RN to                      |
| ----------------- | ------- | ---------------------------------- |
| `tickle`          | Trigger | Plays a random reaction (jump/happy/wave) |
| `sad`             | Boolean | When `true`, idle morphs to sad pose      |
| `arms_up`         | Trigger | The 6-7 celebration                       |
| `equip_hat`       | Number  | Index into the active-hat artwork list    |
| `equip_glasses`   | Number  |                                          |
| `equip_scarf`     | Number  |                                          |

For the cosmetic inputs we'll use Rive's **Solo** pattern: each cosmetic slot has N nested artboards (or visibility-toggled groups), one per item. The number input picks which one is visible. `0` = none.

Alternative (cleaner but more setup): use **dynamic loading** of separate item .riv files and position them at the slot world-transform. We'll start with the Solo pattern because it's all in one file and ships with the pig.

---

## 5. Export

In Rive editor: **File → Export → .riv (binary)**. Save as `assets/rive/pig.riv`. The runtime will load this directly.

---

## 6. RN side (we handle this once the .riv lands)

```ts
import Rive, { RiveRef, Fit, Alignment } from "rive-react-native";

<Rive
  resourceName="pig"          // looks for assets/rive/pig.riv
  stateMachineName="pig"
  artboardName="Rosie"
  fit={Fit.Contain}
  alignment={Alignment.BottomCenter}
  ref={riveRef}
  autoplay
/>
```

To trigger an animation:
```ts
riveRef.current?.fireState("pig", "tickle");
```

To swap a hat:
```ts
riveRef.current?.setInputState("pig", "equip_hat", 3); // 3 = the third hat
```

---

## 7. Rough timeline (for one person, no prior Rive experience)

| Step                                     | Time      |
| ---------------------------------------- | --------- |
| Cut pig into 12-15 layered PNGs          | 1–2 h     |
| Import + build skeleton in Rive          | 2–3 h     |
| Animate `idle` (the easiest, sets style) | 1–2 h     |
| Each subsequent animation                | 1–2 h     |
| 13 animations × 1.5 h avg                | ~20 h     |
| State machine + slot wiring              | 2–3 h     |
| Per-item Rive variants for hats etc.     | ~10 min/item × 100 = ~17 h |
| RN integration (we do this)              | ~3 h      |

**Realistic delivery: 1–2 working weeks of focused effort.**

---

## What we ship while you're rigging

The current PNG-frame `<SpritePig>` keeps working. We're parking the Rive runtime install + a stub `<RivePig>` component in the codebase but **not yet swapping** anything in `SwipeElement.tsx`. Once you have a `pig.riv` in `assets/rive/`, the swap is one import change away.
