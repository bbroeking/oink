import React from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import * as Haptics from "expo-haptics";
import Svg, { ClipPath, Defs, Path, Rect } from "react-native-svg";
import { FONTS, RADII, SPACE, TYPE, WHIMSY } from "@/constants/theme";
import { Icon } from "./Icon";

export type TicketButtonTone = "companion" | "golden" | "season";

interface Props extends Pick<
  PressableProps,
  "accessibilityHint" | "accessibilityLabel" | "testID"
> {
  label: string;
  stub: string;
  stubCaption?: string;
  tone?: TicketButtonTone;
  showChevron?: boolean;
  loading?: boolean;
  loadingLabel?: string;
  disabled?: boolean;
  full?: boolean;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
}

const TONES: Record<TicketButtonTone, { face: string; stub: string }> = {
  companion: { face: WHIMSY.sun, stub: WHIMSY.sun },
  golden: { face: WHIMSY.sun, stub: WHIMSY.rose },
  season: { face: WHIMSY.rose, stub: WHIMSY.lilac },
};

// The ticket is drawn as one continuous path so the ink outline and hard
// shadow follow the inward notch. Decorative cutout Views leave hairline seams
// on different pixel densities; this path keeps the silhouette intact.
const TICKET_PATH =
  "M 18 2 H 502 Q 516 2 516 16 V 52 Q 516 66 502 66 H 18 Q 4 66 4 52 V 47 C 22 43 22 25 4 21 V 16 Q 4 2 18 2 Z";

function TicketChrome({
  face,
  stub,
  pressed,
}: {
  face: string;
  stub: string;
  pressed: boolean;
}) {
  const mainOffset = pressed ? 3 : 0;
  const shadowOffset = pressed ? 3 : 5;
  return (
    <Svg
      pointerEvents="none"
      width="100%"
      height="100%"
      viewBox="0 0 520 74"
      preserveAspectRatio="none"
      style={StyleSheet.absoluteFill}
    >
      <Defs>
        <ClipPath id="ticket-face">
          <Path
            d={TICKET_PATH}
            transform={`translate(${mainOffset} ${mainOffset})`}
          />
        </ClipPath>
      </Defs>
      <Path
        d={TICKET_PATH}
        fill={WHIMSY.ink}
        transform={`translate(${shadowOffset} ${shadowOffset})`}
      />
      <Path
        d={TICKET_PATH}
        fill={face}
        transform={`translate(${mainOffset} ${mainOffset})`}
      />
      <Rect
        x={mainOffset}
        y={mainOffset}
        width={112}
        height={68}
        fill={stub}
        clipPath="url(#ticket-face)"
      />
      <Path
        d={TICKET_PATH}
        fill="none"
        stroke={WHIMSY.ink}
        strokeWidth={3}
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
        transform={`translate(${mainOffset} ${mainOffset})`}
      />
    </Svg>
  );
}

function Perforation() {
  return (
    <View pointerEvents="none" style={styles.perforation}>
      {Array.from({ length: 6 }, (_, index) => (
        <View key={index} style={styles.perforationDash} />
      ))}
    </View>
  );
}

export function TicketButton({
  label,
  stub,
  stubCaption,
  tone = "companion",
  showChevron = false,
  loading = false,
  loadingLabel = "Checking…",
  disabled = false,
  full = true,
  style,
  onPress,
  accessibilityHint,
  accessibilityLabel,
  testID,
}: Props) {
  const inactive = disabled || loading;
  const colors = inactive
    ? { face: WHIMSY.cream, stub: WHIMSY.cream2, text: WHIMSY.mute }
    : { ...TONES[tone], text: WHIMSY.ink };
  const visibleLabel = loading ? loadingLabel : label;

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => {
        if (!inactive) Haptics.selectionAsync().catch(() => {});
      }}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive, busy: loading }}
      testID={testID}
      style={[full && styles.full, style]}
    >
      {({ pressed }) => {
        const offset = pressed && !inactive ? 3 : 0;
        return (
          <View style={styles.chrome}>
            <TicketChrome
              face={colors.face}
              stub={colors.stub}
              pressed={pressed && !inactive}
            />
            <View
              pointerEvents="none"
              style={[
                styles.content,
                { transform: [{ translateX: offset }, { translateY: offset }] },
              ]}
            >
              <View style={styles.stub}>
                <Text
                  style={[
                    stubCaption ? styles.stubMark : styles.stubSolo,
                    { color: colors.text },
                  ]}
                >
                  {stub}
                </Text>
                {stubCaption ? (
                  <Text style={[styles.stubCaption, { color: colors.text }]}>
                    {stubCaption}
                  </Text>
                ) : null}
              </View>
              <Perforation />
              <View style={styles.action}>
                <Text style={[styles.actionLabel, { color: colors.text }]}>
                  {visibleLabel}
                </Text>
                {loading ? (
                  <ActivityIndicator size="small" color={colors.text} />
                ) : showChevron ? (
                  <View style={styles.iconWell}>
                    <Icon
                      name={inactive ? "lock" : "arrowRight"}
                      size={20}
                      color={colors.text}
                      strokeWidth={2.5}
                    />
                  </View>
                ) : null}
              </View>
            </View>
          </View>
        );
      }}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  full: {
    alignSelf: "stretch",
  },
  chrome: {
    width: "100%",
    minWidth: 240,
    height: 74,
  },
  content: {
    position: "absolute",
    top: 2,
    left: 4,
    right: 4,
    height: 64,
    flexDirection: "row",
    alignItems: "stretch",
    overflow: "hidden",
    borderRadius: RADII.md,
  },
  stub: {
    width: 96,
    paddingLeft: SPACE.sm,
    paddingRight: SPACE.xs,
    alignItems: "center",
    justifyContent: "center",
  },
  stubMark: {
    ...TYPE.cardTitle,
    fontSize: 17,
    lineHeight: 18,
    textAlign: "center",
  },
  stubSolo: {
    ...TYPE.label,
    fontSize: 11,
    lineHeight: 14,
    textAlign: "center",
    textTransform: "uppercase",
  },
  stubCaption: {
    ...TYPE.label,
    fontSize: 11,
    lineHeight: 13,
    letterSpacing: 0.8,
    textAlign: "center",
    textTransform: "uppercase",
  },
  perforation: {
    width: 2,
    paddingVertical: 5,
    justifyContent: "space-between",
  },
  perforationDash: {
    width: 2,
    height: 5,
    borderRadius: RADII.pill,
    backgroundColor: WHIMSY.ink,
  },
  action: {
    flex: 1,
    minWidth: 0,
    paddingLeft: SPACE.md,
    paddingRight: SPACE.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACE.sm,
  },
  actionLabel: {
    flexShrink: 1,
    fontFamily: FONTS.whimsy,
    fontSize: 18,
    lineHeight: 22,
    textAlign: "center",
  },
  iconWell: {
    width: 34,
    height: 34,
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: RADII.pill,
    borderWidth: 2,
    borderColor: WHIMSY.ink,
    backgroundColor: WHIMSY.paper,
  },
});
