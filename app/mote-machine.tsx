import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AccessibilityInfo, Image, StyleSheet, View } from "react-native";
import { Redirect, Stack, router, useLocalSearchParams } from "expo-router";
import { useFocusEffect } from "expo-router/react-navigation";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { MoteMachineRive } from "@/components/mote-machine/MoteMachineRive";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { Stat } from "@/components/ui/Stat";
import { Sticker } from "@/components/ui/Sticker";
import { T } from "@/components/ui/Text";
import { showToast } from "@/components/ui/Toast";
import { MOTE_MACHINE_VISIBLE } from "@/constants/featureFlags";
import {
  ART_SIZE,
  PAGE_PAD,
  RADII,
  SPACE,
  TAP_MIN,
  WHIMSY,
} from "@/constants/theme";
import { useMotionPolicy } from "@/hooks/useMotionPolicy";
import {
  fetchMoteMachineState,
  moteMachineErrorMessage,
  newMoteSpinRequestId,
  spinMoteMachine,
  type MoteMachineSpin,
  type MoteMachineState,
} from "@/utils/moteMachine";
import { createMoteMachineAcceptanceClient } from "@/utils/moteMachineAcceptance";
import { MoteWageringScreen } from "@/components/mote-machine/MoteWageringScreen";
import { MOTE_IMAGE, MOTE_EARNING_HINT } from "@/constants/motes";
import { supabase } from "@/utils/supabase";
import { lookupMotePlayReceipt } from "@/utils/moteGame";
import { validateLegacyMoteReceipt } from "@/utils/moteGamePresentation";

const PENDING_REQUEST_KEY = "mote_machine_pending_request_v3";
const CLOCKWORK_ACORN_ICON = require("../assets/images/mote-machine/clockwork-acorn.png");
const BALANCE_TICKET_WIDTH = 94;
// The float between a safe-area edge and the machine's floating chrome. Named
// so the safe-area sum isn't spacing arithmetic on a SPACE step.
const EDGE_FLOAT = SPACE.sm;
// The gap the receipt panel keeps clear under the cabinet art.
const STAGE_CLEARANCE = SPACE.md;

type PendingMoteRequest = { requestId: string };
type MachinePhase =
  | "idle"
  | "committing"
  | "depositing"
  | "spinning"
  | "braking"
  | "revealing"
  | "settled";

export default function MoteMachineRoute() {
  const params = useLocalSearchParams<{ acceptance?: string | string[] }>();
  const [hasLegacyPending, setHasLegacyPending] = useState<boolean | null>(null);
  const [useLegacyServer, setUseLegacyServer] = useState(false);
  useEffect(() => {
    let live = true;
    AsyncStorage.getItem(PENDING_REQUEST_KEY)
      .then((value) => { if (live) setHasLegacyPending(Boolean(parsePendingRequest(value))); })
      .catch(() => { if (live) setHasLegacyPending(true); });
    return () => { live = false; };
  }, []);
  const canPreviewLocally =
    typeof __DEV__ !== "undefined" && __DEV__ && Boolean(params.acceptance);
  if (!MOTE_MACHINE_VISIBLE && !canPreviewLocally)
    return <Redirect href="/(tabs)/season" />;
  const acceptance = Array.isArray(params.acceptance) ? params.acceptance[0] : params.acceptance;
  if (hasLegacyPending === null) return null;
  if (hasLegacyPending) return <AmbiguousLegacyPending onResolved={() => setHasLegacyPending(false)} />;
  return useLegacyServer
    ? <AccountScopedLegacyMoteMachine />
    : (acceptance && !acceptance.startsWith("wager"))
    ? <LegacyMoteMachineScreen />
    : <MoteWageringScreen onLegacyServer={() => setUseLegacyServer(true)} />;
}

