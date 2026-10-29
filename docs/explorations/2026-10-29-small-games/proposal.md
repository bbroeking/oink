# Small games for today's window (2026-10-29)

Written 12:30–13:15 EDT for the founder. The brief: exploratory proposals for small games, multiplayer allowed, scoped to what one Opus engineer can build in **three hours from 13:45** with **existing art only**, for a binary packaged by 18:30. No OTA exists, so anything not in this binary waits for 1.5. A season after The Great Hunger (prod `snout_season_1` ends **2026-11-12 00:20 UTC**) is being designed in parallel; games that feed the season are a plus.

Everything below was run through `SKILL.md`'s lens (pillar · one sentence · fair by construction · losing stays warm · the reward pipeline can feed it) and checked against what already exists so nothing duplicates a live loop.

---

## 1. Matchmade Play: where it stands

### What is built

The whole feature is on `feat/matchmade-play` (commits `f7019028`, `961a508c`, `e13be0d3`, `04823d18`), dark behind the `multiplayer` flag:

- **Shared rules**: `multiplayer/` (types, engine, protocol, rng, five `games/<id>/rules.ts`), pure and lint-fenced; the app runs the same module for Practice.
- **Play server**: `server/` (Node 24, WebSockets, Supabase JWT auth, live + play-by-push matchmaking, invites, Expo push, persistence), `render.yaml` blueprint (`ttp-play`, Ohio, paid 512 MB instance, manual deploys). Tests: `npm test`, `npm run e2e`.
- **App**: Play door on Friends (`components/play/PlayDoor.tsx`), hub (`app/play/index.tsx` → `PlayHub`), invite landing (`app/play/[code].tsx`), wins board (`app/play/wins.tsx`), one match screen for real and Practice tables (`app/match/[roomId].tsx` → `MatchScreen`), five boards (`components/play/games/*`), client SDK (`utils/multiplayer/*`, `hooks/useMultiplayer.tsx`). Art is in the binary: `assets/images/play/` (icons, Rootle die faces, Fence rail/post/pen, Mud Volley pieces, Out Looking places). Snout Says reuses the finds and dig glyphs.
- **Migration**: `supabase/migrations/20261004230000_matchmade_play.sql` (four service-role tables, `play_leaderboard`, `app_config.multiplayer = false`, `feature_overrides.multiplayer = true` for `is_test`, `app_settings.multiplayer.url`). Harness-validated, **not pushed**.
- **Practice needs no server**: `usePlayCatalog` builds `practiceGames` from the app's own registry. Find a pig / invites refuse with `offline` when the server is unreachable.

### What it needs to go live (verified today)

| Step | State today | Who |
| --- | --- | --- |
| Database push of `20261004230000` | Not applied. The Supabase CLI has no access token (`AccessTokenRequiredError` on `migration list --linked`); Phase 0.1 of `docs/plans/2026-10-29-consolidate-and-ship.md` is still open. Five other unpushed files would ride the same `db push` unless set aside (`20261004231000`, the two 10-14 Halloween files, and the two 09-22 files that need re-timestamping). | Founder "go" |
| Render service | **Not deployed**: `https://ttp-play.onrender.com/healthz` answers `404` with `x-render-routing: no-server`. Blueprint creation is a dashboard step (New › Blueprint) with two prompted secrets, `SUPABASE_SECRET_KEY` and `SUPABASE_JWT_SECRET` (optional `EXPO_ACCESS_TOKEN`). The migration already seeds the onrender URL into `app_settings.multiplayer`, and the compiled fallback matches. | Founder (dashboard) |
| Landing site | `landing/play/index.html` + the `/play/*` AASA path need a Vercel deploy at least 24 h before testers for universal links. Push invites carry the code and route in-app without it; only pasted links depend on it. | Founder "go" |
| App Review | Low risk as designed: no free text anywhere (six emote stickers), `user_blocks` respected in matchmaking, invites and tables, invite codes expire and are rate-limited, so Guideline 1.2 (UGC filtering/report/block) is met by construction. Keep the review demo account **out of** `feature_overrides.multiplayer` so Review never sees a door to an undeployed server. Nothing in the feature runs sockets in the background (ref-counted connection). | Nobody today |
| Rules fixes | The audit's "before anyone plays" list (below) is compiled, so it only reaches players through a binary. | Opus, if chosen |

