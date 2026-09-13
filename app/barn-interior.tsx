import { setStatusBarStyle } from "expo-status-bar";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { Redirect, Stack, router, useLocalSearchParams, useFocusEffect } from "expo-router";
import { useIsFocused } from "expo-router/react-navigation";
import { useFeatureFlagState } from "@/hooks/useFeatureFlags";
import { useHabitat, type HabitatBackend } from "@/hooks/useHabitat";
import { useHabitatAccount } from "@/hooks/useHabitatAccount";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { HabitatDoorTransition } from "@/components/habitat/HabitatDoorTransition";
import { HABITAT_POSITION_META } from "@/constants/habitat";
import { trackInteraction } from "@/utils/interactionAnalytics";
import { HabitatScene } from "@/components/habitat/HabitatScene";
import { HabitatEditor } from "@/components/habitat/HabitatEditor";
import { HabitatOwnerPig } from "@/components/habitat/HabitatOwnerPig";
import { HabitatWorkshopCabinet } from "@/components/habitat/HabitatWorkshopCabinet";
import { HabitatStarterWelcome } from "@/components/habitat/HabitatStarterWelcome";
import { HabitatGiftReveal } from "@/components/habitat/HabitatGiftReveal";
import { HabitatPresetSheet } from "@/components/habitat/HabitatPresetSheet";
import { useHabitatJournal, type HabitatJournalBackend } from "@/hooks/useHabitatJournal";
import type { HabitatPresetBackend } from "@/hooks/useHabitatPresets";
import { Button } from "@/components/ui/Button";
import { EmptyState, LoadingBeat } from "@/components/ui/EmptyState";
import { Icon } from "@/components/ui/Icon";
import { Sticker } from "@/components/ui/Sticker";
import { Body, BodySm, CardTitle } from "@/components/ui/Text";
import type { HabitatCatalogItem, HabitatPosition } from "@/utils/habitat";
import { RADII, SPACE, UI_COLORS, WHIMSY } from "@/constants/theme";

// The two controls that float over the room carry their mark at the size the
// Barn's own chrome uses — a step above the 18pt Icon default so they read
// against the art behind them. (2026-09-11)
const CONTROL_ICON = 22;
const TOOLTIP_CLEARANCE = 64;

// The doors the interior can be reached through. `structure` is the barn on the
// Exterior's ground plane, `button` the retired gold entry, `shop` the purchase
// hand-off, `visit` a friend's room. `unknown` is a deep link or a cold start.
export type HabitatEntryPoint =
  | "structure"
  | "button"
  | "shop"
  | "visit"
  | "unknown";

