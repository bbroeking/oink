import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "expo-router/react-navigation";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AccessibilityInfo, Image, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Button, CardTitle, Chip, EmptyState, IconButton, ListRow, SegmentedControl,
  Sheet, Stat, Sticker, T, Toggle, showToast, type SegmentOption,
} from "@/components/ui";
import { MoteMachineRive } from "./MoteMachineRive";
import { MOTE_EARNING_HINT, MOTE_IMAGE } from "@/constants/motes";
import {
  ART_SIZE, PAGE_PAD, RADII, SPACE, TAP_MIN, TILT, WHIMSY,
} from "@/constants/theme";
import { useMotionPolicy } from "@/hooks/useMotionPolicy";
import { supabase } from "@/utils/supabase";
import {
  fetchMoteGameState, fetchMotePlayHistory, lookupMotePlayReceipt, moteGameErrorMessage,
  newerWallet, playMoteGame, type MoteGameMode, type MoteGameReceipt,
  type AnyMoteReceipt, type MoteGameState, type MoteHistoryEnvelope, type MotePlayCommand, type MoteWallet,
} from "@/utils/moteGame";
import { createMoteGameAcceptanceClient } from "@/utils/moteGameAcceptance";
import { canPresentMode, legacyOutcomeForAmount, receiptToMotePresentation, validateAnyMoteReceipt, validateMoteGameReceipt } from "@/utils/moteGamePresentation";
import { clearMoteCommand, loadMoteCommand, persistMoteCommand, rememberedMoteModeKey } from "@/utils/moteGameSession";
import { useMoteMachineSensory } from "./useMoteMachineSensory";
import { moteReadableAt, type MotePresentationOutcome } from "./moteMachineTiming";
import { MoteRosieStage } from "./MoteRosieStage";

type Phase = 0 | 1 | 2 | 3 | 4 | 5 | 6;
const uncertainReasons = new Set(["network", "no_data", "unknown"]);

// The float between a safe-area edge and the chrome floating over the cabinet
// art. Named so the safe-area sum isn't arithmetic on a SPACE step.
const EDGE_FLOAT = SPACE.sm;
// Drawing geometry for the full-bleed cabinet: how far up the page the machine
// art reaches, and how much of it the console may ever cover.
const MACHINE_BOTTOM = "42%";
// The Mote pouch's fixed frame, so a two-digit balance can't shove the dials
// out of the row. Drawing geometry, not a spacing step.
const POUCH_WIDTH = 88;
const CONSOLE_MAX_HEIGHT = "52%";

