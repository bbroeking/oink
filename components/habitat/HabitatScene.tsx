import React, { type ReactNode, useEffect, useMemo, useState } from "react";
import {
  Animated,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
  type ImageStyle,
  type StyleProp,
} from "react-native";
import {
  HABITAT_CHROME_ASSETS,
  HABITAT_ASSETS,
  HABITAT_DECOR_POSITIONS,
  HABITAT_POSITION_META,
  habitatItemAsset,
  HABITAT_PIG_WIDTH,
} from "@/constants/habitat";
import {
  BORDER,
  RADII,
  SHADOW_SM,
  SPACE,
  TINT,
  TYPE,
  UI_COLORS,
  WHIMSY,
} from "@/constants/theme";
import { Icon } from "@/components/ui/Icon";
import { PigRestingPoseProvider } from "@/components/ui/PigRestingPose";
import { Label } from "@/components/ui/Text";
import type {
  HabitatPlacedItem,
  HabitatPosition,
  HabitatSnapshot,
} from "@/utils/habitat";
import { useMotionPolicy } from "@/hooks/useMotionPolicy";

const DESIGN_WIDTH = 390;
const DESIGN_HEIGHT = 844;
const MIN_TARGET = 44;
// Scene drawing constants — the room is a canvas, so these are measurements of
// the artwork rather than steps on the spacing scale (the PageHeader plaque
// precedent). `PIG_STAGE` is the 300pt frame a caller-supplied pig is authored
// in; `THEME_MARKER_W` is the width of the "Room" capsule; `TOOLBAR_CLEARANCE`
// drops that capsule below the editor's floating toolbar; `EDIT_SLOT_WASH` is
// the pale paper veil that makes an empty decorating spot findable while the
// art still reads through it, and `SELECTED_SLOT_WASH` its sun counterpart.
// Both are veils over artwork, so they sit far below TINT.paperWash (.7) and
// TINT.sunGlow (.5), which are designed to sit on paper. (2026-09-11)
const PIG_STAGE = 300;
// Where the pigs sit, as fractions of the canvas: centre x / y and the drawn
// width. The room is the ONE owner of pig size — a caller hands in a 300pt
// stage at 1:1 and never pre-shrinks it (the visit's TapPig used to, and the
// two scales compounded into a 60pt pig on a 390pt room, 2026-09-15). The
// host is the subject, a shade larger; alone (the owner's room) it sits just
// off centre, and with a guest the pair moves to either side of the middle,
// close enough to be facing each other across it: 86 + 70 = the 156pt
// between their centres, and the three-quarter facing sprites are narrower
// than that.
// The host's width is `HABITAT_PIG_WIDTH`, the unit the decorating spots are
// sized in (constants/habitat), so furniture scales with her.
const PIG_SPOTS = {
  visitor: { x: .30, y: .69, w: .36 },
  host: { x: .70, y: .69, w: HABITAT_PIG_WIDTH },
  owner: { x: .52, y: .69, w: HABITAT_PIG_WIDTH },
} as const;
const THEME_MARKER_W = 80;
const TOOLBAR_CLEARANCE = 56;
const EDIT_SLOT_WASH = "rgba(255,250,240,0.14)";
const SELECTED_SLOT_WASH = "rgba(255,216,122,0.2)";
// The mark inside a decorating spot's control: one step below the 22pt Icon
// scale so it reads as an affordance on the art, not as a button.
const CONTROL_MARK = 16;
// The Shelf spot's plank: drawn under whatever sits on the spot (and while
// decorating, so the empty spot reads as a shelf). Sized off the spot's box —
// a hair wider than it, its top edge just under the box's floor so a set-down
// object stands on it — and drawn from the keyed plank's own aspect.
const SHELF_PLANK_W = 1.35;
const SHELF_PLANK_ASPECT = 279 / 1428;
const SHELF_PLANK_RISE = 6;
// Centers of the blank plaques in the authored square keepsake sprites.
const KEEPSAKE_PLAQUE_Y: Record<string, number> = {
  wallow_keepsake_bronze: .825,
  wallow_keepsake_silver: .775,
  wallow_keepsake_gold: .815,
  wallow_keepsake_celestial: .82,
};

