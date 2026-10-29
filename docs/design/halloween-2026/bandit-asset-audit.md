# Bandit asset audit — Halloween workshop

Date: 2026-10-14

## Recommendation

Use `assets/images/pigs/normalized/bandit-v2.png` for the static Bandit portrait in the Halloween workshop preview.

This is the approved static roster portrait already registered by `components/ui/PigPortrait.tsx`. It matches the current Bandit identity used by the shipping animation frames: warm painted brown coat, cream forehead blaze and hooves, amber-brown eyes, and soft dimensional shading.

For any animated preview, use the shipping frames under `assets/images/sprites/bandit/` through the existing pig renderer instead of animating the standalone portrait. The live game sprite pack remains authoritative for body shape and motion.

## Current wrong reference

The only direct reference to the stale asset found in the Halloween/card prototype surfaces is:

- `components/prototypes/card-packs/HalloweenWorkshop.tsx:218` requires `assets/images/pigs/normalized/bandit.png` for the friend-visit / Little Haunt preview.

No other Halloween or card-prototype source references `normalized/bandit.png`. The base-set Bandit card uses separate full art (`assets/images/trading-cards/full-art/bandit-full-art-v1.png`), and its catalog identity reference is the shipping `assets/images/sprites/bandit/happy_1.png`; neither is the source of this preview defect.

## Asset evidence

| Asset | Dimensions | Current role | Visual identity |
| --- | ---: | --- | --- |
| `assets/images/pigs/normalized/bandit.png` | 370 × 383 RGBA | Stale direct require in Halloween workshop | Near-black/charcoal flat rendering, stark white blaze and socks, thin noisy outline |
| `assets/images/pigs/normalized/bandit-v2.png` | 370 × 383 RGBA | Approved static Bandit portrait in `PigPortrait` | Warm brown painted rendering, cream blaze and hooves, dimensional shading |
| `assets/images/sprites/bandit/idle_1.png` | 370 × 383 RGBA | Shipping front idle frame | Warm brown/cream painted identity matching v2's palette and rendering family, with canonical game-rig anatomy |
| `assets/images/sprites/bandit/happy_1.png` | 369 × 394 RGBA | Shipping happy frame and catalog identity art | Warm brown/cream painted identity matching the current animation pack |
| `assets/images/pigs/masters/bandit.png` | 1254 × 1254 RGBA | Standalone high-resolution concept/master | Separate concept asset; not authoritative for live anatomy |

`components/ui/PigPortrait.tsx` explicitly maps Bandit to `normalized/bandit-v2.png`. Its comment identifies the `-v2` recruit images as approved authored masters normalized to the roster portrait canvas. The card design body-reference note (`docs/design/card-packs-2026-10-13/co-op/game-body-reference/README.md`) separately establishes `assets/images/sprites/{pig}/` as the live-game anatomy source of truth and says roster portraits and standalone masters do not override it.

The inspected assets were all introduced in repository commit `836db6f166b4dac4b50c2ece50c3ae9c4be5a5ff` (`checkpoint: publish game, art, release, and tooling workspace`, 2026-08-01). Git history therefore does not expose earlier generation lineage or a later replacement commit. Present source usage and pixel inspection provide the actionable provenance: `bandit-v2.png` is the approved portrait, while `sprites/bandit/*` is the production animation family.

## Artifact check

`normalized/bandit.png` does **not** contain enclosed fully transparent holes. A four-connected alpha scan found zero transparent components isolated inside its silhouette. It does contain a visible opaque white triangular tear/speckle at the inner edge of the upper-left ear, plus a rough dotted/jagged contour and flatter near-black rendering. The preview defect should therefore be described as stale/wrong artwork with opaque edge artifacts, not as an alpha hole.

For comparison, the old portrait has 6,001 partially transparent edge pixels; v2 has 2,784. That count supports the visibly noisier old contour but is not itself a quality score.

## Has frame 1 adopted v2?

Yes in identity and style, but not as a literal derivative. Both inspected production frame-1 images (`idle_1.png` and `happy_1.png`) already depict the warm brown/cream, softly shaded Bandit associated with v2. Their pixels, dimensions, and poses differ from `normalized/bandit-v2.png`, so v2 should not be claimed as the animation source image. `assets/images/sprites/bandit/happy_1.png` is byte-for-byte identical to the corresponding authored export at `assets/images/sprites-authored/bandit/happy_1.png`, which confirms that the current production frame is the authored painted version.

## Animation risk

Replacing the workshop's single static image with v2 is low risk and aligns that preview with the current roster portrait. If the workshop later animates Bandit by mixing v2 with the stale `normalized/bandit.png`, the character will visibly flash between charcoal/white flat art and brown/cream painted art. If it mixes v2 with production sprite frames, palette and rendering style remain coherent, but silhouette and pose proportions can still pop because v2 is a standalone portrait while the animation frames follow the canonical common rig. An animated implementation should render one complete sequence from `assets/images/sprites/bandit/` rather than treating v2 as frame zero.