function AmbiguousLegacyPending({ onResolved }: { onResolved: () => void }) {
  const [message, setMessage] = useState("Checking the saved older Reveal without making a new play…");
  const [recovered, setRecovered] = useState(false);
  useEffect(() => { let live = true; void AsyncStorage.getItem(PENDING_REQUEST_KEY).then(async (raw) => {
    const request = parsePendingRequest(raw); if (!request) return;
    const result = await lookupMotePlayReceipt(request.requestId);
    if (!live) return;
    const receipt = result.ok ? validateLegacyMoteReceipt(result.receipt) : null;
    if (receipt) {
      // Re-read before removing so a newer request written while lookup was in
      // flight can never be cleared by this older receipt.
      const current = parsePendingRequest(await AsyncStorage.getItem(PENDING_REQUEST_KEY));
      if (!live) return;
      if (current?.requestId !== request.requestId) {
        setMessage("The saved request changed while its receipt was checked. It was not cleared or retried.");
        return;
      }
      await AsyncStorage.removeItem(PENDING_REQUEST_KEY);
      if (!live) return;
      setRecovered(true);
      setMessage(`Recovered older Reveal: ${receipt.resource_amount ?? receipt.reward_tickles ?? 0} ${receipt.resource_id ? "Clockwork Acorns" : "Tickles"}. ${result.ok ? result.wallet.motes : receipt.motes_remaining} Motes are available.`);
    }
    else setMessage("This older saved play does not belong to the signed-in account, or its receipt is not available yet. Sign in to the original account and contact support. It was not retried.");
  }).catch(() => { if (live) setMessage("The older saved play could not be checked. It was not retried."); }); return () => { live = false; }; }, []);
  return <View style={styles.legacyGuard}><T role="bodySm" align="center" accessibilityRole="alert">{message}</T><Button full variant="gold" onPress={recovered ? onResolved : () => router.back()} accessibilityLabel={recovered ? "Continue" : "Go back"} accessibilityHint={recovered ? "Returns to the machine. No Mote is spent." : "Leaves the machine. Nothing is spent."}>{recovered ? "Continue" : "Go back"}</Button></View>;
}

function AccountScopedLegacyMoteMachine() {
  const [storageKey, setStorageKey] = useState<string | null>(null);
  useEffect(() => { let live = true; void supabase.auth.getSession().then(({ data }) => {
    if (live) setStorageKey(data.session?.user.id ? `${PENDING_REQUEST_KEY}:${data.session.user.id}` : "");
  }); return () => { live = false; }; }, []);
  if (!storageKey) return null;
  return <LegacyMoteMachineScreen storageKeyOverride={storageKey} />;
}

