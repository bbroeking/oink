# The Great Hunger — Higgsfield video storyboard

Production board for generating the ~30s Season 2 opening cinematic on Higgsfield (image-to-video), one clip per shot, from the composited start frames in `assets/concepts/great-hungerer/storyboard/`. Companion to `docs/great-hunger-opening-production.md` (the still-image prompt pack) and `docs/wiki/outputs/memos/great-hog-storyboard-v2-2026-07.md` (the authoritative 7-shot board).

## Locked parameters

- **Total runtime:** ~30s final cut (7 clips, trimmed; math in §Assembly).
- **Format:** portrait **9:16**, generate at the highest offered resolution (min 1080×1920 upscale).
- **Emotional arc — ENDS DOWN:** joy → theft → grey → empty → *the Hunger begins*. No resolution. Rosie is never happy or victorious. Final image is the Hog King gloating on his hoard + CTA **"Help win them back."**
- **Style guard:** the game's own soft glossy storybook look — chubby kawaii pigs, thick warm outlines, glossy eyes, soft cel shading. **Never** scary, photoreal, gritty, 3D-rendered, or horror. The Hunger is a smug cute glutton, not a monster.
- **Text:** NO text generated inside Higgsfield. All on-screen text is overlaid in edit (§Assembly).

## Per-clip generation settings