### The fun-audit verdict (Codex, 2026-10-07, `docs/multiplayer/fun-audit-2026-10-07/`)

| Game | Score | Verdict | What sinks it today |
| --- | --- | --- | --- |
| Rootle | 5/10 | fix | 4-pig tables are 6 min of mostly waiting; the "Trot home now" line is bad advice; first seat wins 53% |
| Fence the Pen | 5/10 | fix | 3–4 pigs is seat order and kingmaking; beginners lose 96% to the bot; first pen at ~3 min |
| Mud Volley | 4/10 | fix | 43-second matches; by post an absent pig wins 41.6% and it counts |
| Snout Says | 5/10 | fix | cancelled clues stay visible and still prune answers; 10 s to scan 21 pictures |
| Out Looking | 5/10 | fix | the sharing order that decides payouts is never shown; sub-minute matches |

Shared: **play-by-push is broken in all five** (clocks contradict "a move a day"), live length misses 2–5 min both ways, every how-to omits a rule, tuning is compiled, bots teach the wrong lessons. "No game worth cutting, none ready to ship. Nobody has played these with people yet."

### Recommendation: keep all five dark in this build

Turning any of them on today is not a client decision: the server does not exist, the migration is unpushed, the CLI cannot push, and the audit says none is ready. Flip nothing. Two things *are* worth the binary, because they are compiled and the binary is the scarce resource:

1. **Trim the pace lists to `live` only** in all five `rules.ts` (hide play-by-push until the clocks are redesigned) and **cap Fence the Pen at 2 seats**. Small, test-covered, roughly 45 min.
2. **Rewrite the five how-tos** from the audits' copy and replace Rootle's "Trot home now" line. Copy only, roughly 45 min.

The rules changes that need the server too (Mud Volley's absent-player win, Snout Says clue merge, Out Looking's visible order) can wait for the server's first deploy, because `rulesVersion` pairing means the server and this binary's Practice can diverge without breaking a table. Everything else in the go-live list is a founder afternoon on another day: push → Blueprint → `/healthz` → landing deploy → `is_test` playtest (two phones, §8.2 of the plan) → flip `app_config.multiplayer`.

A tempting shortcut, **Practice-only Play without a server**, is not recommended: the hub still shows Find and Invite (they fail `offline`), the `multiplayer` row only exists after the push, and the audit found the practice pigs actively mis-teach the games.

---

## 2. New small games

### What already exists (so nothing below repeats it)

Snout Deep (the once-per-feeding press-your-luck dig), the Drum (one ball per dig, Monday purse), the Porch Round (three doorsteps make a scrapbook page), Barn visits (tickle the host, swap a Find for the host's wish), Errands (send a Pen pig for a friend's wished Find, one per pig per local day), the Ghost Sheep Trader (sells Finds for tickles, one 6 h visit per local day), the Halloween login gift (campaign off), the five Play tables, and two dev-gated prototypes: the card packs (88-card art set, `features/cards/domain/hedgeRun.ts` has rules and six tests) and Old Wisp.

### Reward rules every proposal obeys

From the decision log: tickles that count toward `tickles_earned` are the season tiebreak and must never be minted by a side loop (2026-07-17, spec 15); no rank or side loop grants tickles or snouts (2026-09-22); matchmade tables touch no currency at all (2026-10-04). The honest lanes a small game may use:

- **Nothing minted**: the reward is a visit, a swap, a reveal, a share line, or a page in a book. Cheapest and safest.
- **Pass XP** via `grant_season_xp(uid, amount)` (definer-only since `20260780500000`; called from a new `SECURITY DEFINER` RPC, once per UTC day, small amounts in the 2026-06-13 social-XP band of +3 to +5). Feeds the season without touching tickles.
- **Spendable tickles** via `grant_tickles` (the bank, never `tickles_earned`): the weekly-spoils precedent. Only with a hard daily cap, and only if the founder wants a purse.
- **Never drum balls**: `_monday_draw_balls` counts `rooting_receipts`; a game must never fake a dig.

