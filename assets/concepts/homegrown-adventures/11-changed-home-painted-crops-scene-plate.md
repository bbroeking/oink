# Painted remembered crops scene plate

Generated with the built-in ImageGen edit workflow on August 6, 2026.

## Inputs

- Edit target: `11-changed-home-pond-scene-plate.png`
- Approved gameplay reference:
  `end-to-end-flow/rosie-v3/11-changed-barn-next-day.png`

## Exact final prompt

```text
Use case: precise-object-edit
Asset type: character-free browser-game Farm scene plate
Input images: Image 1 is the exact edit target and must keep its camera, crop, geometry, pond, barn, paths, lighting, and dimensions; Image 2 is the approved storybook gameplay reference for how crops should feel rooted in soil.
Primary request: Edit only the middle and right foreground Kitchen Patch beds in Image 1. Paint a low, young Moonberry crop directly into the middle soil bed: several irregular leafy clusters with deep dusky-purple berries, integrated into the soil with natural occlusion and the same hand-painted storybook texture. Paint a newly sprouted Glowroot crop directly into the right soil bed: three small warm-gold bulb sprouts with soft luminous leaf tips, rooted in the dirt, restrained and readable rather than oversized. Keep the entire left soil bed exactly empty because its crop is composited separately at runtime.
Style/medium: Match Image 1 exactly: warm hand-painted storybook game art, subtle canvas texture, chunky readable forms, natural soil shadows, painterly edges.
Composition/framing: Preserve Image 1 pixel-for-pixel outside the three bed interiors, including the exact 853×1844 portrait framing and all object positions.
Lighting/mood: Calm bright farm morning. Crop highlights and shadows must match the existing sun direction. Glowroot may have a very soft localized golden glow only.
Constraints: No Rosie or any character. No frog changes. No UI, signs, labels, text, tools, baskets, or extra objects. Do not change the pond, crate, barn, trees, path, grass, flowers, bed borders, soil shape, or left bed. Do not move or resize anything. The middle Moonberries and right Glowroot must look painted into the same scene, not stickers or vector cutouts.
Avoid: flat vector shapes, thick black outlines, excessive bloom, duplicated beds, mature jungle-like crops, promotional composition, watermark.
```

The resulting PNG is 853×1844. Runtime code uses two registered clips from the
same plate so `bedTwoState` and `bedThreeState` reveal Moonberries and Glowroot
independently without repainting the rest of the Farm.
