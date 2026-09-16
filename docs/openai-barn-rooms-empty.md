# Barn room backgrounds, empty — ImageGen brief

Target: the three Barn Interior rooms (`assets/images/habitat/{warm_plank_barn,spring_whitewash,midnight_rafters}.png`, 780×1688, drawn into the 390×844 `HabitatScene` canvas). Each is regenerated **completely empty** — walls, beams, floor and light only — from the current room as its layout reference.

**Ran 2026-09-16 through the Codex CLI ImageGen lane** (`codex exec --enable image_generation -i <current room> -` with the prompt on stdin, one process per room, `-C` into `docs/reviews/barn-rooms-empty-2026-09-16/<room>/`). Prompts + logs + raw 853×1844 outputs live there; v2 sources are `assets/images/habitat/source/imagegen-<room>-empty-v2.png`. One run hung in the image tool for 13 minutes with no output — kill and re-run rather than wait. The ChatGPT-in-Chrome form below is kept for the day the browser lane is wanted (refs in `~/Desktop/ttp-refs/barn-rooms/`, one drag covers all three batches).

Post-process: `scripts/habitat/import-room.sh <room> <output.png> [version]` — center-crops to 780:1688 (a no-op for Codex's 853×1844; ChatGPT's 1024×1536 loses its outer strips), writes the versioned source, repoints `generate-art.mjs`, rebuilds the room + thumbnail. `generate-art.mjs` re-renders every SVG asset too, and ImageMagick is not byte-stable — `git checkout` any unrelated PNGs it touches.

## Style anchor (paste once)

```
You are painting room backgrounds for "Tickle the Pig", a cozy storybook mobile game. I have attached three images: they are the game's three current barn rooms, in this order — (1) Warm Plank Barn, (2) Spring Whitewash, (3) Midnight Rafters. Each is a barn interior seen straight on: vertical plank walls, exposed roof beams meeting in a peak at the top, a framed back-wall panel with a horizontal beam, a small window or opening high on one wall, and a plank floor filling the bottom half. Rendering style: painterly storybook, soft watercolor-like fills, warm dark ink lines on boards and beams, gentle light, no photorealism.

I will ask you to repaint each room, one at a time, as a COMPLETELY EMPTY BACKGROUND. The rules for every one:
- Keep the same camera, the same composition, the same wall structure (planks, beams, peak, the framed back-wall panel, the window opening) and the same floor and light as the attached room.
- Nothing is in the room. No furniture, no shelves, no cupboards, no crates, no hay, no tools, no rugs, no lanterns, no hanging objects, no flowers or vines, no scattered objects, no animals, no people, no vehicles. Bare walls, bare beams, bare floor.
- Tallest portrait canvas you can produce. The picture will be cropped to a tall phone screen, so keep the important architecture (the peak, the back-wall panel, the window, the floor) inside the central 70% of the width; the outer strips are just more wall.
- No text, no labels, no borders, no watermark, no vignette frame.
Reply "ready" and wait.
```

## Batch 1 of 3 — Warm Plank Barn

```
Repaint attached image (1), Warm Plank Barn, as a completely empty background. Same camera, same composition, same honey-gold vertical plank walls, same broad roof beams meeting in a peak, same framed back-wall panel with its horizontal beam, same small window on the upper left with its warm shaft of afternoon sunlight across the wall, same sunlit plank floor filling the bottom half with a soft pool of light. Nothing stands or hangs in the room: no furniture, no shelves, no crates, no hay, no rugs, no tools, no objects, no animals. Only walls, beams, window light and floor. Tallest portrait canvas. No text.
```

## Batch 2 of 3 — Spring Whitewash

```
Repaint attached image (2), Spring Whitewash, as a completely empty background. Same camera, same composition, same fresh whitewashed cream vertical planks, same sage-green roof beams meeting in a peak, same framed back-wall panel with its horizontal beam, same small window on the upper left with soft spring daylight on the wall, same pale plank floor filling the bottom half with a soft pool of sunlight. REMOVE the pink blossoms and climbing vines from the beams — the beams are plain painted wood. Nothing stands or hangs in the room: no furniture, no shelves, no crates, no rugs, no flowers, no garlands, no objects, no animals. Only walls, beams, window light and floor. Tallest portrait canvas. No text.
```

## Batch 3 of 3 — Midnight Rafters

```
Repaint attached image (3), Midnight Rafters, as a completely empty background. Same camera, same composition, same moonlit indigo-blue vertical plank walls, same deep-blue roof beams meeting in a peak, same framed back-wall panel with its horizontal beam, same open gable between the rafters showing the night sky with the full moon, same cool moonlight falling onto the wall, same dark blue plank floor filling the bottom half with a soft pool of moonlight. Nothing stands or hangs in the room: no furniture, no shelves, no crates, no rugs, no lanterns, no hanging objects, no objects, no animals. Only walls, beams, moonlight and floor. Tallest portrait canvas. No text.
```
