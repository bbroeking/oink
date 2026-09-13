import React from "react";
import { Image, StyleSheet, View } from "react-native";

import { habitatItemAsset } from "@/constants/habitat";
import {
  BORDER,
  RADII,
  RARITY_BG_SOLID,
  SPACE,
  TILT,
  UI_COLORS,
} from "@/constants/theme";
import type { HabitatCatalogItem } from "@/utils/habitat";
import {
  AdaptiveModalScaffold,
  Body,
  BodySm,
  Button,
  Hand,
  HandLg,
  Label,
  PageTitle,
  SectionTitle,
  SnoutCoin,
  Sticker,
  Tag,
  useUnmanagedModalHold,
  type ChipTone,
} from "@/components/ui";

type Props = {
  item: HabitatCatalogItem | null;
  owned: boolean;
  balance: number;
  busy: boolean;
  error?: string | null;
  onClose: () => void;
  onBuy: () => void;
  roomPreview?: React.ReactNode;
  showRoomPreview?: boolean;
  onToggleRoomPreview?: () => void;
  canPurchase?: boolean;
  acquisitionPaths?: readonly string[];
  wishlisted?: boolean;
  wishlistBusy?: boolean;
  onPlace?: () => void;
  onToggleWishlist?: () => void;
};

// The rarity capsule's fill, said in the Chip/Tag tone vocabulary rather than
// as three raw WHIMSY picks. `lilac` replaces the old `lilacDeep`: spec §5
// decision 2 forbids body-weight ink on lilacDeep, and Tag writes ink on every
// tone but bark. [D-02] (2026-09-11)
const RARITY_TONE: Record<HabitatCatalogItem["rarity"], ChipTone> = {
  common: "sage",
  uncommon: "paper",
  rare: "lilac",
};

// The Snout coin beside the price, sized to the sectionTitle numeral it sits
// with — art at a type size, not a spacing step.
const PRICE_COIN_SIZE = 18;

