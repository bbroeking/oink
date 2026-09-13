import React, { useState } from "react";
import { View } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { TrufflePatch } from "@/components/mudwar/TrufflePatch";
import {
  LivingMudReceipt,
  LivingMudRecovery,
} from "@/components/mudwar/LivingMudReceipt";
import { AdaptiveModalScaffold, Button, T } from "@/components/ui";
import { SPACE, WHIMSY } from "@/constants/theme";
import type { RootingOutcome, RootingSession } from "@/hooks/useRooting";
const session: RootingSession = {
  userId: null,
  seed: 314159,
  windowIndex: 1000000001,
  windowEndsAtMs: 9999999999999,
  practice: false,
  coop: false,
  blessed: false,
  crewDug: [],
  uniqueId: null,
  carry: null,
};
const receipt: RootingOutcome = {
  drain: 3,
  credited: 3,
  truffles: 2,
  echo: true,
  blessed: false,
  practice: false,
};
/** Native-only acceptance fixture: no auth, submission, or economy mutation. */
export default function LivingMudPreview() {
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const [version, setVersion] = useState(0);
  const [brushing, setBrushing] = useState(false);
  const [closed, setClosed] = useState(false);
  const insets = useSafeAreaInsets();
  const close = () => setClosed(true);
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: WHIMSY.ink,
        paddingTop: insets.top,
        paddingBottom: insets.bottom,
      }}
    >
      <Stack.Screen options={{ headerShown: false }} />
      <AdaptiveModalScaffold visible onRequestClose={close} bare
        scrollViewProps={{ scrollEnabled: !brushing }} contentContainerStyle={{ justifyContent: "center" }}>
        {closed ? (
          <View
            style={{
              padding: SPACE.xl,
              gap: SPACE.md,
              backgroundColor: WHIMSY.paper,
            }}
          >
            <T role="pageTitle">Back at the Barn</T>
            <Button
              onPress={() => {
                setClosed(false);
                setVersion((n) => n + 1);
              }}
            >
              Try again
            </Button>
          </View>
        ) : mode === "complete" ? (
          <LivingMudReceipt outcome={receipt} onClose={close} />
        ) : mode === "uncertain" ? (
          <LivingMudRecovery
            busy={false}
            reason="uncertain"
            onRetry={() => {}}
            onClose={close}
          />
        ) : (
          <TrufflePatch
            key={version}
            session={session}
            preview
            onClose={close}
            onInteractionChange={setBrushing}
            onSubmit={async () => ({
              outcome: {
                ...receipt,
                practice: false,
              },
            })}
          />
        )}
      </AdaptiveModalScaffold>
    </View>
  );
}