### Proposal A: The Sheep's Riddle (solo daily, shared by everyone)

**Pitch.** *The Ghost Sheep won't say what he's thinking of. He nods at three pictures from the hedge: a pinecone, a tin whistle, a lantern. Nine things lie in the mud below. Only one of them is kin to all three. Two guesses. Everyone in the herd gets the same riddle today, so when Pepper says "got it in one", you know exactly what she means.*

- **Pillar fit.** Connect (one shared riddle a day is a reason to talk; "did you get today's?" is a text message) and Collect (the Finds and dig things are the whole deck, and you learn them). One sentence: *three clues, nine answers, one is kin to all three.*
- **Loop.** Once per UTC day: open the riddle, study three clue tiles, tap one of nine; a wrong first guess greys the tile and the sheep shakes his head; the second guess resolves. Solved or not, the answer is shown with the tags that made it kin, and a share line ("Riddle 12 · got it in 2") copies to the clipboard (text, no emoji).
- **Multiplayer model.** Solo, but synchronous in spirit: the puzzle is a pure function of the UTC date, so every pig sees the same one. v2 (server): "4 of your Sounder got it" under the answer.
- **Reward hook.** v1 mints nothing: the solve and the share line are the reward, and the Burrow Book pattern (a local "riddles solved" count) is enough. v2 rides the season migration: `claim_daily_riddle(day)` → `grant_season_xp(auth.uid(), 5)`, once per day. v3 ties it to the Trader: the answer *is* the sheep's fancied Find for the day, so solving tells you what he pays double for before he arrives (the hint is the prize; no currency moves).
- **Server needs.** None for v1. v2 is a 20-line RPC plus a `daily_riddle_claims (user_id, day)` table.
- **Art.** All existing: `assets/images/glyphs/finds/` (12), `assets/images/glyphs/dig/` (15), `assets/images/trader/ghost_sheep.png`, the wish bubble.
- **Client files.** `utils/dailyRiddle.ts` (pure generator over the Snout Says deck and `kinship(a, b)` in `multiplayer/games/snout_says/deck.ts`; picks a secret, three clues sharing a tag with it, eight decoys such that exactly one of nine is kin to all three; falls back to the next seed if no deal exists, with a test that pins every date in 2026–2027 deals) and `__tests__/dailyRiddle.test.ts`; `app/riddle.tsx` (screen on `StackPage`, `Sticker`, `Glyph`, `Button`, tokens only); a `Riddle` row on the Barn button's fan beside `Trader` (where today's daily things already live); local solved-state in AsyncStorage keyed by day.
- **Estimate.** 2 to 2.5 h including tests and a simulator screenshot. The generator is the only real logic; the screen is a grid of existing glyph tiles.
- **Fun risk.** A machine-made clue can feel arbitrary if the tag overlap is thin ("why is a boot kin to honeycomb?"). Mitigation: require two shared tags between each clue and the secret when the deck allows it, and show the tags on the reveal so every answer teaches. Second risk: a solved riddle is 20 seconds; that is fine for a daily, wrong for anything that expects a session.

### Proposal B: Whose Pig? (solo daily, about your friends)

**Pitch.** *Here's a pig in a tophat and a marsh wreath, standing in front of a firefly lantern. Which of your friends is that? Four names. Get it right and you can go say hello; get it wrong and you'll want to go look.*

