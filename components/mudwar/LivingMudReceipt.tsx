import React, { useEffect, useState } from "react";
import { AccessibilityInfo, Image, StyleSheet, View } from "react-native";
import { Button, T } from "@/components/ui";
import type { RootingOutcome } from "@/hooks/useRooting";
import { HAT_IMAGES } from "@/constants/hats";
import { UNIQUE_BY_ID } from "@/constants/uniques";
import { SPACE, TAP_MIN } from "@/constants/theme";
import {
  LivingMudPouch,
  LivingMudScene,
  livingMudStyles,
} from "./LivingMudScene";

/** Both immediate and recovered receipts render the server's original outcome. */
export function LivingMudReceipt({
  outcome,
  onClose,
  reduceMotion = false,
  children,
}: {
  outcome: RootingOutcome;
  onClose: () => void;
  reduceMotion?: boolean;
  children?: React.ReactNode;
}) {
  const [details, setDetails] = useState(false);
  const practice = outcome.practice;
  const title = practice ? "Practice complete" : "Finds packed";
  const truffles = practice ? (outcome.snoutGift ?? 0) : outcome.truffles;
  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(
      practice
        ? `Practice complete.${truffles > 0 ? ` Beginner's Snout added ${truffles} Golden Truffle.` : " No rewards were banked."}`
        : `Finds packed. ${truffles} Golden Truffles added to your pouch.`,
    );
  }, [practice, truffles]);
  return (
    <LivingMudScene title={title}>
      <LivingMudPouch
        count={outcome.credited}
        truffleCount={truffles}
        confirmed={!practice}
        reduceMotion={reduceMotion}
      />
      <View style={livingMudStyles.footer}>
        <View style={livingMudStyles.paper}>
          <View style={styles.reward}>
            {truffles > 0 && (
              <Image
                source={HAT_IMAGES.golden_truffle}
                style={styles.rewardArt}
                resizeMode="contain"
                accessible={false}
              />
            )}
            <T role="sectionTitle">
              {truffles > 0
                ? `+${truffles} Golden ${truffles === 1 ? "Truffle" : "Truffles"}`
                : practice
                  ? "A little practice"
                  : "Your dig is complete"}
            </T>
          </View>
          <T role="bodySm" align="center">
            {practice
              ? truffles > 0
                ? "Your first practice gift is yours to keep. The practice finds were not banked."
                : "These were practice finds. Join a Sounder to dig for keeps."
              : outcome.credited > 0
                ? "Your finds helped your Sounder and weakened the Hungerer."
                : "No finds were banked this time. Another patch awaits next Feeding."}
          </T>
        </View>
        <Button
          size="lg"
          full
          onPress={onClose}
          accessibilityLabel="Back to Barn"
        >
          Back to Barn
        </Button>
        {!practice && (
          <>
            <Button
              variant="ghost"
              full
              onPress={() => setDetails(!details)}
              accessibilityState={{ expanded: details }}
            >
              {details ? "Hide receipt" : "View receipt"}
            </Button>
            {details && (
              <View style={[livingMudStyles.paper, styles.details]}>
                <T role="body">
                  {outcome.credited} {outcome.credited === 1 ? "find" : "finds"}{" "}
                  credited to the Sounder.
                </T>
                {outcome.echo && (
                  <T role="bodySm">A crewmate's dig helped yours.</T>
                )}
                {outcome.blessed && (
                  <T role="bodySm">A blessing joined this dig.</T>
                )}
                {outcome.uniqueFound && (
                  <T role="bodySm">
                    {UNIQUE_BY_ID[outcome.uniqueFound.id]?.name ?? "A relic"}{" "}
                    {outcome.uniqueFound.new
                      ? "joined your Burrow Book."
                      : "was found again."}
                  </T>
                )}
                {outcome.carryCaught && (
                  <T role="bodySm">
                    You finished a find from your last Feeding.
                  </T>
                )}
                {outcome.carryNext && (
                  <T role="bodySm">
                    One almost-found treasure returns next Feeding.
                  </T>
                )}
                {outcome.milestone && (
                  <T role="bodySm">
                    The barnyard reached a Hungerer milestone.
                  </T>
                )}
              </View>
            )}
          </>
        )}
        {children}
      </View>
    </LivingMudScene>
  );
}

export function LivingMudRecovery({
  busy,
  reason,
  onRetry,
  onClose,
}: {
  busy: boolean;
  reason?: string;
  onRetry?: () => void;
  onClose: () => void;
}) {
  const expired =
    reason === "no_open_rooting" ||
    reason === "patch_closed" ||
    reason === "expired" ||
    reason === "window_changed";
  const storageFailed = reason === "storage_failed";
  return (
    <LivingMudScene
      title={
        busy
          ? "Packing your finds"
          : expired
            ? "The patch has closed"
            : "Let's check your finds"
      }
      busy={busy}
    >
      <View style={livingMudStyles.footer}>
        <View style={livingMudStyles.paper} accessibilityLiveRegion="polite">
          <T role="body" align="center">
            {busy
              ? "Checking with the Barn…"
              : expired
                ? "This Feeding has ended. No new dig was banked."
                : storageFailed
                  ? "Saving failed before submission. Your dig was not sent. Try again to save it safely."
                  : "We haven't confirmed the result yet. Check again to recover your receipt."}
          </T>
        </View>
        {onRetry && !expired && (
          <Button size="lg" full disabled={busy} onPress={onRetry}>
            {busy ? "Checking…" : "Check result"}
          </Button>
        )}
        <Button
          variant={expired ? "primary" : "ghost"}
          full
          disabled={busy}
          onPress={onClose}
        >
          Back to Barn
        </Button>
      </View>
    </LivingMudScene>
  );
}

const styles = StyleSheet.create({
  reward: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACE.sm,
    flexWrap: "wrap",
    marginBottom: SPACE.sm,
  },
  rewardArt: { width: TAP_MIN, height: TAP_MIN },
  details: { gap: SPACE.sm },
});
