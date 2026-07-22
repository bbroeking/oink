# The Slop Club Lounge — a walkable farm (draft plan)

Founder direction 2026-07-21: the lounge perk graduates from a Barn
background swap (the v0 prototype in `BarnMemberPerks.tsx`) into a
**real-time shared space**: a Pokémon-style ¾-top-down farm where members
walk their pig around and emote with other members live.

Charter fit: this is the **hangout** — Connect's purest form (the Club
Penguin / Habbo beat: presence, ambient company, expression — no scores).
It runs perfectly parallel to the core loop: nothing in the lounge mints
tickles, finds, or snouts.

---

## Product shape (v1)

- **Members only.** The Barn lounge chip routes to a full-screen
  `/lounge` route. Slop Club (`is_vip`) gates entry — client-side gate +
  channel-level authorization server-side.
- **One hand-painted farm scene** in the game's sticker/storybook style —
  fences, mud wallow, trough, a barn door (exit). Camera follows your pig,
  Pokémon-view (¾ top-down).
- **Tap-to-walk** (founder call 2026-07-21): tap a spot, Rosie trots
  there — one-handed, cozy, no virtual-stick clutter. Pathing is a
  straight line with the walkable mask as the clamp (no A*; the farm is
  an open field with fences, and sliding along a blocked edge is enough).
- **See other pigs** move in real time: pig + username tag, skin tint.
- **Emote, don't chat.** A radial emote menu (wave, happy, surprise,
  heart, zzz — reuse the existing front-facing sprite anims + reaction
  art as floating bubbles). **No free-text chat in v1** — keeps App
  Review moderation surface at zero and the space unpoisonable.
- **Room cap ~12** with transparent sharding (`lounge-1`, `lounge-2`, …
  join the emptiest non-full shard). A cozy farm, not a stadium.

## Explicit non-goals (v1)

