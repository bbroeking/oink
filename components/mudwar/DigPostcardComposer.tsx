import React, { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import type { DigShareData } from "@/utils/digShare";
import {
  createDigPostcard,
  digPostcardsAvailable,
  fetchPostcardFriends,
  type PostcardFriend,
} from "@/utils/digPostcards";
import { AdaptiveModalScaffold } from "@/components/ui/AdaptiveModalScaffold";
import {
  FONTS,
  RADII,
  SHADOW_SM,
  SPACE,
  TYPE,
  WHIMSY,
} from "@/constants/theme";

export function DigPostcardComposer({ data }: { data: DigShareData }) {
  const [available, setAvailable] = useState(false);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [friends, setFriends] = useState<PostcardFriend[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("");

  React.useEffect(() => {
    let active = true;
    void digPostcardsAvailable().then((next) => {
      if (active) setAvailable(next);
    });
    return () => {
      active = false;
    };
  }, []);

  const show = useCallback(async () => {
    setOpen(true);
    setFeedback("");
    setLoading(true);
    setFriends(await fetchPostcardFriends());
    setLoading(false);
  }, []);

  const send = useCallback(
    async (friend: PostcardFriend) => {
      if (busyId || sentTo) return;
      setBusyId(friend.id);
      const result = await createDigPostcard(friend.id, data);
      setBusyId(null);
      if (!result.ok) {
        setFeedback(
          result.reason === "already_sent"
            ? "This dig already became a postcard."
            : result.reason === "not_friends"
              ? "You need to be friends first."
              : "That postcard stayed in your satchel. Try again.",
        );
        return;
      }
      const name = friend.username ?? "your friend";
      setSentTo(name);
      setFeedback(`Postcard left for ${name}.`);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => {},
      );
    },
    [busyId, data, sentTo],
  );

  if (!available) return null;

  return (
    <>
      <Pressable
        onPress={show}
        accessibilityRole="button"
        accessibilityLabel="Send this dig as a postcard"
        style={({ pressed }) => [styles.trigger, pressed && styles.pressed]}
      >
        <Text style={styles.triggerText}>Send to a friend</Text>
      </Pressable>
      <AdaptiveModalScaffold
        visible={open}
        onRequestClose={() => setOpen(false)}
        showCloseButton
        closeLabel="Close postcard picker"
        contentContainerStyle={styles.modal}
      >
        <Text style={styles.kicker}>FROM THE TRUFFLE PATCH</Text>
        <Text style={styles.title}>Leave a dig postcard</Text>
        <Text style={styles.sub}>
          One friend gets this feeding’s little mud-map. It stays in their
          Inbox, and they can leave one hoof cheer.
        </Text>
        <View
          accessible
          accessibilityLabel={`${data.finds} finds in ${data.digs} digs`}
          style={styles.receipt}
        >
          <Text style={styles.feeding}>FEEDING #{data.feedingNumber}</Text>
          <Text style={styles.result}>
            {data.finds} {data.finds === 1 ? "find" : "finds"} in {data.digs}{" "}
            {data.digs === 1 ? "dig" : "digs"}
          </Text>
        </View>
        {!!feedback && (
          <Text accessibilityLiveRegion="polite" style={styles.feedback}>
            {feedback}
          </Text>
        )}
        {loading ? (
          <Text style={styles.empty}>Checking the fence line…</Text>
        ) : friends.length === 0 ? (
          <Text style={styles.empty}>
            Add a friend first, then your next dig can travel.
          </Text>
        ) : (
          <View style={styles.friendList}>
            {friends.map((friend) => {
              const sent = sentTo != null;
              return (
                <Pressable
                  key={friend.id}
                  onPress={() => send(friend)}
                  disabled={sent || busyId != null}
                  accessibilityRole="button"
                  accessibilityLabel={`Send postcard to ${friend.username ?? "friend"}`}
                  style={({ pressed }) => [
                    styles.friend,
                    pressed && styles.pressed,
                    sent && styles.disabled,
                  ]}
                >
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>
                      {(friend.username ?? "?").slice(0, 1).toUpperCase()}
                    </Text>
                  </View>
                  <Text style={styles.friendName}>
                    {friend.username ?? "A friend"}
                    {friend.discriminator ? ` #${friend.discriminator}` : ""}
                  </Text>
                  <Text style={styles.sendLabel}>
                    {busyId === friend.id ? "sending…" : sent ? "sent" : "send"}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}
      </AdaptiveModalScaffold>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    borderWidth: 1.5,
    borderColor: WHIMSY.ink,
    borderRadius: RADII.pill,
    backgroundColor: WHIMSY.paper,
    paddingHorizontal: SPACE.md,
    paddingVertical: SPACE.sm,
    ...SHADOW_SM,
  },
  triggerText: { ...TYPE.label, color: WHIMSY.ink },
  pressed: { opacity: 0.72, transform: [{ translateY: 1 }] },
  disabled: { opacity: 0.48 },
  modal: { paddingHorizontal: SPACE.lg, paddingBottom: SPACE.lg },
  kicker: {
    ...TYPE.kicker,
    color: WHIMSY.accent,
    textAlign: "center",
  },
  title: {
    ...TYPE.pageTitle,
    color: WHIMSY.ink,
    textAlign: "center",
    marginTop: SPACE.xs,
  },
  sub: {
    ...TYPE.bodySm,
    color: WHIMSY.mute,
    textAlign: "center",
    marginTop: SPACE.sm,
  },
  receipt: {
    alignItems: "center",
    backgroundColor: WHIMSY.cream2,
    borderWidth: 1.5,
    borderColor: WHIMSY.ink,
    borderRadius: RADII.md,
    padding: SPACE.md,
    marginTop: SPACE.md,
  },
  feeding: { ...TYPE.kicker, color: WHIMSY.accent },
  result: { ...TYPE.cardTitle, color: WHIMSY.ink, marginTop: 2 },
  feedback: {
    fontFamily: FONTS.hand,
    fontSize: 13,
    color: WHIMSY.accent,
    textAlign: "center",
    marginTop: SPACE.sm,
  },
  empty: {
    ...TYPE.hand,
    color: WHIMSY.mute,
    textAlign: "center",
    marginTop: SPACE.lg,
  },
  friendList: { gap: SPACE.sm, marginTop: SPACE.md },
  friend: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.sm,
    borderWidth: 1.5,
    borderColor: WHIMSY.ink,
    borderRadius: RADII.md,
    backgroundColor: WHIMSY.paper,
    padding: SPACE.sm,
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: WHIMSY.rose,
  },
  avatarText: {
    fontFamily: FONTS.bodyExtra,
    fontSize: 15,
    color: WHIMSY.ink,
  },
  friendName: { ...TYPE.bodySm, color: WHIMSY.ink, flex: 1 },
  sendLabel: { ...TYPE.label, color: WHIMSY.accent },
});
