# Matchmade play — architecture, games, and the path to ship

Status (2026-10-04): **built on `feat/matchmade-play`, dark-launched, not deployed.** Everything here runs locally end to end (server, five games, bots, the app against a local server). Three steps need the founder: the database push, the Render deploy, and the landing-site deploy (for invite links). See [§9 Rollout](#9-rollout).

Charter ruling: `SKILL.md` decision log, 2026-10-04. Glossary: `CONTEXT.md` (Matchmade play, Table, Play invite, Open seat, Practice pig, Wins board).

---

## 1. What we built, in one paragraph

A player opens **Play together** on the Friends tab, picks one of five games, and either **finds a pig** (random matchmaking), **invites** a friend, a link-holder or their Sounder (push + universal link), or **practises** against a bot pig. An authoritative **play server on Render** (Node + WebSockets) runs every real match from the **same pure TypeScript rules module** the app uses for Practice, so a practice table cannot behave differently from a live one. When nobody is around, random matchmaking still produces a game: the table becomes **play-by-push** with an open seat the next random pig takes, and each pig is pinged when it is their move. Results land in Supabase; the public board counts **wins this month** and never goes down.

## 2. Architecture

```
┌──────────────── iOS app (Expo 57) ────────────────┐         ┌──────── Render: ttp-play (Node 24) ────────┐
│ Friends ▸ Play together (app/play/index.tsx)      │  wss    │ hub ─ auth (Supabase JWT, HS256 today)     │
│ app/match/[roomId].tsx ─ MatchScreen + Board      │◀──────▶ │     ─ matchmaker (live queue, async seats) │
│ app/play/[code].tsx ─ invite landing              │  JSON   │     ─ rooms (room engine + timers)         │
│ Practice: /match/practice-… ─ local room + bots    │ frames  │     ─ invites ─ push (Expo Push API)       │
│ hooks/useMultiplayer ─ PlayClient (utils/…)       │         │     ─ store (Supabase service key)         │
└───────────────┬───────────────────────────────────┘         └──────────────┬─────────────────────────────┘
                │ rpc: play_leaderboard, app_setting('multiplayer')          │ play_invites · play_matches
                │ feature_flags (multiplayer)                                │ play_results · play_ratings
                ▼                                                            ▼
        ┌────────────────────────── Supabase (Postgres) ──────────────────────────┐
        │ profiles (looks, push tokens, flags) · user_blocks · friendships · crews │
        └──────────────────────────────────────────────────────────────────────────┘
                   shared, pure, platform-free:  multiplayer/  (types · engine · protocol · rng · games/*)
```

### Why a Render server, not Supabase alone

The 2026-10-01 exploration specified a Supabase-only design (RPC authority + Realtime). For five games it costs more than it saves:

| | Supabase only | **Render play server (chosen)** |
| --- | --- | --- |
| Where rules live | plpgsql, one RPC family per game | one TS module per game, shared with the app |
| A rules tweak | a migration (needs a push "go") + a binary | a server deploy; Practice picks it up next build |
| Timers (turn clocks, reconnect grace) | lazy reconciliation or pg_cron | `setTimeout`, re-armed every revision |
| Matchmaking atomicity | advisory locks | single-threaded event loop |
| Hidden information | per-seat projection RPCs + private channels | `view(state, seat)` per socket |
| Tests | stubbed-Postgres harness | jest + node:test + in-process e2e bots |

The cost is one more service: a paid instance (always on), secrets, a deploy. It is a single instance by design (§10).

### The layers

| Layer | Path | Owns |
| --- | --- | --- |
| Contract | `multiplayer/types.ts` | `GameDefinition`: setup · activeSeats · apply · onTimeout · view · secretsOf · result · bot · parseAction |
| Room engine | `multiplayer/engine.ts` | phases, revisions, deadlines, timeouts, departures, idle no-contest, rematch, per-seat snapshots. Pure: every function takes `now`. |
| Protocol | `multiplayer/protocol.ts` | every wire frame, `parseClientMessage`, timing defaults |
| Games | `multiplayer/games/<id>/rules.ts` | the five rules modules (+ a README each) |
| Server | `server/` | sockets, auth, matchmaker, rooms, invites, push, persistence, health |
| Client SDK | `utils/multiplayer/*`, `hooks/useMultiplayer.tsx` | PlayClient (reconnect, heartbeat, clock offset), store, practice rooms, looks, copy |
| Screens | `app/play/index.tsx` (hub), `app/play/[code].tsx` (invite landing), `app/play/wins.tsx` (wins board), `app/match/[roomId].tsx` (every table, real or Practice), `components/play/*` | hub, invite landing, match screen, boards, result sheet, the Friends door |

The **boundary rule** (lint-enforced): nothing under `multiplayer/` imports React, React Native, Expo, Supabase, Node built-ins or `@/` paths. Metro, jest, tsx and esbuild all resolve it unchanged.

### The room engine, in five rules

1. **A room is a revisioned state machine**: `lobby → starting → playing → ended`; every accepted step bumps `rev`; a client ignores any snapshot older than the one it holds.
2. **The clock rule**: a fresh deadline when a new decision opens (a seat that didn't owe one now does, the actor owes another, or there was no clock); in a simultaneous beat the shared deadline stands when the first pig answers. Open async chairs carry no clock.
3. **Timeouts resolve, never stall**: at the deadline every owing seat's decision goes through the game's own `onTimeout` default. A seat that misses its turn too often (live 3, async 2 in a row) has left the table, unless every pig at the table is idle, which is a no contest.
4. **Departures by kind**: competitive with one pig left, that pig takes it (forfeit); co-op/social below the game's minimum, ended early (no contest); otherwise play continues and the empty chair's turns resolve by its default. A departed pig is never among the winners.
5. **Secrets never leave the server**: the seed is server-only; each seat receives `view(state, seat)` and events scoped by `visibleTo`; the test kit fuzzes every game against `secretsOf`.

## 3. Wire protocol (v1)

JSON text frames over one socket (`wss://<server>/ws`). Full types in `multiplayer/protocol.ts`.

- **Handshake**: first frame `auth { token, protocol }` within 5 s → `welcome { userId, name, serverNow, timing, catalog, resume }`. Close codes: 4001 auth timeout · 4002 protocol mismatch (terminal) · 4003 bad token · 4004 disabled (terminal) · 4005 signed in elsewhere · 4008 abuse.
- **Requests** carry `rid` and get an `ack { rid, ok, data | error }`.
- **Client → server**: `ping`, `sync`, `queue.join {games, pace}`, `queue.leave`, `invite.create {game, kind, to?, pace}`, `invite.preview|accept|decline|cancel {code}`, `room.join|leave|rematch|start {roomId}`, `room.action {roomId, rev, action}`, `room.emote {roomId, emote}`.
- **Server → client**: `pong`, `queue.state`, `room.state {room: RoomSnapshot}` after every revision, `room.gone`, `room.emote`, `invite.state`, `rooms`, `notice` (server restarting, signed in elsewhere), `error`.
- **Timing is server config** (`welcome.timing`): heartbeat 25 s, idle drop 70 s, reconnect grace 20 s, countdown 3 s, rematch window 30 s, emote gap 2 s, practice offer 15 s, invite TTLs (direct 15 min, crew 15 min, link 60 min).
- **Emotes** are a fixed set of six stickers (`oink · love · giggle · wow · oops · gg`). There is no free text anywhere: strangers share these tables.

## 4. Matchmaking

**Live** (`queue.join pace:"live"`): oldest compatible waiting pig first; compatible = shares a game, no block either way, not the pig you just played (unless both have waited 20 s). Among pigs who have waited under 10 s the closest hidden rating is preferred; anyone waiting 10 s or more wins the seat. Two-seat games start after a 3 s countdown; party games (Rootle, Fence the Pen, Snout Says, Out Looking at 3–4) gather for 6 s to pull in more pigs, then start with whoever is seated. A pig may queue for several games at once ("any of these").

**Play-by-push** (`pace:"async"`): if an async table with an open chair exists for a shared game, take it (the seated pig is pinged); otherwise a new table starts *now* with the chair open, so the first move can be made immediately, and waits up to 72 h for a random pig. Each turn pings the pig who owes it ("Your move"). Up to ten async tables per pig.

**The 15-second offer**: after 15 s in the live queue the hub offers *Leave an open seat* (switch to play-by-push) and *Practice with a bot pig*, plainly labelled. A bot never takes a seat in a real match.

## 5. Invites

| Kind | Who can accept | Push | Seats |
| --- | --- | --- | --- |
| `direct` | the named friends or crewmates only | each named pig ("Clover wants to play" · "Fence the Pen · tap to take your seat") | 1 + named, within the game's range |
| `link` | anyone holding the URL (blocks respected) | none (the inviter shares it) | the game's maximum; host may start early at the minimum |
| `crew` | the inviter's Sounder | every crewmate ("Clover wants to play Rootle" · "First pig to tap takes the seat") | the game's maximum |

- **Links**: `https://ticklethepig.com/play/<CODE>` (universal link, AASA path `/play/*`) and `ticklethepig://play/<CODE>`; both route to `app/play/[code].tsx` by Expo Router with no handler. Codes are 8 characters from a 30-symbol alphabet with no look-alikes, expire with the invite, and lookups are rate-limited. The web page `landing/play/index.html` shows who invited you to what and offers *Open in Tickle the Pig* plus the App Store.
- **Push payload**: `data: { screen: "play", invite: CODE, url, foreground: "alert" }`, `ttl` = time left on the invite, `categoryId: "match_invite"` (Play / Not now), `collapseId: invite_<CODE>`. A tap routes through `utils/notificationRouting.ts` to `/play/<CODE>`; a "your move" push carries `room` and routes to `/match/<roomId>`.
- **Host away**: if the host has backgrounded the app when the last guest sits down, the server pings the host ("Bandit is at the table") and holds the lobby up to 2 minutes.
- Pigs connected right now get the invite in-app (`invite.state`) instead of a push.

## 6. Data (Supabase) — `supabase/migrations/20261004230000_matchmade_play.sql`

| Table | Written by | Read by |
| --- | --- | --- |
| `play_invites` | server (service key) | server |
| `play_matches` (full engine state incl. seed, for restarts and async) | server | server |
| `play_results` (one row per pig per finished table, `period` = UTC month) | server | the pig itself (RLS), `play_leaderboard` |
| `play_ratings` (hidden Elo, competitive two-seat tables) | server | server |

`play_leaderboard(game?, period?, limit?)` returns the month's top pigs by wins (dense ranks, earliest to reach the count first), hiding `hide_from_leaderboard` pigs, with `me: { wins, rank }`. No loss column, no zero rows. Dark launch: `app_config.multiplayer = false` globally, `feature_overrides.multiplayer = true` for `is_test` profiles; `app_settings.multiplayer.url` tells the app where the server is. Validated with `scripts/db-harness/00z_matchmade_play_prep.sql` + `96_matchmade_play_smoke.sql` on Postgres 15 (and re-applied for idempotency).

## 7. The five games

| Game | Lineage | Kind · seats | Paces | One sentence | Spec · module |
| --- | --- | --- | --- | --- | --- |
| **Rootle** | the dice game Pig | competitive · 2–4 | live · async | Roll for truffles as long as you dare; roll the Hungerer and he eats the basket. | `explorations/01` §4.1 · `multiplayer/games/rootle/` |
| **Fence the Pen** | Dots and Boxes | competitive · 2–4 | live (4×4) · async (3×3) | Draw a fence; close a pen and its truffle is yours, then draw again. | `explorations/01` §4.2 · `multiplayer/games/fence_the_pen/` |
| **Mud Volley** | penalty-kick guessing | competitive · 2 | live · async (sealed envelope) | Everyone sees where your pig winds up: follow through for a big splat, flick it for a small one, and a catch scores for the catcher. | `explorations/02` §4.1 · `multiplayer/games/mud_volley/` |
| **Snout Says** | Just One × Codenames Duet | cooperative · 2–4 | live · async | Show me one picture that reminds you of it, and I'll guess which one you mean. | `explorations/03` §4.2 · `multiplayer/games/snout_says/` |
| **Out Looking** | pig-native (errands) | competitive · 2–4 | live · async | Each round send your pig to one of four places; alone you take the pile, pigs who meet share it. | `explorations/04` Top 2 · `multiplayer/games/out_looking/` |

Each game's README (`multiplayer/games/<id>/README.md`) records its rules in four lines, tuning, deviations from its spec, what the board shows per phase, and test coverage. The design explorations in `docs/multiplayer/explorations/` hold the full candidate sets (forty-odd games across four lenses) and the next wave (Who Woke Him, Light Sleeper, Two Noses, Sniff Out, Supper Scrum, Acorn Arc).

### What changes in the current game, per game

Common to all five (built once): the Play together door on Friends; the play server; the `multiplayer` flag; push routing for `play`; the `/play/*` universal-link path; the match screen, result sheet and emote tray; the wins board; the migration. None of the five touches the economy, the Satchel, Happiness, the Streak, the season or the Sounder's standing.

| Game | Reuses from the current game | New in the app | New art |
| --- | --- | --- | --- |
| Rootle | the truffle, the bag, the boom splat, the Hungerer's face, the barn glyph | a die tumble, a basket counter, the last-round tape | 6 die faces |
| Fence the Pen | the truffle, pig portraits as ownership stamps | a post-and-rail board with two-tap placement, seat tints (`SEAT_TINTS`) | rail, post, pen |
| Mud Volley | the visit's facing pigs (`PigStage facing`, the `face` turn), reactions | a pasture with lane posts, lane cards, the reveal arc, the sealed-envelope form | 6 (ball, pail, two splats, arc, post) |
| Snout Says | the twelve Finds and fifteen dig things as the whole deck, the wish bubble | the spread, the tray, clue bubbles, the round ledger | none |
| Out Looking | the Finds and their rarities, the Pen's "out looking" and "muddy trotters", the visit's heart | the four-place map, piles, the reveal scene | 4 places + muddy trotters |

### Implementation steps (each game followed the same recipe)

1. Rules module against `GameDefinition` (pure, JSON state, `ctx.rng`, secrets in `secretsOf`).
2. Jest: every rule and edge case, every timeout default, determinism, and `fuzz(game, 200)` per pace and seat count with zero unfinished tables, zero illegal bot moves and zero leaks.
3. Board against `BoardProps` (a pure function of `view`; `act()` and local pending feedback only), `seatStatus`, `howTo`, optional `ResultDetail`; a render smoke test.
4. Register: `multiplayer/games/index.ts`, `components/play/gameUi.ts`, art in `components/play/playArt.ts`.
5. Run it through the e2e harness (`cd server && npm run e2e`: queue, link invite, direct invite, reconnect, forfeit, async open seat, rematch).
6. Play it on the simulator against a server bot (`npm run bot -- --game <id>`), then on two devices.

## 8. Testing end to end

| Level | Command | What it proves |
| --- | --- | --- |
| Engine + protocol | `npx jest --ci __tests__/multiplayer/engine.test.ts` | clock rule, timeouts, departures, idle no-contest, rematch, secrecy, parsers |
| Games | `npx jest --ci __tests__/multiplayer` | each game's rules + 200-table fuzz per pace; boards render |
| Client | (same folder) | PlayClient reconnect/backoff/heartbeat/acks, store ordering, practice rooms, copy |
| Server | `cd server && npm test` | auth (HS256/JWKS/fallback), hub, matchmaker, invites, rooms with fake clocks, push |
| End to end | `cd server && npm run e2e` | for every game: queue match, link invite, direct invite, reconnect inside grace, forfeit past grace, async open seat, rematch; no seat ever receives another seat's secrets |
| Database | the harness command in §6 | migration + wins board + grants |
| On device | §8.1 | real thumbs, real latency, real pushes |

### 8.1 Manual: simulator against a local server

```bash
# terminal 1: the server, in memory, dev auth, pushes logged
cd server && npm install && STORE=memory AUTH_MODE=dev PUSH_MODE=log ACCESS=all npm run dev
# terminal 2: a bot pig waiting in the queue for one game
cd server && npm run bot -- --url ws://localhost:8787/ws --game fence_the_pen
# terminal 3: the app pointed at the local server (dev builds only)
EXPO_PUBLIC_PLAY_URL=ws://localhost:8787/ws NODE_OPTIONS="--max-old-space-size=16384" npx expo start --dev-client
```

Dev auth accepts `dev:<uuid>:<name>` tokens and is refused when `NODE_ENV=production`. For the app (which sends its real Supabase token) run the server with `AUTH_MODE=supabase SUPABASE_URL=… SUPABASE_JWT_SECRET=… STORE=memory` instead. On a physical phone use your Mac's LAN address in `EXPO_PUBLIC_PLAY_URL`.

### 8.2 Manual: two devices against Render (after deploy)

1. Two test accounts (`is_test`, so the flag is on), two phones.
2. Phone A: Play together ▸ Fence the Pen ▸ Find a pig. Phone B: same. They meet within a second; play to the end; rematch once.
3. Phone A: Invite ▸ a friend (B). B receives the push; tap it; the invite landing opens; Accept; play.
4. Phone A: Invite ▸ Copy link; paste it into Messages on B; tap; the app opens on the invite.
5. Mid-game, background B for 10 s and return (resumes); then for 30 s (A takes it, "Round ended early").
6. Play-by-push: A ▸ Out Looking ▸ Leave an open seat; later B ▸ Out Looking ▸ Find a pig (by post); both get "your move" pushes as rounds close.
7. Check the wins board on both phones.

## 9. Rollout

1. **Review and merge** `feat/matchmade-play`.
2. **Database push** (founder "go"): `npx supabase migration list --linked` first (parallel sessions push migrations); then push `20261004230000_matchmade_play.sql`, regenerate `utils/database.types.ts`, confirm `select public.play_leaderboard()` as a test user.
3. **Render**: New ▸ Blueprint ▸ this repo (`render.yaml`, service `ttp-play`, Ohio, always-on paid instance). Set the secrets Render prompts for: `SUPABASE_SECRET_KEY` (Settings ▸ API Keys) or the legacy service key, `SUPABASE_JWT_SECRET` (the project still signs user tokens with the legacy HS256 secret), optional `EXPO_ACCESS_TOKEN`. Check `https://<service>.onrender.com/healthz`. Then `update app_settings set value = jsonb_set(value,'{url}','"wss://<service>.onrender.com/ws"') where key = 'multiplayer'`. Optional: CNAME `play.ticklethepig.com` → the service, then point `url` there.
4. **Landing site** (Vercel, ≥ 24 h before the build reaches testers): deploy `landing/` with the `/play/*` AASA path, the `/play/:code` rewrite and `landing/play/index.html`; verify `https://app-site-association.cdn-apple.com/a/v1/ticklethepig.com` lists `/play/*`.
5. **Build** (local EAS, changelog first per CLAUDE.md): the binary carries the door, routes and boards; the flag keeps them dark for everyone but `is_test`.
6. **Playtest** with test accounts (§8.2) and watch: queue fill and wait, live vs async share, completion, forfeits, rematch rate, invite acceptance, and Mud Volley's depth metric (do winners' follow-through rates differ from losers'?).
7. **Open the door**: `update app_config set enabled = true where key = 'multiplayer'` (one row, no binary). Switch a single game off with `app_settings.multiplayer.games.<id> = false`.

## 10. Operations, limits, risks

- **One instance holds every live table in memory.** Deploys and restarts end live tables as no contest (state is persisted, async tables resume). Deploy when no live rooms are open (`/healthz` reports counts); `autoDeployTrigger` is off for v1. Scaling out later needs sticky routing or a shared room directory (Render Key Value) plus forwarding.
- **Auth today is HS256** with the legacy JWT secret; plan the move to Supabase's asymmetric signing keys (the verifier already branches on `alg` and supports JWKS). The legacy anon key the app ships is scheduled for removal by Supabase in late 2026; a build with a publishable key should ship before then.
- **Population**: at tens of daily players, live matches will often find nobody; play-by-push and invites carry the feature until there's a rendezvous hour. Measure before adding queues.
- **Depth**: a rating cannot manufacture skill. If Mud Volley's reads don't separate winners from losers in playtests, change its rules, not its rating.
- **Safety**: no free text; blocks are respected in matchmaking, invites and tables; direct invites only reach friends and crewmates; invite codes expire and lookups are rate-limited.
- **Cost**: one always-on Render instance (≈ $7–25/month by size); Expo pushes are free; Supabase writes are a handful per table.

## 11. Open questions

See the end of the final report and each exploration's open questions. The two that change the build: whether a practice pig may fill a seat in a *casual* table when humans are thin (today: never), and whether multi-seat tables feed the hidden rating (today: two-seat competitive only).
