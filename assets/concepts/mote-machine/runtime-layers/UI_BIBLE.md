# Mote Alchemy UI Bible

Status: locked from the approved 2026-08-14 version 2 master.

## Source of truth

- Canvas: 390 x 844 logical points.
- Ready master:
  `../alchemy-master/mote-alchemy-ready-390x844-v2.png`
- State comparison:
  `../alchemy-master/mote-alchemy-state-comparison-v2.png`

## Locked style stem

Tickle the Pig paper-craft game UI. Warm cream paper, pastel rose, lilac, sun
yellow, sage, peach, bark brown, and dark-brown ink. Friendly rounded pig
forms. Two-to-three-pixel ink outlines. Small hard offset paper shadows with no
blur. Simple watercolor fill and subtle paper grain. Cozy storybook workshop.
Large readable silhouettes. Caprasimo-like display title and bold rounded
labels. Special and magical, but part of the same game.

Do not use photorealism, cinematic 3D, glossy metal, ornate fantasy engraving,
steampunk complexity, a heavy black surface, casino lights, reels, paylines,
fruit, coins, jackpot copy, a pull lever, tiny decoration, or full-screen frame
animation.

## Locked composition

1. Native back control at the top left.
2. Live Mote count at the top right.
3. Live title centered below the top safe area.
4. One friendly pig-shaped cabinet.
5. One large central chamber.
6. Three control groups in one row: Warmth, Whirl, and Resonance.
7. One large reaction plunger.
8. One output tray.
9. One live status line above the bottom safe area.

## Runtime ownership

- Static raster: workshop plate and paper-craft material plates.
- Rive raster groups: cabinet shell, chamber frame, pipes, three knobs,
  reaction plunger, output tray, and Mote.
- Rive vectors and masks: glass, liquid, chamber clipping, hit areas, glow,
  reaction streams, sparkles, press feedback, result panel, and fizzle.
- Live Rive text: title, Mote count, control labels, action, cost, status, and
  confirmed result.
- Native and server: selected control values, request state, Mote debit,
  confirmed reward, persistence, recovery, accessibility, and announcements.

## State rules

- Ready: calm Mote, quiet liquid, empty tray, controls available.
- Active: 3-to-5-second sustained reaction. Mote remains visible until the
  resolve phase. Tray remains empty. No result appears early.
- Success: Mote is gone. A simple lilac-and-rose paper-magic bloom leads to the
  confirmed live result in the tray.
- Failed: Mote is gone. Chamber and tray are empty. One faint wisp fades. There
  is no residue or consolation item.
- Reduced Motion: use a short opacity and color settle. Do not use a large
  vortex, cabinet shake, or large translation.

## Extraction rules

- All parts use the 390 x 844 registration coordinate system.
- Do not bake changing text, balance values, result values, or state copy into
  runtime images.
- Keep alpha padding around irregular parts.
- Keep all pivots and bounds in the registration manifest.
- Keep texture edges at or below 2048 pixels.
- Do not use the full-screen state images at runtime.
