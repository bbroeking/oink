# Mote contract freeze — 2026-09-06

Local implementation contract for specs 23 and 23a. Public enablement remains
separate. Reveal defaults on first entry. Wager uses earned Motes only.

- Protocol 1 retains `spin_mote_machine(p_request_id)` and existing receipt fields.
- Protocol 2 uses `mote_game_state()`, `play_mote_game(p_request_id, p_mode,
  p_stake_motes, p_expected_rules_version)`, `mote_play_receipt(p_request_id)`,
  and `mote_play_history(p_cursor default null, p_limit default 20)`.
- Rules: `reveal-v1` (one Mote, guaranteed Acorns 1/2/3/5 at weights
  5000/3000/1500/500); `wager-v1` (stakes 1/3/5, weights
  5000/2500/1800/600/100, returns 0/1/2/3/10 and Acorns 0/0/0/1/5
  multiplied by stake). Total returned includes stake; net = returned − stake.
- Successful v2 envelope: `{ok:true, receipt, wallet:{motes,revision}, replayed}`.
  Lookup absent: `{ok:true,receipt:null,wallet}`. Failures:
  `{ok:false,reason,...}`. State: `{ok:true, modes, allowed_stakes,
  rules_versions:{reveal,wager}, paytables:{reveal,wager}, wallet,
  inventory, required_presentation_version, wager_enabled}`.
  Paytable rows: `{outcome,weight,motes_multiplier,acorns_multiplier}`.
- Receipt: `protocol_version:2`, `spin_id`, `request_id`, `mode`, `stake_motes`,
  `outcome` (`legacy_resource|loss|returned_stake|small|big|jackpot`),
  `motes_returned`, `net_motes`, `motes_remaining`, `wallet_revision`,
  `contraption_id`, `resource_id`, `resource_amount`, `resource_balance`,
  `newly_unlocked`, `reel_stops`, `reel_value` (legacy selector or null),
  `paytable_version`, `presentation_version`, `created_at`.
  Historical receipt wallet facts never replace a newer envelope wallet.
  History: `{ok:true,plays:[receipts],next_cursor:string|null,wallet}`;
  cursor is opaque to the client, ordered by timestamp plus spin ID.
- Persist full account-scoped pending commands before network dispatch;
  check owner-only lookup before same-command retry. Never translate protocol 1
  into protocol 2. Same ID with changed payload conflicts. Replay is quiet.
- V4: `mote-animation-v4`; preserve artboard `MOTE MACHINE`, state machine
  `MoteMachine`, VM `MoteMachineViewModel` / `Default` and every V3 property.
  Add numbers `mode`, `stakeMotes`, `outcomeCode`, `leftStop`, `centerStop`,
  `rightStop`; booleans `newlyUnlocked`, `replayedReceipt`; triggers
  `reset`, `enter`; number `phase` (0 ready, 1 empty, 2 commit pending,
  3 confirmed presentation, 4 hold, 5 recovery pending, 6 known error).
- Outcome codes: legacy_resource=0, loss=1, returned_stake=2, small=3,
  medium=4 (Reveal presentation only), big=5, jackpot=6.
- Wager symbols: clover=0, mote=1, acorn=2, rosie_crest=3.
  Returned `[0,0,0]`, Small `[1,1,1]`, Big `[2,2,2]`, Jackpot `[3,3,3]`.
  Loss uniformly selects `[0,1,2]`, `[1,2,3]`, `[2,3,0]`, `[3,0,1]`.
  Reveal preserves selectors 3/5/10/25 for Acorns 1/2/3/5 in a separate bank.
- Clip names exactly follow spec 23a, plus `Next Play Reset`.
  Runtime/source and manifest are staged until actual validation; no V3 asset
  may claim V4 compatibility. Wager requires loaded V4 bindings and manifest.
- Timing table and source authoring belong to the animation owner. Sound/haptic
  code consumes that table; no scattered route timers. Sensory settings key:
  `mote_machine_sensory_v1`, both enabled by default.

Server feature defaults Wager off for rollout. Throwaway harness and development
fixtures enable it for acceptance. No production migration or wallet mutation
is authorized by this document.
