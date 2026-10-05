# Matchmade play art

**Generation is done (2026-10-04): all 25 stickers are real art, none is a
placeholder.** Every PNG here started life as a copy of
`assets/images/glyphs/dig/bag.png` so the registry
(`components/play/playArt.ts`) resolved while boards were built. The Codex
ImageGen pass (`tools/gen_play_art.py`) overwrote each file in place with its
painted 256 px sticker, so no code path changed. A file byte-identical to
`dig/bag.png` would be a placeholder; `__tests__/multiplayer/playArt.test.ts`
fails on any that come back (and on any sticker that is not 256² RGBA with a
transparent box edge).

- Prompts: `PROMPTS.md` holds every attempt plus a review of what landed
  (21 on the first try; snout icon, die_3 and windup_arc after one retry,
  splat_big after two).
- Redo one: `python3 tools/gen_play_art.py --only <key>` (keys and groups are in
  the tool; `--dry-run` prints the prompt). Raws and the contact sheet live in
  `artifacts/play-art-2026-10-04/`, which is gitignored, so they exist only
  on the machine that ran the pass.
- The Rootle die is one family: every face is framed on the same body box and
  wears die_2's two sparkles. After regenerating die_2, run
  `--rekey --only dice` so the other faces pick up its sparkles.
- Board pieces drawn many times on one board are bare, with no gold
  sparkles: rail, post, pen_truffle and lane_post (lead, 2026-10-04). They
  were cut from their sparkled raws without regenerating, and they carry
  `sparkles=False` in the tool, so a future regeneration comes out bare too.
  The test checks they stay that way. Everything else keeps the house's two
  sparkles.
