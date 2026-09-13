// The dig-postcard inbox — the receipts friends send each other after a
// feeding. Each postcard is the patch you dug, redrawn small, plus a one-tap
// "hoof cheer" back.
//
// Wave-4 conformance pass: the flat card is a `Sticker` wearing the paper-craft
// DNA it was missing (C-29), stamped with a top-left `Ribbon` naming the
// direction (the result line owns the top-right corner), the mini-grid consumes
// the shared `DIG_TILE` palette instead of six hexes that matched nothing on the
// real board (C-14), the cheer is a `Button` (cost-free, but it states its
// target and its consequence) and the cheered receipt is a `Tag`.
// [C-01, C-14, C-17, C-29]
import React, { useCallback, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useFocusEffect } from "expo-router/react-navigation";
import * as Haptics from "expo-haptics";
import {
  cheerDigPostcard,
  fetchDigPostcards,
  markDigPostcardsOpened,
  postcardAccessibilityLabel,
  type DigPostcard,
} from "@/utils/digPostcards";
import type { ShareCell } from "@/utils/digShare";
import {
  BORDER,
  DIG_TILE,
  RADII,
  SPACE,
  UI_COLORS,
  WHIMSY,
} from "@/constants/theme";
import { Button, Ribbon, SectionHeader, Sticker, T, Tag } from "@/components/ui";

// Drawing geometry for the mini-patch, not spacing: a 5-wide board of 16pt
// tiles, and the little hoof mark that rides the cheer control.
const CELL = 16;
const GRID_WIDTH = 100;
const HOOF_W = 9;
const HOOF_H = 11;
const HOOF_R = 5;
// The stamp's footprint: the Ribbon crosses the top-left corner on a 35° chord,
// so the header column starts clear of it. Drawing geometry, not spacing.
const STAMP_CLEARANCE = 62;
// A shimmer tile is drawn as a diamond — rotated and shrunk so its corners stay
// inside the cell it shares with the square tiles.
const TILE_SHRINK = 0.72;

function PostcardGrid({ cells }: { cells: ShareCell[] }) {
  return (
    <View style={styles.grid} accessibilityElementsHidden>
      {cells.map((cell, index) => (
        <View
          key={`${cell}-${index}`}
          style={[
            styles.cell,
            cell === "mud" && styles.mud,
            cell === "truffle" && styles.truffle,
            cell === "shimmer" && styles.shimmer,
            cell === "unique" && styles.unique,
          ]}
        />
      ))}
    </View>
  );
}

// The hoof mark that leads the cheer control and its receipt.
function HoofDot() {
  return <View style={styles.hoofDot} />;
}

