import React, { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
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
  FONTS,
  RADII,
  SHADOW_SM,
  SPACE,
  TYPE,
  WHIMSY,
} from "@/constants/theme";
import { SectionHeader } from "@/components/ui/SectionHeader";

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
        {postcards.map((card) => {
          const received = card.recipientId === userId;
          const otherName = received
            ? (card.senderUsername ?? "A friend")
            : (card.recipientUsername ?? "a friend");
          return (
            <View key={card.id} style={styles.card}>
              <View
                style={styles.cardTop}
                accessible
                accessibilityLabel={`${received ? `${otherName} sent you` : `You sent ${otherName}`} a postcard. ${postcardAccessibilityLabel(card)}${card.cheeredAt ? ". Hoof cheered" : ""}`}
              >
                <View>
                  <Text style={styles.byline}>
                    {received ? `FROM ${otherName}` : `TO ${otherName}`}
                  </Text>
                  <Text style={styles.feeding}>
                    Feeding #{card.feedingNumber}
                  </Text>
                </View>
                <Text style={styles.result}>
                  {card.finds} {card.finds === 1 ? "find" : "finds"} ·{" "}
                  {card.digs} {card.digs === 1 ? "dig" : "digs"}
                </Text>
              </View>
              <PostcardGrid cells={card.cells} />
              <View style={styles.footer}>
                <Text style={styles.trace}>
                  {card.goldenInDigs
                    ? `Golden on move ${card.goldenInDigs}`
                    : "A little patch memory"}
                </Text>
                {card.cheeredAt ? (
                  <View style={styles.cheered}>
                    <View style={styles.hoofDot} />
                    <Text style={styles.cheeredText}>hoof cheered</Text>
                  </View>
                ) : received ? (
                  <Pressable
                    onPress={() => cheer(card)}
                    disabled={busyId != null}
                    accessibilityRole="button"
                    accessibilityLabel={`Hoof cheer ${otherName}'s dig postcard`}
                    style={({ pressed }) => [
                      styles.cheerButton,
                      pressed && styles.pressed,
                    ]}
                  >
                    <View style={styles.hoofDot} />
                    <Text style={styles.cheerText}>
                      {busyId === card.id ? "cheering…" : "hoof cheer"}
                    </Text>
                  </Pressable>
                ) : (
                  <Text style={styles.waiting}>waiting for a cheer</Text>
                )}
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: SPACE.lg },
  list: { gap: SPACE.md, marginTop: SPACE.xs },
  card: {
    backgroundColor: "#fff7df",
    borderWidth: 1.5,
    borderColor: WHIMSY.ink,
    borderRadius: RADII.md,
    padding: SPACE.md,
    ...SHADOW_SM,
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: SPACE.sm,
  },
  byline: { ...TYPE.kicker, color: WHIMSY.accent },
  feeding: { ...TYPE.cardTitle, color: WHIMSY.ink, marginTop: 2 },
  result: { ...TYPE.hand, color: WHIMSY.mute, textAlign: "right" },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    width: 100,
    gap: 4,
    marginTop: SPACE.md,
    marginBottom: SPACE.md,
  },
  cell: { width: 16, height: 16, borderWidth: 1, borderColor: WHIMSY.ink },
  mud: { backgroundColor: "#9a7552", borderRadius: 3 },
  truffle: { backgroundColor: "#e8b636", borderRadius: 8 },
  shimmer: {
    backgroundColor: "#8ed9d0",
    borderRadius: 3,
    transform: [{ rotate: "45deg" }, { scale: 0.72 }],
  },
  unique: {
    backgroundColor: "#865ba8",
    borderColor: "#d8a82d",
    borderWidth: 2,
    borderRadius: 3,
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: WHIMSY.muteSoft,
    paddingTop: SPACE.sm,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SPACE.sm,
  },
  trace: { ...TYPE.hand, color: WHIMSY.mute, flex: 1 },
  cheerButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: RADII.pill,
    backgroundColor: WHIMSY.rose,
    paddingHorizontal: SPACE.sm,
    paddingVertical: 6,
  },
  pressed: { opacity: 0.7, transform: [{ translateY: 1 }] },
  hoofDot: {
    width: 9,
    height: 11,
    borderRadius: 5,
    backgroundColor: WHIMSY.accent,
  },
  cheerText: { ...TYPE.label, color: WHIMSY.accent },
  cheered: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  cheeredText: {
    fontFamily: FONTS.hand,
    fontSize: 12,
    color: WHIMSY.accent,
  },
  waiting: {
    fontFamily: FONTS.hand,
    fontSize: 12,
    color: WHIMSY.mute,
  },
});
