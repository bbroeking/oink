# Generating Pig Parts for Rive

Honest framing first: **diffusion models do not reliably separate body parts**. They were trained on whole creatures. Asking for "pig head, no body" produces a full pig 70% of the time. The prompts below mitigate this but you should plan for manual cleanup in Photopea before importing to Rive editor.

There are two viable paths. **Read both before picking one.**

---

## Path A: ChatGPT "exploded anatomy sheet" (experimental)

Ask for a SINGLE image showing all parts laid out separately. This works better than "pig head only" because the model is producing a *diagram*, which exists in its training data (Pinterest character anatomy posters, art reference sheets, etc.).

Then you slice the result into individual PNGs and import each as a Rive part.

### Prompt — paste into a fresh ChatGPT conversation

```
Create a character anatomy reference sheet for a chubby pink cartoon
pig, similar to a children's storybook anatomy poster. Show each
body part isolated and laid out in a grid against a TRANSPARENT
background, with NO connecting lines, NO labels, NO text, and
no character body assembled together. Each part is its own
standalone illustration:

Row 1 (head section, left to right):
1. Head silhouette (no ears) — round head with eyes, snout, mouth,
   blush cheeks, soft smile
2. Left ear (the pig's left, viewer's right) — soft pink ear shape
   with darker pink inner
3. Right ear — mirrored
4. Snout disk only — pink oval with two black nostrils
5. Mouth/smile only — small upturned line with pink interior

Row 2 (body and limbs):
6. Body silhouette (NO head, NO ears, NO limbs, NO tail) — just
   the chubby pink torso oval
7. Front-left leg
8. Front-right leg
9. Back-left leg
10. Back-right leg
11. Tail — small pink curly spiral

Style: flat children's storybook illustration, bold ~3px black
outline, soft pink palette (body #F8B9C6, inner ear #F4A5B6,
cheeks/snout #EF8FA4, hooves #6D4C41). No shading gradients.
Identical line weight and color across every part.

CRITICAL: each part is FULLY ISOLATED on TRANSPARENT background.
No part touches another. No body parts are stacked or combined.
No assembled pig anywhere in the image. NO LABELS, NO TEXT,
NO ARROWS. Pure transparent PNG with alpha channel — no white
fill, no gradient, no vignette. Just the 11 parts on transparent.

Layout: 2 rows of 5-6 parts, total image 1536×1024 px.
```

### What to expect from this

- Best case: a clean exploded-view sheet you can slice into 11 PNGs
- Realistic: 2-3 of the parts will come back with extra body context (e.g., the "head only" cell still has neck stub showing). Open in Photopea → erase the bits that shouldn't be there.
- Worst case: ChatGPT returns one fully-assembled pig anyway. Reroll.
- Plan for 1-2 reroll attempts before getting something usable. About ~$1 in API or 10 min in ChatGPT Plus.

### After generation

Drop the PNG in `~/Downloads/ttp_anim/parts.png` and tell me. I'll add a slicer entry that splits it into the 11 named parts.

---

## Path B: cut idle_1.png in Photopea (reliable)

The existing pig sprite already has all the parts, just merged into one layer. Cutting them apart by hand in Photopea takes ~1-2 hours but produces guaranteed-clean parts ready for Rive.

The walkthrough is in `docs/photopea-pig-cutting.md` (still in the repo). Steps in summary:

1. Drag `assets/images/sprites/rosie/idle_1.png` into [photopea.com](https://www.photopea.com)
2. Use the Polygonal Lasso to trace the outline of each part
3. `Cmd+Shift+J` cuts the selection into a new layer
4. Paint in the body color where each part used to overlap (so the body underneath the head silhouette is still complete — Rive needs each part to be standalone)
5. Export each layer as a transparent PNG into `pig-parts/`

This is the path that actually ships. The ChatGPT path is a shortcut attempt.

---

## What's restored from git for the Rive plumbing

- `rive-react-native@9.8.3` reinstalled in node_modules + pods
- `components/ui/RivePig.tsx` — drop-in component with `customFrames` API and stub fallback
- `docs/rive-pig-rigging.md` — end-to-end Rive editor guide (skeleton hierarchy, slot definitions, state machine, animations, export)
- `assets/rive/` folder created (empty — drop `pig.riv` here when exported)

When you have a `.riv` exported from the Rive editor, the swap from `<SpritePig>` to `<RivePig>` in `SwipeElement.tsx` is two lines.

---

## Honest recommendation

If you're committing 1-2 weeks to Rive, do the manual Photopea cut. ChatGPT will eat your morning and still produce parts you have to manually clean up.

If you're just curious whether Rive is worth it, try the ChatGPT prompt first — if it produces something usable you've saved hours. If not, you've burned 30 minutes confirming the manual path.
