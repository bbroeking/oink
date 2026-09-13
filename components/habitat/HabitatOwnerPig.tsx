import { View } from "react-native";
import Barn from "@/components/Barn";
import { ActiveEffectsProvider } from "@/hooks/ActiveEffectsProvider";
import { useHabitatPigConsumer } from "@/hooks/useHabitatPigBridge";

// The square the pig stage occupies once it loads. Held open while the bridge
// resolves so the room doesn't reflow around Rosie — a reserved ART footprint,
// not a spacing step, so it gets its own name. [A-03] (2026-09-11)
const PIG_STAGE_RESERVE = { width: 300, height: 300 } as const;

/** The existing Home controller owns all tickle economics and feedback. */
export function HabitatOwnerPig() {
  const bridge = useHabitatPigConsumer();
  if (!bridge.loaded) return <View style={PIG_STAGE_RESERVE} />;
  if (!bridge.accountId) return null;
  if (bridge.accountId && bridge.controllers > 0 && bridge.presentation)
    return <>{bridge.presentation}</>;
  return (
    <ActiveEffectsProvider>
      <Barn interiorPigOnly bridgeFallback />
    </ActiveEffectsProvider>
  );
}