export function DigPostcardInbox({
  userId,
  onPresence,
}: {
  userId: string;
  onPresence?: (present: boolean) => void;
}) {
  const [postcards, setPostcards] = useState<DigPostcard[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const next = await fetchDigPostcards();
    setPostcards(next);
    onPresence?.(next.length > 0);
    const unopened = next
      .filter(
        (card) => card.recipientId === userId && card.recipientOpenedAt == null,
      )
      .map((card) => card.id);
    void markDigPostcardsOpened(unopened);
  }, [userId, onPresence]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const cheer = useCallback(
    async (card: DigPostcard) => {
      if (busyId || card.cheeredAt) return;
      setBusyId(card.id);
      const result = await cheerDigPostcard(card.id);
      setBusyId(null);
      if (!result.ok) return;
      setPostcards((current) =>
        current.map((item) =>
          item.id === card.id
            ? { ...item, cheeredAt: new Date().toISOString() }
            : item,
        ),
      );
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => {},
      );
    },
    [busyId],
  );

  if (postcards.length === 0) return null;

  return (
    <View style={styles.section}>
      <SectionHeader
        kicker="from the patch"
        title="Dig postcards"
        ruleWidth={88}
      />
      <View style={styles.list}>
        {postcards.map((card, index) => {
          const received = card.recipientId === userId;
          const otherName = received
            ? (card.senderUsername ?? "A friend")
            : (card.recipientUsername ?? "a friend");
          return (
            <Sticker
              key={card.id}
              color="cream"
              radius={RADII.md}
              border={BORDER.ink}
              shadow="sm"
              rotate={index % 2 === 0 ? POSTCARD_TILT : -POSTCARD_TILT}
              pad
            >
              <View
                style={styles.cardTop}
                accessible
                accessibilityLabel={`${received ? `${otherName} sent you` : `You sent ${otherName}`} a postcard. ${postcardAccessibilityLabel(card)}${card.cheeredAt ? ". Hoof cheered" : ""}`}
              >
                <View style={styles.byline}>
                  {/* The direction word lives on the stamp above; this is the
                      pig it came from or went to. */}
                  <T role="kicker" tone="accent">
                    {otherName}
                  </T>
                  <T role="cardTitle" style={styles.feeding}>
                    Feeding #{card.feedingNumber}
                  </T>
                </View>
                <T role="hand" tone="secondary" align="right">
                  {card.finds} {card.finds === 1 ? "find" : "finds"} ·{" "}
                  {card.digs} {card.digs === 1 ? "dig" : "digs"}
                </T>
              </View>
              <PostcardGrid cells={card.cells} />
              <View style={styles.footer}>
                <T role="hand" tone="secondary" style={styles.trace}>
                  {card.goldenInDigs
                    ? `Golden on move ${card.goldenInDigs}`
                    : "A little patch memory"}
                </T>
                {card.cheeredAt ? (
                  <Tag
                    label="hoof cheered"
                    tone="rose"
                    accessibilityLabel="Hoof cheered"
                  />
                ) : received ? (
                  <Button
                    variant="primary"
                    size="xs"
                    icon={<HoofDot />}
                    onPress={() => cheer(card)}
                    disabled={busyId != null && busyId !== card.id}
                    loading={busyId === card.id}
                    accessibilityLabel={`Hoof cheer ${otherName}'s dig postcard`}
                    accessibilityHint={`Sends ${otherName} a cheer for this dig. It can't be taken back.`}
                    testID={`postcard-cheer-${card.id}`}
                  >
                    hoof cheer
                  </Button>
                ) : (
                  <T role="hand" tone="secondary">
                    waiting for a cheer
                  </T>
                )}
              </View>
            </Sticker>
          );
        })}
      </View>
    </View>
  );
}

// Postcards alternate their lean so a stack reads as scrapbook rather than
// spreadsheet — a smaller angle than TILT.card, because they stack tight.
const POSTCARD_TILT = 0.5;

const styles = StyleSheet.create({
  section: { marginTop: SPACE.lg },
  list: { gap: SPACE.md, marginTop: SPACE.xs },
  // The Ribbon is absolutely positioned and hangs off the card's edge, so the
  // card it crosses has to clip.
  card: { overflow: "hidden" },
  byline: { paddingLeft: STAMP_CLEARANCE },
  cardTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: SPACE.sm,
  },
  feeding: { marginTop: SPACE.xxs },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    width: GRID_WIDTH,
    gap: SPACE.xs,
    marginTop: SPACE.md,
    marginBottom: SPACE.md,
  },
  cell: {
    width: CELL,
    height: CELL,
    borderWidth: 1,
    borderColor: UI_COLORS.border,
  },
  // The four tile kinds, straight off the shared DIG_TILE palette so the
  // postcard is the same board the patch drew. [C-14]
  mud: { backgroundColor: DIG_TILE.mud[1], borderRadius: RADII.hair },
  truffle: { backgroundColor: DIG_TILE.truffle, borderRadius: RADII.sm },
  shimmer: {
    backgroundColor: DIG_TILE.shimmer,
    borderRadius: RADII.hair,
    transform: [{ rotate: "45deg" }, { scale: TILE_SHRINK }],
  },
  unique: {
    backgroundColor: DIG_TILE.unique,
    borderColor: DIG_TILE.uniqueEdge,
    borderWidth: BORDER.ink,
    borderRadius: RADII.hair,
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: UI_COLORS.uiMuted,
    paddingTop: SPACE.sm,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SPACE.sm,
  },
  trace: { flex: 1 },
  hoofDot: {
    width: HOOF_W,
    height: HOOF_H,
    borderRadius: HOOF_R,
    backgroundColor: WHIMSY.accent,
  },
});
