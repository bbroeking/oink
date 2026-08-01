# Handoff — Rosie's Ramble (expedition) — 2026-07-29

*Written for a fresh agent with zero session context. Read this, then `components/expedition/README.md`, then the master plan. Everything below is true as of this writing; verify with the commands at the bottom before trusting it after that.*

## THE GOAL

**Ship Rosie's Ramble — Tickle the Pig's idle battler — as a real, server-authoritative game mode that serves the charter (Connect · Collect · Contend).** In one sentence: *send your pig rambling down the road while you're away; dress her in gear that decides how she fights, and come home to the story of what happened* — and when a chapter boss stops every pig, *the Sounder knocks it down together.*

The strategic intent: give TTP its first **earned-only power system** (gear with Bonk/Cushion/Sparkle stats + data-driven abilities, firewalled from paid cosmetics forever), its first **tickle sink** (Zoomies), a **card layer** that bridges to the physical card game Rosie's Loadout, and a co-op boss beat (**Sounder Scuffle**) that makes the crew text each other. Public launch is explicitly **gated on the Sounder Scuffle existing** — solo idle is the genre's loneliness trap.

## Where the work stands (all UNCOMMITTED on `main`)

**Done — a fully playable client-local v0 slice**, dev-gated at `/expedition`:
- Pure deterministic sim kernel `utils/expedition.ts` (this later becomes the client parity mirror of the server settle, the `rooting.ts` ↔ `submit_rooting` pattern).
- Hook `hooks/useExpedition.ts` (AsyncStorage `expedition_v0`), shell `app/expedition.tsx`, 13 components + README in `components/expedition/`.
- 50 tests green (`__tests__/expedition.test.ts`), `tsc --noEmit` clean. Two FULL-suite failures are PRE-EXISTING and unrelated (archeryBowSlotMigration path renumber; polishPrimitives 11pt scan — expedition's offenders already reduced to 2 sanctioned ones).
- Two Impeccable critique rounds applied (trend 22→27, snapshots in `.impeccable/critique/`); all P0/P1 honesty issues fixed and pinned by tests.
- `constants/theme.ts` gained `TYPE.cardTitleSm` + `TYPE.kickerPillSm` (additive).
- Old prototype `app/idle-battler-prototype.tsx` deliberately untouched.

**Key docs (read in this order):**
1. `components/expedition/README.md` — feature front door, file map, design laws.
2. `docs/expedition-idle-battler-plan.md` — THE master plan: charter check, genre-research verdicts, stat/ability/card framework, server data model + RPCs, art pipeline, rollout phases, decision log (§10), UI verdicts baked as contract (§5.4 note).
3. `docs/expedition-v0-playable-spec.md` — the v0 contract (content catalogs, sim rules).
4. `docs/idle-battler-genre-research.md` — the 12 load-bearing genre mechanics + adopt/reject verdicts.

## Locked decisions (do not relitigate without the founder)

- Cosmetics stay stat-less forever; gear is a separate earned-only domain (enforce via migration guard test in the server phase).
- Stats cap at three: Bonk (damage), Cushion (armor-as-access), Sparkle (luck). Abilities are data recipes `{trigger, effect, magnitude, flavor}` interpreted by one kernel.
- Cards replace the Plan surface (draw 3 Tricks, tuck 1); dupes tuck as Training (+1 stat, capped); Bestiary pages ARE the Enemy cards. Physical-pack QR crossover may grant ART ONLY, never power.
- Send-off tickle is mechanically real (charge carries into the first wall). Tuck survives arrival at a wall, comes home only when a trip completes on the open road.
- Zoomies is a feeling: sprite energy + spark art, NEVER a digit. Enemy HP keeps honest small numbers.
- Sum, never rank, inside a Sounder. No pig HP, no loss states, walls wait warmly.
- Companion signature abilities: flavor-only until the phase-3 earn-lane (membership must never buy battler power).
- Name: "Rosie's Ramble" player-facing; `expedition` in code.
- Legibility law (a UI requirement, tested): predict a fight ±20% from the send-off; when wrong, see why in one glance.

## Next steps, in order

1. **Commit the v0 slice** (user must ask/approve; suggest one feature commit or kernel/UI/docs split). Nothing is committed yet.
2. **Founder playtest** of `/expedition` in a dev build; fold feel-notes back into the plan.
3. **Phase 1 — the real build** (plan §5–§6): migration with `expedition_*` tables + RPCs (`expedition_settle` lazy+idempotent, equip/draw/tuck/zoomies/claim), port the kernel math to plpgsql, keep the TS kernel as parity mirror with shared fixtures. ~12 gear + 4 enemy art via the Codex ImageGen lane (`tools/regen_studio.py`) replacing hat-PNG/silhouette placeholders. Feature flag `expedition` in app_config.
4. **Phase 2 — Sounder Scuffle** (pooled boss HP via the Great-Hunger derived-meter pattern; flat participation rewards). PUBLIC LAUNCH GATE.
5. Backlog when touching these screens anyway: P3 governance sweep from `.impeccable/critique/` (RARITY_STRIPE adoption, kicker diet, a11y: `accessibilityViewIsModal` on overlays, selected-states, sprite labels).

## House rules that WILL bite you

- **Never run `npm run db:push` / `supabase db push` without the user explicitly saying go.** Migrations timestamped and alphabetically after the latest applied.
- Local builds only (`eas build --local`), Metro needs `NODE_OPTIONS="--max-old-space-size=16384"`, upload via Transporter never `eas submit`, changelog `docs/builds/` BEFORE building.
- Taste law: tokens only (no raw hex/fontSize/radius/pad), no emoji ever in UI, zero-blur shadows, feelings never numbered. `docs/design/taste-standard.md` + `DESIGN.md`.
- Technical names in code, cozy names on screen. Fable plans, Opus implements (spawn implementation subagents with model:"opus").
- Test conventions: pure-kernel replay fixtures (digSession style), SQL-as-text migration guard tests, popup-priority source scan (register any new popup slot).

## Unresolved / loose ends

- **"Circle of Pig"** — the user asked to "pull in the latest Circle of Pig" at the very start; it exists NOWHERE in the repo/branches/issues/sibling projects/PDF guide. Never resolved. If the user mentions it again, ask them to paste/export it, then reconcile against the plan as a diff.
- Local `main` is ~43 commits ahead of `origin/main` (this predates the expedition work; pushing is the user's call).
- v0 uses mock tickles (regen +1/10min cap 20) — real tickle-bank integration is a Phase 1 server concern.
- Jest full suite: the 2 pre-existing failures above; don't burn time on them unless asked.

## Verify before you start

```
NODE_OPTIONS="--max-old-space-size=8192" npx jest __tests__/expedition.test.ts   # expect 50/50
npx tsc --noEmit                                                                  # expect clean
git status --short | grep -c expedition                                           # expect the uncommitted set
```
