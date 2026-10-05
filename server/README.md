# ttp-play: the Tickle the Pig play server

The authoritative WebSocket host for matchmade games. Every rule lives in
`../multiplayer/` (shared with the app, which runs the same engine for
Practice); this server owns the clock, the seed and every accepted move, and
adds sockets, matchmaking, invites, pushes and persistence around it.

```
app ──wss /ws──▶ hub ──▶ matchmaker / invites / rooms ──▶ multiplayer/engine + games
                  │                     │
                  └── http (/healthz, /v1/invites/:code)   └── store (Supabase or memory), Expo push
```

## Run it locally

```sh
cd server
npm install
npm run dev            # tsx watch; reads server/.env if present (see .env.example)
```

With no configuration the server listens on `:8787` with dev auth (tokens
`dev:<userId>[:<name>]`), the in-memory store, pushes printed to the log, and
every pig allowed in. Set `STORE_FILE=./.play-store.json` to keep tables
across restarts (play-by-post games survive a `dev` reload).

Point a development build of the app at it with the dev-only override
(`utils/multiplayer/config.ts`):

```sh
EXPO_PUBLIC_PLAY_URL=ws://localhost:8787/ws NODE_OPTIONS="--max-old-space-size=16384" npx expo start
```

(the simulator reaches `localhost`; a device needs your Mac's LAN address).
The app signs in with its real Supabase session. Dev auth accepts those too
once `SUPABASE_URL` and `SUPABASE_JWT_SECRET` are set, alongside `dev:`
tokens, so one local server can seat the simulator and `npm run bot` pigs
together (keep `STORE=memory`; a pig the memory store has never seen plays as
"a pig").

## Tests

```sh
npm run typecheck      # tsc over src, test, scripts and ../multiplayer
npm test               # node:test via tsx: test/*.test.ts
npm run e2e            # every game in the registry, every way a table happens
npm run build          # esbuild → dist/index.js (node_modules stay external)
```

`npm test` runs the real server on an ephemeral port against toy games
(`test/fixtures/games.ts`), an in-memory store, a recording push sender and a
manual clock, so deadlines, grace windows and countdowns move only when a
test says so. Tests never touch Supabase or Expo.

`npm run e2e` boots the server in-process and plays every game in
`multiplayer/games/index.ts` with bot pigs over real sockets: a queue match,
a link invite, a direct invite, a drop-and-return inside the grace, a drop
past it (forfeit or ended early), a table by post filled later, and a
rematch. Every snapshot sent is checked against the game's `secretsOf`.
Flags: `--fixtures` (toy games instead), `--game <id>`, `--verbose`,
`--timeout <ms>`. It prints a game by scenario table and exits 1 on any
failure.

## Play against a bot from the simulator

```sh
# terminal 1: dev auth that also takes the app's real session
SUPABASE_URL=https://wbcnhvvakptoinwkulmn.supabase.co SUPABASE_JWT_SECRET=... npm run dev
# terminal 2
npm run bot -- --game fence_the_pen
# terminal 3: the app, pointed at the local server
EXPO_PUBLIC_PLAY_URL=ws://localhost:8787/ws NODE_OPTIONS="--max-old-space-size=16384" npx expo start
```

Then queue for Fence the Pen in the app: the bot takes the other chair, plays
with the game's own practice bot after a short pause, and re-queues after
every table (it will not re-pair with you for 20 s, by the recent-opponent
rule). Options: `--url`, `--pace live|async`, `--invite CODE` (take your
invite instead of queueing), `--count N` (several bots: they pair with each
other too), `--token` (a specific dev token, or a real access token against
a Supabase-auth server).

## Deploy (Render Blueprint)

`render.yaml` at the repo root defines one web service, `ttp-play`. First time:

1. In Render: **New > Blueprint**, connect the GitHub repo, pick the branch
   (Blueprints cannot be created through the API).
2. Fill the `sync: false` secrets when prompted (only prompted on creation):
   - `SUPABASE_SECRET_KEY`: an `sb_secret_…` key (Settings > API Keys), or
     set `SUPABASE_SERVICE_ROLE_KEY` instead;
   - `SUPABASE_JWT_SECRET`: the project's legacy JWT secret. User tokens are
     still HS256-signed, so this lets the server verify them locally;
   - `EXPO_ACCESS_TOKEN`: only if Expo enhanced push security is on.
3. Deploy. Health check: `GET /healthz`.
4. Point the app at it: `app_settings.multiplayer.url` = `wss://ttp-play.onrender.com/ws`
   (or a `play.ticklethepig.com` CNAME added in Render and at GoDaddy).
5. Open the gate when ready: `feature_overrides.multiplayer` per pig (is_test
   pigs already have it) or `UPDATE app_config SET enabled = true WHERE key = 'multiplayer'`.
   Games switch off individually with `app_settings.multiplayer.value.games`
   (`{"games": {"rootle": false}}`; absent means on).

Auto-deploy is off: deploy by hand (`render deploys create` or the
dashboard) at a quiet moment, ideally with no live tables. The build filter
only considers `server/**`, `multiplayer/**` and `render.yaml`.

The `play_*` tables come from `supabase/migrations/20261004230000_matchmade_play.sql`.
Until that migration is pushed, each missing table is logged once and held in
memory, so the server still runs matches (results and ratings are lost on
restart until then).

## Configuration

| Variable | Default (production / local) | Notes |
|---|---|---|
| `PORT`, `HOST` | `8787`, `0.0.0.0` | Render injects `PORT` |
| `NODE_ENV` | | `production` refuses dev auth |
| `AUTH_MODE` | `supabase` / `dev` | |
| `SUPABASE_URL` | | needed for supabase auth or store |
| `SUPABASE_SECRET_KEY` | | or `SUPABASE_SERVICE_ROLE_KEY` |
| `SUPABASE_JWT_SECRET` | | HS256 verification (primary path today) |
| `SUPABASE_PUBLISHABLE_KEY` | secret key | apikey for the `/auth/v1/user` fallback |
| `EXPO_ACCESS_TOKEN` | | Expo push auth, when required |
| `PUSH_MODE` | `expo` / `log` | |
| `STORE` | `supabase` / `memory` | |
| `STORE_FILE` | | JSON file behind the memory store |
| `ACCESS` | `flag` / `all` | `flag` = `feature_overrides.multiplayer ?? app_config.multiplayer.enabled` |
| `HEARTBEAT_MS` | 25000 | protocol ping cadence; also sent to clients |
| `IDLE_TIMEOUT_MS` | 70000 | socket silent this long is closed (4006) |
| `RECONNECT_GRACE_MS` | 20000 | a dropped live seat's chair is held this long |
| `COUNTDOWN_MS` | 3000 | "Found a pig!" beat |
| `REMATCH_WINDOW_MS` | 30000 | |
| `EMOTE_COOLDOWN_MS` | 2000 | |
| `PARTY_GATHER_MS` | 6000 | a party table waits this long for more pigs |
| `LOBBY_HOST_WAIT_MS` | 120000 | a full lobby waits this long for an away host |
| `ASYNC_OPEN_SEAT_TTL_MS` | 259200000 (72 h) | an unfilled table by post is called off |
| `ASYNC_INVITE_TTL_MS` | 86400000 (24 h) | a play-by-post invite of any kind; live invites keep 15 min (direct, crew) and 60 min (link) |
| `AUTH_TIMEOUT_MS` | 5000 | first frame must be `auth` |
| `SETTINGS_POLL_MS` | 60000 | dark-launch switches are re-read |
| `MAX_ROOMS` | 5000 | tables in memory |
| `LOG_LEVEL` | `info` | JSON lines; tokens and seeds never logged |

## Operating it

- **Health**: `GET /healthz` → `{ ok, uptime, connections, rooms, version }`
  (version carries the git commit on Render).
- **Logs**: one JSON object per line (`msg` plus fields): "pig signed in",
  "token refused", "play table missing in Supabase", "push ticket error",
  "retiring a table this server cannot run", ... Search them in the Render
  dashboard.
- **Close codes** the app should know: 4001 auth timeout, 4002 protocol
  mismatch (update the app), 4003 bad token (refresh the session), 4004 not
  allowed yet, 4005 signed in elsewhere, 4006 idle, 4008 too many frames,
  1011 try again, 1012 server restarting (reconnect), 1013 auth unavailable
  (retry with backoff).
- **Graceful restarts**: on SIGTERM the server stops matchmaking, tells every
  pig `server_restarting`, writes every table, closes sockets with 1012 and
  exits 0, all within 10 s. On boot it brings back every play-by-post table
  and invite lobby, retires live tables nobody can still be playing (a no
  contest), and leaves fresh live tables in the store until a pig rejoins:
  a live table resumes inside the reconnect grace, with its revision jumped
  past anything a client could hold.

## Scaling notes

One instance holds every live table in memory, so `numInstances` stays 1.
Render has no sticky sessions and keeps the old instance up for about a
minute after a deploy cuts over, so a deploy splits any table whose pigs
reconnect during that minute. (VERIFY: that sockets already open on the old
instance really survive that minute rather than being cut at the switch; one
test deploy settles it.) The server softens this (play-by-post tables
re-read the store before their first change; stale live tables are only
retired when their clock has also run out), which is why deploys are manual
and best done with no live tables. Scaling out would need a room directory
and cross-instance routing (Render Key Value with pub/sub, or forwarding to
the owning instance over the private network); see
`docs/multiplayer/research/platform-notes.md`.

## Layout

```
src/
  index.ts        entry: config, store, server, signals
  server.ts       createPlayServer: wires everything, all injectable
  config.ts       environment → typed config
  auth.ts         token verification (HS256 secret, JWKS, /auth/v1/user, dev)
  hub.ts          sockets: auth, sessions, heartbeats, rate limits, dispatch
  http.ts         /healthz, /v1/invites/:code, /
  players.ts      cards, the gate, social graph, hidden ratings
  settings.ts     dark-launch switches and the catalog
  matchmaker.ts   live queue, party gathering, open seats by post
  invites.ts      direct, link and crew invites
  rooms.ts        tables: commit, timers, presence, persistence, results
  results.ts      play_results rows and rated pairs (pure)
  push.ts         Expo push (batches, receipts) and the notifier
  copy.ts         every player-facing line
  store/          Store interface, memory and Supabase stores
  clock.ts, tasks.ts, entropy.ts, ratelimit.ts, rating.ts, reply.ts, log.ts
test/             node:test suites, toy games, harness
scripts/          e2e harness, bot CLI, lib/botClient.ts
```
