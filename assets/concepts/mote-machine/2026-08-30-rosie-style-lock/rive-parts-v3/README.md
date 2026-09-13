# Mote Machine — Impeccable V3 Rive handoff

Status: hierarchy locked for Rive production after an Impeccable critique and a
separate fresh-eye review. The master READY reference is
`../mote-machine-impeccable-v3-ready.png`.

V3 fixes the two causal errors in the prior mock: READY no longer shows an
energy beam or a pre-earned reward, and the machine now reads as a friendly
Rosie/Barn contraption instead of a glossy casino cabinet. Final Rive paint
should favor broad rose/cream fills and dark ink contours. Reserve glow for the
Mote in motion and the earned reward reveal.

## Importable sources

| Source                              | Purpose                                                                                             |
| ----------------------------------- | --------------------------------------------------------------------------------------------------- |
| `background-open-barn-v3.png`       | Quiet full-bleed Barn/meadow plate                                                                  |
| `cabinet-shell-empty-v3.png`        | Empty machine shell with blank plaque, empty feed well, three empty painted windows, and empty tray |
| `mote-preview-v3.png`               | Separate READY/deposit Mote; never bake it into the cabinet                                         |
| `reel-strip-project-symbols-v3.png` | Six-cell loop-safe reel strip: Acorn, Mote, brush, blessing, curse, repeated Acorn                  |
| `clockwork-acorn-reward-v3.png`     | Separate post-settle reward                                                                         |
| `lever-shaft-v3.png`                | Separate lever shaft                                                                                |
| `lever-knob-v3.png`                 | Separate lever knob                                                                                 |
| `lever-pivot-v3.png`                | Separate mechanical pivot/base                                                                      |
| `lever-pull-sign-v3.png`            | Attached PULL sign; parent it to the moving lever assembly                                          |

The `*-chromakey-v3.png` files and `components-sheet-*.png` files are retained
for provenance and recropping. Do not import the sheets into the runtime file.
All final component files are RGBA except the full-bleed background.

## 390 × 844 artboard composition

The values below are starting coordinates, not a substitute for visual
alignment against the master READY reference.

| Node                       | Starting placement                          | Production constraint                                                                                                    |
| -------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `bg.openBarn`              | `(0, 0, 390, 844)`                          | Scale to cover. Keep the central sky quiet.                                                                              |
| `machine.cabinetGuide`     | about `(37, 172, 316, 682)`                 | The visible alpha lands around x `41…343`, y `293…776`. Use as the paint/style guide while authoring masks and overlays. |
| `machine.feedWell.mask`    | centered near `(195, 456)`                  | Independent aperture. It must mask the Mote during deposit.                                                              |
| `machine.motePreview`      | center near `(195, 424)`, nominal `50 × 54` | Visible only before deposit; 1–2 pt idle float is enough.                                                                |
| `machine.reel.left.mask`   | about `(72, 505, 69, 185)`                  | Clip one independent strip; overscan width slightly.                                                                     |
| `machine.reel.center.mask` | about `(151, 505, 68, 185)`                 | Independent strip and stop timing.                                                                                       |
| `machine.reel.right.mask`  | about `(232, 505, 69, 185)`                 | Independent strip and stop timing.                                                                                       |
| `machine.lever`            | pivot near `(350, 615)`                     | Keep the whole 44 pt minimum hit region away from the iOS back-swipe edge.                                               |
| `machine.tray.cavity`      | centered near `(195, 724)`                  | Transparent/reveal cavity behind a separate static tray lip.                                                             |
| `machine.reward.acorn`     | center near `(195, 724)`, nominal `58 × 58` | Hidden until the right reel has fully settled.                                                                           |

Balances, navigation, result quantity, and notification copy stay native. The
Rive plaque may contain the fixed `MOTE MACHINE` title, and the attached lever
sign may contain the fixed `PULL` instruction.

## Required hierarchy

```text
MOTE MACHINE (artboard 390×844)
├─ bg.openBarn
├─ machine
│  ├─ cabinetGuide
│  ├─ reelStrips
│  │  ├─ Reel Strip Left    → clipped by reel.left.mask
│  │  ├─ Reel Strip Center  → clipped by reel.center.mask
│  │  └─ Reel Strip Right   → clipped by reel.right.mask
│  ├─ reelBezelOverlay      → manual rose/dark-ink vector redraw
│  ├─ feedWell
│  │  ├─ feedWell.aperture
│  │  └─ feedWell.mask
│  ├─ motePreview           → separate image; masked away on deposit
│  ├─ lever                 → one rotating parent at the mechanical pivot
│  │  ├─ Lever Pivot
│  │  ├─ Lever Arm
│  │  ├─ Lever Knob
│  │  └─ Lever Pull Sign
│  └─ rewardTray
│     ├─ tray.cavity
│     ├─ reward.acorn
│     └─ tray.lip           → static overlay above the reward
└─ authoredFixedText
   └─ MOTE MACHINE
```

The cabinet source has painted cream reel interiors, not transparent holes.
Author three rounded masks and a thin rose/dark-ink bezel overlay in Rive.
Likewise, make the tray lip and reveal cavity independent. These are required
production layers, not optional polish.

## Truthful animation states

1. **READY:** Mote hovers above the empty feed well; reels are still; lever is
   raised; tray is empty; no beam, ambient jackpot glow, or reward is visible.
2. **DEPOSIT:** Mote compresses slightly, travels downward, and disappears
   through `feedWell.mask`; the cabinet wakes from the feed point outward.
3. **LEVER:** knob, shaft, and PULL sign rotate as one assembly around the
   pivot, then settle mechanically.
4. **SPIN:** three vertical strips accelerate quickly. Movement stays confined
   to their aperture masks.
5. **BRAKE:** left, center, then right strip decelerate independently. These are
   authored reel stops, not three extra player buttons.
6. **REVEAL:** only after the right reel settles, the confirmed Clockwork Acorn
   rises from the tray cavity with one restrained light pulse.
7. **SETTLED:** reward holds long enough to read while native code updates both
   balances, announces the receipt, and shows one notification.

Reduced Motion keeps the deposit, lever state change, final reel symbols, and
reward receipt but completes in under 500 ms without repeated reel travel.

## Generation and post-processing record

Mode: built-in GPT image generation. Asset calls used the accepted V3 READY
mock and the shipped Rosie art as visual references. No CLI image model or
external image API was used.

- The component sheet requested exactly six isolated items in a 2 × 3 grid on
  `#00ff00`: Mote, Clockwork Acorn, lever shaft, lever knob, lever pivot, and
  attached PULL plaque.
- The reel prompt requested one front-facing six-cell strip on `#00ff00` with
  the exact loop-safe sequence documented above and explicitly excluded casino
  glyphs, text, gears, and scenery.
- Alpha was produced with the bundled `remove_chroma_key.py` helper using
  `--auto-key border --soft-matte --transparent-threshold 12
--opaque-threshold 220 --despill`.
- Individual component cells were cropped mechanically from the 1024 × 1536
  source sheet at 512 × 512 per cell. Originals remain alongside the finals.
