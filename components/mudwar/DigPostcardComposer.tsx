import React, { useCallback, useState } from "react";
import { StyleSheet, View } from "react-native";
import * as Haptics from "expo-haptics";
import type { DigShareData } from "@/utils/digShare";
import {
  createDigPostcard,
  digPostcardsAvailable,
  fetchPostcardFriends,
  type PostcardFriend,
} from "@/utils/digPostcards";
import {
  AdaptiveModalScaffold,
  Avatar,
  Button,
  CardTitle,
  Hand,
  Kicker,
  Label,
  ListRow,
  PageTitle,
  Sticker,
  T,
} from "@/components/ui";
import { AVATAR_SIZE, BORDER, RADII, SPACE } from "@/constants/theme";

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
      <Button
        variant="ghost"
        size="sm"
        onPress={show}
        accessibilityLabel="Send this dig as a postcard"
        accessibilityHint="Opens the friend picker. Sending costs nothing."
      >
        Send to a friend
      </Button>
      <AdaptiveModalScaffold
        visible={open}
        onRequestClose={() => setOpen(false)}
        showCloseButton
        closeLabel="Close postcard picker"
        contentContainerStyle={styles.modal}
      >
        <Kicker star={false} align="center">
          FROM THE TRUFFLE PATCH
        </Kicker>
        <PageTitle align="center" style={styles.title}>
          Leave a dig postcard
        </PageTitle>
        <T role="bodySm" tone="secondary" align="center" style={styles.sub}>
          One friend gets this feeding’s little mud-map. It stays in their
          Inbox, and they can leave one hoof cheer.
        </T>
        <Sticker
          color="cream2"
          radius={RADII.md}
          border={BORDER.thin}
          shadow="none"
          rotate={0}
          pad
          accessibilityRole="text"
          accessibilityLabel={`${data.finds} finds in ${data.digs} digs`}
          style={styles.receipt}
        >
          <Kicker star={false} align="center">
            FEEDING #{data.feedingNumber}
          </Kicker>
          <CardTitle align="center" style={styles.result}>
            {data.finds} {data.finds === 1 ? "find" : "finds"} in {data.digs}{" "}
            {data.digs === 1 ? "dig" : "digs"}
          </CardTitle>
        </Sticker>
        {!!feedback && (
          <T
            role="kicker"
            tone="accent"
            align="center"
            accessibilityLiveRegion="polite"
            style={styles.feedback}
          >
            {feedback}
          </T>
        )}
        {loading ? (
          <Hand tone="secondary" align="center" style={styles.empty}>
            Checking the fence line…
          </Hand>
        ) : friends.length === 0 ? (
          <Hand tone="secondary" align="center" style={styles.empty}>
            Add a friend first, then your next dig can travel.
          </Hand>
        ) : (
          <View style={styles.friendList}>
            {friends.map((friend, index) => {
              const sent = sentTo != null;
              const name = friend.username ?? "A friend";
              const sending = busyId === friend.id;
              return (
                <ListRow
                  key={friend.id}
                  index={index}
                  tilt={false}
                  leading={
                    <Avatar size={AVATAR_SIZE[0]} fill="rose" label={name}>
                      <T role="cardTitleSm">
                        {(friend.username ?? "?").slice(0, 1).toUpperCase()}
                      </T>
                    </Avatar>
                  }
                  title={`${name}${friend.discriminator ? ` #${friend.discriminator}` : ""}`}
                  trailing={
                    <Label tone={sent ? "secondary" : "accent"}>
                      {sending ? "sending…" : sent ? "sent" : "send"}
                    </Label>
                  }
                  onPress={() => send(friend)}
                  // A sent postcard is spent, not broken: the row keeps its
                  // shape and reads as "trotted on" instead of dissolving.
                  disabled={sent || busyId != null}
                  muted={sent}
                  accessibilityLabel={`Send postcard to ${friend.username ?? "friend"}`}
                  accessibilityHint="Leaves this dig in their Inbox. One postcard per dig."
                />
              );
            })}
          </View>
        )}
      </AdaptiveModalScaffold>
    </>
  );
}

const styles = StyleSheet.create({
  modal: { paddingHorizontal: SPACE.lg, paddingBottom: SPACE.lg },
  title: { marginTop: SPACE.xs },
  sub: { marginTop: SPACE.sm },
  receipt: { alignItems: "center", marginTop: SPACE.md },
  result: { marginTop: SPACE.xxs },
  feedback: { marginTop: SPACE.sm },
  empty: { marginTop: SPACE.lg },
  friendList: { gap: SPACE.sm, marginTop: SPACE.md },
});
