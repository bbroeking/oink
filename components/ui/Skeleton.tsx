import React, { useEffect, useRef } from "react";
import {
  View,
  Animated,
  StyleSheet,
  ViewStyle,
  StyleProp,
  DimensionValue,
} from "react-native";
import { BORDER, RADII, SHADOW_SM, SPACE, WHIMSY } from "@/constants/theme";
import { startDecorativeLoop, useMotionPolicy } from "@/hooks/useMotionPolicy";

interface Props {
  width?: DimensionValue;
  height?: DimensionValue;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}

// Shimmery placeholder block. Pulses between two paper tones.
export function Skeleton({
  width = "100%",
  height = 20,
  radius = RADII.sm,
  style,
}: Props) {
  const v = useRef(new Animated.Value(0)).current;
  const motionPolicy = useMotionPolicy();
  useEffect(() => {
    return startDecorativeLoop({
      policy: motionPolicy,
      animation: Animated.loop(
        Animated.sequence([
          Animated.timing(v, {
            toValue: 1,
            duration: 800,
            useNativeDriver: false,
          }),
          Animated.timing(v, {
            toValue: 0,
            duration: 800,
            useNativeDriver: false,
          }),
        ]),
      ),
      rest: () => v.setValue(0),
    });
  }, [motionPolicy, v]);
  const bg = v.interpolate({
    inputRange: [0, 1],
    outputRange: [WHIMSY.cream, WHIMSY.paper],
  });
  return (
    <Animated.View
      style={[
        { width, height, borderRadius: radius, backgroundColor: bg },
        style,
      ]}
    />
  );
}

export function ListRowSkeleton() {
  return (
    <View style={styles.listRow}>
      <Skeleton width={40} height={40} radius={RADII.pill} />
      <View style={styles.copy}>
        <Skeleton height={14} width="60%" />
        <Skeleton height={10} width="35%" />
      </View>
      <Skeleton width={50} height={18} />
    </View>
  );
}

const styles = StyleSheet.create({
  listRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.md,
    paddingVertical: SPACE.sm,
    paddingHorizontal: SPACE.md,
    backgroundColor: WHIMSY.paper,
    borderRadius: RADII.md,
    borderWidth: BORDER.ink,
    borderColor: WHIMSY.ink,
    ...SHADOW_SM,
    marginVertical: SPACE.xs,
  },
  copy: { flex: 1, gap: SPACE.sm },
});