export function MoteWageringScreen() {
  const params = useLocalSearchParams<{ acceptance?: string; acceptanceSession?: string; forceRiveFailure?: string }>();
  const acceptance = useMemo(() => createMoteGameAcceptanceClient(params.acceptance, params.acceptanceSession), [params.acceptance, params.acceptanceSession]);
  const insets = useSafeAreaInsets(); const motion = useMotionPolicy();
  const mounted = useRef(true); const inFlight = useRef(false); const announced = useRef(new Set<string>());
  const activeAccount = useRef<string | null>(acceptance?.accountId ?? null);
  const generation = useRef(0); const [focused, setFocused] = useState(false);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<MotePlayCommand | null>(null);
  const [accountId, setAccountId] = useState<string | null>(acceptance?.accountId ?? null);
  const [state, setState] = useState<MoteGameState | null>();
  const [wallet, setWallet] = useState<MoteWallet | null>(null);
  const [mode, setMode] = useState<MoteGameMode>("reveal"); const [stake, setStake] = useState(1);
  const [receipt, setReceipt] = useState<MoteGameReceipt | null>(null); const [replayed, setReplayed] = useState(false);
  const [phase, setPhase] = useState<Phase>(0); const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false); const [error, setError] = useState<string | null>(null);
  const [runtimeVersion, setRuntimeVersion] = useState<string | null>(null);
  const [spinToken, setSpinToken] = useState(0); const [resetToken, setResetToken] = useState(0);
  const [sheet, setSheet] = useState<"paytable" | "history" | "settings" | null>(null);
  const [history, setHistory] = useState<MoteHistoryEnvelope>({ plays: [], next_cursor: null, wallet: { motes: 0, revision: 0 } });
  const sensory = useMoteMachineSensory(focused);
  const stopSensory = sensory.stop;
  const client = useMemo(() => ({
    state: acceptance?.fetchState ?? fetchMoteGameState,
    play: acceptance?.play ?? playMoteGame,
    lookup: acceptance?.lookup ?? lookupMotePlayReceipt,
    history: acceptance?.history ?? fetchMotePlayHistory,
  }), [acceptance]);

  useEffect(() => { mounted.current = true; return () => { mounted.current = false; if (settleTimer.current) clearTimeout(settleTimer.current); }; }, []);
  const applyWallet = useCallback((next: MoteWallet) => setWallet((current) => newerWallet(current, next)), []);
  const hydrate = useCallback(async () => {
    const run = ++generation.current;
    setError(null);
    try {
      const id = acceptance?.accountId ?? (await supabase.auth.getSession()).data.session?.user.id ?? null;
      if (!mounted.current || run !== generation.current) return;
      if (!id) { setAccountId(null); setState(null); setError("Sign in again before playing."); return; }
      activeAccount.current = id;
      setAccountId(id);
      const [game, command, remembered] = await Promise.all([
        client.state(), loadMoteCommand(AsyncStorage, id), AsyncStorage.getItem(rememberedMoteModeKey(id)),
      ]);
      if (!mounted.current || run !== generation.current || activeAccount.current !== id) return;
      if (!game.ok) { setState(null); setError(moteGameErrorMessage(game.reason)); return; }
      setState(game); applyWallet(game.wallet); setPhase(game.wallet.motes > 0 ? 0 : 1); pending.current = command; setUncertain(Boolean(command));
      setMode(remembered === "wager" && game.wager_enabled ? "wager" : "reveal");
    } catch {
      if (!mounted.current || run !== generation.current) return;
      setState(null); setError("Couldn't safely check your saved play. Try again.");
    }
  }, [acceptance, applyWallet, client]);
  useEffect(() => {
    const auth = acceptance ? null : supabase.auth.onAuthStateChange((_event, session) => {
      activeAccount.current = session?.user.id ?? null; generation.current += 1;
      pending.current = null; inFlight.current = false; setAccountId(session?.user.id ?? null);
      setState(undefined); setWallet(null); setReceipt(null); setUncertain(false);
      setHistory({ plays: [], next_cursor: null, wallet: { motes: 0, revision: 0 } }); void hydrate();
    });
    return () => auth?.data.subscription.unsubscribe();
  }, [acceptance, hydrate]);
  useFocusEffect(useCallback(() => { setFocused(true); void hydrate(); return () => { setFocused(false); stopSensory(); }; }, [hydrate, stopSensory]));

  const finishReceipt = useCallback(async (command: MotePlayCommand, result: MoteGameReceipt, currentWallet: MoteWallet, quiet: boolean) => {
    const validReceipt = validateMoteGameReceipt(result);
    if (!validReceipt || validReceipt.request_id !== command.requestId || validReceipt.mode !== command.mode ||
      validReceipt.stake_motes !== command.stakeMotes || validReceipt.paytable_version !== command.expectedRulesVersion) {
      setBusy(false); inFlight.current = false; setUncertain(true); setPhase(6);
      setError(`The saved result could not be verified. Keep request ${command.requestId} for support.`); return;
    }
    result = validReceipt;
    await clearMoteCommand(AsyncStorage, command).catch(() => {});
    if (!mounted.current || activeAccount.current !== command.accountId) return;
    pending.current = null; setUncertain(false); applyWallet(currentWallet); setReceipt(result); setReplayed(quiet);
    setPhase(3); setBusy(true);
    const outcome: MotePresentationOutcome = result.outcome === "legacy_resource"
      ? legacyOutcomeForAmount(result.resource_amount) : result.outcome;
    // The receipt records the required contract; cue choreography must follow
    // the runtime that actually accepted the bindings for this presentation.
    const presentationVersion = runtimeVersion === "mote-animation-v4" ? "mote-animation-v4" : "mote-animation-v3";
    const sensoryPlay = { receiptId: result.spin_id, stake: result.stake_motes, outcome,
      acorns: result.resource_amount, newlyUnlocked: result.newly_unlocked, recovered: quiet,
      reduceMotion: motion.reduceMotion, presentationVersion, legacy: result.outcome === "legacy_resource" } as const;
    sensory.playPresentation(sensoryPlay);
    if (!(quiet && presentationVersion === "mote-animation-v3")) setSpinToken((value) => value + 1);
    if (settleTimer.current) clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => {
      if (!mounted.current) return; setPhase(4); setBusy(false); inFlight.current = false;
      if (!announced.current.has(result.spin_id)) {
        announced.current.add(result.spin_id); AccessibilityInfo.announceForAccessibility(outcomeSpoken(result, currentWallet));
        // The unlock is the one outcome that lands somewhere other than the
        // readout — it belongs to the Contraption shelf, so it gets the toast.
        if (result.newly_unlocked) showToast({ tone: "success", title: "A new Contraption is yours", text: "Find it in your Contraption Inventory." });
      }
    }, moteReadableAt(sensoryPlay));
  }, [applyWallet, motion.reduceMotion, runtimeVersion, sensory]);

  const recover = useCallback(async () => {
    const command = pending.current; if (!command || inFlight.current) return;
    inFlight.current = true; setBusy(true); setPhase(5); setError(null);
    const lookup = await client.lookup(command.requestId).catch(() => ({ ok: false as const, reason: "network" }));
    if (!mounted.current || activeAccount.current !== command.accountId) return;
    if (lookup.ok && lookup.receipt) {
      if (lookup.receipt.protocol_version !== 2) { setBusy(false); inFlight.current = false; setPhase(6); setError("The saved request belongs to an older Reveal play. It was not retried."); return; }
      await finishReceipt(command, lookup.receipt, lookup.wallet, true); return;
    }
    if (!lookup.ok) { sensory.cue("recovery_error"); setBusy(false); inFlight.current = false; setError(moteGameErrorMessage(lookup.reason)); return; }
    applyWallet(lookup.wallet);
    const retry = await client.play(command).catch(() => ({ ok: false as const, reason: "network" }));
    if (!mounted.current || activeAccount.current !== command.accountId) return;
    if (retry.ok) { await finishReceipt(command, retry.receipt, retry.wallet, true); return; }
    sensory.cue("recovery_error"); setBusy(false); inFlight.current = false; setPhase(5); setError(moteGameErrorMessage(retry.reason));
    if (!uncertainReasons.has(retry.reason)) { await clearMoteCommand(AsyncStorage, command).catch(() => {}); pending.current = null; setUncertain(false); setPhase(6); }
  }, [applyWallet, client, finishReceipt, sensory]);

  const play = useCallback(async () => {
    const currentMotes = wallet?.motes ?? 0;
    const chosenStake = mode === "reveal" ? 1 : stake;
    const ready = canPresentMode(mode, state?.required_presentation_version ?? "mote-animation-v4", runtimeVersion, runtimeVersion === "mote-animation-v4");
    if (!accountId || activeAccount.current !== accountId || !state || inFlight.current || busy || uncertain ||
      currentMotes < chosenStake || !state.allowed_stakes[mode].includes(chosenStake) || !ready ||
      !state.modes.includes(mode) || (mode === "wager" && !state.wager_enabled)) return;
    const rules = state.rules_versions[mode];
    const command: MotePlayCommand = { protocolVersion: 2, requestId: `mote-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`,
      accountId, mode, stakeMotes: mode === "reveal" ? 1 : stake, expectedRulesVersion: rules, createdAt: new Date().toISOString() };
    inFlight.current = true; setBusy(true); setPhase(2); setReceipt(null); setError(null); pending.current = command;
    try { await persistMoteCommand(AsyncStorage, command); }
    catch { pending.current = null; inFlight.current = false; setBusy(false); setPhase(6); setError("Couldn't save this play. Nothing was spent."); return; }
    const result = await client.play(command).catch(() => ({ ok: false as const, reason: "network" }));
    if (!mounted.current || activeAccount.current !== command.accountId) return;
    if (result.ok) { await finishReceipt(command, result.receipt, result.wallet, result.replayed); return; }
    setBusy(false); inFlight.current = false; setError(moteGameErrorMessage(result.reason));
    if (uncertainReasons.has(result.reason)) { setUncertain(true); setPhase(5); }
    else {
      await clearMoteCommand(AsyncStorage, command).catch(() => {}); pending.current = null; setPhase(6);
      if (result.reason === "rules_changed" || result.reason === "insufficient_motes") {
        await hydrate();
        if (mounted.current && activeAccount.current === command.accountId)
          setError(moteGameErrorMessage(result.reason));
      }
    }
  }, [accountId, busy, client, finishReceipt, hydrate, mode, runtimeVersion, stake, state, uncertain, wallet?.motes]);

  const chooseMode = useCallback((next: MoteGameMode) => {
    if (busy || uncertain) return; setMode(next); setReceipt(null); setPhase((wallet?.motes ?? 0) ? 0 : 1); setResetToken((v) => v + 1);
    if (accountId) AsyncStorage.setItem(rememberedMoteModeKey(accountId), next).catch(() => {});
  }, [accountId, busy, uncertain, wallet?.motes]);
  const loadHistory = useCallback(async (append = false) => {
    const run = generation.current; const owner = activeAccount.current;
    if (!owner) return;
    const result = await client.history(append ? history.next_cursor : null);
    if (!mounted.current || run !== generation.current || activeAccount.current !== owner) return;
    if (!result.ok) { setError(moteGameErrorMessage(result.reason)); return; }
    const plays = result.plays.map(validateAnyMoteReceipt);
    if (plays.some((play) => !play)) { setError("Play history could not be verified."); return; }
    applyWallet(result.wallet); setHistory((old) => ({ ...result, plays: append ? [...old.plays, ...plays as AnyMoteReceipt[]] : plays as AnyMoteReceipt[] })); setSheet("history");
  }, [applyWallet, client, history.next_cursor]);
  const presentation = receipt ? receiptToMotePresentation(receipt, replayed) : null;
  const requiredVersion = state?.required_presentation_version ?? "mote-animation-v4";
  const presentationReady = canPresentMode(mode, requiredVersion, runtimeVersion, runtimeVersion === "mote-animation-v4");
  const motes = wallet?.motes ?? 0; const actualStake = mode === "reveal" ? 1 : stake;
  const canPlay = Boolean(state && !busy && !uncertain && motes >= actualStake &&
    state.allowed_stakes[mode].includes(actualStake) && state.modes.includes(mode) && presentationReady &&
    (mode === "reveal" || state.wager_enabled));
  const action = uncertain ? (busy ? "Checking last play…" : "Check last play") : busy ? "Play committed…" : mode === "wager" ? `Wager ${moteCount(actualStake)}` : receipt ? "Reveal again" : "Reveal 1 Mote";
  // What the machine SAYS. The headline is one warm line in Rosie's voice; the
  // ledger figures live behind Play history, where a player who wants the audit
  // trail can look. [D-21]
  const headline = error ? null : receipt ? outcomeHeadline(receipt) : null;
  const status = error ?? (receipt ? outcomeSub(receipt, wallet) : !presentationReady && mode === "wager" ? "Wager needs the latest machine animation. Reload after the V4 asset is installed." : motes < actualStake ? MOTE_EARNING_HINT : mode === "wager" ? "A wager can lose the full stake. Look at the paytable first." : "One Mote always reveals Clockwork Acorns.");
  const modeOptions: SegmentOption<MoteGameMode>[] = (["reveal", "wager"] as const)
    .filter((item) => item === "reveal" || Boolean(state?.wager_enabled && state.modes.includes("wager")))
    .map((item) => ({
      value: item,
      label: item === "reveal" ? "Reveal" : "Wager",
      disabled: busy || uncertain,
      accessibilityLabel: item === "reveal" ? "Reveal, costs 1 Mote" : "Wager, stakes the Motes you choose",
      accessibilityHint: item === "reveal" ? "One Mote always reveals Clockwork Acorns." : "A wager can lose the full stake.",
    }));
  const sheetCopy = sheet === "paytable"
    ? { kicker: "what the reels pay", title: "Paytable" }
    : sheet === "history"
      ? { kicker: "every play, in full", title: "Play history" }
      : { kicker: "how the machine feels", title: "Sound & haptics" };

  return <>
    <Stack.Screen options={{ headerShown: false, gestureEnabled: !busy }} />
    <View style={styles.page}>
      <View style={styles.machine}>
        <MoteMachineRive spinToken={spinToken} resetToken={resetToken} resultValue={presentation?.resultValue ?? 3}
          mode={presentation?.mode ?? (mode === "wager" ? 1 : 0)} stakeMotes={presentation?.stakeMotes ?? actualStake}
          outcomeCode={presentation?.outcomeCode ?? 0} leftStop={presentation?.leftStop ?? 0} centerStop={presentation?.centerStop ?? 0}
          rightStop={presentation?.rightStop ?? 0} newlyUnlocked={presentation?.newlyUnlocked ?? false}
          replayedReceipt={presentation?.replayedReceipt ?? false} phase={phase} motes={motes} reduceMotion={motion.reduceMotion}
          presenting={phase === 3} busy={busy} canPlay={canPlay} hasError={Boolean(error)} motesLabel={`${motes} ${motes === 1 ? "MOTE" : "MOTES"}`}
          rewardLabel={receipt?.resource_amount ? `${receipt.resource_amount} ACORNS` : "CLOCKWORK ACORNS"}
          actionLabel={action} statusLabel={headline ? `${headline} ${status}` : status} uncertainPlay={uncertain}
          confirmedRewardLabel={receipt ? confirmedReward(receipt) : undefined}
          forceFailure={params.forceRiveFailure === "1"} onRequestPlay={uncertain ? recover : play}
          onRuntimeReady={(version) => setRuntimeVersion(version ?? "mote-animation-v3")}
          onRuntimeError={() => { setRuntimeVersion(null); sensory.stop(); setBusy(false); inFlight.current = false; }} onRetryRuntime={() => setRuntimeVersion(null)} />
        <MoteRosieStage phase={phase} outcome={receipt ? (receipt.outcome === "legacy_resource" ? legacyOutcomeForAmount(receipt.resource_amount) : receipt.outcome) : null}
          receiptId={receipt?.spin_id ?? null} newlyUnlocked={receipt?.newly_unlocked ?? false} replayed={replayed}
          reduceMotion={motion.reduceMotion} presentationVersion={runtimeVersion === "mote-animation-v4" ? "mote-animation-v4" : "mote-animation-v3"}
          active={focused} />
      </View>

      {/* The chrome taped over the cabinet art: the way out, the pouch, the dials. */}
      <View pointerEvents="box-none" style={[styles.topRow, { top: insets.top + EDGE_FLOAT }]}>
        <IconButton name="chevronLeft" label="Back" accessibilityHint="Leaves the machine. Nothing is spent."
          variant="dark" onPress={() => router.back()} iconSize={ART_SIZE.glyphSm} visualSize={TAP_MIN} />
        <Sticker color={WHIMSY.stage} rotate={0} radius={RADII.md} shadow="sm" style={styles.pouch}
          accessibilityRole="text" accessibilityLabel={`${moteCount(motes)} available`}>
          <Image source={MOTE_IMAGE} style={styles.pouchArt} accessible={false} />
          <Stat value={motes} tone="onDark" label={motes === 1 ? "Mote" : "Motes"} />
        </Sticker>
        <IconButton name="gear" label="Sensory settings" accessibilityHint="Opens sound and haptics. Nothing is spent."
          variant="dark" onPress={() => setSheet("settings")} iconSize={ART_SIZE.glyphSm} visualSize={TAP_MIN} />
      </View>

      {/* The console — the cabinet's own dark panel, hung under the bright art.
          Its controls stay paper, so the machine reads as hardware and the
          things you press read as ours. */}
      <View style={[styles.consoleSlot, { bottom: insets.bottom + EDGE_FLOAT }]}>
        <Sticker color={WHIMSY.stage} rotate={TILT.card} radius={RADII.lg} shadow="sm" pad style={styles.console}>
          <ScrollView contentContainerStyle={styles.consoleBody} showsVerticalScrollIndicator>
            <SegmentedControl label="Play mode" value={mode} options={modeOptions} onChange={chooseMode} />
            {mode === "wager" && <View style={styles.stakes}>
              <T role="kickerPillSm" tone="onDarkAccent">Stake</T>
              <View style={styles.stakeRow}>{(state?.allowed_stakes.wager ?? []).map((value) => <Chip key={value}
                label={String(value)} art={MOTE_IMAGE} selected={stake === value} disabled={value > motes || busy || uncertain}
                onPress={() => setStake(value)} accessibilityLabel={`Stake ${moteCount(value)}`}
                accessibilityHint={value > motes ? "You don't have that many Motes yet." : `Wagers ${moteCount(value)} on the next pull.`} />)}</View>
            </View>}
            <View style={styles.readout}>
              {headline ? <CardTitle tone="onDarkAccent" align="center">{headline}</CardTitle> : null}
              <T role="bodySm" tone="onDark" align="center" accessibilityRole={error ? "alert" : undefined}>{status}</T>
            </View>
            <View style={styles.doors}>
              <Button variant="handLinkOnDark" size="xs" onPress={() => setSheet("paytable")}
                accessibilityLabel="Paytable" accessibilityHint="Shows what each result pays. Nothing is spent.">Paytable</Button>
              <Button variant="handLinkOnDark" size="xs" onPress={() => void loadHistory()}
                accessibilityLabel="Play history" accessibilityHint="Shows your past plays in full. Nothing is spent.">History</Button>
              <Button variant="handLinkOnDark" size="xs" accessibilityLabel="Contraption Inventory"
                accessibilityHint="Opens your Contraptions. Nothing is spent."
                onPress={() => router.push({ pathname: "/contraptions", params: acceptance ? { acceptance: params.acceptance, acceptanceSession: params.acceptanceSession } : {} })}>Inventory</Button>
            </View>
          </ScrollView>
          <Button full variant="gold" disabled={!canPlay && !uncertain} onPress={uncertain ? recover : play}
            accessibilityLabel={action}
            accessibilityHint={uncertain ? "Checks the saved receipt before retrying the identical command. No extra Mote is used."
              : `Commits ${moteCount(actualStake)} after saving this play.`}
            accessibilityState={{ busy }} style={styles.lever}>{action}</Button>
        </Sticker>
      </View>
    </View>

    <Sheet open={sheet !== null} onClose={() => setSheet(null)} kicker={sheetCopy.kicker} title={sheetCopy.title}
      footer={sheet === "history" && history.next_cursor
        ? <Button full variant="ghost" onPress={() => void loadHistory(true)} accessibilityLabel="Load 20 more plays"
            accessibilityHint="Adds the next 20 plays to this list. Nothing is spent.">Load 20 more</Button>
        : undefined}>
      {sheet === "paytable" && <Paytable state={state} mode={mode} stake={actualStake} />}
      {sheet === "history" && <History plays={history.plays} />}
      {sheet === "settings" && <>
        <Toggle label="Sound" value={sensory.settings.sound} onValueChange={sensory.setSound}
          accessibilityHint="Turns the cabinet's chimes on and off" />
        <Toggle label="Haptics" value={sensory.settings.haptics} onValueChange={sensory.setHaptics}
          accessibilityHint="Turns the lever's buzz on and off" />
      </>}
    </Sheet>
  </>;
}

