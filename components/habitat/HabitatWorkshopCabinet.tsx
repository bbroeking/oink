import { useCallback, useState } from "react";
import { View, Image, Pressable, StyleSheet } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { ActionSheet, type ActionSheetItem } from "@/components/ui/ActionSheet";
import { MOTE_MACHINE_VISIBLE } from "@/constants/featureFlags";
import {
  fetchContraptionInventory,
  type ContraptionInventoryState,
} from "@/utils/moteMachine";
import { HABITAT_CHROME_ASSETS } from "@/constants/habitat";
import {
  BORDER,
  PRESSED_FLAT,
  RADII,
  SHADOW_SM,
  SPACE,
  TAP_MIN,
  UI_COLORS,
  WHIMSY,
} from "@/constants/theme";
import { Icon } from "@/components/ui/Icon";

// The cabinet is a piece of scene art, not a control on a page: it stands two
// tap targets tall so the drawn cabinet reads at the scale the room was
// authored at, and its gear badge is a 28pt disc sized to the art it sits on.
// Drawing constants, named here rather than borrowed from SPACE (the
// PageHeader plaque precedent). (2026-09-11)
const CABINET_MIN_H = TAP_MIN * 2;
const GEAR_BADGE = 28;
const GEAR_ICON = 16;
// The press on a picture: it dips toward the shelf as well as dimming.
const PRESS_SCALE = 0.97;

export function HabitatCabinetControl({ state, onPress, testID = "habitat-cabinet-control" }: {
  state: string;
  onPress: () => void;
  testID?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.control, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={`Workshop cabinet. ${state}`}
      accessibilityHint="Opens the Mote Machine and Contraption Inventory"
      testID={testID}
    >
      <Image source={HABITAT_CHROME_ASSETS.workshopCabinet} style={styles.cabinetArt} resizeMode="contain" accessible={false} />
      <View style={styles.gearBadge} accessible={false}>
        <Icon name="gear" size={GEAR_ICON} color={UI_COLORS.textPrimary} />
      </View>
    </Pressable>
  );
}

/** Utility only: no housing load or write depends on the workshop. */
export function HabitatWorkshopCabinet({ owner = true }: { owner?: boolean }) {
  const available = owner && MOTE_MACHINE_VISIBLE;
  const [inventory, setInventory] = useState<ContraptionInventoryState | null>(
    null,
  );
  const [failed, setFailed] = useState(false);
  const [chooserOpen, setChooserOpen] = useState(false);
  useFocusEffect(
    useCallback(() => {
      if (!available) return;
      let current = true;
      setInventory(null);
      setFailed(false);
      void fetchContraptionInventory()
        .then((result) => {
          if (!current) return;
          if (result.ok) setInventory(result);
          else setFailed(true);
        })
        .catch(() => {
          if (current) setFailed(true);
        });
      return () => {
        current = false;
      };
    }, [available]),
  );
  if (!available) return null;
  const tickler = inventory?.items.find(
    (item) => item.contraption_id === "auto_tickler",
  );
  const active =
    tickler?.active_until &&
    new Date(tickler.active_until).getTime() > Date.now();
  const state = failed
    ? "The workshop shelf is unavailable. Your Barn is ready to decorate."
    : !inventory
      ? "Checking the workshop shelf…"
      : active
        ? `Auto-Tickler active until ${new Date(tickler.active_until!).toLocaleString()}`
        : tickler
          ? `${tickler.resource_balance} Clockwork Acorns available`
          : "Auto-Tickler is locked";
  // The Mote Machine is hidden behind its flag; with it off the chooser is
  // just the shelf, so the sheet shows one destination rather than a dead one.
  const items: ActionSheetItem[] = [
    ...(MOTE_MACHINE_VISIBLE
      ? [
          {
            label: "Mote Machine",
            onPress: () => router.push("/mote-machine"),
          },
        ]
      : []),
    { label: "Workshop shelf", onPress: () => router.push("/contraptions") },
  ];
  return (
    <View style={styles.workshop}>
      <HabitatCabinetControl state={state} onPress={() => setChooserOpen(true)} />
      <ActionSheet
        open={chooserOpen}
        onClose={() => setChooserOpen(false)}
        title="Workshop"
        subtitle={state}
        items={items}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  workshop: { flex: 1, minWidth: TAP_MIN, minHeight: TAP_MIN, justifyContent: "flex-end" },
  control: { width: "100%", minWidth: TAP_MIN, minHeight: CABINET_MIN_H, alignItems: "center", justifyContent: "flex-end", borderRadius: RADII.md },
  pressed: { ...PRESSED_FLAT, transform: [{ scale: PRESS_SCALE }] },
  cabinetArt: { position: "absolute", width: "100%", height: "100%" },
  gearBadge: { width: GEAR_BADGE, height: GEAR_BADGE, marginBottom: SPACE.sm, borderRadius: RADII.pill, alignItems: "center", justifyContent: "center", backgroundColor: WHIMSY.paper, borderWidth: BORDER.ink, borderColor: WHIMSY.ink, ...SHADOW_SM },
});