- **Pillar fit.** Connect, squarely: the game is noticing your friends' pigs, and every reveal ends on a **Visit** button, which feeds the Barn visit, the pair's visit streak and the swap. Collect, lightly: friends' looks are the showcase. One sentence: *whose pig is this?*
- **Loop.** Once per day, three rounds: a friend's dressed pig (and optionally their Barn background) is drawn from their profile look, the player picks one of four friend names, the reveal names the pig and offers Visit. No score, no streak; a scrapbook line ("you knew 2 of 3 today").
- **Multiplayer model.** Solo over friend data; async by nature.
- **Reward hook.** Nothing minted. The visit is the reward, and it already pays by its own rules.
- **Server needs.** None: friend looks are already read by the Friends tab and `utils/multiplayer/looks.ts`; the visit renders a host's Barn today.
- **Art.** Existing pig portraits with worn items (`PrestigeAvatar` / `TablePig`), habitat backgrounds.
- **Client files.** `utils/whosePig.ts` (pick three friends whose looks differ from the default and from each other; pick decoys), `app/whose-pig.tsx`, a card on the Friends tab (`?seg=friends`).
- **Estimate.** 2 h. Rendering a friend's look is the only part with unknowns (which hook gives the full worn set outside a visit).
- **Fun risk.** Real. It needs at least four friends with distinguishable pigs; early players have neither, and many pigs wear nothing. The empty state ("make four friends, dress a pig") is honest but means the game is invisible to exactly the players Connect most needs. Ship after Proposal A, not before.

### Proposal C: One Basket (solo daily Rootle, the herd's baskets beside yours)

**Pitch.** *One basket a day. Roll for truffles as long as you dare; roll the Hungerer and he eats the basket; bank when your nerve goes. Your Sounder's baskets sit on the same shelf tonight, unranked: Clover 14, you 22, Bandit woke him on the first roll.*

- **Pillar fit.** Contend, as a daily beat that resets every midnight (no standing outlives the day), and Connect through the shelf of the herd's baskets. One sentence: *roll until you bank or he wakes.* It is the solo sibling of Rootle, which the audit found has a real moment that only lands with a rival; the rival here is the shelf.
- **Loop.** Open, roll (one tap per roll, die art tumbles), bank or keep rolling; one basket per UTC day. The Sounder's shelf shows every crewmate's banked basket today, unordered, and a crewmate who hasn't rolled is simply absent (never a zero).
- **Multiplayer model.** Solo play, herd-async display. No table, no server-side turn.
- **Reward hook.** Pass XP, capped: `+3` for banking anything, `+2` more for a basket of 20 or better, once per day, through `grant_season_xp`. Tickles and snouts never. The shelf is the real prize.
- **Server needs.** A migration: `daily_baskets (user_id, day, seed, rolls int, basket int, banked bool, woke bool)` and three RPCs. `roll_basket()` returns the next face from `hash(seed, n)` so the client never sees ahead (fair by construction: the server deals one face at a time, the only choice is when to stop); `bank_basket()` locks it and grants the XP; `sounder_baskets(day)` reads the crew's shelf. Roughly 120 lines of plpgsql, harness-validated.
- **Art.** `assets/images/play/rootle/die_1..6.png`, the Hungerer faces in `assets/images/hunger/`, the truffle glyph.
- **Client files.** `utils/dailyBasket.ts` (RPC wrappers, parser), `hooks/useDailyBasket.ts`, `app/basket.tsx`, a Season page card or a fan row. The Rootle board (`components/play/games/rootle`) is a `BoardProps` renderer over a table view; borrow its die tumble and basket counter rather than mount it.
- **Estimate.** 3 to 3.5 h with the migration, which is over the window on its own, and the migration cannot be pushed today (CLI auth). The client would ship dark until the push, gated on the RPC's existence.
- **Fun risk.** Press-your-luck alone is thin; the audit measured exactly that. The shelf carries it only if the Sounder actually rolls daily, and a crew of two is a shelf of one. Also an honest charter tension: the shelf is lone pigs beside lone pigs inside the Sounder; unranked and daily keeps it on the warm side of 2026-10-04's amendment, but it is closer to the line than A or B.

### Proposal D: Same Patch (async friend challenge on one seeded dig)

**Pitch.** *I dug this patch and got three truffles before he stirred. Here, you dig the same one. Same mud, same roots, same sleeping Hungerer. Let's see who ties off better.*

