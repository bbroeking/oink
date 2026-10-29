# Assessment B — opening and card evidence

Target: `components/prototypes/card-packs/CardExperience.tsx`  
Target slug: `prototypes-card-packs-cardexperience-tsx-09ec5bd3`  
Method: independent detector, source-contract, and stored-visual assessment. This document contains no Assessment A input.

## Evidence boundaries

- The live URL `http://127.0.0.1:4320/` was opened in a fresh, hidden in-app browser tab. It returned `net::ERR_CONNECTION_REFUSED`, so no current live UI state was available.
- The available browser evaluation surface is read-only. Per the critique playbook, overlay preflight, detector injection, browser presentation, and a critique-only live server were skipped rather than attempting mutation. No user-visible overlay was created.
- The fallback evidence is current source plus the committed October 14 browser captures and measurement log in this directory. Those captures verify static card rendering and several previously exercised flows; they do not substitute for a fresh animation, native-device, haptic, sound, or frame-time pass.
- No server, database, reward, storage, or source mutation was performed. The failed tab creation returned no controllable tab binding, so there was no browser tab or live server to clean up.

## Deterministic detector

Command, run once:

```sh
.agents/skills/impeccable/scripts/impeccable detect --json components/prototypes/card-packs
```

The command exited `0` and returned two advisory findings, both under `design-system-color` / **Color outside DESIGN.md**:

1. `components/prototypes/card-packs/CollectibleCard.tsx:133` — undocumented foil surface `#fff1b8`, imported by `CardExperience.tsx` and `DeckBuilder.tsx`.
2. `components/prototypes/card-packs/CollectibleCard.tsx:134` — undocumented living-finish surface `#eee7ff`, imported by `CardExperience.tsx` and `DeckBuilder.tsx`.

There was no `.impeccable/critique/ignore.md`. Neither finding is a false positive: both colors are deliberate finish cues, but neither is represented in the current design-system palette or tonal ramps. They are advisory governance drift rather than proof of a visible contrast failure. The scan found no other rule families in this target directory.

## What the opening actually does

### Pack handling and tear

- The opening begins from a persisted local receipt. `openPack` commits ownership and the immutable receipt before switching to the ceremony, so the ceremony is presentation rather than the grant boundary.
- A three-card pack uses the exported sealed-packet poster as its static fallback. The five-card branch uses a separately drawn React Native packet, so the two pack sizes do not share identical presentation art.
- The interaction is a horizontal pull, not a press-and-hold. The gesture starts after 5 px of horizontal movement and maps positive `dx / 230` to monotonic tear progress. Releasing at 100% opens; the explicit **Open packet** button opens immediately from sealed or partial-tear state.
- The interface says **PULL TO OPEN**, shows numeric percent progress while tearing, and states that the player's place is saved. This is a clear accessible fallback, but the numeric sentence makes the ceremony feel more diagnostic than tactile.

### Reveal timing and progression

- After opening, the first reveal request fires automatically after 350 ms. The pack-exit overlay lasts 700 ms, and the static child card rises behind it over 350 ms (280 ms overshoot plus 70 ms settle).
- The presentation waits for Rive's `cardSettled` signal when available and otherwise advances state after a 450 ms fallback. Reduced-motion and static modes settle immediately.
- Subsequent cards are explicitly paced. The player swipes the settled card left or right, or taps **Swipe or reveal next**. A swipe needs 72 px displacement or 0.55 velocity and dismisses over 210 ms. While a reveal is pending, inspection and advance are disabled.
- The stage renders shallow card backs behind the current card, the top progress rail marks revealed/current position, and the final action becomes **See all three/five cards**.
- Skip is always present and sends the player straight to the receipt. App backgrounding cancels timers, and restore logic resumes from the persisted opening state.

### Inspect and receipt

- **Inspect card** opens a modal-like full-screen overlay containing the same static card, name, flavor, printed rules, training copy, and **Back to packet**. Closing inspection does not replay the reveal.
- The receipt distinguishes new and repeat copies, shows every card, and links each card to its detail sleeve. Seasonal first copies state the named permanent cosmetic unlock and explicitly confine it to the local prototype.
- The committed receipt screenshot shows the outcome clearly, but its main-screen nav, prototype badges, local-scope warnings, and two-card grid compete with the reward moment. This is useful internal-test instrumentation rather than a shipping ceremony composition.

