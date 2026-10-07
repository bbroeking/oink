# Playtests and build distribution: plan and options (Codex, 2026-10-07)

> Written by Codex (`gpt-6-astra`) from a read-only review of the repo. Hours, prices and provider turnaround times are its planning estimates. Corrections from checking it against the app are in the [summary](README.md#distribution-what-was-verified).

**1. Minimum path to a real playtest this week**

**You need 2–4 people, a reachable play server, and a client they can open. The production rollout can wait.**

If everyone already has a compatible development client installed, the shortest path is **roughly 1–3 hours of preparation**:

- Run the existing Node server on the Mac with `STORE=memory`, `PUSH_MODE=log`, and `ACCESS=all`.
- Use Supabase authentication for the existing app, which sends its real session token.
- Expose port `8787` through an HTTPS/WebSocket tunnel.
- Start Metro with both development overrides enabled.
- Have everyone join the same **live** game, or use a link invite/code. Test Mud Volley in pairs; the other four games support 2–4 players.

These capabilities already exist in [server/README.md](../../../server/README.md:14), [server/src/config.ts](../../../server/src/config.ts:76), and [docs/multiplayer/README.md](../../../docs/multiplayer/README.md:112).

If testers have nothing installed, **build a small browser playtest surface first**. Budget **12–20 focused hours**, including phone-browser verification. That gives the owner the desired “receive a link, start playing” loop.

| Full rollout item | Needed for this first session? | Why |
|---|---|---|
| Multiplayer DB migration | **No** | The memory store supports matches, invites, results, and ratings. Persistence and the production wins board can wait. |
| Render deployment | **No** | The Mac plus a tunnel can host a scheduled session. |
| Marketing-site deployment and universal links | **No** | A browser client can use its own Vercel URL. Native testers can use codes or development links. |
| New TestFlight build | **Only if choosing TestFlight** | Browser play avoids it; an already-installed compatible development client can load current JS. |
| Production feature flag | **No** | The development override or a dedicated pilot provider enables the client; `ACCESS=all` enables server access after authentication. |
| Push notifications, friends/crew invites, public rankings | **No** | Schedule everyone together and use link invites. The memory store has no existing social graph. |

Optional `STORE_FILE` preserves memory-store data locally, but **a restart is still disruptive to live matches**. Deploy or restart between games.

[Local practice tables](../../../utils/multiplayer/localRoom.ts:1) already run the shared rules with bots and no server. Use them to check controls and explain games; they do not answer whether playing with people is fun.

**2. Distribution options**

The repository inspection establishes:

- **Installed:** `react-native-web`, React DOM, `expo-dev-client`, and the native modules used by the main app.
- **Absent:** `expo-updates`. The transitive `expo-updates-interface` package is not an OTA updater.
- Web is configured for Metro with `output: "single"`.
- EAS profiles exist for `development`, `preview`, `production`, and `testflight`; **none has an Update channel**.
- There is **no `runtimeVersion` or updates URL**, and the checked-in iOS configuration explicitly disables updates.
- `testflight` extends `production`; it does not itself create tester groups, enable multiplayer, or establish OTA delivery.

Sources: [package.json](../../../package.json), [app.json](../../../app.json:44), [app.config.js](../../../app.config.js), [eas.json](../../../eas.json), [Expo.plist](../../../ios/ttp/Supporting/Expo.plist).

All hours, prices, tap counts, and provider turnaround times below are **planning estimates**, not currently verified provider commitments. This investigation used no network. Tap counts exclude typing and download time.

| Option | Setup effort | Running cost | Tester friction | Iteration speed | Fidelity, constraints, and principal risks |
|---|---:|---|---|---|---|
| **Isolated Expo/RNW web pilot on Vercel** | **12–20 h** for a bounded guest pilot; allow more for broad account onboarding | Usually little incremental frontend cost on an eligible existing plan; server separate | **2–3 taps + name**; returning players about 2 | Server-compatible changes at next match; UI changes after deploy and refresh, usually minutes | Same rules and reusable boards. Safari rendering, audio, backgrounding, and input differ from native. No Apple installation/review dependency. |
| **EAS Update over one installed native build** | **4–8 h integration**, plus local build, verification, and initial distribution | EAS Update usage/plan limits are separate from cloud-build quota | Initial native installation below; afterward open/relaunch or tap an update prompt | Typically minutes to publish/download; activation must wait until outside a match | High native fidelity. Only compatible JS/assets can change; incompatible native changes need another binary. |
| **TestFlight internal group** | **2–4 h administration**, plus build and project gates | Existing Apple membership; no usual per-tester charge | Existing tester roughly **3–5 taps**; new App Store Connect user onboarding is much heavier | Server-only changes immediate; client changes require processing unless OTA exists | Up to 100 eligible App Store Connect users. No external beta review, but processing remains. Poor reason to give casual friends developer-account access. |
| **TestFlight external group/public link** | **2–5 h administration**, plus build/gates and review wait | Existing Apple membership | Roughly **7–12 taps** on first use; **3–5** once enrolled | Binary changes take hours/days; OTA can shorten compatible JS iteration | Up to 10,000 external testers. Public link enrolls testers; it does not instantly put them at a particular table. |
| **Ad-hoc/internal distribution** | **3–6 h**, plus build/provisioning | Existing Apple membership; IPA hosting | Often **8–15 taps** initially, including device registration/install prompts | New IPA for client changes unless OTA is configured | High fidelity. Registered UDIDs and annual device limits; adding a device requires updated provisioning/re-signing or rebuilding. “Internal” here is different from TestFlight internal testing. |
| **Development client** | **1–3 h if already installed**, otherwise approximately **4–8 h** including provisioning/build | Mac/tunnel; Apple membership for normal device distribution | Existing client **2–4 taps**; initial setup can be **10+**, with Developer Mode/setup where applicable | Seconds through Metro/Fast Refresh; native dependency changes still require rebuilding | Excellent for a facilitated session. Debug performance differs; Metro and the play server must both remain reachable. |
| **Separate playtest app variant** | **6–12 h extra**, plus its chosen distribution lane | Usually little incremental hosting cost; another app/signing setup | Same as TestFlight/ad-hoc after setup | Add OTA for minutes-level JS iteration | Can coexist with production, clearly named “Pig Playtest,” with play enabled. Separate bundle ID does not eliminate Apple distribution constraints. |
| **App Clip / Expo Go** | App Clip: **several days or more**. Expo Go: only useful after proving the reduced surface fits its installed modules | Depends on delivery | App Clip could eventually be a short link-to-play flow; Expo Go requires its app | Neither is the shortest route here | App Clip requires a native target, invocation/signing work, size discipline, and review. Expo Go cannot load arbitrary native modules from this app. |

For TestFlight, budget **15–60 minutes for processing when things go smoothly**, with several hours possible. For external beta review, reserve **24–48 hours and contingency for several days**. The first external build generally needs beta review; later builds can still require it. Builds expire after **90 days**, and OTA does not extend that expiry. A build marked internal-testing-only cannot later serve external testers.

Use one clearly named pilot group with one intended available build, clear “What to Test,” and a compatibility check at launch. A public link or universal link alone does not guarantee that someone has installed the intended version.

**What actually needs work for web**

The boards are promising: RN primitives, images, SVG, responsive measurements, and an existing [RivePig.web.tsx](../../../components/ui/RivePig.web.tsx) renderer. [PlayClient](../../../utils/multiplayer/client.ts) can use the browser’s WebSocket. The routes in `app/play/*` and `app/match/*` are thin wrappers.

The concrete obstacles are elsewhere:

| Area | Repository finding | Smallest useful treatment |
|---|---|---|
| Root application | [app/_layout.tsx](../../../app/_layout.tsx:40) imports native notifications, IAP/paywalls, Sentry, and many unrelated systems | Give the pilot its own small Expo entry/layout. Avoid exporting the entire application as the first experiment. |
| Authentication | [useMultiplayer.tsx](../../../hooks/useMultiplayer.tsx:158) obtains a Supabase token; runtime requires a session; invite landing blocks signed-out users | Inject pilot identity/token handling into the multiplayer provider and session/card hooks. |
| Anonymous Supabase auth | [server/src/auth.ts](../../../server/src/auth.ts:104) explicitly rejects anonymous sessions | “Guest name” needs a new verifier. Calling Supabase anonymous sign-in is not sufficient. |
| Production web configuration | `EXPO_PUBLIC_PLAY_URL` and `EXPO_PUBLIC_PLAY_FORCE_ON` are both guarded by `__DEV__` | Add explicit pilot endpoint/enabled configuration. Those existing overrides **do not work in a production web export or TestFlight build**. |
| Native services | PlayHub imports push registration, which installs a notification handler at module evaluation | Provide web notification no-ops; omit push onboarding. Verify haptics, clipboard, sharing, audio activation, and accessibility behavior on Safari. |
| Broad UI imports | [components/ui/index.tsx](../../../components/ui/index.tsx) re-exports unrelated modules | Narrow imports where the web dependency graph encounters native-only modules; retain existing web renderers. |
| Social/economy dependencies | Wins, friend selection, profile looks, and live flags depend on the main backend | Pilot hub needs only five games, a name/avatar, link invites, and the table. |

Relevant configuration: [utils/multiplayer/config.ts](../../../utils/multiplayer/config.ts:69), [hooks/useMultiplayer.tsx](../../../hooks/useMultiplayer.tsx:205).

**Guest names versus magic links:** For four known people, preissued expiring pilot credentials are less work than general guest registration. Details follow below. Email magic links are a reasonable later option, but add inbox switching, mail delivery, redirect configuration, and callback handling. [utils/supabase.ts](../../../utils/supabase.ts) sets `detectSessionInUrl: false`; the current provider is not a complete web magic-link flow.

The existing [landing/play/index.html](../../../landing/play/index.html:155) is **an invitation bridge**, not a playable game. It links to `ticklethepig://play/CODE` and the App Store. Its [Vercel rewrite](../../../landing/vercel.json) and [AASA file](../../../landing/.well-known/apple-app-site-association) support native routing. Put the pilot on a separate Vercel project/domain so those links continue behaving predictably.

**EAS Update policy**

After the first playtest, OTA is the strongest improvement to recurring **native** testing.

- Install `expo-updates`, configure the project, and add a **`playtest` channel**, separate from production.
- Prefer **`runtimeVersion: { "policy": "fingerprint" }`**, after verifying that local builds and update exports calculate compatible fingerprints. It reduces the chance of delivering JS that expects missing native code.
- `appVersion` is a simpler alternative, but then every native dependency/configuration change requires disciplined version bumping. The current long-lived `"1.3"` would not provide that discipline automatically.
- JS rules, React screens, compatible dependencies, and bundled assets can update OTA.
- Expo/RN/Hermes upgrades, new native modules, native module upgrades, entitlements, bundle IDs, associated domains, and native configuration changes require a new binary.
- Checked-in `ios/` means configuration must actually reach the native project; changing JSON alone is insufficient.
- Fetch updates on launch or in the lobby. Offer **“Update and return to the table” outside active matches**, with rollback and protocol compatibility checks.

OTA channels route updates to already-installed binaries. They do not distribute the first binary, replace Apple review obligations, or guarantee immediate activation on every device.

**Server hosting and routing**

| Host | Best use | Practical tradeoff |
|---|---|---|
| **Mac + cloudflared/ngrok** | First scheduled evening | Usually negligible incremental cost. Mac must stay awake; tunnel/network/restarts can interrupt play. Use `wss://<tunnel>/ws`, never a remote tester’s `localhost`. |
| **Separate Render pilot service** | Repeated or unattended sessions | Stable endpoint and no dependency on the Mac. The repo estimates roughly **$7–25/month** for an always-on instance; verify current pricing. Keep one instance. |

The existing [render.yaml](../../../render.yaml) is production-oriented: Supabase store/auth, real pushes, and flag access. A pilot service should explicitly select its own auth, `STORE=memory`, `PUSH_MODE=log`, and `ACCESS=all`. An ephemeral Render filesystem is not durable storage.

Vercel serves the frontend; the persistent WebSocket process remains on the Mac or Render. Configure the endpoint in the pilot deployment, not an arbitrary `?server=` link that could redirect credentials.

**3. Recommendation and implementation plan**

**Primary: a separate browser pilot, shared game code, four expiring guest credentials, and a local server through a tunnel.** Budget **12–20 hours**. This directly improves both human testing and distribution.

**Fallback: existing native development clients, real Supabase sessions, and the same memory-backed tunnel server.** Use this if browser bundling becomes a larger project than expected.

The following are proposed changes and future commands; none was performed during this investigation.

| Order | Files to add/change | Work and acceptance criterion | Hours |
|---|---|---|---:|
| 1 | Add `playtest-web/package.json`, `app.json`, `metro.config.cjs`, `tsconfig.json`, and a minimal `app/_layout.tsx` | Separate Expo web entry; share root modules and one React installation. Prove all five boards render in an exported build on iPhone Safari. Time-box the initial bundling investigation. | 3–5 |
| 2 | Refactor bindings in `hooks/useMultiplayer.tsx`; add pilot provider/identity adapters and web implementations for `useSessionUserId` / `useMyCard` | Reuse client/runtime/store. Inject token, identity, endpoint, and enabled state. Add minimal hub, invite, and match routes; web service shims as needed. | 3–5 |
| 3 | `server/src/config.ts`, `auth.ts`, `server.ts`; focused tests; add `server/scripts/playtest-tickets.ts` | Implement the bounded credential scheme below. Verify accepted, unknown, expired, and malformed credentials. | 2–3 |
| 4 | Add pilot `vercel.json`; update pilot link generation; add client/server compatibility diagnostics | SPA deep links survive refresh. Host creates link invites. Everyone reaches the same pilot server. | 1–2 |
| 5 | `server/src/rooms.ts`, pilot feedback handler, `components/play/ResultSheet.tsx`; browser/device checks | Capture lifecycle and feedback; finish matches, rematch, reconnect, and recover from stale links on real phones. | 3–5 |

Keep the independent pilot’s flag always on. Do not change the main app’s production flag to accomplish this.

**Minimal guest authentication**

Add a proposed `AUTH_MODE=playtest`:

- Generate four random **256-bit bearer tickets**.
- Keep a server-only mapping from ticket to **server-assigned UUID and expiry**.
- Accept `playtest:<ticket>:<encoded-name>` in the existing first WebSocket authentication frame.
- The name changes display only; the browser cannot choose another user ID.
- Deliver each tester a distinct link containing their ticket in the URL **fragment**. Read it, store it for the session, then remove the fragment.
- Reject expired tickets; close pilot connections at session end and rotate tickets.

No new signup endpoint, Supabase profile, email flow, or migration is required. The existing [VerifiedUser interface](../../../server/src/auth.ts:28) and [player name hints](../../../server/src/players.ts:36) support this seam.

Do not publicly expose the existing `dev:<id>:<name>` verifier: anyone can invent another player’s identity. The server already [refuses it in production](../../../server/src/config.ts:79).

Proposed server launch, after implementation and dependency installation:

```sh
cd server
npm ci
npm run build

AUTH_MODE=playtest \
STORE=memory \
STORE_FILE=./.playtest-store.json \
PUSH_MODE=log \
ACCESS=all \
LOG_LEVEL=info \
npm start
```

Load the new `PLAYTEST_TICKETS_JSON` through a local secret environment; never an `EXPO_PUBLIC_*` variable or committed file. Avoid `tsx watch` during the actual session so an edit cannot restart everyone’s game.

In another terminal:

```sh
cloudflared tunnel --url http://localhost:8787
```

Then export the pilot with a **new, explicitly supported** public endpoint variable:

```sh
cd playtest-web

EXPO_PUBLIC_PLAYTEST_WS_URL=wss://YOUR-TUNNEL-HOST/ws \
NODE_OPTIONS="--max-old-space-size=16384" \
npx expo export --platform web
```

Deploy its `dist/` through a **separate Vercel project**, with a fallback to `index.html` for application routes. Avoid accidentally deploying over the existing `ttp-landing` project.

Run the existing targeted checks, plus the new auth/browser checks:

```sh
npx jest --ci --runInBand __tests__/multiplayer
npm --prefix server run typecheck
npm --prefix server test
npm --prefix server run e2e
npm run quality:check
```

Use `npm run quality:loop` while changing layouts/contracts. A successful export is only the first gate: verify the actual deployed frontend on two phones, including Safari background/resume and cellular networking.

**Tester flow**

1. Host opens the pilot, selects a game, and creates a **link invite**.
2. Tester receives their personal HTTPS link with the room code and credential fragment.
3. They tap it; the current browser client loads.
4. They enter a name and tap **Join**.
5. Their authenticated seat appears; the host starts once 2–4 people are present.
6. After the result, they tap a fun rating and optionally **Rematch**.

That is approximately **2–3 taps plus typing**, with no App Store, TestFlight, email, or production-game onboarding.

Keep the deployment fixed during a match. For an incompatible client/server revision, stop joining with a clear refresh prompt. Show the build/server revision in an operator diagnostics view so “wrong build” is observable.

**Fallback commands**

For existing native development clients, run the server with:

```sh
AUTH_MODE=supabase \
SUPABASE_URL=https://YOUR-PROJECT.supabase.co \
STORE=memory \
PUSH_MODE=log \
ACCESS=all \
npm run dev
```

Provide its JWT verification secret server-side through the environment. Then start the app:

```sh
EXPO_PUBLIC_PLAY_FORCE_ON=1 \
EXPO_PUBLIC_PLAY_URL=wss://YOUR-TUNNEL-HOST/ws \
NODE_OPTIONS="--max-old-space-size=16384" \
npx expo start --dev-client --tunnel
```

There are **two services** here: Metro’s tunnel delivers JS; the play-server tunnel carries matches. Testers open the development link, sign in, then join by code. If the installed client lacks a required native module, build a new local development client using the existing `development` profile.

For later TestFlight/OTA work:

```sh
npx expo install expo-updates
eas update:configure
```

Add the channel/runtime policy and native configuration, then build locally. Publish later compatible updates with:

```sh
eas update --channel playtest --platform ios \
  --environment preview --message "Playtest rules revision"
```

Any distributable native build still follows [docs/RELEASE_CHECKLIST.md](../../../docs/RELEASE_CHECKLIST.md), including changelog first, gate report, local EAS build, artifact inspection, and Transporter upload. [docs/builds/README.md](../../../docs/builds/README.md) defines its evidence record; [CLAUDE.md](../../../CLAUDE.md) confirms local builds and Transporter. The user retains Apple sign-in and Deliver.

A separate native variant can come later. It needs its own bundle ID, scheme, icon/name, signing, and channel. This repo also has a `com.broeking.ttp.stickers` extension in the [Xcode project](../../../ios/ttp.xcodeproj/project.pbxproj); changing only `app.json` would not fully create that variant.

**4. Gameplay testing and the one-day iteration loop**

**Automate correctness and balance signals; use people to decide fun.**

The existing [test kit](../../../multiplayer/testkit.ts) and server e2e harness already cover seeded play, legal bot actions, completion, secrecy, reconnects, forfeits, and rematches. Extend them instead of building a separate simulation engine.

Add `server/scripts/balance.ts`, an npm script, and `.github/workflows/playtest.yml`:

- On each relevant PR: existing tests plus a modest fixed seed set.
- Nightly: thousands of seeds across every supported seat count, pace, and rule variant.
- Compare seat/first-player advantage, score spread, ties, simulated decision counts, stalls, and dominant actions.
- Use multiple bot policies: greedy, random, cautious, and exploitative. Identical bots playing themselves can conceal broken incentives.
- Fail on illegal actions, leaks, unfinished games, and substantial regressions; publish balance summaries as artifacts.
- Treat simulated duration as a model, not measured human play time.

For Mud Volley, compare different follow-through/catching policies. For Out Looking, test whether one destination strategy dominates. For cooperative Snout Says, measure completion and clue collisions rather than competitive win balance.

**Make rule variants server configuration**

Today, the server controls transport timing, but gameplay tuning is still compiled into rule modules. [SetupContext](../../../multiplayer/types.ts:112) has no tuning input. [Mud Volley’s README](../../../multiplayer/games/mud_volley/README.md:14) explicitly identifies compiled timing/payoff constants.

Add:

- `server/config/playtest-variants.json` and a validated loader.
- A tuning input to game setup, with effective values frozen into each room’s state.
- `variantId`, `configVersion`, and effective visible parameters in snapshots/results.
- Server-provided values for board labels, help text, and animation timing where rules depend on them.

Start with two or three knobs per game: Rootle target; Fence board size; Volley payoffs/window; Snout Says rounds/clue time; Out Looking days/reveal time.

**Never change a running room’s rules underneath it.** New rooms select a variant; existing rooms retain theirs. Preserve the contract’s `rulesVersion` discipline for rule/scoring changes, and distinguish tuning revisions from incompatible action/view changes.

Practice also needs the selected tuning, or must clearly identify its baseline. Today, server changes and locally compiled practice can diverge. Client boards also import some tuning constants, so “server deploy only” is safe only after checking presentation compatibility.

Do not make a general tuning platform a prerequisite for the first baseline night. Implement the first useful knobs immediately afterward.

**Record useful evidence**

Current results in [server/src/results.ts](../../../server/src/results.ts) record outcomes and scores; normal gameplay telemetry is sparse. Add structured events around room creation, accepted actions, transitions, and completion in [server/src/rooms.ts](../../../server/src/rooms.ts).

Per match, capture:

- Session, room, game, rules/config variant, client/server revision.
- Pseudonymous player IDs, seat order, player count, and human/bot status.
- Invite-to-seat time, queue wait, start/end time, and completion reason.
- Decision latency, action categories, timeouts, disconnects/reconnects, and forfeits.
- Final score, rematch offered/requested/started, and fun feedback.

Write JSONL to the Mac for the first night, alongside observer notes. The memory store is not an analytics archive. Keep credentials out of logs; keep any replay state containing secrets operator-only. Add durable pilot analytics storage later if sessions become regular.

**One-tap feedback**

Add to [ResultSheet.tsx](../../../components/play/ResultSheet.tsx:47):

> **Was that fun?**  
> Yes · So-so · No

One tap submits `{roomId, playerId, variantId, answer}`. Keep **Rematch** immediately available. Offer optional reasons afterward—“confusing,” “slow,” “felt random,” “great moment”—without requiring another form.

Record early exits too; feedback only from finishers will overstate enjoyment. Ask players to rate before group discussion, and treat voluntary rematches as stronger evidence than politeness.

**Playtest-night runbook: approximately 100 minutes**

| Time | Activity |
|---|---|
| 0–10 min | Verify links, names, server connection, and controls. Establish that confusing rules are useful feedback. |
| 10–70 min | Play all five games, ideally twice. Rotate seats/partners. Mud Volley runs as two pairs with four people; other games use the whole table. |
| 70–90 min | Players choose what to replay. Test one changed variant if ready. |
| 90–100 min | Independent favorites, discussion, and schedule the next short session. |

The developer operates the server and records defects. One person facilitates; rotate an observer when possible. If there are only two people, prioritize playing and write notes between games.

Observe: time until the first intentional move, repeated explanations, accidental taps, waiting, laughter/table talk, meaningful prediction, and when a loser stops caring. Let the first round reveal comprehension problems before coaching.

Ask:

- “What did you think would happen?”
- “Which decision mattered?”
- “When did you feel the result was decided?”
- “Which game would you choose again right now?”

**Within the next day:** group findings by game and variant; separate connection/UI failures from rule problems; choose one hypothesis and one change per promising game. Run the existing tests, e2e harness, and balance simulation. Activate the new configuration for new rooms, or redeploy the server between sessions. Redeploy web only when presentation changes; use OTA for compatible native JS changes once configured.

With four testers, the result is a directional decision—**replay, revise, or shelve**—not statistical proof. The first success is getting people to ask for another game.