Text chat · minigames in the lounge · non-member visits ("look through
the fence" teaser can come later as an upsell surface) · Android-specific
work beyond what Expo gives us · furniture/decorating (that's The Den,
a separate flagship).

---

## Architecture

### 1. Rendering — `@shopify/react-native-skia` (new dep)

One Skia canvas, a Reanimated `useFrameCallback` game loop (worklet), and
three layers:

1. **Ground**: the painted farm as one large image (~2048², drawn with a
   camera translate; parallax-free).
2. **Entities**: pigs (sprite frames as Skia images), y-sorted so a pig
   behind the trough renders behind it. Overlay objects (fence posts,
   trough) drawn from the same painted sheet as cutout sprites where
   depth matters.
3. **UI overlay** (plain RN views): thumbstick, emote button, name tags
   (Skia paragraph or absolutely-positioned RN text), exit.

Movement/collision: a **walkable-mask PNG** (black/white, painted in the
same art pass as the scene) sampled at pig-foot position — no tile grid,
no tile art; matches the hand-painted aesthetic and is authorable by the
same art pipeline as backgrounds. Rejected: WebView+Pixi (bridge/asset
friction, feels non-native), expo-gl/three.js (overkill for 2D).

### 2. Rosie sprites — ChatGPT ImageGen (founder call 2026-07-21)

Primary lane is the established ChatGPT ImageGen pipeline (the icon-gen
flow: Chrome-driven ChatGPT session, style anchor first, batches after,
references dragged in by the founder since the connector can't upload):

- **4-frame walk strips, one direction per generation** (S, N, E, W —
  render all four; the tail curl breaks mirror symmetry) + a 4-frame
  idle. 4 frames matches the existing `SpritePig` anims and is the
  Pokémon-era cadence — and fewer frames = fewer consistency failures.
- References: `docs/rosie.png` + the existing front-facing sprites
  (`assets/images/sprites/rosie/`) as the character lock, plus the
  `assets/concepts/rosie-3d/` turnaround views for off-angle anatomy.
- Camera: Pokémon ¾ view. Flat sticker rendering, ink outline — the
  flat-sticker law applies to the *camera*, never the rendering style.
- Post: slice strips to frames, key/clean edges if transparency comes
  back fake (`scripts/slice_mudwar.py` precedent), pad to a uniform
  frame box so anchors stay stable.
- **Fallback** if cross-frame/cross-direction consistency won't hold:
  the rigged 3D model (`assets/models/rosie/rosie-custom-rig-walk-v3`)
  rendered with toon shading — parked, not deleted.
- Emotes reuse the existing front-facing `SpritePig` anims (wave, happy,
  surprise…) as **bubble overlays**, not directional renders — cheaper
  and reads better at lounge zoom.

### 3. Netcode — Supabase Realtime (no new infra)

- One **private channel per shard**: `lounge:<n>`, joined with Realtime
  channel authorization; the RLS-style auth policy checks `is_vip` so
  non-members can't even subscribe.
- **Presence** carries the static state: user id, username, skin tint,
  (later) hat id. Join/leave events drive spawn/despawn.
- **Broadcast** carries the dynamic state: `{x, y, dir, anim}` at
  **8–10 Hz** (self-throttled, only while moving); remote pigs render
  ~120 ms behind with lerp interpolation, so motion is smooth at 10 Hz.
  Emotes are one-shot broadcast events.
- **Client-authoritative** positions. The lounge is non-competitive —
  there is nothing to cheat for; the collision mask is a courtesy, not a
  rule. No game server, no tick loop, no new backend.
- Cost/scale: 12 players × 10 Hz × small payloads is trivial for
  Realtime; shards bound the fan-out (each message fans to ≤11 peers).

### 4. Cosmetics on the walking pig

v1: **skin tint + name tag only** (tint plumbing exists in
`utils/pigSkin.ts`). Hats need a per-direction, per-frame anchor table —
that's a placement-studio extension (new "lounge frames" mode reusing the
`PIG_FRAME_ANCHORS` pattern). Ships as v1.1 so cosmetic pride arrives
shortly after the space itself; the S-facing anchor pass comes first.

---

## Phases (each independently shippable)

| Phase | What | Exit criteria | Rough size |
|---|---|---|---|
| **P0 — sprite spike** | ChatGPT ImageGen session: S-facing 4-frame walk strip from the style anchor + refs, slice, draw it looping in a throwaway Skia canvas | A walking Rosie that *looks like Rosie* next to the sticker art — founder eyeball test | 1–2 days |
| **P1 — the farm, solo** | `/lounge` route: painted scene + walkable mask, camera follow, thumbstick, 4-direction walk/idle, exit door | Walk the whole farm at 60 fps on device, collisions feel right | 2–3 days |
| **P2 — other pigs** | Realtime channel + presence + 10 Hz broadcast + interpolation + name tags; shard picker; `is_vip` channel auth | Two devices see each other move smoothly; non-member cannot join | 2–3 days |
| **P3 — emotes + feel** | Radial emote menu, bubble overlays, join/leave whispers ("Rosie trotted in"), haptics, ambient sound | The farm feels alive with 2+ pigs; emote round-trip < 300 ms | 1–2 days |
| **P4 — hats + polish** | Per-direction hat anchors (placement studio extension), shard fullness UI, analytics (time-in-lounge, emotes sent), Android pass | Members' equipped hats show on their walking pig | 2–3 days |

P0 is deliberately first: it retires the only real unknown (does 3D-toon
Rosie match the game's look?) before any engine work.

## Risks

- **Art-style match** of 3D renders — gated at P0, with the ImageGen
  fallback named.
- **Skia is a new dep** — needs a dev-client rebuild (config plugin,
  local `eas build`), so P0/P1 ride a new build number.
- **Realtime hiccups** (cold reconnects, backgrounding) — reconnect =
  rejoin shard + re-presence; the space is stateless so recovery is free.
- **App Review** — no chat, members-gated, no UGC beyond usernames
  (already reviewed): low risk.
- **Battery** — cap the canvas at 60 fps, pause the loop when the app
  backgrounds (AppState already plumbed in Barn).

## Decisions (founder, 2026-07-21)

- **Tap-to-walk** (no thumbstick).
- **Room cap 12** confirmed for now.
- **Sprites via ChatGPT ImageGen** (icon-gen lane); the rigged 3D model
  render is the fallback, not the primary.

## Open questions (founder)

1. Emotes-only v1 confirmed (no text chat)?
2. Does the v0 lounge chip (background swap) ship in the meantime, or
   hold the perk until the farm is real?

---

## P2 detail — presence, broadcast, and stations (2026-07-21)

**Multiplayer:** shard channel `lounge:<n>` (cap 12). Presence carries
{username, tint, station?: {id, slot, sinceMs}}; broadcast event `pos`
carries {x, y, dir, moving} at ~10 Hz, only while moving. Remote pigs
render through the same 16-frame renderer, interpolated ~120 ms behind.
Client-authoritative; presence self-heals seats on disconnect. Channel
authorization on is_vip hardens at P2-final (realtime.messages RLS
migration); the P2a scaffold rides the client route gate.

**Stations:** per-scene registry (`constants/loungeStations.ts`) — id,
art, 1–2 seat slots (world pos). Tap station → walk to nearest free
seat → presence.station claims it (earliest sinceMs wins conflicts; the
loser keeps walking). Tap elsewhere → stand, seat frees.

**Seesaw:** both seats full → every client runs the same local
deterministic animation: plank sin-rotates ±12° anchored to the second
sitter's sinceMs, riders offset on the plank ends, haptics for the two
riders on each bounce. Zero extra network traffic. One rider → plank
tilts their way and rests (a standing invitation). Art: static base +
plank sprite rotated in Skia; dedicated inward-facing seated sprites
crossfade from the final walking frame with a small boarding hop. A
toggleable, local-only Practice Pig reserves the opposite seat for solo
motion testing and never enters Realtime Presence.

Build order: P2a peers visible → P2b bench/station framework → P2c
seesaw.
