import { useCallback, useMemo, useRef, useState } from "react";
import { Image, ScrollView, StyleSheet, View } from "react-native";
import { Redirect, Stack, router, useLocalSearchParams } from "expo-router";
import { useFocusEffect } from "expo-router/react-navigation";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { createMoteMachineAcceptanceClient } from "@/utils/moteMachineAcceptance";
import { createMoteGameAcceptanceClient } from "@/utils/moteGameAcceptance";
import { LoadingBeat } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { Sticker } from "@/components/ui/Sticker";
import { Button } from "@/components/ui/Button";
import { T } from "@/components/ui/Text";
import { MOTE_MACHINE_VISIBLE } from "@/constants/featureFlags";
import {
  ART_SIZE,
  PAGE_PAD,
  RADII,
  SPACE,
  TAB_SAFE,
  UI_COLORS,
  WHIMSY,
} from "@/constants/theme";
import {
  activateContraption,
  contraptionErrorMessage,
  fetchContraptionInventory,
  type ContraptionDuration,
  type ContraptionInventoryItem,
  type ContraptionServiceEvent,
} from "@/utils/moteMachine";

export default function ContraptionsRoute() {
  const params = useLocalSearchParams<{
    acceptance?: string;
    acceptanceSession?: string;
  }>();
  const canPreviewLocally = Boolean(
    createMoteGameAcceptanceClient(params.acceptance, params.acceptanceSession) ?? createMoteMachineAcceptanceClient(
      params.acceptance,
      params.acceptanceSession,
    ),
  );
  if (!MOTE_MACHINE_VISIBLE && !canPreviewLocally)
    return <Redirect href="/(tabs)/season" />;
  return <ContraptionInventoryScreen />;
}

