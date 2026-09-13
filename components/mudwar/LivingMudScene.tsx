import React from "react";
import { Image, ImageBackground, StyleSheet, View } from "react-native";
import { IconButton, SpritePig, T } from "@/components/ui";
import { BORDER, RADII, SHADOW_SM, SPACE, WHIMSY } from "@/constants/theme";
import { HAT_IMAGES } from "@/constants/hats";

const ART = {
  scene: require("../../assets/images/patch/living-mud/forest-clearing.png"),
  pouch: require("../../assets/images/patch/living-mud/pouch.png"),
};
const DRAW = {
  pig: 116,
  pouch: 112,
  truffle: 32,
  inventoryHeight: 112,
  compactPig: 84,
  compactPouch: 80,
  pouchGroup: 144,
  compactPouchGroup: 112,
};

/** The scene is decorative. Controls, counts and gameplay remain native. */
export function LivingMudScene({
  title,
  busy = false,
  onBack,
  onHelp,
  children,
}: {
  title: string;
  busy?: boolean;
  onBack?: () => void;
  onHelp?: () => void;
  children: React.ReactNode;
}) {
  return (
    <ImageBackground source={ART.scene} resizeMode="cover" style={styles.scene}>
      <View style={styles.header}>
        {onBack && (
          <View style={styles.control}>
            <IconButton
              name="chevronLeft"
              label="Leave the patch"
              disabled={busy}
              onPress={onBack}
            />
          </View>
        )}
        <View style={styles.sign}>
          <T role="pageTitle" align="center" accessibilityRole="header">
            {title}
          </T>
        </View>
        {onHelp && (
          <View style={styles.control}>
            <IconButton
              name="scroll"
              label="How to dig"
              disabled={busy}
              onPress={onHelp}
            />
          </View>
        )}
      </View>
      {children}
    </ImageBackground>
  );
}

/** During play this is a found count; only the confirmed receipt says banked. */
export function LivingMudPouch({
  count,
  truffleCount = 0,
  compact = false,
  confirmed = false,
  reduceMotion = false,
}: {
  count: number;
  truffleCount?: number;
  compact?: boolean;
  confirmed?: boolean;
  reduceMotion?: boolean;
}) {
  return (
    <View style={[styles.inventory, compact && { minHeight: DRAW.compactPig }]}>
      <View
        pointerEvents="none"
        accessible={false}
        importantForAccessibility="no-hide-descendants"
      >
        <SpritePig
          animation={confirmed ? "happy" : "idle"}
          size={compact ? DRAW.compactPig : DRAW.pig}
          reduceMotion={reduceMotion}
        />
      </View>
      <View
        style={[
          styles.pouchGroup,
          compact && {
            width: DRAW.compactPouchGroup,
            height: DRAW.compactPouch,
          },
        ]}
        accessible
        accessibilityLabel={`${count} ${count === 1 ? "find" : "finds"} ${confirmed ? "packed" : "uncovered"}`}
      >
        <Image
          source={ART.pouch}
          style={[
            styles.pouch,
            compact && { width: DRAW.compactPouch, height: DRAW.compactPouch },
          ]}
          resizeMode="contain"
          accessible={false}
        />
        {truffleCount > 0 && (
          <Image
            source={HAT_IMAGES.golden_truffle}
            style={styles.truffle}
            resizeMode="contain"
            accessible={false}
          />
        )}
        <View style={styles.count}>
          <T role="numeral">{count}</T>
          <T role="hand">{count === 1 ? "find" : "finds"}</T>
        </View>
      </View>
    </View>
  );
}

export const livingMudStyles = StyleSheet.create({
  paper: {
    backgroundColor: WHIMSY.paper,
    borderColor: WHIMSY.ink,
    borderWidth: BORDER.thin,
    borderRadius: RADII.md,
    padding: SPACE.md,
  },
  inset: { marginHorizontal: SPACE.md },
  footer: { padding: SPACE.md, gap: SPACE.sm },
});

const styles = StyleSheet.create({
  scene: {
    overflow: "hidden",
    borderRadius: RADII.xl,
    backgroundColor: WHIMSY.dirt,
    paddingTop: SPACE.md,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.sm,
    paddingHorizontal: SPACE.sm,
    marginBottom: SPACE.md,
  },
  sign: {
    flex: 1,
    backgroundColor: WHIMSY.paper,
    paddingVertical: SPACE.sm,
    paddingHorizontal: SPACE.xs,
    borderWidth: BORDER.ink,
    borderColor: WHIMSY.ink,
    borderRadius: RADII.lg,
    ...SHADOW_SM,
  },
  control: {
    backgroundColor: WHIMSY.paper,
    borderRadius: RADII.md,
    borderWidth: BORDER.thin,
    borderColor: WHIMSY.ink,
  },
  inventory: {
    minHeight: DRAW.inventoryHeight,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACE.lg,
  },
  pouchGroup: { width: DRAW.pouchGroup, height: DRAW.pouch },
  pouch: { width: DRAW.pouch, height: DRAW.pouch },
  truffle: {
    width: DRAW.truffle,
    height: DRAW.truffle,
    position: "absolute",
    left: SPACE.xxl,
    top: SPACE.md,
  },
  count: {
    position: "absolute",
    right: 0,
    bottom: SPACE.sm,
    alignItems: "center",
    paddingHorizontal: SPACE.sm,
    paddingVertical: SPACE.xxs,
    backgroundColor: WHIMSY.paper,
    borderWidth: BORDER.thin,
    borderColor: WHIMSY.ink,
    borderRadius: RADII.sm,
  },
});
