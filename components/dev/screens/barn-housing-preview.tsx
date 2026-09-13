import { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Alert, StyleSheet, Text, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { BarnCollection } from "@/app/barn-collection";
import { BarnInterior } from "@/app/barn-interior";
import { PigStage } from "@/components/ui/PigStage";
import { HabitatScene } from "@/components/habitat/HabitatScene";
import { MotionPolicyProvider } from "@/hooks/useMotionPolicy";
import { HABITAT_CATALOG_BY_ID } from "@/constants/habitat";
import { TYPE, SPACE, WHIMSY } from "@/constants/theme";
import { HabitatCabinetControl } from "@/components/habitat/HabitatWorkshopCabinet";
import { HabitatExpansionDiscovery } from "@/components/habitat/HabitatExpansionDiscovery";
import { PopupQueueProvider } from "@/components/ui/PopupQueue";
import {
  habitatAcceptanceBackend,
  habitatAcceptanceControls,
  habitatAcceptanceDiscoveryBackend,
  habitatAcceptanceProgressBackend,
  HABITAT_ACCEPTANCE_ACCOUNT,
} from "./habitatAcceptanceBackend";
import { habitatAcceptanceJournalBackend, habitatAcceptancePresetBackend, resetHabitatCompletionAcceptance } from "./habitatCompletionAcceptanceBackend";
import type { HabitatSnapshot } from "@/utils/habitat";

export default function HabitatAcceptanceScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    mode?: string;
    motion?: string;
    reset?: string;
    theme?: string;
    outfit?: string;
    missing?: string;
    cabinet?: string;
    welcome?: string;
    announcement?: string;
  }>();
  const [key, setKey] = useState(0);
  const [snapshot, setSnapshot] = useState<HabitatSnapshot | null>(null);
  const [ready, setReady] = useState(false);
  const refresh = async () => {
    const result = await habitatAcceptanceBackend.fetch();
    if (result.ok) setSnapshot(result.snapshot);
    setKey((value) => value + 1);
  };
  useEffect(() => {
    void (async () => {
      if (params.reset) {
        await habitatAcceptanceControls.reset(params.reset === "full");
        await resetHabitatCompletionAcceptance();
      }
      if (params.welcome) {
        await AsyncStorage.removeItem(
          `habitat:v1:${HABITAT_ACCEPTANCE_ACCOUNT}:starter-welcome-seen`,
        );
        await AsyncStorage.setItem(
          `habitat:v1:${HABITAT_ACCEPTANCE_ACCOUNT}:starter-welcome-pending`,
          "1",
        );
      }
      await refresh();
      setReady(true);
    })();
  }, [params.reset]);
  const theme = params.theme ? HABITAT_CATALOG_BY_ID[params.theme] : null;
  const viewSnapshot = snapshot
    ? {
        ...snapshot,
        positions: {
          ...snapshot.positions,
          ...(theme?.category === "interior_background"
            ? { interior_background: theme }
            : {}),
          ...(params.missing && snapshot.positions.wall
            ? {
                wall: {
                  ...snapshot.positions.wall,
                  assetKey: "intentionally-missing-local-fixture",
                },
              }
            : {}),
        },
      }
    : null;
  const ownerPig = (
    <PigStage
      pigId="rosie"
      pigMood="happy"
      pigFrozen
      {...(params.outfit
        ? {
            equipped: { id: "wizard", category: "hat", emoji: null },
            equippedHeld: { id: "balloon", category: "held", emoji: null },
            equippedAura: { id: "gold_aura", category: "aura", emoji: null },
          }
        : {})}
    />
  );
  const menu = () =>
    Alert.alert(
      "Local acceptance controls",
      "These actions affect only the fixture account stored on this simulator.",
      [
        {
          text: "Reset starter",
          onPress: () => void habitatAcceptanceControls.reset().then(resetHabitatCompletionAcceptance).then(refresh),
        },
        {
          text: "All designs",
          onPress: () =>
            void habitatAcceptanceControls.reset(true).then(resetHabitatCompletionAcceptance).then(refresh),
        },
        {
          text: "Go offline",
          onPress: () => habitatAcceptanceControls.setOffline(true),
        },
        {
          text: "Reconnect",
          onPress: () => {
            habitatAcceptanceControls.setOffline(false);
            void refresh();
          },
        },
        {
          text: "Lose next response",
          onPress: habitatAcceptanceControls.loseResponse,
        },
        {
          text: "Other device saves",
          onPress: () => void habitatAcceptanceControls.conflict(),
        },
        {
          text: "Reset announcement",
          onPress: () =>
            void habitatAcceptanceControls.resetAnnouncement().then(() => {
              setKey((value) => value + 1);
              router.setParams({ announcement: "true" });
            }),
        },
        { text: "Relaunch screen", onPress: () => void refresh() },
        { text: "Close", style: "cancel" },
      ],
    );
  return (
    <PopupQueueProvider>
      <MotionPolicyProvider reduceMotion={params.motion === "reduced"}>
        <View style={styles.root}>
          <Stack.Screen options={{ headerShown: false }} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Local acceptance controls"
            onPress={menu}
            style={[
              styles.fixture,
              { bottom: Math.max(insets.bottom, SPACE.sm) + SPACE.xs },
            ]}
          >
            <Text style={styles.label} maxFontSizeMultiplier={1}>
              Fixture
            </Text>
          </Pressable>
          {ready &&
            (params.mode === "collection" ? (
              <BarnCollection
                key={key}
                accountId={HABITAT_ACCEPTANCE_ACCOUNT}
                backend={habitatAcceptanceBackend}
                progressBackend={habitatAcceptanceProgressBackend}
                journalBackend={habitatAcceptanceJournalBackend}
                onBack={() =>
                  router.setParams({ mode: undefined, position: undefined })
                }
                onPurchased={(position, purchasedItemId) =>
                  router.setParams({
                    mode: undefined,
                    position,
                    purchasedItemId,
                  })
                }
              />
            ) : params.mode === "friend" && viewSnapshot ? (
              <HabitatScene
                snapshot={viewSnapshot}
                hostPig={ownerPig}
                visitorPig={<PigStage pigId="pickles" pigMood="content" />}
                onInspect={(item) => Alert.alert(item.name, item.description)}
              />
            ) : (
              <BarnInterior
                key={key}
                accountId={HABITAT_ACCEPTANCE_ACCOUNT}
                backend={habitatAcceptanceBackend}
                journalBackend={habitatAcceptanceJournalBackend}
                presetBackend={habitatAcceptancePresetBackend}
                workshop={
                  params.cabinet ? (
                    <HabitatCabinetControl
                      state="Local acceptance fixture"
                      onPress={() =>
                        Alert.alert(
                          "Workshop",
                          "The cabinet is reachable. Machine and inventory routes are verified separately.",
                        )
                      }
                    />
                  ) : null
                }
                onCollection={(position) =>
                  router.setParams({ mode: "collection", position })
                }
                pig={ownerPig}
              />
            ))}
          {ready && params.announcement === "true" ? (
            <HabitatExpansionDiscovery
              key={`announcement-${key}`}
              accountId={HABITAT_ACCEPTANCE_ACCOUNT}
              backend={habitatAcceptanceDiscoveryBackend}
              enabledOverride
              onEnterBarn={() =>
                router.setParams({
                  mode: undefined,
                  position: undefined,
                  announcement: undefined,
                })
              }
              onOpenShop={() =>
                router.setParams({
                  mode: "collection",
                  position: undefined,
                  announcement: undefined,
                })
              }
            />
          ) : null}
        </View>
      </MotionPolicyProvider>
    </PopupQueueProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: WHIMSY.cream },
  fixture: {
    position: "absolute",
    left: "50%",
    width: 64,
    marginLeft: -32,
    zIndex: 500,
    minHeight: 44,
    paddingHorizontal: SPACE.sm,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: "rgba(255, 216, 122, 0.92)",
  },
  label: { ...TYPE.label, fontSize: 12, lineHeight: 16, color: WHIMSY.ink },
});
