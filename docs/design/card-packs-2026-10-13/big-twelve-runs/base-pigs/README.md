# Big Twelve — Base Pigs

Completed private Claude Design PROMPT 1 for Rosie, Copper, Pepper, Bandit, Pickles and Biscuit. Only the owned Base Pigs page and this directory were changed. The source is [Big Twelve — Base Pigs](https://claude.ai/design/p/aec2145f-9fe2-4416-ab82-50c0100f537d?file=Big+Twelve+-+Base+Pigs.dc.html); its exact downloaded export is `Big Twelve - Base Pigs.dc.html`. Supporting assets preserve the export’s relative paths. `support.js` is copied from the retained Six Static Layouts export; fonts load from Google Fonts.

The selected E architecture is retained: 96px upper-corner Cheer, dominant original pig sprite, diagonal pasture-to-cream transition, bold name below the art, and continuous 3px cocoa perimeter with 14px corners. Sprite widths are 172–184px, uniformly scaled with aligned hooves. The pasture edge is 16px higher than E and the text stack is 6px higher, giving the longest rules 8px above the collector footer. Names stay 42px Caprasimo; rules stay 15px/22.5px Nunito. Original anatomy and markings are preserved.

The six faces retain the current digital prototype’s catalog-authored Legend records: all start at 12 Cheer; Rosie has Loadout Instinct, Copper Trail Charge, Pepper Gentle Giant, Bandit Beltline Feint, Pickles Orchard Nose, and Biscuit Stouthearted. Source authority is `docs/design/card-packs-2026-10-13/three-card-refinement.md` and `features/cards/data/catalog.generated.ts`. These records share their origin with printed Legends and are not approved adventure rules. The canvas explicitly says “Current prototype catalog rules · adventure adaptation TBD.” No Rank/Training, Hedge Run values, translated co-op rules, new deck size, permanent draft rewards or solo/co-op scope were introduced. The old co-op Rosie E reference remains unchanged in its original page.

All six local sprite files are byte-for-byte copies of `assets/images/sprites/{pig}/idle_1.png` (370×383); `art-provenance.json` records hashes and decoded pixel equality. Rosie and Pepper reuse the existing Claude original references; the missing Copper, Bandit, Pickles and Biscuit sprites were uploaded as exact originals. The homestead background is copied from the already-verified Six Static Layouts export. No artwork was generated or modified.

## Verification

`six-base-pigs-320.jpg` shows the full six-card sheet at actual 320×448 faces. `six-base-pigs-393.jpg` shows the complete narrow stacked presentation, and `claude-design-final.jpg` records the private editor. Measurements in `verification-desktop.json` and `verification-393.json` confirm all six faces remain 320×448, all text stays inside the perimeter, original image ratios are preserved, every image loads, complete three-line Pepper/Bandit/Pickles rules remain at 15px/22.5px, the shortest rules-to-footer gap is 8px, and the 393px viewport has a 393px document width with no horizontal overflow. Full-size names/titles/abilities and all six narrow faces were visually checked. One focused spacing correction was made; there were no background review loops.

To preview this exact export locally:

```sh
python3 -m http.server 6435 --bind 127.0.0.1 --directory docs/design/card-packs-2026-10-13/big-twelve-runs/base-pigs
```

Then open `http://127.0.0.1:6435/Big%20Twelve%20-%20Base%20Pigs.dc.html`.

No production app code, tokens, gameplay, API, database, release files, builds, deployment, public sharing or paid account changes were made.
