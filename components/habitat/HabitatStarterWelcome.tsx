// The first thing a player sees inside their own Barn. Audit finding A-03
// called it out as the flattest surface in the Habitat: a raw full-screen
// `Modal` over borderless list cards, a hand-rolled sun rectangle for the CTA,
// no Sticker, no tilt, no shadow. Rebuilt as the ceremony it is —
// AdaptiveModalScaffold + Sticker + Button — keeping its art, its copy and its
// VoiceOver labelling verbatim. [A-03] (2026-09-11)
import { Image, StyleSheet, View } from "react-native";
import {
  HABITAT_CATALOG_BY_ID,
  HABITAT_STARTER_ITEM_IDS,
  habitatItemAsset,
} from "@/constants/habitat";
import {
  AdaptiveModalScaffold,
  BodyLg,
  BodySm,
  Button,
  CardTitle,
  KickerPill,
  PageTitle,
  Sticker,
} from "@/components/ui";
import { ROW_TILTS, SPACE, TILT } from "@/constants/theme";

// The starter thumbnail. Product art at a fixed square, not an icon step and
// not a spacing value, so it carries its own name.
const STARTER_ART = { width: 72, height: 72 } as const;

export function HabitatStarterWelcome({
  visible,
  onDismiss,
}: {
  visible: boolean;
  onDismiss: () => void;
}) {
  return (
    <AdaptiveModalScaffold
      visible={visible}
      onRequestClose={onDismiss}
      bare
      contentContainerStyle={styles.content}
      testID="habitat-starter-welcome"
    >
      <Sticker color="cream" rotate={TILT.dialog} style={styles.panel}>
        <KickerPill tone="accent">WELCOME INSIDE</KickerPill>
        <PageTitle accessibilityRole="header">
          Your Barn is a blank canvas.
        </PageTitle>
        <BodyLg tone="secondary">
          Four starter designs are yours for free. The room starts empty, so tap
          Decorate and make it feel like home.
        </BodyLg>
        <View accessibilityRole="list" style={styles.list}>
          {HABITAT_STARTER_ITEM_IDS.map((id, index) => {
            const item = HABITAT_CATALOG_BY_ID[id];
            return (
              <Sticker
                accessibilityRole="summary"
                key={id}
                color="paper"
                rotate={ROW_TILTS[index % ROW_TILTS.length]}
                shadow="sm"
                style={styles.card}
              >
                <Image
                  source={habitatItemAsset(item.assetKey)}
                  style={styles.image}
                  resizeMode="contain"
                  accessible={false}
                />
                <View style={styles.copy}>
                  <CardTitle>{item.name}</CardTitle>
                  <BodySm tone="secondary">{item.description}</BodySm>
                </View>
              </Sticker>
            );
          })}
        </View>
        <BodyLg tone="secondary">
          Visit a friend from Friends to see both pigs in their saved Barn.
          Friends can look around; only the owner can decorate.
        </BodyLg>
        <Button
          variant="gold"
          size="lg"
          full
          accessibilityLabel="Start decorating your Barn"
          accessibilityHint="Closes this welcome and shows your Barn Interior"
          onPress={onDismiss}
        >
          Start decorating
        </Button>
      </Sticker>
    </AdaptiveModalScaffold>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, justifyContent: "center", padding: SPACE.xs },
  panel: { padding: SPACE.lg, gap: SPACE.md },
  list: { gap: SPACE.sm },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.md,
    padding: SPACE.card,
  },
  image: { ...STARTER_ART },
  copy: { flex: 1, gap: SPACE.xxs },
});