function moteCount(value: number) { return `${value} ${Math.abs(value) === 1 ? "Mote" : "Motes"}`; }
function acornCount(value: number) { return `${value} ${value === 1 ? "Acorn" : "Acorns"}`; }

// The ledger noun — a record in Play history, where figures belong.
function outcomeLabel(r: Pick<MoteGameReceipt, "outcome" | "resource_amount">) { return ({ legacy_resource: r.resource_amount === 1 ? "Acorn revealed" : "Acorns revealed", loss: "No return", returned_stake: "Stake returned", small: "Small win", big: "Big win", jackpot: "Jackpot" } as const)[r.outcome]; }

// The headline — one warm sentence, in Rosie's voice. A loss never states a
// cold noun and never shows a negative number. [D-21]
function outcomeHeadline(r: Pick<MoteGameReceipt, "outcome" | "resource_amount">) {
  return ({
    legacy_resource: "The machine hands over your Acorns.",
    loss: "The reels went quiet.",
    returned_stake: "Your stake came right back.",
    small: "A little something!",
    big: "The reels loved that one!",
    jackpot: "Jackpot — the whole cabinet sings!",
  } as const)[r.outcome];
}

// The one honest line under the headline: what you hold now, and what came back.
function outcomeSub(r: MoteGameReceipt, current?: MoteWallet | null) {
  const gained = r.motes_returned > 0 ? `${moteCount(r.motes_returned)} back` : null;
  const acorns = r.resource_amount ? acornCount(r.resource_amount) : null;
  const parts = [gained, acorns].filter(Boolean) as string[];
  const left = `${moteCount(current?.motes ?? r.motes_remaining)} left`;
  return parts.length ? `${parts.join(" · ")} · ${left}` : `Your Motes keep coming. ${left}.`;
}

