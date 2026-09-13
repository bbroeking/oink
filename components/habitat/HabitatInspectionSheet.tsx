// Read-only furnishing details, opened by tapping an item in a friend's Barn.
// A component named `*Sheet` mounts the `Sheet` panel (spec §3.4);
// `presentation="inline"` because this opens from inside `BarnVisitModal`'s
// native Modal. [A-03] (2026-09-11)
import React, { useEffect } from "react";
import { BackHandler, Image, StyleSheet, View } from "react-native";

import { habitatItemAsset } from "@/constants/habitat";
import {
  BORDER,
  RADII,
  RARITY_BG_SOLID,
  SPACE,
  UI_COLORS,
} from "@/constants/theme";
import type { HabitatCatalogItem, HabitatPlacedItem } from "@/utils/habitat";
import {
  BodySm,
  Button,
  HandLg,
  Label,
  Sheet,
} from "@/components/ui";

export function habitatAcquisitionPaths(item: HabitatCatalogItem): string[] {
  const paths: string[] = [];
  if (item.active && item.isForSale) paths.push(`Barn Collection · ${item.snoutCost.toLocaleString()} Snouts`);
  if (item.prestigeRank !== undefined) paths.push(`Free gift at Wallow Rank ${item.prestigeRank}`);
  if (item.rewardThreshold && item.collectionId)
    paths.push(`Collection gift after ${item.rewardThreshold} purchased designs`);
  if (!paths.length && item.snoutCost === 0) paths.push("Earned in your Barn journey");
  return paths;
}

export function HabitatInspectionSheet({
  item,
  catalogItem,
  wishlisted = false,
  wishlistBusy = false,
  onClose,
  onToggleWishlist,
  onFindInCollection,
}: {
  item: HabitatPlacedItem | null;
  catalogItem?: HabitatCatalogItem | null;
  wishlisted?: boolean;
  wishlistBusy?: boolean;
  onClose: () => void;
  onToggleWishlist?: () => void;
  onFindInCollection?: () => void;
}) {
  useEffect(() => {
    if (!item) return;
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        onClose();
        return true;
      },
    );
    return () => subscription.remove();
  }, [item, onClose]);
  const paths = catalogItem ? habitatAcquisitionPaths(catalogItem) : [];
  return (
    <Sheet
      open={!!item}
      presentation="inline"
      onClose={onClose}
      title={item?.name}
      subtitle={item?.description}
      closeLabel={item ? `Close ${item.name} details` : "Close furnishing details"}
      testID="habitat-inspection-sheet"
      footer={
        <View style={styles.actions}>
          {onToggleWishlist ? (
            <Button size="md" variant="ghost" full disabled={wishlistBusy} onPress={wishlistBusy ? undefined : onToggleWishlist} testID="inspection-wishlist-button">
              {wishlistBusy ? "Saving…" : wishlisted ? "Remove from wishlist" : "Save to wishlist"}
            </Button>
          ) : null}
          {onFindInCollection ? (
            <Button size="md" variant="primary" full onPress={onFindInCollection} testID="inspection-find-button">
              Find in my collection
            </Button>
          ) : null}
        </View>
      }
    >
      {item ? (
        <>
          <View style={[styles.art, { backgroundColor: RARITY_BG_SOLID[item.rarity] }]}>
            <Image source={habitatItemAsset(item.assetKey)} style={styles.image} resizeMode="contain" accessible={false} />
          </View>
          {paths.length ? (
            <View style={styles.paths} accessibilityRole="summary">
              <Label>How you can get it</Label>
              {paths.map((path) => (
                <BodySm key={path} tone="secondary">• {path}</BodySm>
              ))}
            </View>
          ) : (
            <HandLg tone="secondary" style={styles.path}>Open your collection for current availability.</HandLg>
          )}
        </>
      ) : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  art: {
    width: "100%",
    aspectRatio: 1.35,
    borderRadius: RADII.xl,
    borderWidth: BORDER.ink,
    borderColor: UI_COLORS.border,
    alignItems: "center",
    justifyContent: "center",
  },
  // The item art fills the rarity well edge to edge minus a breathing margin —
  // a fraction of the well, not a spacing step.
  image: { width: "84%", height: "84%" },
  paths: { marginTop: SPACE.md, gap: SPACE.xs },
  path: { marginTop: SPACE.md },
  actions: { gap: SPACE.sm },
});