function ContraptionInventoryScreen() {
  const params = useLocalSearchParams<{
    acceptance?: string;
    acceptanceSession?: string;
  }>();
  const client = useMemo(
    () =>
      createMoteGameAcceptanceClient(params.acceptance, params.acceptanceSession) ?? createMoteMachineAcceptanceClient(
        params.acceptance,
        params.acceptanceSession,
      ),
    [params.acceptance, params.acceptanceSession],
  );
  const fetchInventory = client?.fetchInventory ?? fetchContraptionInventory;
  const inFlight = useRef(false);
  const [items, setItems] = useState<ContraptionInventoryItem[]>([]);
  const [events, setEvents] = useState<ContraptionServiceEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [activating, setActivating] = useState<ContraptionDuration | null>(
    null,
  );
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await fetchInventory().catch(() => ({
      ok: false as const,
      reason: "network",
    }));
    if (result.ok) {
      setItems(result.items);
      setEvents(result.events);
      setMessage(null);
    } else {
      setMessage(contraptionErrorMessage(result.reason));
    }
    setLoading(false);
  }, [fetchInventory]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const autoTickler = items.find(
    (item) => item.contraption_id === "auto_tickler",
  );
  const recentAutoTickles = useMemo(
    () =>
      events
        .filter((event) => event.kind === "auto_tickles")
        .reduce((sum, event) => sum + Math.max(0, event.amount), 0),
    [events],
  );

  const activate = useCallback(
    async (duration: ContraptionDuration) => {
      if (!autoTickler || inFlight.current) return;
      inFlight.current = true;
      setActivating(duration);
      setMessage(null);
      const result = await (
        client
          ? client.activate(duration)
          : activateContraption("auto_tickler", duration)
      ).catch(() => ({ ok: false as const, reason: "network" }));
      inFlight.current = false;
      setActivating(null);
      if (!result.ok) {
        setMessage(contraptionErrorMessage(result.reason));
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(
          () => {},
        );
        return;
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => {},
      );
      setItems((current) =>
        current.map((item) =>
          item.contraption_id === result.contraption_id
            ? {
                ...item,
                resource_balance: result.resource_balance,
                active_until: result.active_until,
              }
            : item,
        ),
      );
      setMessage(
        `Auto-Tickler wound for ${duration === "day" ? "one day" : "one week"}.`,
      );
    },
    [autoTickler, client],
  );

  return (
    <SafeAreaView style={styles.safe}>
      <Stack.Screen options={{ headerShown: false }} />
      <PageHeader
        kicker="workshop shelf"
        title="Contraptions"
        onBack={() => router.back()}
      />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <T role="bodySm" tone="secondary" align="center" style={styles.intro}>
          Every helper keeps its own fuel here. Wind one up, choose its service
          time, and it will stop exactly where its rule says.
        </T>

        {loading ? (
          <LoadingBeat label="gathering your helpers" style={styles.loader} />
        ) : autoTickler ? (
          <Sticker color="paper" radius={RADII.lg} style={styles.card}>
            <View style={styles.cardTop}>
              <ClockworkAcornIcon />
              <View style={styles.cardTitleWrap}>
                <T role="cardTitle">{autoTickler.name}</T>
                <T role="label" tone="accent" style={styles.resourceName}>
                  {autoTickler.resource_balance} Clockwork{" "}
                  {autoTickler.resource_balance === 1 ? "Acorn" : "Acorns"}
                </T>
              </View>
            </View>

            <T role="body" style={styles.description}>
              {autoTickler.description}
            </T>
            <View style={styles.rule}>
              <T role="label" tone="accent">
                ITS STOPPING RULE
              </T>
              <T role="bodySm" style={styles.ruleText}>
                It tickles only above your personal cap minus five. Those final
                five stay yours for manual play.
              </T>
            </View>

            <T role="bodySm" tone="secondary" style={styles.serviceStatus}>
              {serviceLabel(autoTickler.active_until)}
            </T>

            <View style={styles.actions}>
              <WindButton
                label="Wind for 1 day"
                cost="1 acorn"
                disabled={
                  autoTickler.resource_balance < 1 || activating != null
                }
                busy={activating === "day"}
                onPress={() => void activate("day")}
              />
              <WindButton
                label="Wind for 1 week"
                cost="5 acorns"
                disabled={
                  autoTickler.resource_balance < 5 || activating != null
                }
                busy={activating === "week"}
                onPress={() => void activate("week")}
              />
            </View>

            {recentAutoTickles > 0 ? (
              <T role="bodySm" tone="accent" style={styles.receipt}>
                Recent workshop receipts · {recentAutoTickles} automatic{" "}
                {recentAutoTickles === 1 ? "tickle" : "tickles"}
              </T>
            ) : null}
          </Sticker>
        ) : (
          // The waiting shelf keeps the sticker's shape but wears a dashed,
          // muted outline and no shadow — nothing is sitting here yet.
          <Sticker
            color="paper"
            radius={RADII.lg}
            shadow="none"
            borderStyle="dashed"
            style={styles.lockedCard}
          >
            <ClockworkAcornIcon />
            <T role="cardTitle" align="center" style={styles.lockedTitle}>
              The shelf is waiting.
            </T>
            <T role="bodySm" tone="secondary" align="center" style={styles.lockedText}>
              Win your first Clockwork Acorn in the Mote Machine to reveal and
              charge the Auto-Tickler.
            </T>
            <Button
              variant="primary"
              onPress={() =>
                router.replace({
                  pathname: "/mote-machine",
                  params: client
                    ? {
                        acceptance: params.acceptance,
                        acceptanceSession: params.acceptanceSession,
                      }
                    : {},
                })
              }
              style={styles.machineButton}
              accessibilityLabel="Back to the Mote Machine"
              accessibilityHint="Opens the machine where Clockwork Acorns are won."
            >
              Back to the machine
            </Button>
          </Sticker>
        )}

        {message ? (
          <T
            role="bodySm"
            tone="accent"
            align="center"
            accessibilityRole="alert"
            style={styles.message}
          >
            {message}
          </T>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function ClockworkAcornIcon() {
  return (
    <Image
      source={require("../assets/images/mote-machine/clockwork-acorn.png")}
      style={styles.acornIcon}
      accessibilityLabel="Clockwork Acorn"
    />
  );
}

// The spend control. A currency-moving button states its cost in its label and
// its consequence in its hint [C-03]; `Button` owns the disabled chrome (a
// button asleep, never an opacity crush) and the busy announcement.
function WindButton({
  label,
  cost,
  disabled,
  busy,
  onPress,
}: {
  label: string;
  cost: string;
  disabled: boolean;
  busy: boolean;
  onPress: () => void;
}) {
  return (
    <Button
      variant={disabled ? "locked" : "gold"}
      size="sm"
      disabled={disabled}
      loading={busy}
      onPress={onPress}
      style={styles.windButton}
      accessibilityLabel={`${label}, costs ${cost}`}
      accessibilityHint={
        disabled
          ? "Not enough Clockwork Acorns for this winding yet."
          : "Spends the acorns and puts the Auto-Tickler into service."
      }
    >
      {`${label} · ${cost}`}
    </Button>
  );
}

function serviceLabel(activeUntil: string | null): string {
  if (!activeUntil) return "Resting · wind it when you want service";
  const remaining = new Date(activeUntil).getTime() - Date.now();
  if (remaining <= 0) return "Resting · its last winding has finished";
  const hours = Math.ceil(remaining / 3_600_000);
  if (hours < 48)
    return `Tickling · about ${hours} ${hours === 1 ? "hour" : "hours"} left`;
  return `Tickling · about ${Math.ceil(hours / 24)} days left`;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: WHIMSY.cream },
  content: {
    paddingHorizontal: PAGE_PAD,
    paddingTop: SPACE.lg,
    paddingBottom: TAB_SAFE,
  },
  intro: {
    marginBottom: SPACE.lg,
  },
  loader: { marginTop: SPACE.xxl },
  card: {
    padding: SPACE.lg,
  },
  cardTop: { flexDirection: "row", alignItems: "center", gap: SPACE.md },
  cardTitleWrap: { flex: 1 },
  resourceName: { marginTop: SPACE.xxs },
  acornIcon: { width: ART_SIZE.thumb, height: ART_SIZE.thumb, resizeMode: "contain" },
  description: { marginTop: SPACE.lg },
  rule: {
    marginTop: SPACE.md,
    padding: SPACE.md,
    borderRadius: RADII.md,
    backgroundColor: WHIMSY.slopBand,
  },
  ruleText: { marginTop: SPACE.xs },
  serviceStatus: { marginTop: SPACE.md },
  actions: { flexDirection: "row", gap: SPACE.sm, marginTop: SPACE.md },
  windButton: { flex: 1 },
  receipt: { marginTop: SPACE.md },
  lockedCard: {
    padding: SPACE.xl,
    alignItems: "center",
    // Sticker owns the dashed outline; only its muted ink is a local choice.
    borderColor: UI_COLORS.uiMuted,
  },
  lockedTitle: { marginTop: SPACE.sm },
  lockedText: {
    marginTop: SPACE.xs,
  },
  machineButton: {
    marginTop: SPACE.lg,
  },
  message: {
    marginTop: SPACE.lg,
  },
});