export function LegacyMoteMachineScreen({ storageKeyOverride }: { storageKeyOverride?: string } = {}) {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    acceptance?: string;
    acceptanceSession?: string;
    forceRiveFailure?: string;
    reducedMotion?: string;
  }>();
  const acceptanceClient = useMemo(
    () =>
      createMoteMachineAcceptanceClient(
        params.acceptance,
        params.acceptanceSession,
      ),
    [params.acceptance, params.acceptanceSession],
  );
  const fetchMachineState =
    acceptanceClient?.fetchState ?? fetchMoteMachineState;
  const requestMachineSpin = acceptanceClient?.spin ?? spinMoteMachine;
  const forceRiveFailure =
    typeof __DEV__ !== "undefined" &&
    __DEV__ &&
    params.forceRiveFailure === "1";
  const pendingRequestKey = storageKeyOverride ?? (acceptanceClient
    ? `${PENDING_REQUEST_KEY}:acceptance:${params.acceptance}:${params.acceptanceSession ?? "default"}`
    : PENDING_REQUEST_KEY);
  const [hydrated, setHydrated] = useState(false);
  const [historyError, setHistoryError] = useState(false);
  const [machine, setMachine] = useState<MoteMachineState | null>();
  const [confirmedSpin, setConfirmedSpin] = useState<MoteMachineSpin | null>(
    null,
  );
  const [revealed, setRevealed] = useState(false);
  const [phase, setPhase] = useState<MachinePhase>("idle");
  const [spinToken, setSpinToken] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [hasUncertainPlay, setHasUncertainPlay] = useState(false);
  const [busy, setBusy] = useState(false);
  const [runtimeReady, setRuntimeReady] = useState(false);
  const [runtimeFailed, setRuntimeFailed] = useState(false);
  const [runtimeKey, setRuntimeKey] = useState(0);
  const [receiptHeight, setReceiptHeight] = useState(110);
  const retryRequest = useRef<PendingMoteRequest | null>(null);
  const inFlight = useRef(false);
  const mounted = useRef(true);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const announcedSpinIds = useRef(new Set<string>());
  const motionPolicy = useMotionPolicy();
  const reduceMotion =
    motionPolicy.reduceMotion ||
    Boolean(acceptanceClient && params.reducedMotion === "1");

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      timers.current.forEach(clearTimeout);
    };
  }, []);

  const refresh = useCallback(async () => {
    const result = await fetchMachineState();
    if (!mounted.current) return;
    if (result.ok) {
      setMachine({
        motes: result.motes,
        reward_family: result.reward_family,
        inventory: result.inventory,
      });
      setError(null);
    } else {
      setMachine(null);
      setError(moteMachineErrorMessage(result.reason));
    }
  }, [fetchMachineState]);

  const hydrate = useCallback(async () => {
    if (inFlight.current) return;
    setHydrated(false);
    setHistoryError(false);
    try {
      const pendingValue = await AsyncStorage.getItem(pendingRequestKey);
      await refresh();
      if (!mounted.current) return;
      setConfirmedSpin(null);
      setRevealed(false);
      setPhase("idle");
      const pendingRequest = parsePendingRequest(pendingValue);
      retryRequest.current = pendingRequest;
      setHasUncertainPlay(Boolean(pendingRequest));
      if (pendingRequest) setError(moteMachineErrorMessage("network"));
      setHydrated(true);
    } catch {
      if (!mounted.current) return;
      setHistoryError(true);
      setError(
        "Couldn't check your last play on this device. Try again before using another Mote.",
      );
    }
  }, [pendingRequestKey, refresh]);

  useFocusEffect(
    useCallback(() => {
      void hydrate();
    }, [hydrate]),
  );

  const schedule = useCallback((delay: number, action: () => void) => {
    timers.current.push(
      setTimeout(() => {
        if (mounted.current) action();
      }, delay),
    );
  }, []);

  const runConfirmedMotion = useCallback(
    (spin: MoteMachineSpin) => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
      setConfirmedSpin(spin);
      setRevealed(false);
      setPhase("depositing");
      setSpinToken((value) => value + 1);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});

      if (reduceMotion) {
        schedule(120, () => setPhase("revealing"));
        schedule(480, () => setPhase("settled"));
      } else {
        schedule(350, () => setPhase("spinning"));
        schedule(700, () =>
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
            () => {},
          ),
        );
        schedule(2_500, () => setPhase("braking"));
        schedule(3_000, () =>
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
            () => {},
          ),
        );
        schedule(3_400, () =>
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
            () => {},
          ),
        );
        schedule(3_717, () =>
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
            () => {},
          ),
        );
        schedule(3_720, () => setPhase("revealing"));
        schedule(4_300, () => setPhase("settled"));
      }

      schedule(reduceMotion ? 500 : 4_350, () => {
        setRevealed(true);
        setBusy(false);
        inFlight.current = false;
        Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success,
        ).catch(() => {});
        if (!announcedSpinIds.current.has(spin.spin_id)) {
          announcedSpinIds.current.add(spin.spin_id);
          const unlockCopy = spin.newly_unlocked
            ? ` ${spin.contraption_name} unlocked.`
            : "";
          AccessibilityInfo.announceForAccessibility(
            `${spin.resource_amount} ${pluralResource(spin)} stored.${unlockCopy} ${spin.resource_balance} stored in Contraptions. ${spin.motes_remaining} Motes remain.`,
          );
          showToast(rewardNotification(spin));
        }
      });
    },
    [reduceMotion, schedule],
  );

  const handleSpinResult = useCallback(
    (result: MoteMachineSpin) => {
      retryRequest.current = null;
      void AsyncStorage.removeItem(pendingRequestKey).catch(() => {});
      setHasUncertainPlay(false);
      setMachine((current) => {
        if (!current) return current;
        const inventoryItem = current.inventory.find(
          (item) => item.contraption_id === result.contraption_id,
        );
        const updated = inventoryItem
          ? current.inventory.map((item) =>
              item.contraption_id === result.contraption_id
                ? { ...item, resource_balance: result.resource_balance }
                : item,
            )
          : current.inventory;
        return {
          ...current,
          motes: result.motes_remaining,
          inventory: updated,
        };
      });
      runConfirmedMotion(result);
    },
    [pendingRequestKey, runConfirmedMotion],
  );

  const play = useCallback(async () => {
    if (inFlight.current || busy || !hydrated) return;
    // An uncertain receipt can be recovered even if animation cannot load,
    // or the last Mote has already been debited on the server.
    if (
      !retryRequest.current &&
      (!runtimeReady || runtimeFailed || !machine || machine.motes < 1)
    )
      return;

    inFlight.current = true;
    setBusy(true);
    setError(null);
    setConfirmedSpin(null);
    setRevealed(false);
    setPhase("committing");
    const recovering = Boolean(retryRequest.current);
    const pendingRequest = retryRequest.current ?? {
      requestId: newMoteSpinRequestId(),
    };
    retryRequest.current = pendingRequest;
    try {
      await AsyncStorage.setItem(
        pendingRequestKey,
        JSON.stringify(pendingRequest),
      );
    } catch {
      inFlight.current = false;
      setBusy(false);
      setPhase("idle");
      if (!recovering) retryRequest.current = null;
      setError(
        recovering
          ? "Couldn't save your recovery request. Try checking the last play again."
          : "Couldn't save this play on your device. Your Mote was not spent.",
      );
      return;
    }
    if (!mounted.current) return;
    const result = await requestMachineSpin(pendingRequest.requestId).catch(
      () => ({ ok: false as const, reason: "network" }),
    );
    if (!mounted.current) return;
    if (!result.ok) {
      setBusy(false);
      setPhase("idle");
      const uncertainReceipt = ["network", "no_data", "unknown"].includes(
        result.reason,
      );
      setError(
        moteMachineErrorMessage(uncertainReceipt ? "network" : result.reason),
      );
      setHasUncertainPlay(uncertainReceipt);
      inFlight.current = false;
      if (!uncertainReceipt) {
        retryRequest.current = null;
        void AsyncStorage.removeItem(pendingRequestKey).catch(() => {});
      }
      if (result.reason === "no_motes") {
        setMachine((current) => (current ? { ...current, motes: 0 } : current));
      }
      return;
    }
    handleSpinResult(result);
  }, [
    busy,
    handleSpinResult,
    hydrated,
    machine,
    pendingRequestKey,
    requestMachineSpin,
    runtimeFailed,
    runtimeReady,
  ]);

  const motes = machine?.motes ?? 0;
  const uncertain = hasUncertainPlay;
  const canPlay =
    hydrated &&
    !busy &&
    (uncertain ||
      (runtimeReady && !runtimeFailed && machine != null && motes > 0));
  const actionLabel = historyError
    ? "Try again"
    : buttonLabel({
        busy,
        phase,
        uncertain,
        motes,
        revealed,
        machine,
        runtimeFailed,
      });
  const statusLabel =
    phase === "committing" && uncertain
      ? "Checking the same play. No extra Mote is used."
      : machineStatusLabel({
          phase,
          spin: confirmedSpin,
          revealed,
          error,
          motes,
          runtimeFailed,
        });
  const requestPlay = useCallback(() => {
    if (historyError || (machine === null && !uncertain)) {
      void hydrate();
    } else if (!uncertain && machine?.motes === 0) {
      router.push("/(tabs)/season");
    } else {
      void play();
    }
  }, [historyError, hydrate, machine, play, uncertain]);

  const rewardLabel = confirmedSpin
    ? `${confirmedSpin.resource_amount} ${pluralResource(confirmedSpin).toUpperCase()}`
    : "CLOCKWORK ACORNS";
  const storedAcorns =
    machine?.inventory.find((item) => item.contraption_id === "auto_tickler")
      ?.resource_balance ??
    confirmedSpin?.resource_balance ??
    0;
  const presenting =
    phase === "depositing" ||
    phase === "spinning" ||
    phase === "braking" ||
    phase === "revealing";

  return (
    <>
      <Stack.Screen options={{ headerShown: false, gestureEnabled: true }} />
      <View style={styles.page}>
        <View
          style={[
            styles.machineStage,
            { bottom: receiptHeight + insets.bottom + STAGE_CLEARANCE },
          ]}
        >
          <MoteMachineRive
            key={runtimeKey}
            spinToken={spinToken}
            resultValue={confirmedSpin?.reel_value ?? 3}
            motes={motes}
            reduceMotion={reduceMotion}
            presenting={presenting}
            busy={busy}
            canPlay={canPlay}
            hasError={Boolean(error) || runtimeFailed}
            motesLabel={
              machine === undefined
                ? "— MOTES"
                : `${motes} ${motes === 1 ? "MOTE" : "MOTES"}`
            }
            rewardLabel={rewardLabel}
            actionLabel={actionLabel}
            statusLabel={statusLabel}
            confirmedRewardLabel={
              confirmedSpin
                ? `${confirmedSpin.resource_amount} ${pluralResource(confirmedSpin)}`
                : undefined
            }
            uncertainPlay={
              !hydrated || hasUncertainPlay || phase === "committing"
            }
            forceFailure={forceRiveFailure}
            onRequestPlay={requestPlay}
            onRetryRuntime={() => {
              setRuntimeReady(false);
              setRuntimeFailed(false);
              setRuntimeKey((value) => value + 1);
            }}
            onRuntimeReady={() => {
              setRuntimeReady(true);
              setRuntimeFailed(false);
            }}
            onRuntimeError={() => {
              setRuntimeReady(false);
              setRuntimeFailed(true);
            }}
          />
        </View>

        <View pointerEvents="box-none" style={styles.overlay}>
          <View
            pointerEvents="box-none"
            style={[styles.topRow, { top: insets.top + EDGE_FLOAT }]}
          >
            <IconButton
              name="chevronLeft"
              label="Back"
              accessibilityHint="Leaves the machine. Nothing is spent."
              onPress={() => router.back()}
              iconSize={ART_SIZE.glyphSm}
              visualSize={TAP_MIN}
            />
            <View style={styles.tickets}>
              <Sticker
                color="paper"
                rotate={0}
                radius={RADII.md}
                shadow="sm"
                style={styles.balanceTicket}
                accessibilityLabel={`${motes} ${motes === 1 ? "Mote" : "Motes"} available`}
                accessibilityRole="text"
              >
                <Image
                  source={MOTE_IMAGE}
                  style={styles.balanceIcon}
                  accessible={false}
                />
                <Stat value={motes} label={motes === 1 ? "Mote" : "Motes"} />
              </Sticker>

              <Sticker
                color="paper"
                rotate={0}
                radius={RADII.md}
                shadow="sm"
                style={styles.balanceTicket}
                onPress={() =>
                  router.push({
                    pathname: "/contraptions",
                    params: acceptanceClient
                      ? {
                          acceptance: params.acceptance,
                          acceptanceSession: params.acceptanceSession,
                        }
                      : {},
                  })
                }
                accessibilityLabel={`Open Contraption Inventory. ${storedAcorns} Clockwork ${storedAcorns === 1 ? "Acorn" : "Acorns"} stored`}
                accessibilityHint="Opens your Contraptions. Nothing is spent."
              >
                <Image
                  source={CLOCKWORK_ACORN_ICON}
                  style={styles.balanceIcon}
                  accessible={false}
                />
                <Stat value={storedAcorns} label="Acorns" />
              </Sticker>
            </View>
          </View>

          <View
            style={[styles.receiptSlot, { bottom: insets.bottom + EDGE_FLOAT }]}
            onLayout={({ nativeEvent }) =>
              setReceiptHeight(nativeEvent.layout.height)
            }
          >
            <Sticker
              color="paper"
              rotate={0}
              radius={RADII.lg}
              shadow="sm"
              pad
              style={styles.receiptPanel}
            >
            <T
              role="bodySm"
              align="center"
              accessibilityRole={error ? "alert" : undefined}
            >
              {machine === undefined && !error
                ? "Checking your Mote pouch…"
                : statusLabel}
            </T>
            <Button
              full
              variant="gold"
              onPress={requestPlay}
              disabled={
                busy ||
                (!historyError &&
                  (!hydrated || (!canPlay && machine !== null && motes > 0)))
              }
              accessibilityLabel={actionLabel}
              accessibilityHint={
                uncertain
                  ? "Checks the same play without using another Mote."
                  : motes > 0
                    ? "Uses one Mote."
                    : MOTE_EARNING_HINT
              }
              accessibilityState={{ busy }}
            >
              {actionLabel}
            </Button>
            </Sticker>
          </View>
        </View>
      </View>
    </>
  );
}

