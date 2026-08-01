import React, { useCallback, useRef, useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import * as Haptics from "expo-haptics";
import {
  fetchMyGuestbook,
  GUESTBOOK_STAMP_META,
  guestbookAgeLabel,
  type GuestbookEntry,
} from "@/utils/guestbookStamps";
import {
  FONTS,
  PAGE_PAD,
  RADII,
  SHADOW_SM,
  SPACE,
  TYPE,
  WHIMSY,
} from "@/constants/theme";
import { Glyph } from "./ui/Glyph";
import { Sticker, Tape } from "./ui/Sticker";
import { AdaptiveModalScaffold } from "./ui/AdaptiveModalScaffold";
import { trackInteraction } from "@/utils/interactionAnalytics";
import { BLESSING_META } from "@/utils/rituals";
import {
  dismissBarnNotice,
  guestbookNoticeSignature,
  isBarnNoticeDismissed,
} from "@/utils/barnNoticeDismissal";
import { Icon } from "./ui/Icon";

export function BarnGuestbook() {
  const [entries, setEntries] = useState<GuestbookEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [dismissedSignature, setDismissedSignature] = useState<string | null>(
    null,
  );
  const openedKindnessCards = useRef(new Set<number>());

  const refresh = useCallback(async () => {
    setLoading(true);
    const result = await fetchMyGuestbook();
    if (result) {
      const signature = guestbookNoticeSignature(result.total, result.entries);
      const dismissed = await isBarnNoticeDismissed("guestbook", signature);
      setEntries(result.entries);
      setTotal(result.total);
      setDismissedSignature(dismissed ? signature : null);
    }
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  // Keep an empty Barn uncluttered. The first stamp makes the permanent
  // guestbook placard appear; migration-not-yet-pushed also fails dark here.
  const noticeSignature = guestbookNoticeSignature(total, entries);
  if (
    !open &&
    (entries.length === 0 || dismissedSignature === noticeSignature)
  ) {
    return null;
  }

  const dismissNotice = () => {
    setDismissedSignature(noticeSignature);
    Haptics.selectionAsync().catch(() => {});
    void dismissBarnNotice("guestbook", noticeSignature);
  };

  return (
    <>
      <View style={styles.launchWrap}>
        <Tape
          color="peach"
          rotate={-4}
          width={48}
          height={13}
          style={styles.tape}
        />
        <Pressable
          testID="barn-guestbook-open"
					onPress={() => {
						setOpen(true);
						void refresh();
						void trackInteraction({
							eventName: "guestbook_opened",
							surface: "barn",
							result: "completed",
							properties: { source: "cta" },
						});
            for (const entry of entries) {
              if (
                entry.blessingKind &&
                !openedKindnessCards.current.has(entry.id)
              ) {
                openedKindnessCards.current.add(entry.id);
                void trackInteraction({
                  eventName: "kindness_card_opened",
                  surface: "inbox",
                  targetKind: "barn",
                  result: "completed",
                  contentId: `guestbook:${entry.id}`,
                  properties: {
                    source: "inbox",
                    variant: entry.blessingKind,
                  },
                });
              }
            }
					}}
          style={({ pressed }) => [
            styles.launch,
            pressed && { transform: [{ scale: 0.98 }] },
          ]}
        >
          <View style={styles.launchIcon}>
            <Glyph name="pigface" size={22} />
          </View>
          <View style={styles.launchCopy}>
            <Text style={styles.launchTitle}>Barn guestbook</Text>
            <Text style={styles.launchBody}>
              {total === 1
                ? `${entries[0]?.visitorName ?? "A friend"} left a stamp`
                : `${total} warm little visits, kept forever`}
            </Text>
          </View>
        </Pressable>
        <Pressable
          testID="barn-guestbook-dismiss"
          onPress={dismissNotice}
          style={({ pressed }) => [
            styles.dismiss,
            pressed && styles.dismissPressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Dismiss Barn guestbook notice"
          accessibilityHint="Hides this notice until a new visit arrives"
        >
          <Icon name="x" size={16} color={WHIMSY.mute} strokeWidth={2.5} />
        </Pressable>
      </View>

      <AdaptiveModalScaffold
        visible={open}
        animationType="fade"
        onRequestClose={() => setOpen(false)}
        maxWidth={390}
        bare
        contentContainerStyle={styles.modalContent}
      >
        <Sticker
          color="paper"
          rotate={-0.5}
          radius={RADII.xl}
          style={styles.sheet}
        >
          <View style={styles.headingRow}>
            <View style={styles.headingIcon}>
              <Glyph name="pigface" size={30} />
            </View>
            <View style={styles.headingCopy}>
              <Text style={styles.kicker}>YOUR BARN GUESTBOOK</Text>
              <Text style={styles.title}>
                Every visit leaves a little warmth
              </Text>
            </View>
          </View>
          <Text style={styles.intro}>
            These stamps never expire. There are no streaks to keep and no empty
            days to explain.
          </Text>
          <View style={styles.list}>
            {entries.map((entry, index) => {
              const meta = GUESTBOOK_STAMP_META[entry.stampId];
              return (
                <View
                  key={entry.id}
                  testID="barn-guestbook-entry"
                  style={[
                    styles.entry,
                    index % 2 === 0 ? styles.entryRose : styles.entrySun,
                  ]}
                >
                  <View style={styles.stampWell}>
                    <Glyph name={meta.glyph} size={27} />
                  </View>
                  <View style={styles.entryCopy}>
                    <Text style={styles.entryName}>{entry.visitorName}</Text>
                    <Text style={styles.entryMeta}>
                      {meta.label} · {guestbookAgeLabel(entry.stampedAt)}
                    </Text>
                    {!!entry.blessingKind && (
                      <View
                        testID="barn-kindness-card"
                        style={styles.blessingRow}
                      >
                        <Image
                          source={BLESSING_META[entry.blessingKind].icon}
                          style={styles.blessingIcon}
                        />
                        <Text style={styles.blessingCopy}>
                          Plus a little{" "}
                          {BLESSING_META[entry.blessingKind].name}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              );
            })}
            {loading && entries.length === 0 && (
              <Text style={styles.empty}>Opening the guestbook…</Text>
            )}
          </View>
          <Pressable onPress={() => setOpen(false)} style={styles.close}>
            <Text style={styles.closeText}>Back to the Barn</Text>
          </Pressable>
        </Sticker>
      </AdaptiveModalScaffold>
    </>
  );
}

const styles = StyleSheet.create({
  launchWrap: {
    marginHorizontal: PAGE_PAD,
    marginBottom: SPACE.sm,
    position: "relative",
    zIndex: 3,
  },
  tape: { position: "absolute", top: -6, left: 22, zIndex: 2 },
  launch: {
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.sm,
    paddingLeft: SPACE.md,
    paddingRight: 52,
    paddingVertical: SPACE.sm,
    backgroundColor: WHIMSY.cream,
    borderWidth: 2,
    borderColor: WHIMSY.ink,
    borderRadius: RADII.md,
    ...SHADOW_SM,
  },
  launchIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: WHIMSY.rose,
    borderWidth: 1.5,
    borderColor: WHIMSY.ink,
  },
  launchCopy: { flex: 1, minWidth: 0 },
  launchTitle: { ...TYPE.sectionTitle, fontSize: 15, color: WHIMSY.ink },
  launchBody: { ...TYPE.bodySm, color: WHIMSY.mute, marginTop: 1 },
  dismiss: {
    position: "absolute",
    top: 5,
    right: 4,
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  dismissPressed: { opacity: 0.55 },
  modalContent: { padding: SPACE.xs },
  sheet: { padding: SPACE.lg },
  headingRow: { flexDirection: "row", alignItems: "center", gap: SPACE.md },
  headingIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: WHIMSY.rose,
    borderWidth: 2,
    borderColor: WHIMSY.ink,
  },
  headingCopy: { flex: 1 },
  kicker: { ...TYPE.kicker, color: WHIMSY.roseDeep },
  title: { ...TYPE.sectionTitle, color: WHIMSY.ink, marginTop: 2 },
  intro: {
    fontFamily: FONTS.hand,
    fontSize: 14,
    lineHeight: 19,
    color: WHIMSY.mute,
    marginTop: SPACE.md,
  },
  list: { marginTop: SPACE.md, gap: SPACE.sm, paddingBottom: SPACE.xs },
  entry: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.md,
    padding: SPACE.md,
    borderRadius: RADII.md,
    borderWidth: 1.5,
    borderColor: WHIMSY.ink,
  },
  entryRose: { backgroundColor: WHIMSY.rose },
  entrySun: { backgroundColor: WHIMSY.sun },
  stampWell: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: WHIMSY.paper,
    borderWidth: 1.5,
    borderColor: WHIMSY.ink,
  },
  entryCopy: { flex: 1, minWidth: 0 },
  entryName: { ...TYPE.sectionTitle, fontSize: 15, color: WHIMSY.ink },
  entryMeta: { ...TYPE.bodySm, color: WHIMSY.ink, marginTop: 2 },
  blessingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.xs,
    marginTop: SPACE.xs,
    paddingTop: SPACE.xs,
    borderTopWidth: 1,
    borderTopColor: WHIMSY.ink,
  },
  blessingIcon: { width: 24, height: 24, resizeMode: "contain" },
  blessingCopy: {
    ...TYPE.bodySm,
    color: WHIMSY.ink,
    flex: 1,
  },
  empty: {
    ...TYPE.body,
    color: WHIMSY.mute,
    textAlign: "center",
    padding: SPACE.xl,
  },
  close: {
    alignSelf: "stretch",
    alignItems: "center",
    marginTop: SPACE.md,
    paddingVertical: 11,
    borderRadius: RADII.md,
    backgroundColor: WHIMSY.lilac,
    borderWidth: 2,
    borderColor: WHIMSY.ink,
  },
  closeText: { fontFamily: FONTS.whimsy, fontSize: 14, color: WHIMSY.ink },
});
