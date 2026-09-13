# Barn purchase sheet — September 10, 2026

Barn furnishing purchases now use the Shop's existing visual components: an illustrated paper Sticker, rarity badge, SnoutCoin price, balance, and shared Button inside AdaptiveModalScaffold. Buy opens this sheet; confirmation happens on its Buy button. Preview uses the same sheet with a room/art toggle. Purchase failures stay inline instead of opening a native Alert.

The existing durable purchase hook, receipt handling, ownership checks, collection rewards, and return to the decorating draft remain in use. A synchronous in-flight guard prevents repeated taps. Account changes dismiss the selected item and suppress stale feedback/navigation. Successful feedback and navigation wait for the native modal dismissal gap.

## Files

- `app/barn-collection.tsx`: sheet integration and guarded purchase lifecycle.
- `components/habitat/HabitatItemPreviewModal.tsx`: shared Shop visual language, owned/earned/unavailable/insufficient states, inline errors and room preview.
- `__tests__/BarnCollection.test.tsx` and `__tests__/HabitatItemPreviewModal.test.tsx`: interaction and presentation coverage.

## Verification

- `npm run quality:loop` used during implementation; final `npm run quality:check` passed all contract, sprite, TypeScript, layout Jest and security Jest gates.
- Focused Jest: 36 tests passed across BarnCollection, HabitatItemPreviewModal and useHabitat. Includes dismissal without purchase, repeated taps, uncertain response, account changes, delayed navigation, ownership and affordability states. Jest emitted its delayed-exit diagnostic, then exited successfully.
- Scoped ESLint: zero errors, six React hook/compiler warnings in the collection file. The new modal and both purchase tests pass lint without warnings.
- Scoped whitespace check passed.
- Installed simulator app passed `python3 scripts/verify-ios-simulator-auth.py`; no native build/install was needed for this JavaScript change.

## Native visual and accessibility acceptance

iPhone 17 Pro simulator, iOS native development client, 402 × 874 points. Purchases exercised only the local acceptance backend. The prior fixture server state was backed up and restored after testing; no real wallet was changed.

- The Milk-can Lamp sheet displays finished art, readable rarity, price of 175 Snouts, balance of 1,200, and a gold Buy button. There is no native purchase Alert.
- The room preview renders the saved arrangement with the selected furnishing; the toggle returns to item art within the same sheet.
- Closing the sheet leaves the fixture balance and ownership unchanged.
- Confirming one purchase changes the balance from 1,200 to 1,025 and marks Milk-can Lamp owned.
- At the largest accessibility text size, content scrolls and the complete price, balance and Buy control remain reachable. Close stays pinned. Normal text size was restored afterward.
- Native accessibility tree exposes specific Close, Preview and Buy names, price and balance; Close is 44 points and Buy exceeds 44 points at normal size.

Evidence: `artifacts/habitat-purchase-ui-2026-09-10/` contains screenshots, native accessibility trees, quality/test/lint logs and simulator entitlement verification. Physical VoiceOver/Switch Control acceptance remains part of the broader housing release gates; this simulator check does not certify those.

No database migration, production mutation, distributable build, upload or release was performed for this UI change. Existing housing rollout and release-checklist requirements still apply.