- **Pillar fit.** Connect (a dig you send to one friend by name) and Contend (the most-loved loop, with a rival). Reuses the whole Snout Deep reducer and board (`utils/snoutDeep.ts`, `utils/rooting.generateLayeredBoard`). One sentence: *we dig the same patch; best basket wins.*
- **Loop.** Practice-mode board with a committed seed; challenger digs, sends the challenge (push: "Clover dug a patch for you"); the friend digs the same board once; the result sheet shows both digs side by side. No feeding is consumed; no truffles are banked for real.
- **Multiplayer model.** Async friend, two pigs, named invite only (the 2026-10-04 table rule: temporary, forgets itself).
- **Reward hook.** Nothing minted; the practice board already pays nothing. Optionally pass XP +3 for a completed challenge, capped per day.
- **Server needs.** `patch_challenges (id, seed, challenger, challengee, results jsonb, created_at)` plus `open_patch_challenge`, `submit_patch_dig(id, log)`, and the server must be able to **replay the log** against the seed to verify the basket, which means the Snout Deep rules in plpgsql, or trusting the client. Neither fits today.
- **Estimate.** 5 to 6 h even trusting the client. `generateLayeredBoard(seed, uniqueId?)` already takes a seed (server parity), so the board half is free; the cost is the challenge record, the push, the side-by-side result sheet, and the practice-vs-real lockout gate in `utils/digSession.ts` admitting a third mode.
- **Fun risk.** Low on the moment (the dig is proven); high on fairness if the client is trusted. This is the strongest *idea* on the page and the wrong one for a three-hour window. Defer, and consider making it the first "pig-native" Play game on the server, where the shared-rules seam already solves the replay problem.

### Proposal E: Hedge Run challenge (async friend, the cards)

Already half built: `features/cards/domain/hedgeRun.ts` (252 lines, six tests), the 88-card art in the binary, `docs/design/2026-10-13-card-quick-play-rules.md` ("implementable async pilot", named-friend challenges, both play a sealed 2–3 minute run against the same seed). Needs a run screen built from the dev-gated prototype components, a `hedge_run_challenges` table and two RPCs, and the sealed compare. 6 to 8 h, and `docs/plans/2026-10-29-consolidate-and-ship.md` puts every card screen behind the Claude Design gate (Phase D). Defer to 1.5; note it as the best async friend game on the shelf.

---

## 3. The slate for today

Three Opus hours, beside a season change that will take some of the same engineer's attention and all of the founder's push budget.

**Build: Proposal A, The Sheep's Riddle (v1, no server).** 2 to 2.5 h. It is the only proposal that is fun for a pig with zero friends, needs no migration, reuses art that is already in the binary, and gives the whole herd one shared thing a day. If the season migration is being authored anyway, add the 20-line `claim_daily_riddle` RPC to it so the +5 XP lands when that pushes; the client calls it only when the solve is fresh and treats a missing function as "not yet".

**If 45 minutes remain: the Play pace trims** (pace lists to `live`, Fence at 2 seats, the "Trot home" line). They cost nothing in review, keep the dark feature from embarrassing a future playtest, and are the only Play work the binary gates.

**Defer.** B (Whose Pig) until there is friend data worth quizzing; C (One Basket) to the next migration day, as a candidate for the new season's daily beat; D (Same Patch) as a server-side Play game; E (Hedge Run) behind the design gate. None of the five Play games turns on.

**Do not spend the window on** a Practice-only Play door, a server-backed game whose migration cannot be pushed today, or any game that needs a new sticker.

---

## 4. Open questions for the founder

1. **Should the Riddle feed the season at all?** v1 mints nothing. If yes, is +5 pass XP once a day the right size, and should it ride the season migration (one push) or wait?
2. **Is the Trader tie-in wanted** (the riddle's answer becomes the sheep's fancied Find for the day, so solving it is a hint worth double tickles at his visit)? It couples two daily loops; it also gives the riddle a reason beyond the share line.
3. **Does the Play binary get the pace trims today**, accepting that this build's Practice and a future server may run slightly different rules until the next binary?
4. **For the new season: is a daily beat wanted** (One Basket or the Riddle on the Season page), or does the season stay Feed · Draw · Pass with small games living on the fan and the Friends tab?