function outcomeSpoken(r: MoteGameReceipt, current?: MoteWallet | null) { return `${outcomeHeadline(r)} ${outcomeSub(r, current)}`; }
function confirmedReward(r: MoteGameReceipt) { return r.resource_amount ? acornCount(r.resource_amount) : moteCount(r.motes_returned); }

// The full audit trail, kept for the ledger view only.
function receiptCopy(r: MoteGameReceipt, current?: MoteWallet | null) { const net = r.net_motes > 0 ? `+${moteCount(r.net_motes)}` : moteCount(r.net_motes); const acorns = r.resource_amount ? ` · +${acornCount(r.resource_amount)}` : ""; return `${moteCount(r.stake_motes)} staked · ${moteCount(r.motes_returned)} returned · ${net} net${acorns} · ${moteCount(current?.motes ?? r.motes_remaining)} available · ${r.paytable_version}`; }

function Paytable({ state, mode, stake }: { state: MoteGameState | null | undefined; mode: MoteGameMode; stake: number }) {
  const rows = state?.paytables[mode] ?? [];
  if (!rows.length) return <EmptyState glyph="clipboard" title="No paytable yet" sub="The machine hasn't sent its odds. Try again in a moment." />;
  return <>{rows.map((row, i) => <ListRow key={`${row.outcome}-${i}`} index={i}
    title={row.outcome.replaceAll("_", " ")}
    sub={`${(row.weight / 100).toFixed(row.weight % 100 ? 1 : 0)}% · ${row.motes_multiplier * stake} Motes · ${row.acorns_multiplier * stake} Acorns`} />)}</>;
}

