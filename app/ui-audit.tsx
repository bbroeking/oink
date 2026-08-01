import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Redirect, Stack, router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AlignmentExplainerModal } from "@/components/AlignmentExplainerModal";
import { ItemPreviewModal } from "@/components/ItemPreviewModal";
import { PigFriendsLaunchModal } from "@/components/PigFriendsLaunchModal";
import { RiveRolloutControl } from "@/components/prototypes/RiveRolloutControl";
import { RiveRuntimeProbe } from "@/components/prototypes/RiveRuntimeProbe";
import { Glyph } from "@/components/ui/Glyph";
import { PigStage } from "@/components/ui/PigStage";
import { Button, Skeleton } from "@/components/ui";
import {
  TierUpBanner,
  type TierUpBannerHandle,
} from "@/components/ui/TierUpBanner";
import type { HatRow } from "@/constants/hats";
import { FONTS, SPACE, WHIMSY } from "@/constants/theme";
import {
  MotionPolicyProvider,
  startDecorativeLoop,
  useMotionPolicy,
} from "@/hooks/useMotionPolicy";
import { PIGS, type PigId } from "@/utils/pigs";

type Preview = "alignment" | "item" | "friends-member" | "friends-guest" | null;
type MotionMode = "system" | "full" | "reduced";

const ITEM_FIXTURE: HatRow = {
  id: "wizard",
  name: "The Moonlit Thinking Cap",
  cost: 1250,
  display_order: 1,
  emoji: null,
  image_path: null,
  category: "hat",
  rarity: "legendary",
  description:
    "A magnificently wordy description for checking how the preview behaves when text grows and space gets tight.",
};

function previewFromParam(value: string | string[] | undefined): Preview {
  const candidate = Array.isArray(value) ? value[0] : value;
  switch (candidate) {
    case "alignment":
    case "item":
    case "friends-member":
    case "friends-guest":
      return candidate;
    default:
      return null;
  }
}

export default function UiAuditScreen() {
  if (!__DEV__) return <Redirect href="/" />;
  return <UiAuditLab />;
}

function UiAuditLab() {
  const { modal, motion } = useLocalSearchParams<{
    modal?: string | string[];
    motion?: string | string[];
  }>();
  const requestedMotion = Array.isArray(motion) ? motion[0] : motion;
  const [motionMode, setMotionMode] = useState<MotionMode>(
    requestedMotion === "full" || requestedMotion === "reduced"
      ? requestedMotion
      : "system",
  );

  useEffect(() => {
    setMotionMode(
      requestedMotion === "full" || requestedMotion === "reduced"
        ? requestedMotion
        : "system",
    );
  }, [requestedMotion]);

  return (
    <MotionPolicyProvider
      reduceMotion={
        motionMode === "system" ? undefined : motionMode === "reduced"
      }
    >
      <UiAuditContent
        modal={modal}
        motionMode={motionMode}
        onMotionModeChange={setMotionMode}
      />
    </MotionPolicyProvider>
  );
}

