# Barn navigation clarity

Home now presents a full-width gold **Enter Barn** button with the existing door
art and the explanation “Decorate your room and welcome friends.” It sits below
the Home counters and before the Updates tray. The small painted Barn remains
an optional shortcut; the primary entry does not depend on a cosmetic background.
Shop uses the same entry component labeled **Browse furnishings**.

The owner room has visible **Home**, **Furnishings**, and **Decorate** labels.
The top pair follows safe-area insets and wraps with larger text. Decorate uses
the shared gold Button; the navigation controls use the existing paper, border,
shadow, radius, typography, and spacing tokens. The room remains full-screen,
and editor/save behavior is unchanged. No additional design framework was added.

This uses the project's Impeccable workflow, PRODUCT.md / DESIGN.md and the
existing React Native theme and Button. It serves Connect and Collect by naming
the player's destination/action directly.

Focused entry routing tests pass (2 suites / 3 tests); owner navigation tests
pass (5 tests). Changed source lint has no errors. Native evidence is recorded in
`artifacts/habitat-navigation-2026-09-08/`. The simulator is signed out, so the
normal Home route shows sign-in; room visuals use the local acceptance preview,
not a live-account Home acceptance pass.

The native room check passed at normal and maximum Dynamic Type: Home and
Furnishings wrap onto separate rows when needed (62.7pt high); Decorate remains
fully visible (99.3pt high at maximum size). Visible and accessible control names
match. Normal text size was restored. The missing simulator app bundle was
restored from the existing Debug-iphonesimulator product; no distributable build
was created. The complete `quality:check` gate passes.