function pluralResource(spin: MoteMachineSpin): string {
  return spin.resource_amount === 1
    ? spin.resource_name
    : `${spin.resource_name}s`;
}

function rewardNotification(spin: MoteMachineSpin) {
  const resource = pluralResource(spin);
  return {
    tone: "success" as const,
    title: spin.newly_unlocked
      ? `${spin.contraption_name} unlocked`
      : `${resource} stored`,
    text: `+${spin.resource_amount} · ${spin.resource_balance} stored · ${spin.motes_remaining} ${spin.motes_remaining === 1 ? "Mote" : "Motes"} left`,
  };
}

function buttonLabel({
  busy,
  phase,
  uncertain,
  motes,
  revealed,
  machine,
  runtimeFailed,
}: {
  busy: boolean;
  phase: MachinePhase;
  uncertain: boolean;
  motes: number;
  revealed: boolean;
  machine: MoteMachineState | null | undefined;
  runtimeFailed: boolean;
}) {
  if (uncertain) return busy ? "Checking last play…" : "Check last play";
  if (machine === null) return "Try again";
  if (machine === undefined) return "Waking the machine…";
  if (runtimeFailed) return "Machine resting";
  if (busy)
    return phase === "committing" ? "Adding the Mote…" : "Reels spinning…";
  if (motes <= 0) return "Find a Mote";
  if (revealed) return "Spin another";
  return "Pull the lever";
}

