---
name: pig-accessory-placement
description: Calibrate, author, preview, and verify equipped-item placement on animated pigs using the production resolver and Placement Studio. Use for hat or accessory fit, anchor, rotation, scale, layer, frame, loop, or transition work in this repository.
---

# Pig accessory placement

Use the established accessory pipeline; do not recreate placement math in a separate preview. Read `docs/placement-process.md` for the data model and command reference.

For visual changes, start or update the relevant Claude Design canvas with the project's established design system and concrete fit requirements. Use that output to guide the implementation and visual review. If Claude Design is unavailable, state the specific blocker rather than silently substituting a design tool.

## Workflow

1. Preserve existing baseline and before/after evidence. Run `npm run accessory:export` to capture the current production resolver without overwriting the baseline.
2. For item fit, use `npm run accessory:studio`. The official `tools/placement_studio.py` writer owns authored RelSpecs and `perAnim` overrides in `constants/hat_rel.generated.ts`; do not hand-edit the generated placement map. Treat its canvas as an authoring aid because its head preview can lag the measured per-pig runtime geometry.
3. Use `npm run accessory:calibrate` only when pig crown anatomy itself is wrong across items. Review the generated landmark diagnostics and source diff before keeping the result.
4. Run `npm run accessory:sheets` for all 48 source frames on every pig, or pass `--items` and `--pigs` for a focused iteration. This executes the real production resolver and is the frame-geometry verification truth. Inspect every affected frame rather than relying on the studio canvas or pivot math.
5. Run `npm run accessory:preview:build`, then `npm run accessory:preview:serve`. This production-renderer audit is the playback verification truth. Verify at the 300px game size, including loop seams, reaction transitions, reduced motion when relevant, side-facing art, and front/behind layering.
6. Run `npm run accessory:validate` before handoff. Record any remaining exception with item, pig, animation, and frame.

Prefer a base RelSpec when one fit works across poses. Add the smallest `perAnim` override when a distinct pose or side sprite demonstrably needs one. Preserve uniform image aspect unless the artwork intentionally calls for distortion. Keep other equipped categories in the review whenever shared playback, anchors, or layering change.

Generated contact sheets and previews are local evidence. Do not upload, publish, deploy, or change external services automatically.
