# Are the five games fun? Codex audit and playtest plan (2026-10-07)

The owner asked: before any more servers, pushes and builds, find out what is actually fun, make gameplay testing better, and find an easier way to get testers onto the right build. Six Codex runs (`codex exec`, model `gpt-6-astra`) answered:

- One audit per game. Each read the rules, the board UI and the design exploration, then ran strategy simulations through the real engine: thousands of games per strategy, 100,000+ per game. The reports are in this folder.
- One read-only review of distribution options and the testing process: [playtest-and-distribution.md](playtest-and-distribution.md).

Simulations measure rules and bot behaviour, not enjoyment. Nobody has played these games with people yet. That is the next step, not something to infer.

## Scorecard

| Game | Score | Verdict | The moment that works | What sinks it today |
| --- | --- | --- | --- | --- |
| [Rootle](rootle.md) | 5/10 | fix | "Bank these 18, or risk them because your barn is catching mine." | 4-pig tables average 6 minutes with 4.5 minutes of waiting each. "Trot home now to reach 50" is bad advice: at 45–45 with 8 in the basket, banking wins 38%, rolling wins 72%. |
| [Fence the Pen](fence_the_pen.md) | 5/10 | fix | "I left you two pens so I could take the rest." | 3–4 pig tables are mostly seat order and kingmaking. A beginner who grabs pens loses 96% to the practice bot. The first pen arrives about 3 minutes in. |
| [Mud Volley](mud_volley.md) | 4/10 | fix | The lanes lock, the ball flies: a catch, or a splat. | A match lasts 43 seconds: six tosses is too few to read anyone. By post, a pig who never plays can win (41.6% against an active player), and the result counts. |
| [Snout Says](snout_says.md) | 5/10 | fix | "You picked *that* to mean *this*? Now I get it." | Cancelled clues stay visible and also remove three wrong answers, so matching clues becomes a bonus. Ten seconds to scan 21 pictures rushes newcomers. |
| [Out Looking](out_looking.md) | 5/10 | fix | "I thought you'd chase the Farmhouse, so I went to the Hedge, and you followed me." | The order that decides who gets paid when pigs meet is never shown. The night of rest after a pile is taken leaves many rounds with only one sensible choice. Matches are under a minute. |

Codex found no game worth cutting outright and none ready to ship. Every core has a real moment. The packaging around each one is what fails.

## What all five share

1. **By post is broken in every game.** The clocks contradict "a move a day". All checked in code on 2026-10-07:
   - Rootle gives 12 h to start a turn but 60 s per roll after that (`multiplayer/games/rootle/rules.ts:47`): 0–0.7% of games finish normally when players visit once a day.
   - Snout Says uses 12 h windows (`snout_says/rules.ts:40`): 18% of two-pig games finish normally.
   - Out Looking uses 20 h: half of daily duel picks time out.
   - Fence uses exactly 24 h, with no slack.
   - Mud Volley fills a missing envelope with random picks (`mud_volley/rules.ts:530`), and `ratedPair` (`server/src/results.ts:53`) counts the result with no check that anyone played.
2. **Live length misses the 2–5 minute target both ways.** Mud Volley (0.7 min), Out Looking (~1 min) and Snout Says (~1.3 min) are too short to learn anything about the other pig. Rootle at 4 pigs (6 min) and Fence (5.3 min) run long, mostly as waiting.
3. **Every how-to leaves out a rule a newcomer needs.** Rootle's Hungerer is face 1 (1 in 6). Mud Volley's choices are simultaneous and secret. In Fence, the fourth fence claims the pen. Out Looking pays "up to one" find. Snout Says' tray is separate from the nine answers.
4. **Tuning is compiled, so every experiment needs a build.** Round counts, clocks and payoffs live in the rule files. The server can switch a game off but cannot tune it. The owner's rule is server config over client constants, so add a per-room tuning snapshot the server chooses and freezes at match start.
5. **Practice bots teach the wrong lessons.** The Out Looking bots crowd together on 95% of picks. Mud Volley's "equilibrium" bot is exploitable. Rootle's bot always takes the bad finish-line advice. Fence's bot punishes beginners without teaching them.
6. **Order effects.** Rootle's first seat wins 53.4% of two-pig games, Fence's 3–4 pig seat splits are extreme, and Out Looking's hidden sharing order decides payouts.

