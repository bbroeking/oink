// The Barn's one-step Truffle Patch entry point.
//
// Crewed players dig directly from Home: the button opens the same TrufflePatch
// modal as Season without navigating through the Season page first. Crewless
// players keep the quiet taste/join nudge. `useSounderPath` is still the only
// crew read here (one snapshot on focus, no realtime subscription).
import { useState } from "react";
import { View, Text, Image, Pressable, StyleSheet } from "react-native";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { useFeatureFlag } from "@/hooks/useFeatureFlags";
import { useSounderPath } from "@/hooks/useSounderPath";
import { useFeedingCta } from "@/components/mudwar/useFeedingCta";
import {
  WHIMSY,
  FONTS,
  SPACE,
  PAGE_PAD,
  SHADOW_SM,
  RADII,
  TYPE,
} from "@/constants/theme";
import { Icon } from "./ui/Icon";

const HUNGERER = require("../assets/images/hunger/great_hungerer_chip.png");

export function BarnSounderChip() {
  // Same effective gate the Season tab + Sounder segment + launch nudge use:
  // the world_boss flag (or DEV), NOT the standalone coop_dig flag which never
  // flipped. Loading/failure reads false, so the chip never flashes pre-confirm.
  const coopDig = useFeatureFlag("world_boss") || __DEV__;

  // The path hook does the one-shot crew read and distinguishes the crewless
  // onboarding doors from the normal, crewed digging loop.
  const sounderPath = useSounderPath(coopDig);
  const { step } = sounderPath;
  const cta = useFeedingCta(sounderPath.refresh);
  // Session-only dismiss (the "×"). No AsyncStorage on purpose — this is the
  // quiet crewless fallback, so re-showing next launch is correct. The crewed
  // dig action is never dismissible: it is a core Home action, not a nudge.
  const [dismissed, setDismissed] = useState(false);

  if (!coopDig || step == null || step === "hook") return null;

  const crewed = step === "first_dig" || step === "done";
  if (crewed) {
    const open = cta.phaseOpen && !cta.dugThisWindow;
    const title = cta.dugThisWindow
      ? "Dug this feeding"
      : cta.phaseOpen
        ? "Dig for Golden Truffles"
        : `Dig opens in ${cta.countdown}`;
    const detail = cta.dugThisWindow
      ? "20 Pass XP banked · back next feeding"
      : cta.phaseOpen
        ? `+20 Pass XP · closes in ${cta.countdown}`
        : "Golden Truffles · +20 Pass XP · Sounder spoils";

    return (
      <>
        <View style={styles.slot}>
          <Pressable
            onPress={cta.start}
            disabled={!open}
            accessibilityRole="button"
            accessibilityLabel={title}
            accessibilityHint={
              open
                ? "Opens the Truffle Patch. Finds earn Golden Truffles, weaken the Hungerer, and count toward Sounder rewards."
                : detail
            }
            accessibilityState={{ disabled: !open }}
            style={({ pressed }) => [
              styles.digChip,
              open ? styles.digChipOpen : styles.digChipResting,
              pressed && open && styles.digChipPressed,
            ]}
          >
            <Image
              source={HUNGERER}
              style={styles.digArt}
              resizeMode="contain"
            />
            <View style={styles.chipText}>
              <Text style={styles.digTitle}>{title}</Text>
              <Text style={styles.digDetail}>{detail}</Text>
            </View>
            {open && <Icon name="arrowRight" size={18} color={WHIMSY.ink} />}
          </Pressable>
          {!!cta.note && <Text style={styles.note}>{cta.note}</Text>}
        </View>
        {cta.modal}
      </>
    );
  }

  // Crewless taste/join prompts remain dismissible. Once a player joins, this
  // same slot turns into the direct Dig action above.
  if (dismissed || (step !== "taste" && step !== "join")) return null;

  // taste routes to the season tab (where the practice dig lives); join keeps the
  // Sounder-segment destination the chip has always used.
  const taste = step === "taste";
  const line = taste
    ? "try a dig — no herd needed ›"
    : "the dig needs a herd — join a Sounder ›";
  const dest = taste ? "/(tabs)/season" : "/(tabs)/friends?seg=sounder";

  return (
    <View style={styles.slot}>
      <Pressable
        onPress={() => {
          Haptics.selectionAsync().catch(() => {});
          router.push(dest);
        }}
        style={({ pressed }) => [styles.chip, pressed && { opacity: 0.92 }]}
        accessibilityRole="button"
        accessibilityLabel={taste ? "Try a dig" : "Join a Sounder"}
      >
        <Image source={HUNGERER} style={styles.chipArt} resizeMode="contain" />
        <View style={styles.chipText}>
          <Text style={styles.kicker}>THE GREAT HUNGER</Text>
          <Text style={styles.line}>{line}</Text>
        </View>
      </Pressable>
      <Pressable
        onPress={() => setDismissed(true)}
        hitSlop={10}
        style={({ pressed }) => [styles.close, pressed && { opacity: 0.7 }]}
        accessibilityRole="button"
        accessibilityLabel="Dismiss"
      >
        <Icon name="x" size={13} color={WHIMSY.barkMute} strokeWidth={2.5} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  // In-flow band, matching the stat cluster's horizontal gutters. No absolute
  // positioning — it rides the flex column above the pig, so it can never cover
  // Rosie or eat her taps (no pointerEvents footgun).
  slot: {
    paddingHorizontal: PAGE_PAD,
    zIndex: 2,
  },
  digChip: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.sm,
    borderWidth: 2,
    borderColor: WHIMSY.ink,
    borderRadius: RADII.lg,
    paddingVertical: SPACE.xs,
    paddingHorizontal: SPACE.sm,
    transform: [{ rotate: "-0.8deg" }],
    ...SHADOW_SM,
  },
  digChipOpen: {
    backgroundColor: WHIMSY.sun,
  },
  digChipResting: {
    backgroundColor: WHIMSY.cream,
  },
  digChipPressed: {
    transform: [{ translateX: 2 }, { translateY: 2 }, { rotate: "-0.8deg" }],
    shadowOpacity: 0,
    elevation: 0,
  },
  digArt: {
    width: 34,
    height: 34,
  },
  digTitle: {
    ...TYPE.cardTitleSm,
    color: WHIMSY.ink,
  },
  digDetail: {
    ...TYPE.bodySm,
    color: WHIMSY.mute,
  },
  note: {
    ...TYPE.hand,
    color: WHIMSY.accent,
    marginTop: SPACE.sm,
    textAlign: "center",
  },
  // One sanctioned dark surface — the Great Hunger storyteller voice on bark,
  // same trio the Sounder war panels use. Hand-drawn tilt + hard sticker shadow.
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.sm,
    backgroundColor: WHIMSY.bark,
    borderWidth: 2,
    borderColor: WHIMSY.ink,
    borderRadius: RADII.lg,
    paddingVertical: SPACE.sm,
    paddingLeft: SPACE.sm,
    // Reserve one full iOS touch target for the overlaid close control.
    paddingRight: 52,
    transform: [{ rotate: "-0.8deg" }],
    ...SHADOW_SM,
  },
  chipArt: { width: 34, height: 34 },
  chipText: { flex: 1, minWidth: 0 },
  kicker: {
    ...TYPE.kicker,
    // Tracked-caps storyteller kicker on bark — sun on dark, tighter size +
    // wider tracking than the base role, so those two stay overridden.
    fontSize: 11,
    letterSpacing: 1.4,
    color: WHIMSY.sun,
    marginBottom: 1,
  },
  line: {
    fontFamily: FONTS.bodyExtra,
    fontSize: 13,
    color: WHIMSY.barkText,
    lineHeight: 17,
  },
  close: {
    position: "absolute",
    top: 0,
    right: PAGE_PAD,
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
});
