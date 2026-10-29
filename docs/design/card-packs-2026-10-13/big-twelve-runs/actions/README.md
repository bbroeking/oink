# Big Twelve — Actions

Completed private Claude Design PROMPT 2 exploration. Brief dated 2026-10-13; final verification 2026-10-14.

- [Live owned canvas](https://claude.ai/design/p/aec2145f-9fe2-4416-ab82-50c0100f537d?file=Big+Twelve+-+Actions.dc.html)
- Exact final downloaded source: `Big Twelve - Actions.dc.html`
- Desktop evidence: `actions-local-desktop.jpg` (complete comparison) and `actions-desktop-320.jpg` (Claude Design context at 100% zoom).
- Narrow evidence: `actions-narrow-390.jpg` (complete stacked page) and `actions-narrow-long-title.jpg` (full longest-title face).
- Measurements: `layout-checks.json`; immutable-source hashes: `provenance.json`; supplied prototype records: `catalog-facts.json`.

One consistent Action composition puts 30px Caprasimo names first, a compact sun-colored Energy badge in the upper corner, exact dynamic illustrations through a 234px slanted band, and the immediate effect in the lower third. The shared cream, cocoa, typography and rectangular perimeter relate it to Big Twelve, while its reading order and proportions distinguish it structurally from the Pig layout. The title area is 80px tall; the rules start at 326px. Action type labels are 15px Nunito.

Action effect text is copied verbatim from the current digital prototype catalog (`features/cards/data/catalog.generated.ts`), whose authority is documented in `docs/design/card-packs-2026-10-13/three-card-refinement.md`:

| Card | Supplied prototype effect |
| --- | --- |
| Snoot Boop | Deal 2 damage to an Enemy, then restore 2 Cheer. |
| Big Wind-Up | Your Legend's next attack this turn gets +2 Bash. |
| Duck Into the Mud | Before your next turn, prevent the next 2 damage to your Legend. |

Energy costs remain TBD: the catalog's Rank was not converted into Energy. The outside note identifies the effects as current prototype catalog content and states that adventure adaptation remains TBD. No Rank, Training, style, rarity, Hedge Run or co-op effects were added to the Action faces. Rosie is an unchanged E Big Twelve visual reference with historical co-op text explicitly identified outside its face; it is not the rules authority for Actions.

All four faces measured exactly 320×448, with 3px cocoa borders and 14px corners. Nunito rules measured 15px/22.5px. All text remains inside each perimeter, all artwork loaded, and Action rules have 13.25px clearance above their footers. The 390px viewport measured 390px scroll width with fixed-size stacked cards. The longest title wraps safely onto two lines. Original Action scenes use uniform cover scaling and art-window crops; the principal pigs' ears, faces and visible hooves remain intact. Rosie retains its unchanged natural aspect ratio. Source comparison confirms the complete Rosie card markup is identical to E. All five packaged artwork files are byte-identical to supplied originals/reference exports.

The initial design treated catalog effects as historical-only and used TBD. A focused catalog correction restored the supplied current prototype text. Its shortened art band clipped parts of the pigs, so a final coordinated header/rules adjustment restored the original 234px artwork crops. Final screenshots and measurements above apply to this corrected version.

Initial simultaneous new-chat submissions collided with Claude Design's project-wide active conversation selection. Final corrections used a dedicated Actions conversation and stable controls. Only the owned Actions canvas was edited by this pass; baseline files were read-only. Submitted prompts are preserved in this directory. Claude reported a background check despite instructions to avoid one; acceptance here relies on the lead's actual foreground measurements and screenshots, not that unverified report.

To preview the exact export and packaged relative dependencies:

```sh
python3 -m http.server 6392 --bind 127.0.0.1 --directory docs/design/card-packs-2026-10-13/big-twelve-runs/actions
```

Open `http://127.0.0.1:6392/Big%20Twelve%20-%20Actions.dc.html`. The unchanged export loads fonts from Google Fonts. `support.js` is a copied baseline preview runtime.

No production app code, tokens, gameplay, API, database, build or release files were changed by this pass. No deployment, publishing, public sharing or paid upgrade occurred. These are static design checks, not production app acceptance.