export default function BarnInteriorRoute() {
  const { visible, loaded } = useFeatureFlagState("habitat");
  const { id: accountId, loaded: authLoaded } = useHabitatAccount();
  // The interior is a full-bleed wood scene: the status bar goes light while
  // this route is FOCUSED and back to the app's dark bar the moment another
  // screen (the collection, a sheet's host) takes focus. Imperative on focus
  // rather than a mounted <StatusBar>, because a pushed route leaves this one
  // mounted underneath and the mounted component kept winning. (2026-09-11)
  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle("light");
      return () => setStatusBarStyle("dark");
    }, [])
  );
  if (!loaded || !authLoaded)
    return (
      <View style={styles.loading}>
        <LoadingBeat label="opening the Barn" />
      </View>
    );
  if (!visible || !accountId) return <Redirect href="/(tabs)" />;
  return <BarnInterior key={accountId} accountId={accountId} />;
}
export function BarnInterior({
  accountId,
  backend,
  pig,
  workshop,
  onCollection,
  journalBackend,
  presetBackend,
}: {
  accountId: string;
  backend?: HabitatBackend;
  pig?: React.ReactNode;
  workshop?: React.ReactNode | null;
  onCollection?: (position?: HabitatPosition) => void;
  journalBackend?: HabitatJournalBackend;
  presetBackend?: HabitatPresetBackend;
}) {
  const params = useLocalSearchParams<{
    position?: string;
    purchasedItemId?: string;
    entry?: HabitatEntryPoint;
  }>();
  const habitat = useHabitat(accountId, backend);
  const isFocused = useIsFocused();
  const completionAccountId = backend && !journalBackend ? null : accountId;
  const journal = useHabitatJournal(completionAccountId, journalBackend);
  const insets = useSafeAreaInsets();
  const ownerPig = pig ?? <HabitatOwnerPig />;
  const [editing, setEditing] = useState(false),
    [startInList, setStartInList] = useState(false),
    [inspected, setInspected] = useState<string | null>(null),
    [message, setMessage] = useState<string | null>(null),
    [leaving, setLeaving] = useState(false),
    [initialPosition, setInitialPosition] = useState<HabitatPosition | undefined>(),
    [presetVisible, setPresetVisible] = useState(false);
  const consumedHandoff = useRef<string | null>(null);
  const compatiblePosition = useCallback((category: HabitatCatalogItem["category"]) => {
    if (!habitat.draft) return undefined;
    const matches = Object.entries(HABITAT_POSITION_META)
      .filter(([, meta]) => meta.category === category)
      .map(([key]) => key as HabitatPosition);
    return matches.find((key) => habitat.draft?.positions[key] === null) ?? matches[0];
  }, [habitat.draft]);
  useEffect(() => {
    if (!params.purchasedItemId) {
      consumedHandoff.current = null;
      return;
    }
    if (
      habitat.loading ||
      !habitat.draft ||
      !params.purchasedItemId ||
      !habitat.data
    )
      return;
    const item = habitat.data.owned.find(
      (i) => i.id === params.purchasedItemId,
    );
    if (item) {
      const handoff = `${accountId}:${params.position ?? "auto"}:${item.id}`;
      if (consumedHandoff.current === handoff) return;
      const requested = params.position && Object.hasOwn(HABITAT_POSITION_META, params.position)
        ? params.position as HabitatPosition
        : undefined;
      const target = requested && HABITAT_POSITION_META[requested].category === item.category
        ? requested
        : compatiblePosition(item.category);
      if (!target) return;
      consumedHandoff.current = handoff;
      habitat.place(target, item);
      setInitialPosition(target);
      setEditing(true);
      const acquisitionIds = journal.acquisitions
        .filter((entry) => entry.itemId === item.id && !entry.seen)
        .map((entry) => entry.id);
      if (acquisitionIds.length) void journal.markSeen(acquisitionIds);
      router.setParams({ position: undefined, purchasedItemId: undefined });
    }
  }, [accountId, params.position, params.purchasedItemId, habitat.data, habitat.loading, compatiblePosition, journal.acquisitions, journal.markSeen]);
  useEffect(() => {
    if (message !== "Barn saved.") return;
    const timer = setTimeout(() => setMessage(null), 3500);
    return () => clearTimeout(timer);
  }, [message]);
  const findMore = useCallback(
    (position: HabitatPosition) =>
      onCollection
        ? onCollection(position)
        : router.push({ pathname: "/barn-collection", params: { position } }),
    [onCollection],
  );
  const finishLeaving = useCallback(
    () => (router.canGoBack() ? router.back() : router.replace("/(tabs)")),
    [],
  );
  // Which door the player came through. `variant` is the free-string property
  // on the analytics contract, so the entry point rides it rather than earning a
  // key of its own. Unknown covers deep links and cold starts into the route.
  const entry: HabitatEntryPoint = params.entry ?? "unknown";
  useEffect(() => {
    if (!backend && habitat.data)
      void trackInteraction({
        eventName: "habitat_opened",
        surface: "habitat",
        properties: { variant: entry },
      });
    // `entry` is a route param read once at mount; re-firing on a param edit
    // would double-count one opening.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backend, Boolean(habitat.data)]);
  const beginEditing = (list: boolean) => {
    setInitialPosition(undefined);
    setStartInList(list);
    setEditing(true);
    if (!backend)
      void trackInteraction({
        eventName: "habitat_edit_started",
        surface: "habitat",
      });
  };
  const openCollection = () => {
    onCollection ? onCollection() : router.push("/barn-collection");
  };
  if (habitat.loading && !habitat.preview)
    return (
      <View style={styles.loading}>
        <LoadingBeat label="setting up your Barn" />
      </View>
    );
  if (!habitat.preview || !habitat.data)
    return (
      <SafeAreaView style={styles.error}>
        <EmptyState
          kind="error"
          glyph="barn"
          title="The barn door is stuck."
          sub={habitat.error ?? "Try again when you’re connected."}
          action={
            <View style={styles.errorActions}>
              <Button
                variant="gold"
                accessibilityLabel="Try again"
                accessibilityHint="Reloads your Barn"
                onPress={habitat.refresh}
              >
                Try again
              </Button>
              <Button
                variant="link"
                accessibilityLabel="Outside"
                accessibilityHint="Leaves the Barn and returns Home"
                onPress={() =>
                  router.canGoBack() ? router.back() : router.replace("/(tabs)")
                }
              >
                Outside
              </Button>
            </View>
          }
        />
      </SafeAreaView>
    );
  const cabinet =
    workshop === undefined ? <HabitatWorkshopCabinet owner /> : workshop;
  return (
    <HabitatDoorTransition
      direction={leaving ? "exit" : "enter"}
      onClosed={finishLeaving}
    >
      <View style={styles.root}>
        {/* The doors ARE the route transition, and the exit path runs through
            setLeaving(true) so they always close behind you. An edge-swipe
            back would pop the route out from under that, so the gesture is
            off: leaving the room is the Home control's job. */}
        <Stack.Screen
          options={{
            headerShown: false,
            animation: "none",
            gestureEnabled: false,
          }}
        />
        <HabitatStarterWelcome
          visible={habitat.starterWelcomePending}
          onDismiss={habitat.dismissStarterWelcome}
        />
        {editing ? (
          <HabitatEditor
            initialList={startInList}
            snapshot={habitat.preview}
            owned={habitat.data.owned}
            dirty={habitat.dirty}
            canUndo={Boolean(habitat.draft?.history.length)}
            saving={habitat.saving}
            offline={habitat.offline}
            onPlace={habitat.place}
            onRemove={habitat.remove}
            onUndo={habitat.undo}
            onCancel={() => {
              habitat.cancel();
              setEditing(false);
            }}
            onSave={() =>
              void habitat.save().then((r) => {
                if (r.ok) {
                  if (!backend)
                    void trackInteraction({
                      eventName: "habitat_layout_saved",
                      surface: "habitat",
                      properties: {
                        count:
                          Object.values(r.snapshot.positions).filter(Boolean)
                            .length - 1,
                      },
                    });
                  setEditing(false);
                  setMessage("Barn saved.");
                  AccessibilityInfo.announceForAccessibility("Barn saved");
                } else if (r.reason === "revision_conflict") {
                  if (!backend)
                    void trackInteraction({
                      eventName: "habitat_save_conflicted",
                      surface: "habitat",
                    });
                } else {
                  setMessage(
                    r.reason === "pending_command"
                      ? "A previous change is still being confirmed. Try again shortly."
                      : "The Barn was not saved. Your draft is still here.",
                  );
                }
              })
            }
            onFindMore={findMore}
            onOpenCollection={openCollection}
            initialPosition={initialPosition}
            newItemIds={journal.newItemIds}
            presets={
              <Button variant="ghost" size="md" onPress={() => setPresetVisible(true)}>
                Saved rooms
              </Button>
            }
            workshop={cabinet}
          >
            {ownerPig}
          </HabitatEditor>
        ) : (
          <>
            <HabitatScene
              snapshot={habitat.data.snapshot}
              onInspect={(item) =>
                setInspected(`${item.name}\n${item.description}`)
              }
              cabinet={cabinet}
              hostPig={ownerPig}
            />
            <View
              pointerEvents="box-none"
              testID="barn-owner-top-controls"
              style={[styles.topControls, { top: insets.top }]}
            >
              <Button
                variant="ghost"
                size="sm"
                accessibilityLabel="Home"
                accessibilityHint="Closes the Barn doors and returns Home"
                disabled={leaving}
                onPress={() => setLeaving(true)}
                icon={
                  <Icon
                    name="chevronLeft"
                    size={CONTROL_ICON}
                    strokeWidth={2.4}
                    color={UI_COLORS.action}
                  />
                }
              >
                Home
              </Button>
              <Button
                variant="ghost"
                size="sm"
                accessibilityLabel="Furnishings"
                accessibilityHint="Opens your furnishing collection"
                onPress={openCollection}
                icon={
                  <Icon
                    name="furnishings"
                    size={CONTROL_ICON}
                    strokeWidth={2.4}
                    color={UI_COLORS.action}
                  />
                }
              >
                Furnishings
              </Button>
            </View>
            <View
              pointerEvents="box-none"
              style={[styles.decorateDock, { bottom: insets.bottom }]}
            >
              <Button
                variant="gold"
                size="md"
                accessibilityLabel="Decorate"
                accessibilityHint="Opens the spatial Barn editor"
                onPress={() => beginEditing(false)}
                icon={
                  <Icon
                    name="edit"
                    size={CONTROL_ICON}
                    color={UI_COLORS.textPrimary}
                  />
                }
              >
                Decorate
              </Button>
            </View>
          </>
        )}
        {habitat.dirty && !editing ? (
          <Sticker
            color="paper"
            rotate={0}
            radius={RADII.md}
            shadow="sm"
            pad
            style={styles.strip}
          >
            <BodySm>
              You have an unsaved arrangement. Decorate to continue.
            </BodySm>
          </Sticker>
        ) : null}
        {habitat.offline || habitat.data.snapshot.themeRecovered ? (
          <Sticker
            color={UI_COLORS.warningSurface}
            rotate={0}
            radius={RADII.md}
            shadow="sm"
            pad
            style={styles.strip}
          >
            <BodySm accessibilityRole="alert" tone="warning">
              {habitat.offline
                ? `Offline copy — changes will stay here until you reconnect.${habitat.data.snapshot.themeRecovered ? " Your saved room theme was unavailable, so Warm Plank Barn is shown." : ""}`
                : "Your saved room theme was unavailable, so Warm Plank Barn is shown. Choose a room theme and save to update your Barn."}
            </BodySm>
          </Sticker>
        ) : null}
        {message || habitat.error ? (
          <Sticker
            color="sky"
            rotate={0}
            radius={RADII.md}
            shadow="sm"
            pad
            accessibilityLabel={
              message === "Barn saved."
                ? "Dismiss saved confirmation"
                : "Check connection and retry pending change"
            }
            accessibilityHint={
              message === "Barn saved."
                ? "Hides this confirmation"
                : "Reconnects and retries the change that did not save"
            }
            onPress={() => {
              setMessage(null);
              if (message !== "Barn saved.") void habitat.refresh();
            }}
            style={styles.strip}
          >
            <Body tone="secondary">
              {message ?? `Barn error: ${habitat.error?.replaceAll("_", " ")}`}
            </Body>
          </Sticker>
        ) : null}
        <HabitatGiftReveal
          accountId={completionAccountId}
          catalog={habitat.data.catalog}
          enabled={isFocused && journal.supported && !habitat.starterWelcomePending}
          backend={journalBackend}
          onPreview={(item) => {
            const target = compatiblePosition(item.category);
            if (!target) return;
            habitat.place(target, item);
            setInitialPosition(target);
            setEditing(true);
          }}
        />
        <HabitatPresetSheet
          accountId={backend && !presetBackend ? null : accountId}
          visible={presetVisible}
          onClose={() => setPresetVisible(false)}
          positions={habitat.draft?.positions ?? Object.fromEntries(Object.keys(HABITAT_POSITION_META).map((key) => [key, null])) as Record<HabitatPosition, string | null>}
          roomRevision={habitat.data.snapshot.revision}
          dirty={habitat.dirty}
          onActivated={() => {
            void habitat.refresh();
            setPresetVisible(false);
            setEditing(false);
          }}
          backend={presetBackend}
        />
        {inspected ? (
          <Sticker
            color="paper"
            rotate={0}
            radius={RADII.lg}
            pad
            testID="habitat-item-details"
            style={[styles.tooltip, { bottom: insets.bottom }]}
          >
            <ScrollView style={styles.tooltipScroll}>
              <Body tone="secondary">{inspected}</Body>
            </ScrollView>
            <Button
              variant="link"
              size="sm"
              accessibilityLabel="Close item details"
              accessibilityHint="Dismisses these furnishing details"
              onPress={() => setInspected(null)}
              style={styles.tooltipClose}
            >
              Close
            </Button>
          </Sticker>
        ) : null}
        {habitat.conflict ? (
          <Sticker
            color="paper"
            rotate={0}
            radius={RADII.xl}
            pad
            accessibilityRole="summary"
            accessibilityLabel="This Barn changed somewhere else."
            style={styles.conflict}
          >
            <ScrollView contentContainerStyle={styles.conflictBody}>
              <CardTitle>This Barn changed somewhere else.</CardTitle>
              <Body tone="secondary">
                {habitat.conflict.reviewing
                  ? "The latest saved room is shown. Keep it, or reapply your draft and save again."
                  : "Review the latest room, or reapply your draft and save it again."}
              </Body>
              {habitat.conflict.reviewing ? (
                <Button
                  variant="ghost"
                  accessibilityLabel="Keep latest"
                  accessibilityHint="Discards your draft and keeps the room saved elsewhere"
                  onPress={habitat.cancel}
                >
                  Keep latest
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  accessibilityLabel="Review latest"
                  accessibilityHint="Shows the room saved elsewhere before you choose"
                  onPress={habitat.reviewLatest}
                >
                  Review latest
                </Button>
              )}
              <Button
                variant="gold"
                accessibilityLabel="Reapply my draft"
                accessibilityHint="Puts your arrangement back on top of the latest room so you can save it again"
                onPress={() => {
                  habitat.reapply();
                  setEditing(true);
                }}
              >
                Reapply my draft
              </Button>
            </ScrollView>
          </Sticker>
        ) : null}
      </View>
    </HabitatDoorTransition>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: WHIMSY.cream },
  topControls: {
    position: "absolute",
    left: 0,
    right: 0,
    zIndex: 90,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: SPACE.sm,
    paddingTop: SPACE.xs,
    paddingHorizontal: SPACE.sm,
  },
  decorateDock: {
    position: "absolute",
    right: SPACE.md,
    zIndex: 90,
    paddingBottom: SPACE.sm,
  },
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: WHIMSY.cream,
  },
  error: {
    flex: 1,
    justifyContent: "center",
    backgroundColor: WHIMSY.cream,
  },
  errorActions: { gap: SPACE.sm, alignItems: "center" },
  strip: { marginHorizontal: SPACE.sm, marginBottom: SPACE.sm },
  tooltip: {
    position: "absolute",
    left: SPACE.xl,
    right: SPACE.xl,
    maxHeight: "35%",
    marginBottom: TOOLTIP_CLEARANCE,
  },
  tooltipScroll: { flexShrink: 1 },
  tooltipClose: { alignSelf: "flex-end" },
  conflict: {
    position: "absolute",
    left: SPACE.md,
    right: SPACE.md,
    top: "20%",
    maxHeight: "65%",
  },
  conflictBody: { gap: SPACE.sm },
});
