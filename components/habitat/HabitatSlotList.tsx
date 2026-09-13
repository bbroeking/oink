import { Image, StyleSheet, View, useWindowDimensions } from "react-native";
import { HABITAT_POSITION_META, habitatItemAsset } from "@/constants/habitat";
import type {
  HabitatCatalogItem,
  HabitatPosition,
  HabitatSnapshot,
} from "@/utils/habitat";
import { BORDER, RADII, ROW_TILTS, SPACE } from "@/constants/theme";
import { Body, BodySm, CardTitle } from "@/components/ui/Text";
import { Button } from "@/components/ui/Button";
import { Sticker } from "@/components/ui/Sticker";
import { Tag } from "@/components/ui/Chip";

const LIST_POSITION_ORDER: readonly HabitatPosition[] = [
  "interior_background",
  "wall",
  "ceiling",
  "floor_left",
  "floor_right",
  "floor_centerpiece",
  "surface",
];

// The thumbnail of a furnishing inside a choice row. A picture of the item, not
// a spacing step — named here rather than borrowed from SPACE. (2026-09-11)
const CHOICE_ART = 52;

export function HabitatSlotList({
  snapshot,
  onChoose,
  onRemove,
  workshop,
  disabled = false,
}: {
  snapshot: HabitatSnapshot;
  onChoose: (p: HabitatPosition) => void;
  onRemove: (p: HabitatPosition) => void;
  workshop?: React.ReactNode;
  disabled?: boolean;
}) {
  const { width, fontScale } = useWindowDimensions();
  const stackRows = width < 360 || fontScale >= 1.5;
  return (
    <View accessibilityRole="list" style={styles.list}>
      {LIST_POSITION_ORDER.map((position, index) => {
        const item = snapshot.positions[position];
        const meta = HABITAT_POSITION_META[position];
        return (
          <Sticker
            key={position}
            accessibilityRole="summary"
            shadow="sm"
            radius={RADII.md}
            rotate={ROW_TILTS[index % ROW_TILTS.length]}
            pad
            style={[styles.row, stackRows && styles.rowStacked]}
          >
            <View style={styles.copy}>
              <Body>{meta.label}</Body>
              <BodySm tone="secondary">{item?.name ?? "Empty"}</BodySm>
            </View>
            <View
              style={[styles.rowActions, stackRows && styles.rowActionsStacked]}
            >
              <Button
                variant="ghost"
                size="sm"
                accessibilityLabel={`${item ? "Change" : "Choose"} ${meta.label}`}
                accessibilityHint={`Choose a ${meta.category.replaceAll("_", " ")} design`}
                onPress={() => onChoose(position)}
                disabled={disabled}
              >
                {item ? "Change" : "Choose"}
              </Button>
              {item && position !== "interior_background" ? (
                <Button
                  variant="link"
                  size="sm"
                  accessibilityLabel={`Remove ${item.name} from ${meta.label}`}
                  accessibilityHint="Removes this item from the draft without removing it from your collection"
                  onPress={() => onRemove(position)}
                  disabled={disabled}
                >
                  Remove
                </Button>
              ) : null}
            </View>
          </Sticker>
        );
      })}
      {workshop ? (
        <Sticker
          accessibilityRole="summary"
          shadow="sm"
          radius={RADII.md}
          rotate={ROW_TILTS[LIST_POSITION_ORDER.length % ROW_TILTS.length]}
          pad
          style={styles.workshop}
        >
          <Body>Workshop</Body>
          {workshop}
        </Sticker>
      ) : null}
    </View>
  );
}

export function HabitatChoices({
  position,
  items,
  currentId,
  placedIds = [],
  onPlace,
  onRemove,
  onFindMore,
  newItemIds,
  disabled = false,
}: {
  position: HabitatPosition;
  items: HabitatCatalogItem[];
  currentId: string | null;
  placedIds?: string[];
  onPlace: (item: HabitatCatalogItem) => void;
  onRemove: () => void;
  onFindMore: () => void;
  newItemIds?: ReadonlySet<string>;
  disabled?: boolean;
}) {
  const { width, fontScale } = useWindowDimensions();
  const stacked = width < 360 || fontScale >= 1.5;
  return (
    <View style={styles.choices} accessibilityRole="list">
      <CardTitle>Choose for {HABITAT_POSITION_META[position].label}</CardTitle>
      {items.map((item, index) => (
        <Sticker
          key={item.id}
          accessibilityLabel={`${item.name}, ${item.rarity}${newItemIds?.has(item.id) ? ", New" : ""}, ${item.id === currentId ? "placed here" : placedIds.includes(item.id) ? "move here" : "place"}`}
          accessibilityHint={`${item.description} ${item.id === currentId ? "Already placed here." : placedIds.includes(item.id) ? "Moves it here in your draft." : "Places it here in your draft."}`}
          onPress={() => onPlace(item)}
          disabled={disabled}
          shadow="sm"
          radius={RADII.md}
          border={item.id === currentId ? BORDER.heavy : BORDER.ink}
          rotate={item.id === currentId ? 0 : ROW_TILTS[index % ROW_TILTS.length]}
          color={item.id === currentId ? "sun" : "paper"}
          pad
          style={[styles.choice, stacked && styles.rowStacked]}
        >
          <Image
            source={habitatItemAsset(item.assetKey)}
            style={styles.choiceArt}
            resizeMode="contain"
            accessible={false}
          />
          <View style={styles.copy}>
            <View style={styles.itemHeading}>
              <Body>{item.name}</Body>
              {newItemIds?.has(item.id) ? <Tag label="New" tone="sun" /> : null}
            </View>
            <BodySm tone="secondary">{item.description}</BodySm>
          </View>
          <Body>
            {item.id === currentId
              ? "Placed"
              : placedIds.includes(item.id)
                ? "Move here"
                : "Place"}
          </Body>
        </Sticker>
      ))}
      {currentId && position !== "interior_background" ? (
        <Button
          variant="link"
          full
          accessibilityLabel={`Remove item from ${HABITAT_POSITION_META[position].label}`}
          accessibilityHint="Removes this item from the draft without removing it from your collection"
          onPress={onRemove}
          disabled={disabled}
        >
          Remove from this spot
        </Button>
      ) : null}
      <Button
        variant="ghost"
        full
        accessibilityLabel={`Find more for ${HABITAT_POSITION_META[position].label}`}
        accessibilityHint="Opens the Barn collection and keeps your current draft"
        onPress={onFindMore}
        disabled={disabled}
      >
        Find more for this spot
      </Button>
    </View>
  );
}
const styles = StyleSheet.create({
  list: { gap: SPACE.sm },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.sm,
  },
  copy: { flex: 1 },
  itemHeading: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: SPACE.xs },
  rowStacked: { flexDirection: "column", alignItems: "stretch" },
  rowActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: SPACE.sm,
  },
  rowActionsStacked: { justifyContent: "flex-start", alignSelf: "stretch" },
  workshop: { gap: SPACE.sm },
  choices: { gap: SPACE.sm, padding: SPACE.md },
  choice: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.sm,
  },
  choiceArt: { width: CHOICE_ART, height: CHOICE_ART },
});