/** Alignment of the authored room when cover scaling crops its viewport. */
export type HabitatSceneAnchor = "center" | "bottom";

export type HabitatSceneProps = {
  snapshot: HabitatSnapshot;
  anchor?: HabitatSceneAnchor;
  hostPig?: ReactNode;
  visitorPig?: ReactNode;
  onInspect?: (item: HabitatPlacedItem) => void;
  editing?: boolean;
  selectedPosition?: HabitatPosition;
  /** Safe-area top inset when the scene sits behind a floating editor toolbar. */
  controlInsetTop?: number;
  onSelectPosition?: (position: HabitatPosition) => void;
  /** An owner-only interactive cabinet adapter. Omit for the quiet fixed cabinet. */
  cabinet?: ReactNode;
  testID?: string;
};

type Size = { width: number; height: number };

function HabitatImage({ source, style, resizeMode = "contain", accessibilityLabel, testID, onSettled }: {
  source: ReturnType<typeof habitatItemAsset>;
  style: StyleProp<ImageStyle>;
  resizeMode?: "contain" | "cover";
  accessibilityLabel?: string;
  testID?: string;
  onSettled?: () => void;
}) {
  const [failedSource, setFailedSource] = useState<typeof source>();
  const failed = failedSource === source;
  return <Image source={failed ? HABITAT_CHROME_ASSETS.missingItem : source} style={style} resizeMode={resizeMode} accessible={!!accessibilityLabel} accessibilityLabel={accessibilityLabel} testID={testID} onLoadEnd={onSettled} onError={() => { console.error(`[habitat] Failed to load art for ${testID ?? "item"}`); setFailedSource(source); }} />;
}

