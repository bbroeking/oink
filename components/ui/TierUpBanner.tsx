import React, {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Platform,
  StyleSheet,
  View,
} from "react-native";
import { useAudioPlayer } from "expo-audio";
import * as Haptics from "expo-haptics";
import {
  BORDER,
  MOTION,
  MOTION_SPRING,
  RADII,
  SPACE,
  STICKER_SHADOW,
  WHIMSY,
} from "@/constants/theme";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MOTION_DURATION, useMotionPolicy } from "@/hooks/useMotionPolicy";
import { T } from "./Text";

const tierUpSound = require("../../assets/sounds/tier_up.mp3");

const tierUnlockAnnouncement = (tier: number) =>
  `Snout Season tier ${tier} unlocked. New reward waiting below.`;

export interface TierUpBannerHandle {
  // Fire the celebration for transition from `fromTier` → `toTier`.
  // Plays the fanfare, strong haptic, slides a banner in from the top
  // for ~2.5s, then auto-dismisses.
  fire: (toTier: number) => void;
}

// Mounted at screen root in the battle pass tab. Slides down from the
// top, shows the new tier number with sparkles, then retracts. Triggered
// from season.tsx's tier-change detection effect.
export const TierUpBanner = forwardRef<TierUpBannerHandle>(
  function TierUpBanner(_, ref) {
    const player = useAudioPlayer(tierUpSound);
    const [tier, setTier] = useState<number | null>(null);
    const slide = useRef(new Animated.Value(0)).current;
    const sparkle = useRef(new Animated.Value(0)).current;
    const reducedOpacity = useRef(new Animated.Value(0)).current;
    const motionPolicy = useMotionPolicy();
    const insets = useSafeAreaInsets();

    const fire = useCallback(
      (toTier: number) => {
        setTier(toTier);
        if (Platform.OS === "ios") {
          AccessibilityInfo.announceForAccessibilityWithOptions(
            tierUnlockAnnouncement(toTier),
            { queue: true },
          );
        }
        slide.setValue(0);
        sparkle.setValue(0);
        reducedOpacity.setValue(0);

        try {
          player.seekTo(0);
          player.play();
        } catch {}
        Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success,
        ).catch(() => {});

        const animation = motionPolicy.reduceMotion
          ? Animated.sequence([
              Animated.timing(reducedOpacity, {
                toValue: 1,
                duration: MOTION_DURATION.crossfade,
                useNativeDriver: true,
              }),
              Animated.delay(1500),
              Animated.timing(reducedOpacity, {
                toValue: 0,
                duration: MOTION_DURATION.crossfade,
                useNativeDriver: true,
              }),
            ])
          : Animated.sequence([
              // Slide in + sparkle burst in parallel
              Animated.parallel([
                Animated.spring(slide, {
                  toValue: 1,
                  ...MOTION_SPRING.overshoot,
                  useNativeDriver: true,
                }),
                Animated.timing(sparkle, {
                  toValue: 1,
                  duration: MOTION.beat,
                  easing: Easing.out(Easing.cubic),
                  useNativeDriver: true,
                }),
              ]),
              Animated.delay(1500),
              Animated.timing(slide, {
                toValue: 0,
                duration: MOTION.sheetIn,
                easing: Easing.in(Easing.cubic),
                useNativeDriver: true,
              }),
            ]);
        animation.start(() => {
          setTier(null);
        });
      },
      [player, slide, sparkle, reducedOpacity, motionPolicy.reduceMotion],
    );

    useImperativeHandle(ref, () => ({ fire }), [fire]);

    if (tier === null) return null;

    const translateY = slide.interpolate({
      inputRange: [0, 1],
      outputRange: [-200, 0],
    });
    const bannerOpacity = slide.interpolate({
      inputRange: [0, 0.3, 1],
      outputRange: [0, 1, 1],
    });

    // Six sparkle dots radiating outward + rotating.
    const sparkles = Array.from({ length: 6 }, (_, i) => {
      const angle = (i / 6) * Math.PI * 2;
      const dist = sparkle.interpolate({
        inputRange: [0, 1],
        outputRange: [0, 70],
      });
      const opacity = sparkle.interpolate({
        inputRange: [0, 0.15, 0.85, 1],
        outputRange: [0, 1, 1, 0],
      });
      const scale = sparkle.interpolate({
        inputRange: [0, 0.2, 1],
        outputRange: [0.3, 1.2, 0.4],
      });
      return (
        <Animated.Text
          key={i}
          style={[
            styles.sparkle,
            {
              opacity,
              transform: [
                {
                  translateX: Animated.multiply(
                    dist,
                    new Animated.Value(Math.cos(angle)),
                  ),
                },
                {
                  translateY: Animated.multiply(
                    dist,
                    new Animated.Value(Math.sin(angle)),
                  ),
                },
                { scale },
              ],
            },
          ]}
        >
          ✦
        </Animated.Text>
      );
    });

    return (
      <View
        pointerEvents="none"
        style={[styles.absoluteRoot, { paddingTop: insets.top + SPACE.xl }]}
      >
        <Animated.View
          accessible
          accessibilityRole={Platform.OS === "ios" ? undefined : "alert"}
          accessibilityLiveRegion={Platform.OS === "ios" ? undefined : "polite"}
          accessibilityLabel={tierUnlockAnnouncement(tier)}
          style={[
            styles.banner,
            motionPolicy.reduceMotion
              ? { opacity: reducedOpacity }
              : {
                  opacity: bannerOpacity,
                  transform: [{ translateY }],
                },
          ]}
        >
          {motionPolicy.allowDecorativeMotion && (
            <View style={styles.sparkleField}>{sparkles}</View>
          )}
          <T role="kickerPill" align="center" style={styles.kicker}>
            SNOUT SEASON
          </T>
          <T role="pageTitle" align="center" style={styles.headline}>
            Tier {tier} Unlocked!
          </T>
          <T role="kicker" tone="secondary" align="center">
            New reward waiting below ↓
          </T>
        </Animated.View>
      </View>
    );
  },
);

const styles = StyleSheet.create({
  absoluteRoot: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "flex-start",
  },
  banner: {
    backgroundColor: WHIMSY.lilac,
    borderRadius: RADII.xxl,
    borderWidth: BORDER.ink,
    borderColor: WHIMSY.ink,
    paddingHorizontal: SPACE.xxl,
    paddingVertical: SPACE.lg,
    alignItems: "center",
    // The last soft shadow in the app — a blurred #000 r16 halo that made the
    // banner float like a web toast instead of landing like a sticker. Two
    // shadow tiers only. [F-04] (2026-09-11)
    ...STICKER_SHADOW,
    minWidth: 280,
    position: "relative",
    overflow: "visible",
  },
  sparkleField: {
    position: "absolute",
    top: "50%",
    left: "50%",
    width: 0,
    height: 0,
  },
  sparkle: {
    position: "absolute",
    fontSize: 26,
    top: -13,
    left: -13,
  },
  kicker: {
    color: WHIMSY.ink,
    marginBottom: SPACE.xs,
  },
  headline: {
    color: WHIMSY.ink,
    marginBottom: SPACE.xs,
  },
});