function History({ plays }: { plays: AnyMoteReceipt[] }) {
  if (!plays.length) return <EmptyState glyph="clipboard" title="No plays yet" sub="Pull the lever once and your receipts land here." />;
  return <>{plays.map((r, i) => <ListRow key={`${r.protocol_version}-${r.spin_id}`} index={i}
    title={`${r.mode === "wager" ? "Wager" : "Reveal"} · ${moteCount(r.stake_motes)} staked · ${r.protocol_version === 2 ? outcomeLabel(r) : "Legacy Reveal"}`}
    sub={`${r.protocol_version === 2 ? receiptCopy(r) : `Legacy Reveal · ${r.resource_amount ?? r.reward_tickles ?? 0} ${r.resource_id ? "Acorns" : "Tickles"} · ${moteCount(r.motes_remaining)} after play`} · ${new Date(r.created_at).toLocaleString()} · ${r.paytable_version ?? "legacy reveal"}`} />)}</>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: WHIMSY.paper, maxWidth: 560, width: "100%", alignSelf: "center" },
  machine: { position: "absolute", top: 0, right: 0, left: 0, bottom: MACHINE_BOTTOM },
  topRow: { position: "absolute", left: PAGE_PAD, right: PAGE_PAD, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  pouch: { minWidth: POUCH_WIDTH, minHeight: TAP_MIN, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: SPACE.xs, paddingHorizontal: SPACE.sm },
  pouchArt: { width: ART_SIZE.glyphSm, height: ART_SIZE.glyphSm, resizeMode: "contain" },
  consoleSlot: { position: "absolute", left: PAGE_PAD, right: PAGE_PAD, maxHeight: CONSOLE_MAX_HEIGHT },
  console: { flexShrink: 1, gap: SPACE.sm },
  consoleBody: { gap: SPACE.sm },
  stakes: { gap: SPACE.xs },
  stakeRow: { flexDirection: "row", flexWrap: "wrap", gap: SPACE.sm },
  readout: { gap: SPACE.xxs },
  doors: { flexDirection: "row", justifyContent: "space-around", alignItems: "center" },
  lever: { marginTop: SPACE.xs },
});
