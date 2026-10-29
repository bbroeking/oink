# Big Twelve — New Pig Concepts

Completed private **Prompt 5** exploration in [Claude Design](https://claude.ai/design/p/aec2145f-9fe2-4416-ab82-50c0100f537d?file=Big+Twelve+-+New+Pig+Concepts.dc.html). The project normalizes the page filename to an ASCII hyphen; its display heading retains the em dash.

| Provisional pig | Identity / expression | Proposed hook |
| --- | --- | --- |
| Mallow | Dusty pink, cream forehead blaze, cocoa mud patches and stockings; curious raised brow | Find useful cards in the discard pile. |
| Pip | Buttercream, peach cheeks, caramel ear tip; bright eyes and open smile | Keep momentum by playing helpful cards. |
| Dozer | Slate-lilac, cream muzzle/belly, cocoa ear tips; heavy lids and calm smile | Soften setbacks while the deck recovers. |

These names, illustrations and hooks are **unapproved, unbalanced concepts**. Cheer and collector numbers remain TBD. The original Rosie E · Big Twelve card is an immutable art/layout reference, explicitly labeled with legacy co-op text; it is not the digital rules authority for the concepts.

## Files

- Exact single-page export: `Big Twelve - New Pig Concepts.dc.html`.
- Actual-size four-card screenshot: `new-pigs-desktop-320.jpg`.
- Full 390px stacked presentation: `new-pigs-narrow-390.jpg`.
- Completed live Claude Design proof: `claude-design-completed.jpg`.
- Measured geometry/type/image checks: `verification.json`.
- New source PNGs: `art/{mallow,pip,dozer}-concept.png`; identical copies at `uploads/` preserve the exported page's asset paths.
- Built-in image-generation prompts and reference roles: `imagegen-prompts.json` and `artwork-brief.md`.
- Submitted Claude Design prompts: `claude-design-establish-prompt.txt` and `claude-design-artwork-prompt.txt`.

Claude Design established the layout before new artwork was generated. Built-in `image_gen` then produced three genuinely transparent RGBA PNGs using Rosie, Bandit and Biscuit as read-only anatomy/rendering references. Original assets were not edited. The new PNGs are square 1254×1254 sources, rendered uniformly at 186px; Rosie remains the exact 370×383 source at 184px. All ears, face, body, legs and hooves remain visible.

## Verification

All four exported faces measured **320×448**, with a continuous 3px cocoa border and 14px corner radius. New names use 44px Caprasimo; proposed-hook body text uses **15px Nunito / 22.5px line height**. Type is on its own line above the hook. Images load, preserve natural aspect ratio and stay inside the perimeter. Desktop and the complete 390px stack were visually inspected; names, Cheer, hooks and footers remain unobscured. At 390px the document width is exactly 390px and card bounds are x=35…355. No final correction was needed.

The exported Rosie face markup is exactly identical to E in the retained `static-layouts/Six Static Layouts.dc.html`. Decoded RGBA comparisons confirm its Rosie and homestead background match `assets/images/sprites/rosie/idle_1.png` and `assets/images/backgrounds/homestead_barn.jpg`. Local concept assets are byte-identical to their export-path copies. Every local dependency exists; fonts load from Google Fonts.

Claude Design initially rejected concurrent requests (“Your other tab is working on a request”) and synchronized active chat selection across project tabs. The retained blocker screenshot records that initial issue. Clean conversations and explicit owned-file instructions ultimately completed the design; only this pass's page was edited. The artwork completion used bounded foreground checks. The earlier layout setup performed a type-label spacing correction before artwork insertion.

Preview from this directory with `python3 -m http.server 6395 --bind 127.0.0.1`, then open the URL-encoded exported HTML filename. The temporary verification server was stopped after checks.

No production code, tokens, gameplay, API, database, release files, build, deployment, public sharing or account settings were changed by this pass. All saved deliverables are confined to this directory.