export function HabitatItemPreviewModal({
  item,
  owned,
  balance,
  busy,
  error,
  onClose,
  onBuy,
  roomPreview,
  showRoomPreview = false,
  onToggleRoomPreview,
  canPurchase = true,
  acquisitionPaths,
  wishlisted = false,
  wishlistBusy = false,
  onPlace,
  onToggleWishlist,
}: Props) {
  useUnmanagedModalHold(!!item);

  const canShowRoom = roomPreview != null && onToggleRoomPreview != null;
  const cost = item?.snoutCost ?? 0;
  const canAfford = balance >= cost;
  const earned = !!item && (!item.isForSale || cost <= 0);
  const buyEnabled =
    !!item && item.active && !owned && !earned && canPurchase && canAfford && !busy;

  return (
    <AdaptiveModalScaffold
      visible={!!item}
      onRequestClose={onClose}
      bare
      showCloseButton
      closeLabel={item ? `Close ${item.name} preview` : "Close furnishing preview"}
      maxWidth={430}
      contentContainerStyle={styles.modalContent}
      testID="habitat-item-preview-modal"
    >
      {item ? (
        <Sticker color="paper" rotate={TILT.dialog} radius={RADII.xxl} style={styles.sheet}>
          <View
            accessibilityLabel={
              showRoomPreview && canShowRoom
                ? `${item.name} previewed in your Barn`
                : `${item.name} furnishing preview`
            }
            style={[
              styles.previewCard,
              { backgroundColor: RARITY_BG_SOLID[item.rarity] },
            ]}
          >
            {showRoomPreview && canShowRoom ? (
              <View testID="habitat-room-preview" style={styles.roomPreview}>
                {roomPreview}
              </View>
            ) : (
              <Image
                source={habitatItemAsset(item.assetKey)}
                style={styles.itemArt}
                resizeMode="contain"
                accessible={false}
              />
            )}
          </View>

          {canShowRoom ? (
            <Button
              size="md"
              variant="ghost"
              full
              onPress={onToggleRoomPreview}
              accessibilityLabel={
                showRoomPreview
                  ? `Show ${item.name} furnishing preview`
                  : `Preview ${item.name} in my Barn`
              }
              testID="habitat-room-preview-toggle"
            >
              {showRoomPreview ? "View furnishing" : "Preview in my Barn"}
            </Button>
          ) : null}

          <Tag
            label={item.rarity.toUpperCase()}
            tone={RARITY_TONE[item.rarity]}
            style={styles.rarityBadge}
          />
          <PageTitle>{item.name}</PageTitle>
          <HandLg tone="secondary" style={styles.itemDescription}>
            {item.description}
          </HandLg>
          {acquisitionPaths?.length ? (
            <View style={styles.paths} accessibilityRole="summary">
              <Label>How to get it</Label>
              {acquisitionPaths.map((path) => (
                <BodySm key={path} tone="secondary">• {path}</BodySm>
              ))}
            </View>
          ) : null}
          {item.prestigeRank !== undefined ? (
            <BodySm tone="secondary" style={styles.purchaseCopy}>
              {owned
                ? `A Wallow Rank ${item.prestigeRank} gift. Yours to keep across seasons.`
                : `Free at Wallow Rank ${item.prestigeRank}, or buy it now. Gifts are added automatically when you open your Barn.`}
            </BodySm>
          ) : null}

          {owned ? (
            <Body tone="secondary" style={styles.ownedCopy}>
              Yours to keep. Place it in your Barn whenever you like.
            </Body>
          ) : !earned ? (
            <BodySm tone="secondary" style={styles.purchaseCopy}>
              Buy it once, then place it in your Barn.
            </BodySm>
          ) : null}

          {!owned && !earned ? (
            <View style={styles.purchaseDetails}>
              <View
                accessible
                accessibilityLabel={`${item.name} costs ${cost.toLocaleString()} Snouts`}
                style={styles.priceRow}
              >
                <SnoutCoin size={PRICE_COIN_SIZE} />
                <SectionTitle>{cost.toLocaleString()}</SectionTitle>
                <Hand tone="secondary">Snouts</Hand>
              </View>
              <BodySm tone="secondary">
                Your balance: {balance.toLocaleString()} Snouts
              </BodySm>
            </View>
          ) : null}

          {error ? (
            <Body accessibilityRole="alert" tone="danger" style={styles.error}>
              {error}
            </Body>
          ) : null}

          <View style={styles.cta}>
            {owned ? (
              onPlace ? (
                <Button
                  size="md"
                  variant="primary"
                  full
                  onPress={onPlace}
                  accessibilityLabel={`Place ${item.name} in my Barn`}
                  testID="habitat-place-button"
                >
                  Place in my Barn
                </Button>
              ) : (
                <Button size="md" variant="locked" full disabled>Owned</Button>
              )
            ) : earned ? (
              <Button size="md" variant="locked" full disabled>
                Earned, not sold
              </Button>
            ) : !item.active || !canPurchase ? (
              <Button size="md" variant="locked" full disabled>
                Unavailable right now
              </Button>
            ) : !canAfford ? (
              <Button size="md" variant="locked" full disabled>
                Not enough · need {(cost - balance).toLocaleString()}
              </Button>
            ) : (
              <Button
                size="md"
                variant={item.rarity === "rare" ? "gold" : "primary"}
                full
                disabled={!buyEnabled}
                onPress={buyEnabled ? onBuy : undefined}
                accessibilityLabel={`Buy ${item.name} for ${cost.toLocaleString()} Snouts`}
                accessibilityHint={`Spends ${cost.toLocaleString()} Snouts and adds it to your collection`}
                testID="habitat-buy-button"
              >
                {busy ? "Buying…" : "Buy"}
              </Button>
            )}
            {onToggleWishlist ? (
              <Button
                size="md"
                variant="ghost"
                full
                disabled={wishlistBusy}
                onPress={wishlistBusy ? undefined : onToggleWishlist}
                accessibilityLabel={`${wishlisted ? "Remove" : "Save"} ${item.name} ${wishlisted ? "from" : "to"} wishlist`}
                testID="habitat-wishlist-button"
              >
                {wishlistBusy ? "Saving…" : wishlisted ? "Remove from wishlist" : "Save to wishlist"}
              </Button>
            ) : null}
          </View>
        </Sticker>
      ) : null}
    </AdaptiveModalScaffold>
  );
}

const styles = StyleSheet.create({
  modalContent: { flexGrow: 1, justifyContent: "center", padding: SPACE.xs },
  sheet: { padding: SPACE.lg },
  previewCard: {
    width: "100%",
    aspectRatio: 1.2,
    borderRadius: RADII.xl,
    borderWidth: BORDER.ink,
    borderColor: UI_COLORS.border,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SPACE.sm,
  },
  // The item art fills the rarity well minus a breathing margin — a fraction of
  // the well, not a spacing step.
  itemArt: { width: "84%", height: "84%" },
  roomPreview: { width: "100%", height: "100%" },
  rarityBadge: {
    alignSelf: "flex-start",
    marginTop: SPACE.sm,
    marginBottom: SPACE.xs,
  },
  itemDescription: { marginTop: SPACE.xs },
  ownedCopy: { marginTop: SPACE.sm },
  purchaseCopy: { marginTop: SPACE.sm },
  purchaseDetails: { marginTop: SPACE.md, gap: SPACE.xs },
  paths: { marginTop: SPACE.md, gap: SPACE.xs },
  priceRow: { flexDirection: "row", alignItems: "center", gap: SPACE.sm },
  error: { marginTop: SPACE.sm },
  cta: { marginTop: SPACE.md, gap: SPACE.sm },
});