function HabitatPositionLayer({ position, placed, canvas, editing, selected, wallowRank, onSelectPosition, onInspect, onSettled }: {
  position: Exclude<HabitatPosition, "interior_background">;
  placed: HabitatPlacedItem | null;
  canvas: Size;
  editing: boolean;
  selected: boolean;
  wallowRank?: number;
  onSelectPosition?: (position: HabitatPosition) => void;
  onInspect?: (item: HabitatPlacedItem) => void;
  onSettled: () => void;
}) {
  const policy = useMotionPolicy();
  const [flourish] = useState(() => new Animated.Value(1));
  const meta = HABITAT_POSITION_META[position];
  const rect = habitatRect(position, canvas);
  const plaqueY = placed ? KEEPSAKE_PLAQUE_Y[placed.id] : undefined;
  const rank = plaqueY !== undefined && wallowRank !== undefined ? wallowRank : null;
  const artSize = Math.min(rect.width, rect.height);
  useEffect(() => {
    if (!selected || policy.reduceMotion) {
      flourish.setValue(1);
      return;
    }
    flourish.setValue(.94);
    const animation = Animated.timing(flourish, { toValue: 1, duration: 160, useNativeDriver: true });
    animation.start();
    return () => animation.stop();
  }, [flourish, policy.reduceMotion, selected]);

  if (!placed && !editing) return null;
  const plankW = rect.width * SHELF_PLANK_W;
  const plankH = plankW * SHELF_PLANK_ASPECT;
  // The set-down object is contain-fitted and centred in its box; the plank's
  // top edge meets the object's own floor, not the box's.
  const placedArt = placed ? Image.resolveAssetSource(habitatItemAsset(placed.assetKey)) : null;
  const placedH = placedArt?.width && placedArt.height ? Math.min(rect.height, (rect.width * placedArt.height) / placedArt.width) : rect.height;
  const plankTop = rect.top + (rect.height + placedH) / 2 - SHELF_PLANK_RISE;
  return <>
    {position === "surface" && (
      <Image
        source={HABITAT_CHROME_ASSETS.shelfPlank}
        style={[styles.shelfPlank, { left: rect.left + (rect.width - plankW) / 2, top: plankTop, width: plankW, height: plankH, zIndex: meta.layer - 1 }]}
        resizeMode="contain"
        accessible={false}
        testID="habitat-shelf-plank"
      />
    )}
    <Animated.View pointerEvents="none" style={[styles.positionArt, rect, { zIndex: meta.layer, transform: [{ scale: flourish }] }, editing && styles.editPosition, selected && styles.selectedPosition]}>
      {placed && <HabitatImage source={habitatItemAsset(placed.assetKey)} style={styles.itemArt} resizeMode="contain" testID={`habitat-item-${placed.id}`} onSettled={onSettled} />}
      {rank !== null && <Text accessible={false} style={[styles.keepsakeRank, { top: (rect.height - artSize) / 2 + artSize * plaqueY! - 8 }]} testID="habitat-keepsake-rank">{rank}</Text>}
    </Animated.View>
    <Pressable
      style={({ pressed }) => [styles.positionControl, { left: rect.left + rect.width / 2 - MIN_TARGET / 2, top: rect.top + rect.height / 2 - MIN_TARGET / 2 }, editing && styles.visibleControl, selected && styles.selectedControl, pressed && styles.pressed]}
      onPress={() => editing ? onSelectPosition?.(position) : placed && onInspect?.(placed)}
      disabled={editing ? !onSelectPosition : !placed || !onInspect}
      accessibilityRole="button"
      accessibilityLabel={placed ? `${meta.label}, ${placed.name}${rank !== null ? `, Wallow Rank ${rank}` : ""}` : `${meta.label}, empty`}
      accessibilityHint={editing ? meta.accessibilityHint : placed ? `Shows the story of ${placed.name}` : undefined}
      accessibilityState={{ selected, disabled: editing ? !onSelectPosition : !placed || !onInspect }}
      testID={`habitat-position-${position}`}
    >
      {editing && <Icon name={placed ? "edit" : "plus"} size={CONTROL_MARK} color={UI_COLORS.textPrimary} />}
    </Pressable>
  </>;
}

export function resolveHabitatCanvas(available: Size): Size {
  // Fill the scene viewport while preserving the authored room proportions.
  // A contained canvas exposes the frame whenever a device differs from the
  // 390 x 844 design ratio, which reads as a pale border around the saved Barn.
  const width = Math.max(available.width, (available.height * DESIGN_WIDTH) / DESIGN_HEIGHT);
  return { width, height: (width * DESIGN_HEIGHT) / DESIGN_WIDTH };
}

export function habitatRect(position: HabitatPosition, canvas: Size) {
  const anchor = HABITAT_POSITION_META[position].anchor;
  // A spot's box is measured in pig widths, so it scales with the pig the
  // room draws (one unit for both axes: the pig scales uniformly).
  const pigWidth = canvas.width * HABITAT_PIG_WIDTH;
  const width = Math.max(MIN_TARGET, pigWidth * anchor.width);
  const height = Math.max(MIN_TARGET, pigWidth * anchor.height);
  return {
    left: canvas.width * anchor.x - width / 2,
    top: canvas.height * anchor.y - height / 2,
    width,
    height,
  };
}

