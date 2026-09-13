// The Mote Machine route. Hidden behind MOTE_MACHINE_VISIBLE (2026-09-11,
// audit D-06) until the wagering screen is rebuilt on the design-system
// primitives; `?acceptance=<scenario>` opens it in a dev build regardless so the
// acceptance scenarios in utils/moteGameAcceptance.ts stay reachable.
//
// The v1 "spend a Mote, get a Reveal" screen and its pending-request recovery
// were cut 2026-09-12: the v2 migration (20260906010000) created both RPCs, so
// the legacy handoff could never trigger, and the machine has been dark since
// before any v1 request could still be pending.
import { Redirect, useLocalSearchParams } from "expo-router";
import { MOTE_MACHINE_VISIBLE } from "@/constants/featureFlags";
import { MoteWageringScreen } from "@/components/mote-machine/MoteWageringScreen";

export default function MoteMachineRoute() {
  const params = useLocalSearchParams<{ acceptance?: string | string[] }>();
  const canPreviewLocally =
    typeof __DEV__ !== "undefined" && __DEV__ && Boolean(params.acceptance);
  if (!MOTE_MACHINE_VISIBLE && !canPreviewLocally)
    return <Redirect href="/(tabs)/season" />;
  return <MoteWageringScreen />;
}