function machineStatusLabel({
  phase,
  spin,
  revealed,
  error,
  motes,
  runtimeFailed,
}: {
  phase: MachinePhase;
  spin: MoteMachineSpin | null;
  revealed: boolean;
  error: string | null;
  motes: number;
  runtimeFailed: boolean;
}) {
  if (error) return error;
  if (runtimeFailed && !spin) return "Reload the machine to play.";
  if (phase === "committing") return "Adding one Mote…";
  if (phase === "depositing") return "The Mote wakes the machine…";
  if (phase === "spinning") return "Three reels turn…";
  if (phase === "braking") return "The reels slow one by one…";
  if (phase === "revealing" || (phase === "settled" && !revealed))
    return "The machine reveals your Contraption fuel…";
  if (revealed && spin) {
    const unlock = spin.newly_unlocked ? " · Auto-Tickler unlocked" : "";
    return `${spin.resource_amount} ${pluralResource(spin)} · ${spin.resource_balance} stored${unlock} · ${spin.motes_remaining} Motes left`;
  }
  if (motes <= 0) return `Your Mote pouch is empty. ${MOTE_EARNING_HINT}`;
  return "Deposit one Mote and pull the lever.";
}

function parsePendingRequest(value: string | null): PendingMoteRequest | null {
  if (!value) return null;
  try {
    const candidate = JSON.parse(value) as Partial<PendingMoteRequest>;
    if (
      typeof candidate.requestId !== "string" ||
      candidate.requestId.length < 8
    )
      return null;
    return { requestId: candidate.requestId };
  } catch {
    return null;
  }
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    width: "100%",
    maxWidth: 560,
    alignSelf: "center",
    backgroundColor: WHIMSY.paper,
  },
  machineStage: { position: "absolute", top: 0, left: 0, right: 0 },
  overlay: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0 },
  // The floating chrome rides one row: back on the left, the two balance
  // tickets on the right — so nothing has to add a token to a page gutter.
  topRow: {
    position: "absolute",
    left: PAGE_PAD,
    right: PAGE_PAD,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  tickets: { flexDirection: "row", alignItems: "center", gap: SPACE.sm },
  balanceTicket: {
    width: BALANCE_TICKET_WIDTH,
    minHeight: TAP_MIN,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACE.xs,
    paddingHorizontal: SPACE.xs,
  },
  balanceIcon: {
    width: ART_SIZE.glyphSm,
    height: ART_SIZE.glyphSm,
    resizeMode: "contain",
  },
  receiptSlot: { position: "absolute", left: PAGE_PAD, right: PAGE_PAD },
  receiptPanel: { gap: SPACE.sm },
  legacyGuard: { flex: 1, justifyContent: "center", gap: SPACE.lg, padding: PAGE_PAD, backgroundColor: WHIMSY.paper },
});
