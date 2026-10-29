# Spooky Snouts gallery

Surface mode: Experience. Extend the established cream paper, lilac, cocoa outline and Caprasimo/Nunito game design system. Keep actual art and animated Rosie as the focus; ownership controls belong to the separate fitting room.

Open the single page at http://127.0.0.1:4320/?view=halloween. The existing card preview also has an **All Halloween items** button. Expo has a development-only `/halloween-gallery` route; production redirects follow the existing prototype boundary.

To rebuild and serve locally:

```sh
node scripts/prototypes/card-packs/build.mjs
python3 -m http.server 4320 --bind 127.0.0.1 --directory artifacts/card-packs-preview
```

## Content and behavior

All 49 canonical seasonal identities appear without an ownership filter: 11 live costume previews, 29 wearable cards and 9 place cards. The latest five costumes lead the gallery with New markers. Names, numbers, categories and card images come from the existing catalog and generated art registry. Search accepts names or printed card numbers. The separate gallery entry reads no saved album and grants/equips nothing.

The [existing Claude Design canvas](https://claude.ai/design/p/aec2145f-9fe2-4416-ab82-50c0100f537d?file=Halloween+-+Spooky+Snouts.dc.html) guided the 1120px content width, large selected viewer, three-column costume layout, compact printed-card grid, wrapping 44px filters and 16px phone margins. Its concept uses an explicitly labelled bob stand-in; runtime uses the actual 12 source PNG frames instead. The canvas also labels unconfirmed numbers; runtime always uses authoritative catalog numbers. `claude-gallery.png` records the design reference.

One `useCostumeGalleryPlayback` clock drives all 11 costume stages and the larger selected viewer. `CostumeRosieStage.frameIndex` controls the existing source sprite and crown-following hood together; the registered romper layer remains separate. The source pig art, attachment landmarks and authored clothing geometry are unchanged. Original Rosie removes only the selected viewer's two clothing layers, keeping the same source frame.

Play/Pause affects every preview. Pause preserves the current frame; stepping pauses and wraps 12→1 or 1→12; Play resumes from the inspected frame. Backgrounding stops the clock and preserves manual pause. Reduce Motion stops automatic playback at frame1 and leaves manual inspection available. Filtering to a category with no costume stops costume playback.

## Verification — 2026-10-15

- 49 unique item nodes verified in browser; filters produced 11 costumes, 29 wearables and 9 places. Search049 returned Marshmallow Boo only. No broken loaded images remained.
- A live 12-frame sweep inspected all 12 stages (11 costumes plus selected viewer) at each frame: every stage used the identical source-frame index and three separate image layers. `frames/evidence.json` records labels, source URLs and geometry. The larger viewer is360px, with the unchanged source pig300px. Inspected `linen-lurker-contact-sheet.png` and saved the actual source-frame playback GIF.
- Normal6fps playback sampled20 times across approximately4.4seconds; all12 stages stayed in sync through loops. `playback.json` contains timed observations.
- Original comparison left exactly one source image at the same frame. Costume selection/unequip, controlled stages, pause/resume, manual wrap and reduced-motion behavior are covered by regressions.
- Desktop1000px and phones393px/320px were checked. All four filters wrap at44px height, and the viewer, input and item tiles remain inside the screen. Temporary viewport overrides were reset. Screenshots in this directory are browser evidence, not native device acceptance.
- Seven focused Jest suites passed31 tests. The two new gallery suites also passed8 tests with `--detectOpenHandles`; their Sentry mock prevents an unrelated SDK cleanup interval and no open handles remain. TypeScript and scoped ESLint passed. See `tests.txt` and `open-handles-check.txt`.
- `quality:loop` could not watch because of EMFILE. `quality:check` still fails the existing locked contracts: text clamps138/91 and the default-role revoke on `my_drives()`. See `quality-check.txt`. These failures were not suppressed.

## Remaining animation exceptions

Every one of the11 costumes is accepted here only for Rosie's12 front-idle frames. Every non-idle Rosie family/frame (including happy, jump, wave, walk and turned poses), transitions into those families, and every frame on other pigs still needs its own authored fit/occlusion verification. The gallery does not present those families as supported. Native device acceptance and live wardrobe integration remain pending as recorded in the production readiness report.
