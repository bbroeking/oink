import { ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { cloneElement, isValidElement, useEffect, useRef, useState } from "react";
import { POPUP_HANDOFF_GAP_MS } from "@/components/ui/PopupQueue";
import { HabitatScene } from "@/components/habitat/HabitatScene";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { Icon } from "@/components/ui/Icon";
import { Sheet } from "@/components/ui/Sheet";
import { Sticker } from "@/components/ui/Sticker";
import { Label } from "@/components/ui/Text";
import {
  HabitatChoices,
  HabitatSlotList,
} from "@/components/habitat/HabitatSlotList";
import { HABITAT_POSITION_META } from "@/constants/habitat";
import type {
  HabitatCatalogItem,
  HabitatPosition,
  HabitatSnapshot,
} from "@/utils/habitat";
import { BORDER, RADII, SPACE, UI_COLORS } from "@/constants/theme";

// The status pill never claims more than half the toolbar row, so the cancel
// and more controls flanking it keep their full targets. A proportion of the
// drawing, not a spacing step. (2026-09-11)
const STATUS_MAX_WIDTH = "52%";
// The save / undo marks on the floating toolbar — one step below the label they
// sit beside, so the toolbar reads as chrome over the room.
const CONTROL_ICON = 22;

export function HabitatEditor({
  snapshot,
  owned,
  dirty,
  canUndo,
  saving,
  offline,
  onPlace,
  onRemove,
  onUndo,
  onCancel,
  onSave,
  onFindMore,
  onOpenCollection = () => {},
  children,
  workshop,
  presets,
  initialList = false,
  initialPosition,
  newItemIds,
}: {
  snapshot: HabitatSnapshot;
  owned: HabitatCatalogItem[];
  dirty: boolean;
  canUndo: boolean;
  saving: boolean;
  offline: boolean;
  onPlace: (p: HabitatPosition, i: HabitatCatalogItem) => void;
  onRemove: (p: HabitatPosition) => void;
  onUndo: () => void;
  onCancel: () => void;
  onSave: () => void;
  onFindMore: (p: HabitatPosition) => void;
  onOpenCollection?: () => void;
  children?: React.ReactNode;
  workshop?: React.ReactNode;
  presets?: React.ReactNode;
  initialList?: boolean;
  initialPosition?: HabitatPosition;
  newItemIds?: ReadonlySet<string>;
}) {
  const insets = useSafeAreaInsets();
  const { width, fontScale } = useWindowDimensions();
  const [selected, setSelected] = useState<HabitatPosition | null>(
      initialPosition ?? null,
    ),
    [list, setList] = useState(initialList),
    [toolsOpen, setToolsOpen] = useState(false);
  const compact = fontScale >= 1.6 || width < 350;
  const navigationTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (navigationTimer.current) clearTimeout(navigationTimer.current);
    },
    [],
  );
  const compatible = selected
    ? owned.filter(
        (i) => i.category === HABITAT_POSITION_META[selected].category,
      )
    : [];
  const presetAction = isValidElement<{ onPress?: () => void }>(presets)
    ? cloneElement(presets, {
        onPress: () => {
          setToolsOpen(false);
          navigationTimer.current = setTimeout(
            () => presets.props.onPress?.(),
            POPUP_HANDOFF_GAP_MS,
          );
        },
      })
    : presets;
  const saveLabel = offline
    ? "Save when online"
    : saving
      ? "Saving…"
      : "Save Barn";
  const saveHint = offline
    ? "Reconnect to save this arrangement"
    : "Saves the complete arrangement for you and your friends";
  return (
    <View style={styles.root}>
      {list ? (
        <ScrollView
          style={{ paddingTop: insets.top }}
          contentContainerStyle={styles.list}
        >
          <HabitatSlotList
            snapshot={snapshot}
            onChoose={setSelected}
            onRemove={onRemove}
            workshop={workshop}
            disabled={saving}
          />
        </ScrollView>
      ) : (
        <HabitatScene
          snapshot={snapshot}
          editing
          controlInsetTop={insets.top}
          selectedPosition={selected ?? undefined}
          onSelectPosition={saving ? undefined : setSelected}
          hostPig={children}
          cabinet={workshop}
        />
      )}
      {list ? (
        <View
          style={[
            styles.actions,
            { paddingBottom: Math.max(insets.bottom, SPACE.sm) },
          ]}
        >
          <Button
            variant="ghost"
            size="sm"
            accessibilityLabel={list ? "Arrange in room" : "Arrange as list"}
            accessibilityHint={
              list
                ? "Switches to the spatial Barn editor"
                : "Switches to the non-spatial list editor with the same draft"
            }
            onPress={() => setList((v) => !v)}
          >
            {list ? "Arrange in room" : "Arrange as list"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            accessibilityLabel="Undo last decorating change"
            accessibilityHint="Restores the arrangement from before your last change"
            disabled={!canUndo || saving}
            onPress={onUndo}
          >
            Undo
          </Button>
          <Button
            variant="ghost"
            size="sm"
            accessibilityLabel="Cancel decorating"
            accessibilityHint="Discards this draft and restores the last saved Barn"
            disabled={saving}
            onPress={onCancel}
          >
            Cancel
          </Button>
          <Button
            variant="gold"
            size="sm"
            accessibilityLabel="Save Barn"
            accessibilityHint={saveHint}
            disabled={!dirty || saving || offline}
            onPress={onSave}
          >
            {saveLabel}
          </Button>
        </View>
      ) : (
        <>
          <View
            pointerEvents="box-none"
            style={[styles.toolbar, styles.toolbarTop, { top: insets.top }]}
          >
            {compact ? (
              <IconButton
                name="x"
                label="Cancel decorating"
                accessibilityHint="Discards this draft and restores the last saved Barn"
                disabled={saving}
                onPress={onCancel}
              />
            ) : (
              <Button
                variant="ghost"
                size="sm"
                accessibilityLabel="Cancel decorating"
                accessibilityHint="Discards this draft and restores the last saved Barn"
                disabled={saving}
                onPress={onCancel}
              >
                Cancel
              </Button>
            )}
            <View pointerEvents="none" style={styles.statusSlot}>
              <Sticker
                color="paper"
                rotate={0}
                radius={RADII.xxl}
                shadow="sm"
                style={styles.status}
              >
                <Label
                  align="center"
                  accessibilityLabel="Editing. Place items by selecting a decorating spot."
                  maxFontSizeMultiplier={compact ? 1.3 : undefined}
                  numberOfLines={compact ? 1 : undefined}
                >
                  {compact ? "Editing" : "Editing · Place items"}
                </Label>
              </Sticker>
            </View>
            <IconButton
              name="more"
              label="More decorating actions"
              accessibilityHint="Opens list, collection, and decorating controls"
              onPress={() => setToolsOpen(true)}
            />
          </View>
          <View
            pointerEvents="box-none"
            style={[
              styles.toolbar,
              styles.toolbarBottom,
              { bottom: insets.bottom },
            ]}
          >
            {compact ? (
              <IconButton
                name="undo"
                label="Undo last decorating change"
                accessibilityHint="Restores the arrangement from before your last change"
                disabled={!canUndo || saving}
                onPress={onUndo}
              />
            ) : (
              <Button
                variant="ghost"
                size="sm"
                icon={
                  <Icon
                    name="undo"
                    size={CONTROL_ICON}
                    color={UI_COLORS.textPrimary}
                  />
                }
                accessibilityLabel="Undo last decorating change"
                accessibilityHint="Restores the arrangement from before your last change"
                disabled={!canUndo || saving}
                onPress={onUndo}
              >
                Undo
              </Button>
            )}
            <Button
              variant="gold"
              size="md"
              icon={
                <Icon
                  name="save"
                  size={CONTROL_ICON}
                  color={UI_COLORS.textPrimary}
                />
              }
              accessibilityLabel="Save Barn"
              accessibilityHint={saveHint}
              disabled={!dirty || saving || offline}
              onPress={onSave}
            >
              {saving ? "Saving…" : "Save"}
            </Button>
          </View>
        </>
      )}
      <Sheet
        open={toolsOpen}
        onClose={() => setToolsOpen(false)}
        title="Decorating actions"
        closeLabel="Close decorating actions"
      >
        <View style={styles.toolList}>
          <Button
            variant="ghost"
            accessibilityLabel="Arrange as list"
            accessibilityHint="Switches to the non-spatial list editor with the same draft"
            onPress={() => {
              setToolsOpen(false);
              setList(true);
            }}
          >
            Arrange as list
          </Button>
          <Button
            variant="ghost"
            accessibilityLabel="Barn collection"
            accessibilityHint="Opens your furnishing collection without discarding this draft"
            onPress={() => {
              setToolsOpen(false);
              navigationTimer.current = setTimeout(
                onOpenCollection,
                POPUP_HANDOFF_GAP_MS,
              );
            }}
          >
            Collection
          </Button>
          {presetAction}
          <Button
            variant="ghost"
            accessibilityLabel="Undo last decorating change"
            accessibilityHint="Restores the arrangement from before your last change"
            disabled={!canUndo || saving}
            onPress={() => {
              setToolsOpen(false);
              onUndo();
            }}
          >
            Undo
          </Button>
          <Button
            variant="gold"
            accessibilityLabel="Save Barn"
            accessibilityHint={saveHint}
            disabled={!dirty || saving || offline}
            onPress={() => {
              setToolsOpen(false);
              onSave();
            }}
          >
            {saveLabel}
          </Button>
          <Button
            variant="link"
            accessibilityLabel="Cancel decorating"
            accessibilityHint="Discards this draft and restores the last saved Barn"
            disabled={saving}
            onPress={() => {
              setToolsOpen(false);
              onCancel();
            }}
          >
            Cancel decorating
          </Button>
        </View>
      </Sheet>
      <Sheet
        open={selected !== null}
        onClose={() => setSelected(null)}
        footer={
          <Button
            variant="ghost"
            full
            accessibilityLabel="Close furniture choices"
            accessibilityHint="Returns to your current decorating draft"
            onPress={() => setSelected(null)}
          >
            Done choosing
          </Button>
        }
      >
        {selected ? (
          <HabitatChoices
            position={selected}
            items={compatible}
            currentId={snapshot.positions[selected]?.id ?? null}
            placedIds={Object.values(snapshot.positions).flatMap((item) =>
              item ? [item.id] : [],
            )}
            onPlace={(i) => {
              onPlace(selected, i);
              setSelected(null);
            }}
            onRemove={() => {
              onRemove(selected);
              setSelected(null);
            }}
            onFindMore={() => {
              const position = selected;
              setSelected(null);
              navigationTimer.current = setTimeout(
                () => onFindMore(position),
                POPUP_HANDOFF_GAP_MS,
              );
            }}
            newItemIds={newItemIds}
            disabled={saving}
          />
        ) : null}
      </Sheet>
    </View>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1 },
  list: { padding: SPACE.md, paddingBottom: SPACE.xl },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACE.sm,
    justifyContent: "center",
    backgroundColor: UI_COLORS.surface,
    padding: SPACE.sm,
    borderTopWidth: BORDER.ink,
    borderColor: UI_COLORS.border,
  },
  // The floating editor chrome: one row pinned under the safe-area top, one
  // above the safe-area bottom. `box-none` keeps the room between the controls
  // tappable.
  toolbar: {
    position: "absolute",
    left: 0,
    right: 0,
    zIndex: 90,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SPACE.sm,
    paddingHorizontal: SPACE.sm,
  },
  toolbarTop: { paddingTop: SPACE.xs },
  toolbarBottom: { paddingBottom: SPACE.sm },
  statusSlot: { flexShrink: 1, maxWidth: STATUS_MAX_WIDTH },
  status: {
    justifyContent: "center",
    paddingHorizontal: SPACE.sm,
    paddingVertical: SPACE.xs,
  },
  toolList: { gap: SPACE.sm },
});