function UiAuditContent({
  modal,
  motionMode,
  onMotionModeChange,
}: {
  modal?: string | string[];
  motionMode: MotionMode;
  onMotionModeChange: (mode: MotionMode) => void;
}) {
  const insets = useSafeAreaInsets();
  const [preview, setPreview] = useState<Preview>(() =>
    previewFromParam(modal),
  );

  useEffect(() => {
    setPreview(previewFromParam(modal));
  }, [modal]);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        style={styles.screen}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + SPACE.lg,
            paddingBottom: insets.bottom + SPACE.xl,
          },
        ]}
      >
        <Button
          size="sm"
          variant="ghost"
          style={styles.exitButton}
          accessibilityHint="Leaves the development lab and returns to the Barn"
          onPress={() => router.replace("/")}
        >
          ‹ Back to Barn
        </Button>
        <Text style={styles.kicker}>DEVELOPMENT ONLY</Text>
        <Text style={styles.title}>UI audit lab</Text>
        <Text style={styles.body}>
          This is a development workbench, not part of the game. Use it to open
          fixture-backed surfaces without an account, then change text size,
          rotate the device, or resize the simulator while the surface is open.
        </Text>
        <View style={styles.checklist}>
          <Text style={styles.checklistTitle}>What to check</Text>
          <Text style={styles.checklistItem}>
            1. Nothing clips or escapes its paper.
          </Text>
          <Text style={styles.checklistItem}>
            2. Every action remains readable and tappable.
          </Text>
          <Text style={styles.checklistItem}>
            3. Reduced Motion still explains the state change.
          </Text>
        </View>

        <MotionAuditPreview
          mode={motionMode}
          onModeChange={onMotionModeChange}
        />
        <RiveRolloutControl />
        <RiveRuntimeProbe autoStart />
        <PigEquipmentPreview />

        <View style={styles.group}>
          <Text style={styles.groupTitle}>Dense modals</Text>
          <Button full onPress={() => setPreview("alignment")}>
            Alignment explainer
          </Button>
          <Button full variant="gold" onPress={() => setPreview("item")}>
            Item preview
          </Button>
          <Button
            full
            variant="purple"
            onPress={() => setPreview("friends-member")}
          >
            Pig Friends — member
          </Button>
          <Button
            full
            variant="ghost"
            onPress={() => setPreview("friends-guest")}
          >
            Pig Friends — guest
          </Button>
        </View>

        <Text style={styles.note}>
          Dev-client URL: exp+ttp://ui-audit?modal=alignment&amp;motion=reduced
        </Text>
      </ScrollView>

      {preview === "alignment" && (
        <AlignmentExplainerModal onDismiss={() => setPreview(null)} />
      )}
      <ItemPreviewModal
        item={preview === "item" ? ITEM_FIXTURE : null}
        owned={false}
        active={false}
        canAfford
        balance={2500}
        onClose={() => setPreview(null)}
        onBuy={() => setPreview(null)}
        onEquip={() => setPreview(null)}
        onUnequip={() => setPreview(null)}
      />
      <PigFriendsLaunchModal
        visible={preview === "friends-member" || preview === "friends-guest"}
        isMember={preview === "friends-member"}
        onDismiss={() => setPreview(null)}
        onAction={() => setPreview(null)}
      />
    </>
  );
}

function PigEquipmentPreview() {
  const [pigId, setPigId] = useState<PigId>("rosie");
  const pig = PIGS.find((candidate) => candidate.id === pigId) ?? PIGS[0];

  return (
    <View style={styles.motionGroup}>
      <Text style={styles.groupTitle}>Pig equipment compatibility</Text>
      <Text style={styles.motionStatus}>
        Switch through every pig. The cowboy hat must remain attached to the
        head and the authored coat must remain visible.
      </Text>
      <View style={styles.pigStage}>
        <PigStage
          pigId={pigId}
          pigAnimation="idle"
          pigFrozen
          equipped={{ id: "cowboy", category: "hat", emoji: null }}
        />
      </View>
      <View style={styles.pigButtons}>
        {PIGS.map((candidate) => (
          <Button
            key={candidate.id}
            size="sm"
            variant={candidate.id === pigId ? "dark" : "ghost"}
            style={styles.pigButton}
            onPress={() => setPigId(candidate.id)}
          >
            {candidate.name}
          </Button>
        ))}
      </View>
      <Text style={styles.motionStatus}>
        Showing {pig.name}: {pig.coat}
      </Text>
    </View>
  );
}