## Recommended order of work

1. **Before anyone plays (about a day):**
   - Hide "by post" for all five. The pace list is compiled, so this is a small change.
   - Fix Mud Volley's absent-player win.
   - Replace Rootle's "Trot home now" line.
   - Make matching Snout Says clues merge into one instead of cancelling.
   - Show Out Looking's sharing order.
   - Rewrite the five how-tos from the audits' copy.
   - Play Fence 2 pigs only for now.
2. **A playtest surface (1–2 days):** see Distribution below. Add a one-tap "Was that fun? Yes / So-so / No" to the result sheet and log each match as JSONL on the server.
3. **Playtest night:** run the runbook in [playtest-and-distribution.md](playtest-and-distribution.md) §4. The deciding metric in every audit is the same: **do players, especially the losers, start another match without being asked?**
4. **Then iterate:** per-room server tuning, so a rule variant reaches the next table without a build. Turn the audit sims into `server/scripts/balance.ts` and a nightly job.

None of this needs the production rollout (the database push, Render, the landing deploy, TestFlight). That rollout is for real strangers matchmaking over the internet, once a game has earned it.

## Distribution: what was verified

Codex recommends a **browser playtest build on its own Vercel URL, with the play server on a Mac behind a tunnel**. Testers get a personal link, type a name and sit down: about 2–3 taps, no App Store or TestFlight. Its fallback is the existing dev client over a Metro tunnel. Over-the-air updates (EAS Update) are the long-term upgrade for native testers.

Checked against the app on 2026-10-07:

- **The web build is closer than Codex assumed.**
  - The whole app exports for web: `npx expo export --platform web`, 7.4 MB, exit 0. Served locally, it boots to the sign-in screen in Chrome with no console errors.
  - `/play` renders. With the flag off, it shows "Play together is on its way".
  - With a dev web server and the play override, the hub renders and **Rootle and Mud Volley practice tables play in the browser**: the die rolls, the pasture draws, the lane cards work. The only console item is a dev-mode React warning about `accessible={false}` on a DOM node.
  - So Codex's separate `playtest-web/` project may not be needed. A build-time playtest mode on the existing web export could do the job. Its 12–20 h estimate is probably high.
- **Confirmed blockers:**
  - The play overrides only work in dev builds (`utils/multiplayer/config.ts:71`), so a real playtest build needs an explicit playtest switch.
  - The server refuses anonymous Supabase sessions (`server/src/auth.ts:107`), so guest players need a playtest ticket mode on the server.
  - The invite page blocks signed-out visitors.
- **Not verified:**
  - Signed-in web flows.
  - Safari on an iPhone.
  - Live multiplayer over the WebSocket from a browser.
- **Over-the-air updates need one more native build first.** `expo-updates` is not installed, and `ios/ttp/Supporting/Expo.plist` sets `EXUpdatesEnabled` to false.

## Re-running the simulations

The scripts are local only, kept with the repo's other audit evidence under `artifacts/fun-audit-2026-10-07/` (gitignored). That folder has `multiplayer` and `server` symlinks so they run unchanged:

```sh
cd artifacts/fun-audit-2026-10-07
TSX_DISABLE_CACHE=1 node --import ./server/node_modules/tsx/dist/loader.mjs codex-sims/rootle/audit.ts
```

Each game's report lists its entry points (`audit.ts`, `tuning.ts`, `timeouts.ts`, `decisions.ts` and so on). Run them after a rule change and compare against the numbers in the reports.
