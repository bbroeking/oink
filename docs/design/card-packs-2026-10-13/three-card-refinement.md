# Three-card refinement addendum

This note records the current state of the collectible-card prototype after the three-card, framed-card, and Pig Legend deck-planning refinement. It supplements the main [prototype handoff](./HANDOFF.md); older five-card and Rive evidence there is historical unless repeated here.

## Current product shape

New local demo packets contain three fixed cards in this order: Firefly Swarm in standard finish, Mud Shovel in standard finish, and Puddle Duckling in foil finish. Previously committed five-card receipts remain valid, resumable, and immutable. Presentation progress now follows the length of each receipt, so a new packet stops on its third card while a legacy receipt still stops on its fifth.

The canonical 88-card catalog remains authoritative for identity, numbering, original artwork paths, rarity, and printed rules. The three-card change does not rewrite those records. Earlier Claude Design explorations contained placeholder style assumptions; none were imported into the catalog or game rules.

Opening, receipt, album, inspection, and deck planning now share the same framed card face. Standard cards use the framed treatment now. Full-art treatments remain a later presentation option and must not change printed mechanics or collection identity.

The private [Claude Design canvas](https://claude.ai/design/p/aec2145f-9fe2-4416-ab82-50c0100f537d?file=Pack+Opening+Prototype.dc.html) was updated in place for this refinement. It remains a private design source, not executable reward authority or a public deliverable.

## Pig Legends and deck plans

All six existing pigs are selectable Pig Legends. Each Legend stays outside the deck and keeps its catalog-authored ability and two favored styles. The local constructed plan follows the printed base-set rules: exactly 24 cards, every card matches at least one favored style, no more than two copies of an identity, and no more than one copy of each Legendary identity.

The planner can produce a deterministic legal example, preserve an incomplete draft, and flag cards that no longer match after changing Legends. It may plan cards the local collection does not own; missing copies are labelled. Saving persists only the plan on the device. It does not grant cards, alter inventory, or change any currency. Constructed planning is separate from Hedge Run, which continues to use its fixed borrowed kit and quick-play rules.

## Opening choreography

The authored wrapper exit lasts 700 ms. The first React Native card begins rising behind it at 350 ms, keeping the wrapper above the card until the exit finishes. Its 350 ms settle moves from 22 px below the resting position to an 8 px overshoot and then rests. Subsequent cards leave in 210 ms before the next reveal. The host retains a guarded 450 ms settle fallback because Rive completion callbacks are still silent.

Reduced-motion and static modes remove spatial movement and settle immediately. These values describe the implemented choreography. Browser verification exercised the resulting three-card stop and interaction flow; it did not instrument or claim exact per-frame timing.

## Rive artifacts

The current runtime export is 1,244,656 bytes with SHA-256 `959f94cc677ac6fa8120b360d7fad547727a65ef7742b66af414cd527aa0c46d`. The editable `.rev` backup has SHA-256 `a9a94a84eccd6eb5b2d68c3f646295bccb8b8393279cd2f82412819214c606d5`. The poster image has SHA-256 `c0dbf6eb384df3ab2eea1fdc6d49a07e80740b4e8ef8f85d316e31e12ca8f867`.

Exact-runtime WASM inspection passes all 15 typed contract properties. Output callbacks remain silent, so they are optional visual signals rather than presentation or reward authority. The host fallback remains required.

## Verification status

The current focused run passes 52 tests across six suites. TypeScript checking, scoped lint, and the standalone browser build pass. Browser checks at 393 px, 320 px, and desktop covered the new three-card stop, a preserved legacy five-card receipt, deck-plan persistence, legal 24-card fill, and style-mismatch handling. The current browser reveal is captured in [three-card-framed-reveal.jpg](./verification/three-card-framed-reveal.jpg).

These checks confirm the tested flows, not precise frame pacing. The current native export at the runtime SHA above has not been verified. Earlier native smoke belongs to the historical runtime documented in the main handoff and must not be treated as evidence for this revision. Android remains unavailable because no `adb` target is present.

The continuous quality watcher encountered the known `EMFILE` limit. The one-shot quality check still reports the two existing baseline failures: layout clamps at `138 > 91`, and the `my_drives` migration revocation issue. These are not new card-prototype failures, and the overall release gate is not green.

## Remaining production work

The earlier five-card economy simulation must be rerun with three-card packs before production decisions use its results. Current work remains a local prototype: there is no database migration or push, backend reward authority, network invitation, production grant, deployment, distributable build, or release upload.

Native acceptance for the current runtime, Android testing, callback emission, human playtesting, economy review, and the independently reviewed server contract remain open.
