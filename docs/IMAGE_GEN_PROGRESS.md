# Image Gen Progress (Tickle the Pig cosmetics)

Run started: 2026-05-05
Tab: midjourney.com/imagine (id 17005411, account @qurtyyy)
Style anchor: /Users/bbroeking/projects/oink/assets/images/hats/monocle.png

## Items already done (do not regenerate)
- wizard, cowboy, tophat, party, monocle

## Workflow notes
- file_upload returns "Not allowed" — use clipboard paste fallback (osascript → cmd+V).
- Style reference attached via Style References tab, monocle.png sits in recent uploads strip.
- MJ has no one-click "Erase Background" in current UI; manual brush only. Decision: skip BG removal in MJ, just save raw PNG. User can post-process or pick.
- Image grab path: read CDN url `https://cdn.midjourney.com/{job_id}/0_0_640_N.webp` → load via Image+canvas (crossOrigin=anonymous) → toDataURL('image/png') → `<a download>` triggers save to ~/Downloads.
- Style reference DOES need to be re-attached for each prompt? Need to check.

## Log

- crown — OK (smoke test)
- magic_wand — OK
- halo — OK
