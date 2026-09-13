import { Image, StyleSheet, View } from "react-native";
import {
  ART_SIZE,
  OPACITY,
  RADII,
  SPACE,
} from "@/constants/theme";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageBackground } from "@/components/ui/PageBackground";
import { Sticker, Tape } from "@/components/ui/Sticker";
import { CardTitle } from "@/components/ui/Text";
import type { MoteMachineRiveViewModel } from "./moteMachineRiveContract";

// The same approved empty cabinet as the live Rive scene: no lever, stake,
// winning symbols or reward are depicted while the renderer is unavailable.
const RESTING_CABINET = require("../../assets/images/mote-machine/machine-resting.png");

export function MoteMachineFallback({
  loading,
  confirmedRewardLabel,
  uncertainPlay,
  onRetryRuntime,
}: Pick<
  MoteMachineRiveViewModel,
  "confirmedRewardLabel" | "uncertainPlay" | "onRetryRuntime"
> & { loading?: boolean }) {
  if (!loading) {
    return (
      <PageBackground>
        <View style={styles.fallback}>
          <EmptyState
            kind="error"
            art={RESTING_CABINET}
            rotate={-0.7}
            title="The machine is resting."
            sub={
              confirmedRewardLabel
                ? `Your confirmed ${confirmedRewardLabel} is safe; only the machine's motion failed.`
                : uncertainPlay
                  ? "Your last play may have completed. Check it before using another Mote."
                  : "Your Mote was not spent. Reload the machine or go back."
            }
            action={onRetryRuntime ? (
              <Button
                variant="gold"
                onPress={onRetryRuntime}
                accessibilityLabel="Reload the Mote Machine"
                accessibilityHint="Loads the machine again. No Mote is spent."
              >
                Reload machine
              </Button>
            ) : undefined}
            style={styles.card}
          />
        </View>
      </PageBackground>
    );
  }

  return (
    <PageBackground>
      <View style={styles.fallback}>
        <Sticker
          color="paper"
          rotate={0.6}
          radius={RADII.lg}
          style={styles.loadingCard}
        >
          <Tape color="sun" rotate={5} style={styles.fallbackTape} />
          <Image source={RESTING_CABINET} style={[styles.cabinet, styles.wakingCabinet]} resizeMode="contain" accessible={false} />
          <CardTitle align="center">Waking the machine…</CardTitle>
        </Sticker>
      </View>
    </PageBackground>
  );
}

// The resting-cabinet art box — drawing geometry (a 3:4 crop of the approved
// empty cabinet), not a spacing step.
const CABINET = { width: ART_SIZE.thumb, height: 96 };

const styles = StyleSheet.create({
  cabinet: { ...CABINET, marginBottom: SPACE.xs },
  wakingCabinet: { opacity: OPACITY.ghost },
  fallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: SPACE.md,
  },
  card: { width: "100%", maxWidth: 340 },
  loadingCard: {
    alignItems: "center",
    paddingHorizontal: SPACE.xl,
    paddingVertical: SPACE.lg,
  },
  fallbackTape: { position: "absolute", top: -8, alignSelf: "center" },
});