function MotionAuditPreview({
  mode,
  onModeChange,
}: {
  mode: MotionMode;
  onModeChange: (mode: MotionMode) => void;
}) {
  const motionPolicy = useMotionPolicy();
  const drift = useRef(new Animated.Value(0)).current;
  const tierUp = useRef<TierUpBannerHandle>(null);

  useEffect(() => {
    return startDecorativeLoop({
      policy: motionPolicy,
      animation: Animated.loop(
        Animated.sequence([
          Animated.timing(drift, {
            toValue: 1,
            duration: 900,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(drift, {
            toValue: 0,
            duration: 900,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
      ),
      rest: () => drift.setValue(0),
    });
  }, [drift, motionPolicy]);

  const translateX = drift.interpolate({
    inputRange: [0, 1],
    outputRange: [-44, 44],
  });

  return (
    <View style={styles.motionGroup}>
      <Text style={styles.groupTitle}>Motion policy</Text>
      <Text style={styles.motionStatus}>
        Resolved mode:{" "}
        {motionPolicy.reduceMotion ? "Reduce Motion" : "Full motion"}
      </Text>
      <View style={styles.modeButtons}>
        {(["system", "full", "reduced"] as MotionMode[]).map((value) => (
          <Button
            key={value}
            size="sm"
            variant={mode === value ? "dark" : "ghost"}
            style={styles.modeButton}
            onPress={() => onModeChange(value)}
          >
            {value === "system"
              ? "Follow iOS"
              : value === "full"
                ? "Full"
                : "Reduced"}
          </Button>
        ))}
      </View>
      <View style={styles.motionStage}>
        <Animated.View
          style={[styles.motionPig, { transform: [{ translateX }] }]}
        >
          <Glyph name="pigface" size={40} />
        </Animated.View>
      </View>
      <Skeleton height={18} radius={9} />
      <Button full variant="gold" onPress={() => tierUp.current?.fire(12)}>
        Preview Tier Up transition
      </Button>
      <TierUpBanner ref={tierUp} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: WHIMSY.cream,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: SPACE.lg,
    gap: SPACE.md,
  },
  exitButton: {
    alignSelf: "flex-start",
  },
  kicker: {
    fontFamily: FONTS.bodyExtra,
    fontSize: 12,
    letterSpacing: 1.2,
    color: WHIMSY.accent,
  },
  title: {
    fontFamily: FONTS.whimsy,
    fontSize: 34,
    color: WHIMSY.ink,
  },
  body: {
    fontFamily: FONTS.hand,
    fontSize: 19,
    color: WHIMSY.mute,
  },
  checklist: {
    gap: SPACE.xs,
    padding: SPACE.md,
    borderWidth: 2,
    borderColor: WHIMSY.ink,
    borderRadius: 14,
    backgroundColor: WHIMSY.sun,
  },
  checklistTitle: {
    fontFamily: FONTS.whimsy,
    fontSize: 18,
    color: WHIMSY.ink,
  },
  checklistItem: {
    fontFamily: FONTS.body,
    fontSize: 14,
    color: WHIMSY.ink,
  },
  group: {
    gap: SPACE.sm,
    marginTop: SPACE.md,
  },
  motionGroup: {
    gap: SPACE.sm,
    marginTop: SPACE.sm,
    padding: SPACE.md,
    borderWidth: 2,
    borderColor: WHIMSY.ink,
    borderRadius: 14,
    backgroundColor: WHIMSY.paper,
  },
  motionStatus: {
    fontFamily: FONTS.body,
    fontSize: 14,
    color: WHIMSY.mute,
  },
  modeButtons: {
    flexDirection: "row",
    gap: SPACE.sm,
  },
  modeButton: {
    flex: 1,
  },
  pigStage: {
    height: 300,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderRadius: 12,
    backgroundColor: WHIMSY.sky,
  },
  pigButtons: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACE.sm,
  },
  pigButton: {
    minWidth: 92,
    flexGrow: 1,
  },
  motionStage: {
    height: 72,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderRadius: 12,
    backgroundColor: WHIMSY.sky,
  },
  motionPig: {
    alignItems: "center",
    justifyContent: "center",
  },
  groupTitle: {
    fontFamily: FONTS.whimsy,
    fontSize: 21,
    color: WHIMSY.ink,
  },
  note: {
    marginTop: "auto",
    fontFamily: FONTS.body,
    fontSize: 12,
    color: WHIMSY.mute,
  },
});
