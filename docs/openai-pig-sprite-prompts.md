# OpenAI / ChatGPT Sprite-Sheet Prompts for Rosie

Drop these into ChatGPT (Plus tier, with image generation enabled). One animation strip per generation. Save each result as a PNG, then use it to replace the corresponding frames in `assets/images/sprites/rosie/`.

---

## How to use

1. Open a fresh ChatGPT conversation.
2. Paste the **Base prompt** (once at the top of the conversation).
3. Then paste **one animation block** at a time. ChatGPT will generate the strip.
4. Right-click the result → **Save image as…** → save to a temp folder.
5. Crop into individual frames in Photopea (or a tiny script) and drop them into `assets/images/sprites/rosie/` with the right names.

Tips for consistency across strips:
- Generate every strip in the **same conversation** so ChatGPT keeps the character locked.
- If a generation drifts (different shade, different proportions), reply: *"Use the same exact character as the previous image — same head shape, same colors, same line weight."*
- If transparency comes out wrong, ask for: *"Pure transparent background — no white fill behind the character."*

---

## Base prompt (paste this first)

```
I'm going to ask you to generate a series of horizontal sprite sheets
for a 2D game character. Use the same character — identical
proportions, colors, line weight, and style — across every generation.

Character: a chubby pink cartoon pig.
- Round head, big black anime-style eyes with small white highlights
- Pink oval snout with two nostrils
- Soft smile, blush cheeks
- Two soft pink ears (slight forward droop)
- Four short stubby legs with darker hooves
- Small curly tail

Style: flat children's storybook illustration, bold ~3px black outline,
soft pink palette (body #F8B9C6, inner ear/cheeks #F4A5B6, snout #EF8FA4,
hooves #6D4C41). No shading gradients — keep colors flat. Front-facing
in every frame.

Default layout for every sprite sheet I ask for:
- Horizontal row of frames at 256×256 pixels each
- No gaps, no gridlines, no labels, no numbers between frames
- Pure transparent background — no fill behind the character
- No ground line, no shadow
- Same character size and vertical position in every frame so
  contact-points (feet, snout) stay aligned

Confirm you understand, then I'll send the first animation.
```

---

## Animation strips

### IDLE — 4 frames, 1024×256

```
IDLE breathing loop, 4 frames horizontal, 1024×256 total.
- Frame 1 (rest): neutral standing pose, body at baseline, ears straight up
- Frame 2 (inhale): body lifted 4px, slight vertical squash, ears slightly back
- Frame 3 (rest): same as frame 1
- Frame 4 (exhale): body lowered 4px, slight vertical stretch, ears slightly forward
```

### WALK — 4 frames, 1024×256

```
WALK cycle, 4 frames horizontal, 1024×256 total.
- Frame 1 (contact left): front-left leg forward extended, back-right leg forward, body at baseline
- Frame 2 (passing left): all four legs gathered under body, body lifted 4px
- Frame 3 (contact right): front-right leg forward extended, back-left leg forward, body at baseline
- Frame 4 (passing right): all four legs gathered under body, body lifted 4px
The pig stays in the same horizontal position — only legs move.
```

### RUN — 4 frames, 1024×256

```
RUN cycle, 4 frames horizontal, 1024×256 total. Like WALK but more dynamic — bigger leg extension, more body bounce, ears flapping back from the wind.
- Frame 1: full extension, body leaning forward, all legs splayed
- Frame 2: gather under body, body lifted higher
- Frame 3: full extension other side, body still leaning forward
- Frame 4: gather under body
```

### JUMP — 4 frames, 1024×256

```
JUMP arc, 4 frames horizontal, 1024×256 total.
- Frame 1 (anticipation): squat down, body vertically squashed, legs bent, ears back
- Frame 2 (takeoff): body launching upward, legs extending straight down, ears starting to lift
- Frame 3 (apex): fully airborne, body lifted ~30px from baseline, legs pulled up under body, ears flapping back
- Frame 4 (landing): body squashed on impact, legs splayed outward, ears forward
```

### FALL — 4 frames, 1024×256

```
FALL in air, 4 frames horizontal, 1024×256 total. The pig is falling — legs flailing, ears flapping up.
- Frame 1: body upright but starting to lean back, legs bent slightly
- Frame 2: legs splaying out, ears tilting up from wind
- Frame 3: same with arms/legs in different positions, slight wobble
- Frame 4: legs preparing for landing, body bracing
```

### HAPPY / CHEER — 4 frames, 1024×256

```
HAPPY cheering loop, 4 frames horizontal, 1024×256 total. The pig has its arms raised in celebration.
- Frame 1: arms raised, body at baseline, eyes happy/closed
- Frame 2: small bounce up, arms shaking a bit, big smile
- Frame 3: same as frame 1
- Frame 4: bounce up again with sparkle particles around the head
```

### WAVE — 4 frames, 1024×256

```
WAVE greeting, 4 frames horizontal, 1024×256 total. The pig is waving its right arm side to side.
- Frame 1: right arm raised, hand at center
- Frame 2: arm swung to the right
- Frame 3: arm centered again
- Frame 4: arm swung to the left
Body, head and other limbs stay still — only the right arm moves.
```

### SAD / HURT — 2 frames, 512×256

```
SAD pose, 2 frames horizontal, 512×256 total.
- Frame 1: head drooped forward, ears down, body slightly slumped, sad mouth
- Frame 2: same pose with a single tear forming under one eye
```

### SURPRISE — 2 frames, 512×256

```
SURPRISE pose, 2 frames horizontal, 512×256 total.
- Frame 1: ears up, eyes wide open, mouth round in a small "O", body lifted slightly
- Frame 2: same with motion lines around the head and an exclamation mark above
```

### SLEEP — 4 frames, 1024×256

```
SLEEP loop, 4 frames horizontal, 1024×256 total. The pig is curled up sleeping.
- Frame 1: lying on side, eyes closed, gentle smile
- Frame 2: tiny "Z" rising from the snout, body slightly inflated (in-breath)
- Frame 3: "Z" floating up further, body relaxed
- Frame 4: a slightly bigger "Z", body deflated (out-breath)
```

---

## After generation

Each result is a single PNG horizontal strip. To split into individual frames you can run:

```bash
# 4 equal frames from a 1024×256 strip
sips --cropToHeightWidth 256 256 input.png --out f1.png
# repeat with offset, or use ImageMagick:
convert input.png -crop 256x256 +repage f_%d.png
```

Or open in Photopea, use **Image → Slice** at every 256px on the X axis.

Then move + rename:

```bash
mv f1.png assets/images/sprites/rosie/idle_1.png
mv f2.png assets/images/sprites/rosie/idle_2.png
# ...etc
```

---

## Realistic expectations

- **First 2-3 strips will feel rough.** Iterate on the prompt, ask ChatGPT to "match the previous strip's character exactly," and regenerate.
- **Transparent backgrounds may need follow-up.** ChatGPT's image gen sometimes ships a near-white background. Drag the result through [remove.bg](https://remove.bg) for a clean cutout.
- **Cost per strip**: ~$0.07-0.17 via API at high quality, free in ChatGPT Plus.
- **Total budget for all 9 strips above**: ~$1 in API or 30 min in ChatGPT Plus.

The strips give you ~36 frames covering the most-used animations. The remaining sheet animations from your reference (eat, clap, look up/down, attack, roll, sit, etc.) you can add later only if a feature actually calls for them.
