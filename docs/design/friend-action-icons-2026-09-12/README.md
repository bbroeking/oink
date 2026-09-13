# Friend action icons — 2026-09-12

Four raster concepts were created with the built-in ChatGPT image generation tool. The production SVGs are manually reconstructed and simplified vector paths based on those concepts, with solid palette colors and no embedded raster images.

## Assets and usage

Canonical editable sources: `assets/icons/friend-actions/{bless,curse,visit,pin}.svg` (32×32 viewBox).

Run `node scripts/build-friend-action-icons.mjs` after editing a source SVG. This produces `constants/friendActionIcons.generated.ts` for the existing `react-native-svg` renderer. `node scripts/build-friend-action-icons.mjs --check` verifies synchronization. No new dependencies or Metro configuration are needed.

Use `GameIcon` from `components/ui/GameIcon.tsx`, with `name`, `size`, optional `muted`, and optional container `style`. Icons are decorative; the parent action owns the accessible label. The Friends screen uses 24pt blessing, curse, and visit art, and a 16pt pushpin. Sent rituals retain their ritual-specific art.

The approved set is also used in profile actions, the ritual picker, Inbox blessing/curse events, active-effect fallback art and badges, visit counts, the Porch Round scrapbook, and season XP instructions. The Barn navigation icon and `Glyph`'s `barn` name share the new barn artwork. `Glyph` also accepts `bless`, `curse`, and `pin`, allowing existing chips, tags, and avatars to use the vectors. `glyphSource` is deliberately limited to raster glyph names for consumers such as Skia and `Animated.Image`.

Generic reward sparkles, weather clouds, and ranking stars retain their own meanings. The next distinct subjects worth designing are a guestbook/visit-history stamp, a tickle-request mark, and a Sounder/crew symbol.

The source concepts are kept beside this document. `preview.svg` shows the exported vectors at display size and at 16/24/32px.

## Generation prompts

### bless

Use case: logo-brand. Create ONE production-minded vector-style icon concept for the BLESS action in a cozy social pig game called Tickle the Pig. Symbol: a broad, charming four-point golden magic star with softly concave sides and rounded tips, with a small tilted halo above it; one tiny glint to the upper right ONLY if it reads cleanly. It should feel like a little good-luck charm someone cut from paper. The silhouette must be immediately readable at 24 pixels. Pure flat 2D front view. Bold continuous dark warm-brown outline (#2a1f15), golden cream star fill (#fff3d0), warm gold halo (#ffd87a), no more than three flat colors. Slight organic asymmetry, clean smooth contours, thick even weight, a little personality, no fussy internal linework. Icon fills 80% of a square canvas with breathing room around its outline. Transparent background. No outer circular button, no badge container, no wording, no labels, no gradients, no texture, no blurry shadows, no 3D lighting, no glossy shine, no faces. The result will be rebuilt as clean SVG paths and shown at 20–24pt on a yellow paper button. Generate only the isolated finished icon.

### curse

Use case: logo-brand. Create ONE isolated vector-style action icon for Tickle the Pig, a cozy paper-craft social pig game. Pure flat 2D front view, a broad recognizable silhouette readable at 24 pixels. Bold continuous warm dark brown outlines #2a1f15 with round joins, clean smooth slightly organic contours, gentle storybook personality. Exactly flat solid color regions; NO gradients, texture, shading, lighting, gloss, blur, shadows, text, surrounding badge, button, or scene. Transparent background, centered, subject fills 80% of square canvas. Keep line count very low and internal gaps generous. This concept will be rebuilt into clean SVG paths. Subject: one squat puffy sage-green storm cloud with three broad rounded lobes and a single short crooked golden lightning bolt dropping from underneath. Playful harmless mischief. No face, eyes, rain, sparkles, or extra lightning. Pale sage cloud fill #d5e4c9, gold bolt #ffd87a. Cloud should be a strong simple shape, not a thin outline.

### visit

Use case: logo-brand. Create ONE isolated vector-style action icon for Tickle the Pig, a cozy paper-craft social pig game. Pure flat 2D front view, a broad recognizable silhouette readable at 24 pixels. Bold continuous warm dark brown outlines #2a1f15 with round joins, clean smooth slightly organic contours, gentle storybook personality. Exactly flat solid color regions; NO gradients, texture, shading, lighting, gloss, blur, shadows, text, surrounding badge, button, or scene. Transparent background, centered, subject fills 80% of square canvas. Keep line count very low and internal gaps generous. This concept will be rebuilt into clean SVG paths. Subject: one tiny welcoming barn shown squarely from the front. A broad gambrel barn roof silhouette, warm rose-red facade #f8a8b3, cream double door #fff3d0 with one dark X across it, a small cream square hayloft opening, and dark brown roof trim. Just the barn, no landscape, fence, foliage, smoke, animal, rays, or decorative details. Make it chunky and compact enough to read as a barn at 24 pixels.

### pin

Use case: logo-brand. Create ONE isolated vector-style action icon for Tickle the Pig, a cozy paper-craft social pig game. Pure flat 2D front view, a broad recognizable silhouette readable at 24 pixels. Bold continuous warm dark brown outlines #2a1f15 with round joins, clean smooth slightly organic contours, gentle storybook personality. Exactly flat solid color regions; NO gradients, texture, shading, lighting, gloss, blur, shadows, text, surrounding badge, button, or scene. Transparent background, centered, subject fills 80% of square canvas. Keep line count very low and internal gaps generous. This concept will be rebuilt into clean SVG paths. Subject: one squat pushpin seen as a flat side-profile symbol, tilted diagonally 25 degrees so its short needle points toward the lower left. One broad round-ended golden cap #ffd87a, a stout small warm-gold body, and short dark outlined cream needle #fff3d0. Large simple silhouette, visibly a thumbtack for pinning a friend to the top of a list. No star, sparkle, round button, extra curves, 3D perspective, or texture.