- Mode: **image-to-video** from the shot PNG. The start frame is the identity lock — do not also prompt character descriptions beyond what stabilizes the frame.
- Clip length: generate **5s** per shot (the standard increment); trim in edit.
- Motion strength: LOW-to-MEDIUM everywhere. These are storybook panels; small motion reads better than big motion and drifts less.
- Motion reference (what the characters' movement should feel like): the sprite GIF packs in `assets/concepts/great-hungerer/sprites/` — Rosie `rosie_{idle,sad,tired,surprise}_preview_v1.gif`, Hunger `great_hunger_{idle,waddle,gloat,slurp}_preview_v2.gif`. Gentle squash-and-stretch bobs, nothing skeletal.

---

## The 7 shots

| # | Clip | Start frame | Final-cut dur | Camera | Transition out |
|---|---|---|---|---|---|
| 1 | Valley of tickles | `storyboard/shot_01_valley_of_tickles.png` | 4.0s | slow push-in | cross-dissolve |
| 2 | Rosie asleep | `storyboard/shot_02_rosie_asleep.png` | 4.0s | very slow drift L→R | shadow dip-to-dark |
| 3 | The Hunger arrives | `storyboard/shot_03_hunger_arrives.png` | 4.5s | slow push-in | hard cut |
| 4 | The theft (thesis) | `storyboard/shot_04_the_theft.png` | 5.5s | locked-off / micro push | dip-to-grey (color drain) |
| 5 | Grey dawn | `storyboard/shot_05_grey_dawn.png` | 4.0s | slow push-in on doorway | cross-dissolve |
| 6 | The empty valley | `storyboard/shot_06_empty_valley.png` | 4.5s | slow pull-back (reveal smallness) | slow dissolve |
| 7 | The Hunger begins | `storyboard/shot_07_hunger_begins.png` | 5.5s + hold | slow tilt-up past Rosie to the hill | end card |

Sum 32.0s − ~6 overlapping transitions (~0.3s each) ≈ **30s net**.

### Shot 1 — Valley of tickles

- **Motion prompt:**
  ```text
  Hundreds of small glowing golden orbs drift slowly upward and sideways like fireflies over a golden storybook bog valley. The orbs bob gently and twinkle. The stream water shimmers softly. Cattails sway very slightly. Camera pushes in very slowly. Warm, peaceful, magical atmosphere. Illustration style stays constant.
  ```
- **Camera:** slow push-in toward the stream's vanishing point.
- **Must NOT change:** palette stays warm gold; no characters appear; background painting stays static except water shimmer and reed sway.
- **Text / VO:** *"Once, the valley glowed gold…"* / "Once, the whole valley glowed gold with tickles — every single night."
- **SFX/music:** warm music-box waltz starts; soft twinkle bed; gentle night crickets.

### Shot 2 — Rosie asleep

- **Motion prompt:**
  ```text
  A sleepy cartoon piglet dozes under a purple quilt in a cozy barn doorway. Her eyelids stay heavy and closed, her head bobs almost imperceptibly with slow breathing, the quilt rises and falls gently. Golden orbs float past outside. A dark shadow at the right edge of frame slowly stretches further into the frame. Camera drifts sideways very slowly. Calm bedtime atmosphere with a hint of something sneaky.
  ```
- **Camera:** very slow lateral drift left→right (parallax feel), no zoom.
- **Must NOT change:** Rosie's face stays the tired sprite (eyes closed, no new expressions); the barn's flat graphic shapes must not warp or repaint; palette stays warm.
- **Text / VO:** *"…and no one loved them more than Rosie."* / "And no one loved them more than a little pig named Rosie."
- **SFX/music:** waltz continues quieter; soft snore; low creeping-bassoon note enters under the shadow.
- **⚠ Composition note:** flat-graphic barn + sprite over painterly bg is a style seam; keep motion strength LOW so the model doesn't repaint the barn. First fallback candidate for Ken Burns (§Assembly).

### Shot 3 — The Hunger arrives

- **Motion prompt:**
  ```text
  A huge round pink hog king with a tiny gold crown sits on a dark mound in a sunset swamp, hugging a pile of brown truffles. He chews smugly, cheeks bulging, belly slowly heaving, eyebrows arched with greedy mischief. His crown tilts slightly as he moves. Swamp mist drifts behind him, the low sun glows. Camera pushes in slowly toward his grin. Cute villain energy, comedic, not scary.
  ```
- **Camera:** slow push-in from full-frame to belly-up framing.
- **Must NOT change:** crown, napkin, mud smudges, truffle pile all stay; he stays SEATED (the frame has him seated, not tiptoeing — do not prompt walking); style stays cute.
- **Text / VO:** *"But then… the Great Hunger."* / "But one night, over the hill, came the Great Hunger."
- **SFX/music:** waltz stumbles into a comic sneaky tuba/bassoon vamp; wet chewing squelch; distant thunder-rumble kept soft.

### Shot 4 — The theft (thesis shot)

- **Motion prompt:**
  ```text
  A glowing golden ribbon of tiny orbs flows out of the small barn window on the left, travels along its winding path through the air, and streams into the huge pink hog king on the right. He slurps it in, cheeks puffing with delight, eyes squeezed happy, belly swelling slightly. As the golden stream drains, the barn and the left side of the frame slowly dim and desaturate toward grey. Fireflies in the swamp fade out one by one. Camera stays locked. Comedic greedy slurp, storybook style.
  ```
- **Camera:** locked-off (or 2% micro push). The motion is the stream — don't compete with it.
- **Must NOT change:** the hog's identity (crown/napkin/tusk); the barn's shape; no new characters; grey creeps in only from the barn side, the hog's glow stays warm.
- **Text / VO:** *"He ate every last tickle."* / "And with one enormous slurp, he ate every last tickle."
- **SFX/music:** music holds its breath → long ascending slurp → deep gulp → beat of silence. This is the audio thesis too.
- **⚠ Composition note:** the mote-stream is drawn as a static zigzag; some seeds will wiggle it instead of flowing along it. Accept a take where flow direction reads barn→mouth; otherwise fall back to animating the stream in edit over a Ken Burns of the still (§Assembly).

### Shot 5 — Grey dawn

- **Motion prompt:**
  ```text
  A small pink piglet peeks over a grey quilt in a grey barn doorway at pale dawn, the only warm color in a desaturated marsh. Her eyes are wide and her mouth is a small round o of surprise. She blinks slowly once, ears twitching slightly. Grey clouds drift slowly. Reeds sway faintly. Camera pushes in gently toward her face. Quiet, hushed, sad morning atmosphere.
  ```
- **Camera:** slow push-in on the doorway.
- **Must NOT change:** the grey palette (nothing re-warms); Rosie's pink is the ONLY saturated element; her surprise expression stays (the surprise→sad turn is carried by the cut to Shot 6 and the VO, not by an in-clip face change); flat barn shapes stay put.
- **Text / VO:** *"Morning came. The gold was gone."* / "Rosie woke to a world gone quiet and grey."
- **SFX/music:** music drops to a thin, high, sparse piano; cold wind; no birds.
- **⚠ Composition note:** same style-seam as Shot 2 — low motion strength, Ken Burns fallback ready.

### Shot 6 — The empty valley

- **Motion prompt:**
  ```text
  A tiny sad pink piglet stands alone in a vast grey drained bog valley, head low, ears drooping slightly as she looks down. Three small grey piglets in the distance sit slumped and still. Dull grey orbs drift slowly downward like ash and fade. Thin mist moves through the reeds. Camera pulls back slowly, making the piglet smaller and smaller in the frame. Quiet heartbreak, tender storybook mood.
  ```
- **Camera:** slow pull-back (the reverse of Shot 1's push-in — the valley that drew us in is now empty).
- **Must NOT change:** all-grey palette except Rosie's pink; the grey orbs must fall/fade, never glow gold; distant piglets stay slumped (no walking); no new elements.
- **Text / VO:** *"The tickles were gone. Every last one."* / "By morning, every last tickle was gone."
- **SFX/music:** near-silence — one sustained low string; the wind dies; a single sad music-box note.

### Shot 7 — The Hunger begins (end card, ends DOWN)

- **Motion prompt:**
  ```text
  Far away on a dark hill, a huge crowned pink hog king sits on a glowing golden hoard, patting his round belly and gloating, the gold light pulsing softly around him. In the foreground below, a tiny pink piglet seen from behind stays perfectly still, looking up at him. The grey valley between them is motionless except for slow drifting mist. Camera tilts up slowly from the piglet toward the distant glowing hill. The only warm light in the frame comes from the stolen hoard. Smug triumph, unresolved, storybook style.
  ```
- **Camera:** slow tilt-up from over Rosie's shoulder to the hill; end on the hill + empty sky (title space is the upper frame).
- **Must NOT change:** Rosie's back-view sprite must stay a simple back-of-head — the model must NOT invent a face on her; no celebration, no valley re-lighting, no warm color anywhere except the hoard; the Hunger stays distant (no zoom onto him past mid-frame).
- **Text (in edit):** *"The Great Hunger has begun."* → hold → CTA *"Help win them back."* / VO: "He has them all now."
- **SFX/music:** low comic-ominous tuba + soft heartbeat; a distant belly-pat thump; final single dark music-box note under the CTA; cut to silence.
- **⚠ Composition note:** Rosie's back-view is a minimal sprite blob — face-invention is the main failure mode; if two seeds fail, mask-freeze her region or Ken Burns.

---

## Consistency rules

1. **The start frame is the character reference.** Every clip generates from the composited PNG, so identity is inherited from pixels, not prompts. Never describe Rosie or the Hunger "fresh" in a motion prompt — describe only their *movement*.
2. **Reuse the same seed** (or Higgsfield's character/style reference feature, if the chosen model exposes it) across shots 3, 4, and 7 — the three Hunger shots — and across shots 2, 5, 6 — the three Rosie shots.
3. **Regenerate, don't prompt-fix.** If a take drifts (repainted barn, invented face, warmed palette), reroll the seed. Editing the prompt to argue with drift makes it worse; the prompts above already carry the negative constraints.
4. **Judge takes against the sprite GIFs** (`sprites/*.gif`): character motion should look like those loops — soft bobs, squash-and-stretch, no limb re-invention.
5. **Palette is plot.** Gold = shots 1–4 (draining at 4), grey = 5–7 (hoard-only gold at 7). Reject any take that violates the color arc, even if the motion is nice.

## Assembly (edit)

- **Clip order:** 1→7 as tabled; trim each 5s take to its final-cut duration, keeping the take's best motion window.
- **Transitions:** cross-dissolves (~0.3s) except: shot 2→3 = dip-to-dark riding the creeping shadow; shot 4→5 = dip-to-grey (this is the color-drain hinge — let the grey of 5 "infect" the tail of 4); shot 7 ends on a hold, no transition.
- **Text overlays in edit, not Higgsfield:** storybook serif, cream (#f8ead2-ish, match game type), lower third for shots 1–6; shot 7's title *"The Great Hunger has begun."* sits in the reserved upper sky, then the CTA *"Help win them back."* replaces it. Fade text in/out 0.25s.
- **VO:** record the 7 lines from the v2 board (warm storybook narrator); duck music −6dB under VO.
- **Audio bed shape:** warm music-box waltz (1–2) → sneaky comic vamp (3) → slurp + silence beat (4) → thin sparse piano (5) → near-silence (6) → low tuba/heartbeat + final dark note (7). The music "goes grey" at shot 5 with the picture.
- **Export:** 1080×1920 (9:16), H.264 + a ProRes master, 24 or 30fps constant, −14 LUFS. Deliverables: full ~30s marketing cut; the 7 individual loops (for `components/GreatHungerIntroModal.tsx` beat art later); a 15s cutdown (shots 1, 4, 6, 7) for ads.
- **Fallback per clip (Ken Burns):** if a shot won't animate cleanly in 3–4 seeds, use the still with a slow pan/zoom matching the tabled camera move, plus edit-side particle overlays (gold motes on 1–4, grey ash on 5–6, hoard glow pulse on 7). Shots 2 and 5 are the most likely to need this; shot 4's mote-stream can be animated as an edit-side overlay if the model won't flow it.
