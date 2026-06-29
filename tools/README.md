# Placement Studio

One tool for all cosmetic placement — **item anchors** (where each item sits on
the pig) and **pig anatomy anchors** (the body points items attach to).

```bash
python3 tools/placement_studio.py
open http://127.0.0.1:8124/
```

**Items mode** — pick any item (auto-discovered from `assets/images/hats/` +
the members catalog; no hardcoded list). Filter to **Untuned** to see exactly
what still needs work. Drag the pivot on the item, click a pig anchor dot, set
width + "render behind". Live on-pig preview uses the real `PigStage.resolveSlot`
math. Autosaves to `constants/hat_rel.generated.ts` (rebuild-all, sorted — never
drops an entry, even ones whose art lives outside `hats/`).

**Pig anatomy mode** — drag the 11 body anchors per animation/frame (onion-skin
to check coherence). Autosaves `PIG_FRAME_ANCHORS` in `constants/hats.ts` and
keeps `REST_ANCHORS` in lockstep with `idle[0]` automatically.

Replaces the retired tools: `item-anchor.html` + `anchor-server.py`,
`item-anchor/` (serve.py), and `anchor-editor/`.

## Related

- `scripts/compute_overlays.py` — emits the **legacy** `HAT_OVERLAYS` only for
  items WITHOUT a RelSpec (full-canvas + tuned items are skipped). As you tune a
  legacy item in the studio it gains a RelSpec and drops out of that file.
- `scripts/pig_preview.py` — bakes on-pig preview PNGs for the review gallery
  (`scripts/factory_server.py`, the image-generation factory).
