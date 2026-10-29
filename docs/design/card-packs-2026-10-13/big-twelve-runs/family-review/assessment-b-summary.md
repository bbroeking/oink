# Assessment B — detector and browser geometry

The detector reported 27 items: 19 warnings and 8 advisories. Counts were 12 `cramped-padding`, 6 `design-system-font`, 1 `design-system-radius`, 7 `design-system-font-size`, and 1 `cream-palette`. None is actionable for this authored static collectible-card review. Visual and computed checks show 21px card text insets, no descendants outside card bounds, loaded intended fonts, and deliberate card-family typography, radius, display sizing, and cream canvas.

All 12 printed faces measure exactly 320×448 at the default 1280px desktop viewport, 390px, and 320px. Document horizontal overflow is absent at every width. Names, type/cost/stat labels, rules, and footers remain contained without observed overlap. Every actual rules paragraph uses Nunito at 15px with 22.5px line height, including the longest Pickles rule. The smaller 12px Nunito instances are Energy coin labels rather than rules copy.

All 11 expected image elements load. Pig sprites retain the 370×383 source ratio, provisional concepts retain their 1254×1254 square ratio, and Action art deliberately uses `cover` within the authored 314×234 illustration band. Missing Item art is expected source incompleteness. Nunito, Caprasimo, and Patrick Hand all report loaded. Sample text contrast ratios are 15.46:1 for rules, 6.26:1 for the Action label, 6.92:1 for the footer, and 5.72:1 for review status text. No animation, transition, transform, depth, or tilt was detected.

One focused correction is warranted: the Mud Shovel missing-art placeholder contains active-looking **Replace** and **Edit** controls even though the page calls itself a static review and the art is deliberately unavailable. Remove or visually neutralize those controls so the missing-source evidence cannot be mistaken for an editable repair task. No source card artwork, catalog text, or missing Item/Location content should be changed.

Evidence: `assessment-b-measurements.json`, `assessment-b-default.jpg`, `assessment-b-390.jpg`, and `assessment-b-320.jpg`. The temporary viewport override was restored.
