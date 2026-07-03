# The Great Hunger — opening production prompts

Project memory for the Season 2 opening cinematic and its reusable character sprites.

## Locked creative constraints

- Anchor on the actual Tickle the Pig game art. Use Rosie from `assets/images/sprites/rosie/idle_1.png` / `~/Desktop/ttp-refs/soccer-regen/idle_1.png` as the identity and style lock.
- Use the meaner attached Truffle King / Hunger image as the identity lock for the villain: huge pale-pink hog, too-small gold crown, white neck napkin, mud smudges, truffles, sharp mischievous eyebrows, tiny tusk, greedy gloating grin.
- Final cinematic panels should be full-frame generated illustrations using the character references, not stitched composites of sprites on backgrounds. The composite builder is only a layout/state-review fallback.
- Do not drift into invented sticker, gouache, felt, painterly-realistic, scary, gritty, or 3D-rendered styles.
- The cinematic ends sad and unresolved. Rosie is never victorious here. The gameplay loop is where players win the stolen tickles back.
- Portrait story panels are 9:16. Sprite sheets should be clean, orthographic, transparent-friendly, and animation-ready.

## Shared image-generation anchor

Use this anchor at the top of every storyboard or sprite prompt:

```text
Use Image #1 as the strict Rosie reference and Image #2 as the strict Great Hunger / Truffle King reference.
Match the real Tickle the Pig art: chubby kawaii pig characters, thick warm dark outline, glossy dark eyes with bright catchlights, rosy cheek circles, soft cel shading, clean rounded forms, cheerful mobile-game polish.
Rosie must keep the exact species, face, eyes, snout, proportions, pink coloring, and cute soft body from Image #1. The Great Hunger must keep the huge round hog body, tiny gold crown, white napkin, mud smudges, brown truffle pile, glossy eyes, pink hide, sharp mean eyebrows, little tusk, and greedy gloating expression from Image #2.
No text, no watermark, no photorealism, no gritty monster treatment, no horror, no victory celebration. The Hunger can look meaner and more smug than Rosie, but still belongs in the cute Tickle the Pig art world.
For storyboard panels, create one cohesive full-frame image with integrated lighting, camera, and background. Do not paste sprites onto a scene or make a collage.
```

## Sprite sheet prompts

### Rosie walk turnaround

```text
Create a clean animation sprite sheet for Rosie using the shared anchor.
Asset type: mobile game character sprite sheet.
Layout: 4 rows x 4 columns, transparent or flat removable background, generous padding, consistent scale and baseline.
Rows: front walk, left-facing walk, right-facing walk, back walk.
Columns: four looping walk frames per row.
Rosie stays identical to Image #1, only pose and viewing angle change. Include a believable rear view with curly tail and ears; no costume changes; no extra props.
```

### Great Hunger walk turnaround

```text
Create a clean animation sprite sheet for the Great Hunger / Truffle King using the shared anchor.
Asset type: mobile game boss sprite sheet.
Layout: 4 rows x 4 columns, transparent or flat removable background, generous padding, consistent scale and baseline.
Rows: front waddling walk, left-facing waddling walk, right-facing waddling walk, back waddling walk.
Columns: four looping walk frames per row.
Keep his huge round body, too-small tilted gold crown, white napkin, mud smudges, truffle crumbs, dark hooves, sharp mischievous eyebrows, tiny tusk, and greedy gloating personality. Make him meaner than Rosie but still cute and readable, not scary.
```

### Rosie full animation pack

```text
Create a clean animation sprite pack for Rosie using the shared anchor.
Asset type: mobile game character sprite sheet.
Layout: 8 rows x 4 columns, transparent or flat removable background, generous padding, consistent scale and baseline.
Rows: idle, happy, sad, surprise, tired, jump, walk, wave.
Columns: four looping frames per row.
Rosie stays identical to Image #1; preserve her shipped character identity and do not add props, costume changes, or new markings.
```

### Great Hunger action pack

```text
Create a clean animation sprite pack for the Great Hunger / Truffle King using the shared anchor.
Asset type: mobile game boss sprite sheet.
Layout: 4 rows x 4 columns, transparent or flat removable background, generous padding, consistent scale and baseline.
Rows: idle glare, heavy waddle, smug gloat, slurping stolen golden tickles.
Columns: four looping frames per row.
Keep the meaner Image #2 expression: sharp eyebrows, tiny tusk, greedy grin, too-small crown, white neck napkin, mud smudges, and truffle hoard. He should feel like a cute-but-bad season boss, not a horror monster.
```

## Storyboard prompts

### Shot 1 — Valley of Tickles

```text
Portrait 9:16 storyboard panel for The Great Hunger opening. A cozy Tickle the Pig bog valley at warm night-gold dusk: rounded barns, cattails, lily pads, soft marsh water, and thousands of glowing golden joy-motes called tickles drifting like fireflies. No characters. Peaceful, full of joy, matching the mobile game's rounded cel-shaded art.
```

### Shot 2 — Rosie Asleep

```text
Portrait 9:16 storyboard panel using the shared anchor. Rosie, exactly Image #1, curled asleep in a cozy round barn doorway under a tiny patchwork quilt, one hoof over her snout, peaceful sleeping smile. Warm gold light spills from the barn. A faint sneaky shadow creeps in from the edge of frame. Sweet, calm, not ominous yet.
```

### Shot 3 — The Great Hunger Arrives

```text
Portrait 9:16 storyboard panel using the shared anchor. The Great Hunger / Truffle King, exactly Image #2 but full-body and enormous, tiptoes over a moonlit bog hill on absurd dainty little hooves. He raises one hoof in a "shhh" gesture, crown tilted, napkin at neck, mud smudges and truffles visible, mischievous hungry grin. Cute greedy rascal, not scary.
```

### Shot 4 — The Theft

```text
Portrait 9:16 storyboard panel using the shared anchor. The same Great Hunger from Image #2 slurps a swirling glowing golden river of tickles out of a tiny cozy barn window like a golden noodle. His cheeks puff with greedy delight, eyes squeezed happily, napkin at neck, mud smudges and crown visible. The barn behind him dims from warm gold to dull grey as its glow streams into him.
```

### Shot 5 — Grey Dawn

```text
Portrait 9:16 storyboard panel using the shared anchor. Rosie, exactly Image #1, stands in her barn doorway at pale grey dawn with the patchwork quilt slipping from one shoulder. Her mouth is a small round "o" of surprise, eyes wide, staring at a dim empty grey spot where golden tickles used to glow. Gently sad but sweet; mostly grey-blue palette with one faint warm accent on her cheeks.
```

### Shot 6 — Empty Valley

```text
Portrait 9:16 storyboard panel using the shared anchor. Rosie, exactly Image #1, stands tiny and alone in the middle of a vast colorless bog valley at cold grey dawn. Every golden tickle is gone. A few distant little pigs are slumped and sad far away. Rosie looks down at a dead-grey empty spot where a tickle used to float. Quiet heartbreak, tender, not scary.
```

### Shot 7 — The Hunger Begins

```text
Portrait 9:16 storyboard panel using the shared anchor. End-card image, sad and unresolved. Foreground bottom: Rosie, exactly Image #1 but seen from behind, tiny and sad, looking up. Far away on a dark hill: the Great Hunger / Truffle King from Image #2 sits triumphantly on an enormous glowing golden mountain of all the stolen tickles, patting his round belly and gloating. The valley between them is grey and drained. Only the distant hoard glows warm. Leave clear sky at the top for title overlay. No celebration, no relit valley, no happy Rosie.
```
