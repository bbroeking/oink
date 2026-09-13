# Barn background options

Three empty interior base plates for the Barn screen. Each is a full-bleed portrait raster with timber architecture and a bare wood floor, leaving the room open for separately rendered characters and objects.

| Option | Source asset | Character |
| --- | --- | --- |
| Warm Timber | `warm-timber.png` | Honey-brown boards and warm oak tones. |
| Whitewashed | `whitewashed.png` | Pale creamwashed walls with a light natural-oak floor. |
| Weathered Wood | `weathered-wood.png` | Muted gray-brown boards with a clean rustic feel. |

The delivered PNGs are 887×1774 RGB rasters. The exact generation prompt for each option is beside its source image as `<name>.png.prompt.txt`; the same prompt is also embedded in the PNG metadata. They were generated with the built-in image generator and contain no props, animals, furniture, text, or exterior view.

## Choose a base

Open [the standalone chooser](../../../docs/barn-background-options.html) while serving the repository root, for example:

```sh
python3 -m http.server 4178 --bind 127.0.0.1
```

Then visit `http://localhost:4178/docs/barn-background-options.html`. The chooser offers preview, source open/download links, explicit confirmation, and a versioned localStorage choice (`tickle-the-pig:barn-background-preview:v2`). It does not change a game setting or database value. No base has been selected yet.

When a base is selected, use the corresponding source PNG here as the integration asset. The mirrored copies in `docs/assets/barn-background-options/` exist for the chooser only. The preview uses the existing web token and sticker styles; the project’s cozy, hand-made, warm design canon remains unchanged.
