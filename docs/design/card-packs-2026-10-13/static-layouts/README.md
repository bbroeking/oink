# Six Static Layouts

Private Claude Design exploration of six static co-op card compositions: **Quiet Margin**, **Open Field**, **Cameo**, **Field Band**, **Big Twelve**, and **Spine**. This is an ordinary extension of the current Tickle the Pig design language, not an approved new design world or a change to the canonical tabletop catalog.

- Source canvas: [Six Static Layouts](https://claude.ai/design/p/aec2145f-9fe2-4416-ab82-50c0100f537d?file=Six+Static+Layouts.dc.html)
- Exact export: `Six Static Layouts.dc.html`
- Evidence: `six-layouts-desktop.jpg` and `six-layouts-mobile.jpg`
- Supporting files: `support.js`, `art/coop/sprites/rosie-idle_1.png`, and `art/maple/homestead_barn.jpg`

Every concept is 320 × 448 and prints identical test content: Rosie; 12 Cheer; Legend; Loadout Tactician; “Once per round, after you play a Support card, draw 1 card, then discard 1 card.”; and “No. 001 · Co-op test rules.” The same 370 × 383 Rosie sprite is uniformly scaled in every layout. Decoded RGBA comparison confirms that the exported Rosie and homestead art preserve the originals at `assets/images/sprites/rosie/idle_1.png` and `assets/images/backgrounds/homestead_barn.jpg`; file metadata hashes differ.

The cards reuse the established cream/paper, cocoa ink, warm rose, and illustrated-pasture vocabulary. Display type is Caprasimo; rules are Nunito at 15px/22.5px; footers are Patrick Hand. The text accent is the corrected `#a03e2f`. D’s band crosses only Rosie’s hoof tips, and F’s spine crosses only her tail tip. The exploration includes no shelf, room, box, 3D, or motion treatment.

Desktop and 390px mobile evidence confirms all six cards at 320 × 448 with no mobile overflow. The scoped follow-up review in `review.json` marks both previously reported findings resolved and gives a `ship` disposition; it was limited to foreground layering and text-safe accent, not a fresh whole-surface review.

Preview locally:

```sh
python3 -m http.server 6367 --bind 127.0.0.1 --directory docs/design/card-packs-2026-10-13/static-layouts
```

Then open the URL-encoded `Six%20Static%20Layouts.dc.html` route. Fonts currently load from Google Fonts.

No production app code, API, gameplay, tokens, database, build, or release-quality gate changed. Known pre-existing drift remains untouched: `.impeccable/design.json` still records accent `#c25a3f`, while generated `DESIGN.md` and this export use `#a03e2f`.