## Rive and fallback contract

- The Rive contract binds tear progress, reveal index, tilt, finish, reduce motion, dynamic card art, and open/reveal/inspect/reset triggers. It reports `tearComplete`, `cardSettled`, `inspectComplete`, and `sequenceComplete` signals.
- The stage only lets Rive own the sealed/tearing state, the opening transition, and the empty pre-reveal stage. Once a card is visible, the authored React Native `CollectibleCard` is the visible card surface. The opening is therefore a hybrid composition, not continuous Rive ownership of the revealed-card stage.
- The native adapter dynamically loads the raster into the Rive image property before firing an action. The web adapter fetches and decodes the same art. Both hide the Rive view until ready; after five seconds, or on binding/runtime failure, the host switches to the static fallback and records a review status.
- Seasonal cards without registered selected raster art force `staticMode`. All 34 currently selected Spooky Snouts illustrations are registered according to the stored integration evidence, so that branch is a guard for incomplete seasonal content rather than the expected current seasonal path.
- The card-detail sleeve deliberately mounts `PerformanceStage` with `staticMode`, so the sleeve itself is a static card view even though it uses the performance-stage wrapper.

## Card rendering, rarity, foil, and seasonality

### Shared card family and art fit

- Base and seasonal cards use the same 300 × 420 `CollectibleCard` renderer. The stored browser metadata records all 34 seasonal detail cards at exactly 300 × 420 in a 393 × 852 viewport, with loaded images and nonzero natural dimensions. Card 034 was also checked at 320 × 568.
- The base Mud Shovel capture confirms that Rank, Bash, play rules, training action, slot, and 88-card footer remain present. Seasonal captures correctly remove rank/stats/training and replace them with ITEM/PLACE, first-copy unlock copy, a lilac perimeter, and a dark collection-only band.
- `resizeMode` is intentional: background unlocks use `cover`; wearable/object unlocks use `contain`; base hat art also uses `contain`; most other base art uses `cover`. The stored contact sheet supports the claim that object silhouettes are not visibly clipped and that scenes fill their windows.
- The seasonal artwork is visually cohesive at card scale: bold cocoa outlines and warm painted fills survive the compact frame. Backgrounds carry richer contrast and depth than isolated items, so album rows alternate between airy cream object cards and dense scene cards; this is a content-family difference rather than a renderer failure.

### Rarity cues

- Rarity is primarily textual: the title metadata spells out COMMON through LEGENDARY, and the footer compresses the same information to `C`, `U ✦`, `R ✦✦`, `E ✦✦✦`, or `L ✦✦✦✦`.
- There is no rarity-specific border, title plate, stripe, badge fill, reveal aura, or ceremony treatment. Base-card perimeter color follows play style; all seasonal unlock cards use the same lilac perimeter regardless of rarity. This bypasses the established `RARITY_BG_SOLID`, `RARITY_STRIPE`, and `RARITY_BADGE` vocabulary documented in `DESIGN.md`.
- The result is technically labeled but emotionally flat: an epic or legendary pull does not look meaningfully rarer at first glance than a rare pull. In the stored contact sheet, rarity differences require reading tiny metadata/footer marks.

### Foil and living finishes

- Foil changes the card surface to pale gold, adds a 10% gold wash over the art, appends `FOIL` to the footer, and performs one 650 ms diagonal gleam after a 350 ms delay on ceremony-size cards.
- Living changes the surface to pale lilac, adds a 10% lilac art wash, and appends `LIVING` to the footer. There is no living-specific animation in `CollectibleCard`.
- Rive receives the finish enum, but because the static React Native card becomes the visible surface after the opening transition, the enduring finish read depends on these subtle static treatments. The stored receipt screenshot's foil Lantern Porch is not available here as a fresh moving view; the current foil animation and Rive finish compositing remain unverified in this run.

### Seasonal outcome versus production outcome

