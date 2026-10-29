# Five more costumes and the one-time login gift — 2026-10-14

Implemented content: Linen Lurker, Starspell, Bat Nap, Little Imp and Marshmallow Boo, SSN 045–049. The set has 49 cards, 11 full-body costumes, 29 modular wearables and 9 backgrounds. Existing identities 001–044 remain stable. Cards use the shared CollectibleCard and official 49/49 raster registry. Marshmallow Boo v1 had extra ghost-eye patches; corrected v2 is selected, preserving one real pig face.

The existing [Claude Design canvas](https://claude.ai/design/p/aec2145f-9fe2-4416-ab82-50c0100f537d?file=Halloween+-+Spooky+Snouts.dc.html) was updated using the established cocoa/lilac/cream design system, card geometry and fonts. See `claude-drop3-login-gift.png`; runtime uses separate transparent hood/romper art around the unchanged Rosie source frame. Concept art does not certify runtime fit.

## Visual verification

- Saved all 60 front-idle frames at a 360px fitting stage, containing the normal 300px source pig. Five 4×3 contact sheets and full viewport screenshots are in `drop3-fit-frames/`; `evidence.json` records the exact frame, stage rectangle and three layer URLs. Initial scrolled second-frame screenshots were recaptured with the stage fully visible. No game sprite pixels were edited to assemble these QA contact sheets.
- Inspected all five contact sheets. Hood follows measured crown translation, tilt and scale on the same clock as the source sprite; short romper leaves the real hoof tips visible. Source expressions remain legible through face windows. No jump or detached layer was observed within this supported idle family.
- Played each suit at tempo 1 for approximately 4.3 seconds, crossing the 12→1 boundary twice. `drop3-fit-playback.json` records 16 timed samples per suit. Source, hood and body stayed aligned through loops.
- Phone 320×740: fitting stage is 280px (source about233px), bounded x20..300; Try on Starspell succeeds only after the saved gift owns it. Other four remain locked while freely previewable. Reduce motion settles to idle frame1. Temporary viewport override was reset.
- Gift content tested on 393px phone preview. Production modal stage uses an available-width calculation (230px at320, capped300); native device modal/safe-area acceptance is still pending.

## Gift behavior

Live client is connected in root layout, gated by authenticated identity and positive installed native build. It resolves the server's exact costume/card pair, joins popup priority35, defers Later for that login session and keeps the closing payload mounted. It never selects or equips a production reward. Missing/inactive backend or unknown fit stays dark.

The staged migration grants one random new costume instance and matching card discovery per account, with an immutable replay receipt. Concurrent claims, cross-account receipt acknowledgement, inactive gates and pool freezing were checked in the disposable database harness. Campaign/catalog are inactive; no migration, campaign setting, live grant or EAS build was applied.

The browser preview grants one separate local gift on its next load and saves it before presentation. Observed result was Starspell. Later preserved the receipt; reload revealed the same Starspell; Continue acknowledged without replacing the previously equipped Candy Corn. Another reload showed no Resume gift button. Starspell then became wearable via explicit Try on. New five are a single-gift pool, separate from the earlier five-card costume packet. Automated local gift tests cover all five equal draw buckets, replay, provenance and restoration.

## Remaining exceptions — not accepted for activation

| Affected item | Animation/frame or surface | Status |
| --- | --- | --- |
| All eleven full-body suits | Rosie: every non-idle pose/frame, including reactions/turned views and transitions | Not authored or verified by this drop; defer shipping fit claims |
| All eleven full-body suits | Bandit, Pickles, Biscuit, Copper and Pepper: every frame | Per-pig art/fit pending |
| All new five | Production Closet/Home/Barn/Visit, equipment occlusion and removal | Live costume slot and wardrobe ownership projection pending |
| Login gift | Exact installed TestFlight binary, popup competition, cold/warm login, second device and native320pt modal | Device acceptance pending |
| Owned gift instances | Friend transfer and Old Wisp consumption | This ledger has mint provenance only; no live transfer/consume API is claimed |

See `production-readiness.md` and `../../builds/2026-10-14-halloween-preflight.md` for release gates and the inactive-backend → exact-binary TestFlight → public-release → explicit activation sequence. Follow-up `halloween-one-time-login-gift` is queued without a build assignment.

## Automated gates

Focused catalog/art/unlock/local gift/live hook/reveal/fitting/equipment checks: 8 suites, 48 tests passed. The hook's final lint-compliant commit capture also passed 6 tests. TypeScript, scoped lint and production-source lint pass (the broad lint run retains 865 warnings). iOS Metro export passed; disposable database harness passed. Full Jest rerun: 320 passed suites, 2 existing placement suites failed; 3,757 passed tests and 2 failed. Exact failures are recorded in `production-preflight/drop3-full-jest-summary.txt`.

`quality:check:full` short-circuits on the existing text clamp budget138/91 and default-role revoke for `my_drives()`. Independent sprite integrity still flags Copper idle_8. Linked database lint and remote migration boundary hung and remain unverified. The watcher hit EMFILE. These failures have not been suppressed or treated as accepted release exceptions.
