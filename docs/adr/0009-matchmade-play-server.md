# Matchmade play runs on an authoritative play server, from shared rules

Date: 2026-10-04. Supersedes the transport section of
`docs/explorations/2026-10-01-matchmade-play/matchmaking-spec.md` (Supabase-only
authority). Charter ruling: `SKILL.md` decision log, 2026-10-04. Plan:
`docs/multiplayer/README.md`.

## Context

The founder asked for multiplayer games with random matchmaking, friend
invites by link and push, and head-to-head play, on a Render subscription they
already pay for. The 2026-10-01 exploration had specified Supabase alone:
plpgsql RPCs as the authority, Realtime private channels as transport, lazy
reconciliation of deadlines. Five games were then chosen (Rootle, Fence the
Pen, Mud Volley, Snout Says, Out Looking), each with turn clocks, hidden
information and timeout defaults.

## Decision

1. **One pure TypeScript rules module per game** (`multiplayer/games/<id>/rules.ts`)
   implements `GameDefinition` (`multiplayer/types.ts`). The same module runs on
   the server (authority), in the app (Practice against bot pigs) and in tests
   (fuzzed with bots, checked for leaks). `multiplayer/` imports nothing
   platform-specific (lint-enforced).
2. **One pure room engine** (`multiplayer/engine.ts`) turns a game into a table:
   phases, revisions, the clock rule, timeouts, departures, the idle no-contest,
   rematch, per-seat snapshots. Every function takes `now`; it holds no timers,
   sockets or storage.
3. **An authoritative Node WebSocket server on Render** (`server/`, `render.yaml`)
   wraps the engine: Supabase JWT auth (HS256 today, JWKS ready), live and
   play-by-push matchmaking, invites, Expo pushes, persistence to four
   service-role tables (`20261004230000_matchmade_play.sql`). One always-on
   instance; Ohio, beside the database.
4. **Supabase stays the system of record**: identity, profiles and looks, blocks,
   friendships, crews, push tokens, results and the wins board. Clients read
   their own results and `play_leaderboard`; they never write play tables.

## Why not Supabase alone

Five games in plpgsql would make every rules change a migration (gated on a
push "go") plus a binary for Practice, and every turn clock a lazy
reconciliation. A single Node process gives atomic matchmaking without locks,
real timers, per-socket hidden-information projection, and a rules module that
is unit-tested and shared with the client. The cost is one more service: a
paid instance, secrets, and deploys that end live tables (async tables resume
from persisted state).

## Consequences

- A rules change ships as a server deploy (bump `rulesVersion`; only equal
  versions pair). Practice picks it up with the next binary.
- One instance holds every live table in memory. Deploy when no live rooms are
  open; scaling out later needs sticky routing or a shared room directory.
- The app connects only while a Play surface needs it (ref-counted), so idle
  players hold no socket.
- Auth depends on the legacy HS256 secret until the project moves to Supabase's
  asymmetric signing keys; the verifier already branches on `alg`.
- The engine's semantics are part of the contract: a departed pig never wins;
  an open async chair counts as present; a table where everyone idles out is a
  no contest; a co-op result belongs to everyone who sat at the table.
