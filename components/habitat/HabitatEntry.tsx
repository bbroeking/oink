import { router } from "expo-router";
import { View, Image, StyleSheet } from "react-native";
import { BodySm, Button } from "@/components/ui";
import { useFeatureFlag } from "@/hooks/useFeatureFlags";
import { HABITAT_CHROME_ASSETS } from "@/constants/habitat";
import { SPACE, PAGE_PAD, UI_COLORS, RADII } from "@/constants/theme";

// The barn-door pictogram inside the entry Button. It is ART riding in the
// Button's icon slot, not an interface icon on the Icon scale and not a spacing
// step, so it carries its own name the way EmptyState's GLYPH_SIZE does rather
// than borrowing a SPACE value that happens to match. [A-03] (2026-09-11)
const DOOR_ART = { width: 32, height: 36 } as const;
const DOOR_ART_COMPACT = { width: 24, height: 28 } as const;

export function HabitatEntry({ collection = false, compact = false }: { collection?: boolean; compact?: boolean }) {
  const enabled = useFeatureFlag("habitat");
  if (!enabled) return null;
  return (
    <View style={[styles.entry, compact && styles.compactEntry]}>
      <Button
        icon={
          <Image
            source={HABITAT_CHROME_ASSETS.barnDoor}
            style={compact ? styles.compactDoor : styles.door}
            resizeMode="contain"
            accessible={false}
          />
        }
        variant={collection ? "ghost" : "gold"}
        size={collection || compact ? "md" : "lg"}
        full
        accessibilityLabel={collection ? "Browse Barn furnishings" : "Enter Barn"}
        accessibilityHint={
          collection
            ? "Browse furnishings to buy with Snouts or earn through play"
            : "Opens your room to decorate and welcome friends"
        }
        onPress={() =>
          router.push(collection ? "/barn-collection" : "/barn-interior")
        }
      >
        {collection ? "Browse furnishings" : "Enter Barn"}
      </Button>
      {!collection && !compact && (
        <BodySm style={styles.hint}>Decorate your room and welcome friends.</BodySm>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  entry: {
    paddingHorizontal: PAGE_PAD,
    marginBottom: SPACE.sm,
    gap: SPACE.xs,
    alignSelf: "stretch",
  },
  door: { ...DOOR_ART },
  compactEntry: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 0,
    marginBottom: 0,
  },
  compactDoor: { ...DOOR_ART_COMPACT },
  hint: {
    backgroundColor: UI_COLORS.surface,
    borderRadius: RADII.sm,
    paddingHorizontal: SPACE.sm,
    paddingVertical: SPACE.xs,
    alignSelf: "center",
    textAlign: "center",
  },
});
