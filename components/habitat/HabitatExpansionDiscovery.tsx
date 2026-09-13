import { useEffect, useRef, useState } from "react";
import { Image, StyleSheet, useWindowDimensions, View } from "react-native";
import { router } from "expo-router";
import {
  useHabitatExpansionDiscovery,
  type HabitatExpansionDiscoveryBackend,
} from "@/hooks/useHabitatExpansionDiscovery";
import { POPUP_PRIORITIES } from "@/constants/popupPriorities";
import {
  AdaptiveModalScaffold,
  Body,
  BodySm,
  Button,
  CardTitle,
  Hand,
  Kicker,
  LoadingBeat,
  POPUP_HANDOFF_GAP_MS,
  POPUP_TEARDOWN_MS,
  SectionTitle,
  Sticker,
  usePopupSlot,
} from "@/components/ui";
import { RADII, SPACE } from "@/constants/theme";
import {
  HABITAT_STARTER_ITEM_IDS,
  habitatItemAsset,
} from "@/constants/habitat";
import { subscribeHabitatIntro } from "@/utils/habitatIntro";

const STARTER_ART = { width: 68, height: 68 } as const;

export function HabitatExpansionDiscovery({
  accountId,
  backend,
  enabledOverride,
  onEnterBarn,
  onOpenShop,
}: {
  accountId: string | null;
  backend?: HabitatExpansionDiscoveryBackend;
  enabledOverride?: boolean;
  onEnterBarn?: () => void;
  onOpenShop?: () => void;
}) {
  const { width, fontScale } = useWindowDimensions();
  const stackCompactRows = width < 350 || fontScale >= 1.3;
  const enabled = enabledOverride ?? true;
  const discovery = useHabitatExpansionDiscovery(accountId, enabled, backend);
  const [closing, setClosing] = useState(false);
  const [replayAccountId, setReplayAccountId] = useState<string | null>(null);
  const replaying = Boolean(
    accountId && replayAccountId === accountId && enabled,
  );
  const busy = discovery.loading && !replaying;
  const activeAccount = useRef(accountId);
  const mounted = useRef(true);
  const finishing = useRef(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  activeAccount.current = accountId;
  useEffect(() => {
    finishing.current = false;
    setClosing(false);
    setReplayAccountId(null);
    return () => {
      for (const timer of timers.current) clearTimeout(timer);
      timers.current = [];
    };
  }, [accountId]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      for (const timer of timers.current) clearTimeout(timer);
      timers.current = [];
    };
  }, []);
  useEffect(
    () =>
      subscribeHabitatIntro((requestedAccount) => {
        if (enabled && accountId === requestedAccount && !finishing.current) {
          setReplayAccountId(requestedAccount);
        }
      }),
    [accountId, enabled],
  );
  const want =
    enabled &&
    (replaying || (discovery.available && discovery.pending)) &&
    !closing;
  const slot = usePopupSlot(
    "habitatExpansionDiscovery",
    want,
    POPUP_PRIORITIES.habitatExpansionDiscovery,
  );

  const finish = async (navigate?: () => void) => {
    if (finishing.current || closing || busy) return;
    const initiatingAccount = accountId;
    finishing.current = true;
    const acknowledged = discovery.pending
      ? await discovery.acknowledge()
      : replaying;
    if (
      !acknowledged ||
      !mounted.current ||
      activeAccount.current !== initiatingAccount
    ) {
      finishing.current = false;
      return;
    }
    setClosing(true);
    setReplayAccountId(null);
    slot.release();
    timers.current.push(
      setTimeout(() => {
        if (mounted.current && activeAccount.current === initiatingAccount) {
          finishing.current = false;
          setClosing(false);
        }
      }, POPUP_TEARDOWN_MS),
    );
    if (navigate)
      timers.current.push(
        setTimeout(() => {
          if (mounted.current && activeAccount.current === initiatingAccount)
            navigate();
        }, POPUP_HANDOFF_GAP_MS),
      );
  };

  return (
    <AdaptiveModalScaffold
      visible={slot.visible}
      onRequestClose={() => void finish()}
      maxWidth={390}
      contentContainerStyle={styles.card}
      testID="habitat-expansion-discovery"
    >
      <View style={styles.heading}>
        <Kicker>A home for your pig</Kicker>
        <SectionTitle accessibilityRole="header" align="center">
          Your Barn is ready
        </SectionTitle>
      </View>
      <Sticker
        color="cream"
        rotate={0}
        radius={RADII.lg}
        shadow="sm"
        style={styles.gift}
      >
        <View
          style={styles.art}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          {HABITAT_STARTER_ITEM_IDS.slice(1).map((id) => (
            <Image
              key={id}
              source={habitatItemAsset(id)}
              style={styles.furnishing}
              resizeMode="contain"
              accessible={false}
            />
          ))}
        </View>
        <BodySm tone="secondary" align="center">
          A Warm Plank Barn, Rosie’s sketch, a sunflower crock, and a patchwork
          rug are yours for free. Your room starts empty, ready to decorate.
        </BodySm>
      </Sticker>
      <View style={[styles.featureRow, stackCompactRows && styles.stackedRow]}>
        <View style={styles.feature}>
          <CardTitle>Friends</CardTitle>
          <BodySm tone="secondary">
            Visit with their pig and yours together.
          </BodySm>
        </View>
        <View style={styles.feature}>
          <CardTitle>Decorate</CardTitle>
          <BodySm tone="secondary">
            Decorate your Barn and keep every change.
          </BodySm>
        </View>
      </View>
      <Hand tone="secondary" align="center">
        80 designs for Snouts · 20 bonus designs earned by collecting · No Motes
        needed
      </Hand>
      {!replaying && discovery.error ? (
        <Body accessibilityRole="alert" tone="danger">
          {discovery.error}
        </Body>
      ) : null}
      <Button
        variant="gold"
        size="md"
        full
        accessibilityLabel="Enter Barn"
        accessibilityHint="Opens your Barn"
        disabled={busy}
        onPress={() =>
          void finish(onEnterBarn ?? (() => router.push("/barn-interior")))
        }
      >
        See my Barn
      </Button>
      <View
        style={[styles.secondaryRow, stackCompactRows && styles.stackedRow]}
      >
        <Button
          variant="link"
          size="md"
          style={styles.secondary}
          accessibilityLabel="Shop Barn furnishings"
          accessibilityHint="Opens the Barn collection"
          disabled={busy}
          onPress={() =>
            void finish(onOpenShop ?? (() => router.push("/barn-collection")))
          }
        >
          Shop furnishings
        </Button>
        <Button
          variant="link"
          size="md"
          style={styles.secondary}
          accessibilityLabel="Dismiss Barn furnishings announcement"
          accessibilityHint="Closes the introduction without opening the Barn"
          disabled={busy}
          onPress={() => void finish()}
        >
          Maybe later
        </Button>
      </View>
      {busy ? <LoadingBeat label="saving announcement choice" /> : null}
    </AdaptiveModalScaffold>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: SPACE.lg,
    gap: SPACE.md,
  },
  heading: { gap: SPACE.xs, alignItems: "center" },
  gift: { gap: SPACE.xs, padding: SPACE.sm },
  art: { flexDirection: "row", justifyContent: "space-evenly" },
  // The three starter thumbnails: product art at a fixed square, not an icon
  // step and not a spacing value, so the size carries its own name.
  furnishing: { ...STARTER_ART },
  featureRow: { flexDirection: "row", gap: SPACE.sm },
  stackedRow: { flexDirection: "column" },
  feature: { flex: 1, gap: SPACE.xs },
  secondaryRow: { flexDirection: "row", gap: SPACE.sm },
  secondary: { flex: 1 },
});
