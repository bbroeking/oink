# Wallow rank sheet — design round, 2026-09-21

Canvas: https://claude.ai/artifact/2CWhqfXMHDjkDBtgUnUz55 (Today · A ladder · B now & next · C portrait).
Boards + `index.html` review page come from `gen.py`; `--dc blobs.json` exports the artboards
(`project/`, gitignored art via `/_blob/` uploads). Subject: `WallowRankBody` in `components/Account.tsx`.

Recommendation on the canvas: **A, with C's ghost ring**. One new data need: the pass XP on the Me tab.

## Page 2 — Prestige gear rethink (same day)

`gen2.py` adds page "2 · Prestige gear": the grant map (what a Wallow gives today and where each gift lives),
then **D regalia / one home**, **E one crown that grows**, **F the Barn's Wallow shelf**. Recommendation on the
canvas: **D**. Sources: `constants/hats.ts` (wearables), `constants/habitat.ts` (Barn gifts + keepsakes),
`components/ui/PrestigeAvatar.tsx` (rings), migration `20260779000000` (rank → wearable).