export function HabitatScene({
  snapshot,
  anchor = "center",
  hostPig,
  visitorPig,
  onInspect,
  editing = false,
  selectedPosition,
  controlInsetTop,
  onSelectPosition,
  cabinet,
  testID = "habitat-scene",
}: HabitatSceneProps) {
  const [available, setAvailable] = useState<Size>({ width: DESIGN_WIDTH, height: DESIGN_HEIGHT });
  const canvas = useMemo(() => resolveHabitatCanvas(available), [available]);
  const background = snapshot.positions.interior_background;
  const requestedThemeKey = background?.assetKey ?? "warm_plank_barn";
  const themeKey = ["warm_plank_barn", "spring_whitewash", "midnight_rafters"].includes(requestedThemeKey) && HABITAT_ASSETS[requestedThemeKey] ? requestedThemeKey : "warm_plank_barn";
  useEffect(() => {
    if (requestedThemeKey !== themeKey) console.error(`[habitat] Unknown room theme ${requestedThemeKey}; using Warm Plank Barn`);
  }, [requestedThemeKey, themeKey]);
  const requiredAssets = [`theme:${themeKey}`, ...HABITAT_DECOR_POSITIONS.flatMap((position) => snapshot.positions[position] ? [`${position}:${snapshot.positions[position]!.assetKey}`] : [])];
  const [loadedAssets, setLoadedAssets] = useState<Set<string>>(() => new Set());
  const settled = (key: string) => setLoadedAssets((current) => current.has(key) ? current : new Set(current).add(key));
  const ready = requiredAssets.every((key) => loadedAssets.has(key));
  const placedDecor = HABITAT_DECOR_POSITIONS.flatMap((position) => snapshot.positions[position] ? [`${HABITAT_POSITION_META[position].label}: ${snapshot.positions[position]!.name}`] : []);
  const roomSummary = `${background?.name ?? "Warm Plank Barn"}. ${placedDecor.length} of ${HABITAT_DECOR_POSITIONS.length} decorating spots furnished.${placedDecor.length ? ` ${placedDecor.join(". ")}.` : ""}${snapshot.wallowRank !== undefined ? ` Wallow Rank ${snapshot.wallowRank}.` : ""}`;

  const measure = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    if (width > 0 && height > 0) setAvailable({ width, height });
  };

  return (
    <View style={[styles.frame, anchor === "bottom" && styles.frameBottom]} onLayout={measure} testID={testID} accessibilityLabel="Barn Interior">
      <View style={[styles.canvas, canvas]}>
        <Text style={styles.accessibleSummary} accessibilityRole="summary" accessibilityLabel={roomSummary} testID="habitat-room-summary">{roomSummary}</Text>
        <HabitatImage
          source={habitatItemAsset(themeKey)}
          style={{ position: "absolute", left: 0, top: 0, width: canvas.width, height: canvas.height }}
          resizeMode="cover"
          accessibilityLabel={background?.description ?? "Warm plank Barn room"}
          testID="habitat-room-theme"
          onSettled={() => settled(`theme:${themeKey}`)}
        />

        {editing && (
          <Pressable
            style={({ pressed }) => [styles.themeMarker, controlInsetTop !== undefined && { top: controlInsetTop + TOOLBAR_CLEARANCE }, selectedPosition === "interior_background" && styles.selectedPosition, pressed && styles.pressed]}
            onPress={() => onSelectPosition?.("interior_background")}
            disabled={!onSelectPosition}
            accessibilityRole="button"
            accessibilityLabel={`Room, ${background?.name ?? "Warm Plank Barn"}`}
            accessibilityHint={HABITAT_POSITION_META.interior_background.accessibilityHint}
            accessibilityState={{ selected: selectedPosition === "interior_background", disabled: !onSelectPosition }}
            testID="habitat-position-interior_background"
          >
            <Label maxFontSizeMultiplier={1.3}>Room</Label>
          </Pressable>
        )}

        {HABITAT_DECOR_POSITIONS.map((position) => <HabitatPositionLayer key={position} position={position} placed={snapshot.positions[position]} canvas={canvas} editing={editing} selected={selectedPosition === position} wallowRank={snapshot.wallowRank} onSelectPosition={onSelectPosition} onInspect={onInspect} onSettled={() => settled(`${position}:${snapshot.positions[position]!.assetKey}`)} />)}

        {/* Indoors, pigs sit. The room declares the seated rest for every pig
            it stages — the owner's bridged Home presentation, a friend's host,
            a visitor — and PigStage takes it only in place of a standing idle
            (a mood or a reaction still plays). The Exterior never provides a
            pose, so its tickle idle is untouched. */}
        <PigRestingPoseProvider pose="sit">
          <View style={[styles.pigStage, { left: canvas.width * PIG_SPOTS.visitor.x - PIG_STAGE / 2, top: canvas.height * PIG_SPOTS.visitor.y - PIG_STAGE / 2, transform: [{ scale: canvas.width * PIG_SPOTS.visitor.w / PIG_STAGE }] }]} pointerEvents="box-none" testID="habitat-visitor-pig">
            {visitorPig}
          </View>
          <View style={[styles.pigStage, { left: canvas.width * (visitorPig ? PIG_SPOTS.host : PIG_SPOTS.owner).x - PIG_STAGE / 2, top: canvas.height * PIG_SPOTS.host.y - PIG_STAGE / 2, transform: [{ scale: canvas.width * PIG_SPOTS.host.w / PIG_STAGE }] }]} pointerEvents="box-none" testID="habitat-host-pig">
            {hostPig}
          </View>
        </PigRestingPoseProvider>

        <View style={styles.cabinet} testID="habitat-workshop-cabinet">
          {cabinet}
        </View>
        {!ready && <View style={styles.loadingVeil} pointerEvents="none" testID="habitat-art-loading" />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { flex: 1, alignItems: "center", justifyContent: "center", overflow: "hidden", backgroundColor: WHIMSY.cream2 },
  // Bottom-anchored: the floor meets the stage's bottom edge and the frame
  // paints nothing, so whatever sits behind the scene owns the leftover.
  frameBottom: { justifyContent: "flex-end", backgroundColor: "transparent" },
  canvas: { position: "relative", overflow: "hidden", backgroundColor: WHIMSY.cream },
  positionArt: { position: "absolute", alignItems: "center", justifyContent: "center" },
  positionControl: { position: "absolute", zIndex: 80, width: MIN_TARGET, height: MIN_TARGET, borderRadius: MIN_TARGET / 2, alignItems: "center", justifyContent: "center" },
  visibleControl: { backgroundColor: TINT.paperWash, borderWidth: BORDER.ink, borderColor: WHIMSY.ink, ...SHADOW_SM },
  selectedControl: { borderColor: WHIMSY.sun, backgroundColor: WHIMSY.paper },
  themeMarker: { position: "absolute", left: 12, top: 12, zIndex: 80, width: THEME_MARKER_W, height: MIN_TARGET, paddingHorizontal: SPACE.sm, alignItems: "center", justifyContent: "center", borderRadius: RADII.xxl, borderWidth: BORDER.ink, borderColor: WHIMSY.ink, backgroundColor: WHIMSY.paper, ...SHADOW_SM },
  itemArt: { width: "100%", height: "100%" },
  keepsakeRank: { ...TYPE.label, color: WHIMSY.ink, position: "absolute", textAlign: "center", width: "100%" },
  editPosition: { borderWidth: BORDER.ink, borderColor: WHIMSY.paper, borderStyle: "dashed", borderRadius: RADII.lg, backgroundColor: EDIT_SLOT_WASH },
  selectedPosition: { borderColor: WHIMSY.sun, borderStyle: "solid", backgroundColor: SELECTED_SLOT_WASH },
  pressed: { transform: [{ scale: .97 }] },
  pigStage: { position: "absolute", width: PIG_STAGE, height: PIG_STAGE, zIndex: 50 },
  shelfPlank: { position: "absolute" },
  cabinet: { position: "absolute", width: "21%", height: "24%", right: "2%", top: "40%", zIndex: 55, alignItems: "stretch", justifyContent: "flex-end" },
  loadingVeil: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, zIndex: 100, backgroundColor: WHIMSY.cream },
  accessibleSummary: { position: "absolute", left: 0, top: 0, width: 1, height: 1, overflow: "hidden", color: "transparent" },
});