- Spooky Snouts is real inside the local prototype: 34 cards, raster art, local three-card fixture, local persistent receipts, album switching, detail views, and first-copy local cosmetic flags.
- It is not a live reward system. The database set is inactive, mappings are not seeded, the production client adapter is unwired, odds and live dates are unset, and the new wearables/backgrounds are not registered or fitted for production pigs.
- The card art has been checked as card art only. It does not establish front/profile wearable exports, pivots, occlusion, or fit across six pigs and their animation frames. A screenshot of the unlock card is not evidence that the cosmetic can be equipped correctly.

## Assessment

### Strong evidence

- Ownership is separated cleanly from ceremony timing: interruption, skip, inspection, and animation failure cannot revoke the already committed local result.
- The ceremony has credible recovery paths: persisted opening state, background-safe timers, card-settle fallback, reduced motion, static fallback, skip, and a readable inspection route.
- The shared renderer preserves the base-card grammar while giving the seasonal collection a clear collection-only identity. Stored card-scale and narrow-width captures support the art-fit claims.

### Highest-value gaps

1. **Rarity has almost no visual theater.** The player must read metadata or miniature footer marks to know that a pull is epic or legendary. Add rarity-specific authored cues to the reveal and card frame using the existing rarity tokens, with shape/mark differences so rarity does not depend on hue.
2. **The reveal is hybrid in a way that may expose a handoff.** Rive owns the packet/open transition; the React Native card owns the settled result. The 700 ms cover and static rise are designed to conceal that seam, but only a fresh moving-device pass can establish that the dynamic art, scale, crop, finish, and timing join cleanly.
3. **Foil and living reads are too quiet for collectible finishes.** Foil gets one short gleam; living gets only a tinted wash. Neither finish changes border, typography, depth, particles, or persistent material behavior. The authored Rive finish state cannot carry the settled card because Rive no longer owns that visible stage.
4. **The ceremony's tactile story is weaker than its interaction plumbing.** The packet is charming, but percent-open copy, generic progress bars, and utilitarian controls dominate the feedback. The experience communicates state well while underselling rustle, resistance, rupture, rarity anticipation, and a memorable final pull.
5. **Stored browser proof is broader than current proof.** Prior evidence says the web/Rive flow settled normally and survived reload, but this run could not reproduce it because the preview was offline. Native Rive behavior, haptics, sound, reduced-motion feel, low-end performance, and exact foil compositing remain unverified.

## Claimed versus evidenced outcomes

| Claim | Evidence in this run | Status |
|---|---|---|
| All 34 seasonal cards fit the shared detail renderer | Stored screenshots, contact sheet, and `browser-card-checks.json` | Supported as static web evidence |
| Tear, reveal, inspect, skip, restore, and fallback are implemented | Current source contracts | Supported by source; live behavior not freshly replayed |
| Normal web/Rive opening settled Moonbrew, Broom, and foil Lantern Porch | Prior integration verification | Previously reported; not independently reproduced here |
| Foil animation and Rive finish compositing feel correct | No fresh moving capture | Unverified |
| Native iOS opening, haptics, sound, and performance are correct | No Simulator/device evidence in scope | Unverified |
| Seasonal cards grant production cosmetics | Current docs explicitly deny this | False as a production claim; local preview only |
| Card illustrations are ready as wearable assets | Art QA explicitly limits approval to card art | False; production fit remains open |

## Run notes

- Slug: `prototypes-card-packs-cardexperience-tsx-09ec5bd3`.
- Ignore list: absent.
- Assessment independence: no Assessment A output read.
- CLI detector: completed once; 2 advisory `design-system-color` findings with exact locations above.
- Browser visibility: fresh hidden tab requested; navigation failed with `ERR_CONNECTION_REFUSED`; it was never presented.
- Overlay injection: skipped because the page was unavailable and the browser evaluation surface is read-only; no overlay claimed.
- Live-server cleanup: no server started.
- Browser cleanup: failed creation returned no tab binding; no controllable review tab remained to close.
- Temp-file cleanup: no temporary files created.
- Fallback signal: current source, stored screenshots, stored browser measurement JSON, and the existing October 14 integration/art QA records.

