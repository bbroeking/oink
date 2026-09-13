import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AppState,
  Image,
  PanResponder,
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import {
  Canvas,
  Circle,
  Group,
  Image as SkiaImage,
  Path,
  Skia,
  useImage,
} from "@shopify/react-native-skia";
import { PATCH_COLS, PATCH_ROWS } from "@/constants/dig";
import { DIG_TILE, TAP_MIN, WHIMSY } from "@/constants/theme";
import { HAT_IMAGES } from "@/constants/hats";
import { UNIQUE_IMAGES } from "@/constants/uniques";
import { clusterBox, type Find, type PatchBoard } from "@/utils/rooting";
import {
  beginDigBrush,
  cancelDigBrush,
  endDigBrush,
  idleDigBrush,
  moveDigBrush,
  type BrushGeometry,
  type DigBrushAction,
} from "@/utils/digBrush";
import { visibleFindCells } from "@/utils/livingMud";

const TOTAL = PATCH_COLS * PATCH_ROWS;
const TRAIL_LIMIT = 24;
const TRAIL_RADIUS = 13;
const MUD_TEXTURE = require("../../assets/images/patch/living-mud/mud-texture.png");

const FIND_LABEL: Record<Find, string> = {
  truffle_l: "Golden Truffle",
  truffle_d: "Golden Truffle",
  shimmer: "Shimmer pocket",
  stone: "Stone",
  junk_boot: "Old boot",
  junk_wrap: "Licked wrapper",
  unique: "Relic",
};

const FIND_ART = {
  truffle: HAT_IMAGES.golden_truffle,
  shimmer: require("../../assets/images/tickle-particles/bubble.png"),
  stone: require("../../assets/images/patch/stone.png"),
  junk_boot: require("../../assets/images/uniques/old_boot.png"),
  junk_wrap: require("../../assets/images/uniques/licked_wrapper.png"),
} as const;

function findSource(kind: Find, uniqueId: string | null): number | null {
  if (kind === "unique")
    return uniqueId ? (UNIQUE_IMAGES[uniqueId] ?? null) : null;
  if (kind === "truffle_l" || kind === "truffle_d") return FIND_ART.truffle;
  if (kind === "shimmer") return FIND_ART.shimmer;
  if (kind === "stone") return FIND_ART.stone;
  return FIND_ART[kind];
}

export interface LivingMudSurfaceProps {
  board: PatchBoard;
  layers: number[];
  collected: readonly Find[];
  disabled: boolean;
  reduceMotion: boolean;
  onAction: (action: DigBrushAction) => void;
  aspectRatio?: number;
  gildedIndices?: readonly number[];
  gildSilhouetteDepth?: number;
  onInteractionChange?: (active: boolean) => void;
  style?: StyleProp<ViewStyle>;
}

export function LivingMudSurface({
  board,
  layers,
  collected,
  disabled,
  reduceMotion,
  onAction,
  aspectRatio = PATCH_COLS / PATCH_ROWS,
  gildedIndices = [],
  gildSilhouetteDepth = 1,
  onInteractionChange,
  style,
}: LivingMudSurfaceProps) {
  const mudTexture = useImage(MUD_TEXTURE);
  const [geometry, setGeometry] = useState<BrushGeometry>({
    width: 0,
    height: 0,
    cols: PATCH_COLS,
    rows: PATCH_ROWS,
  });
  const [trail, setTrail] = useState<{ x: number; y: number; id: number }[]>(
    [],
  );
  const gesture = useRef(idleDigBrush());
  const nextTrailId = useRef(0);
  const disabledRef = useRef(disabled);
  const reduceMotionRef = useRef(reduceMotion);
  const geometryRef = useRef(geometry);
  const onActionRef = useRef(onAction);
  const onInteractionChangeRef = useRef(onInteractionChange);
  disabledRef.current = disabled;
  reduceMotionRef.current = reduceMotion;
  geometryRef.current = geometry;
  onActionRef.current = onAction;
  onInteractionChangeRef.current = onInteractionChange;

  const resetGesture = () => {
    gesture.current = cancelDigBrush(gesture.current);
    setTrail([]);
    onInteractionChangeRef.current?.(false);
  };

  useEffect(() => {
    if (disabled) resetGesture();
  }, [disabled]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state !== "active") resetGesture();
    });
    return () => {
      sub.remove();
      onInteractionChangeRef.current?.(false);
    };
  }, []);

  const emit = (actions: DigBrushAction[]) => {
    if (disabledRef.current) return;
    actions.forEach((action) => onActionRef.current(action));
  };

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !disabledRef.current,
      onMoveShouldSetPanResponder: () => !disabledRef.current,
      onPanResponderGrant: (event) => {
        const { locationX: x, locationY: y, touches } = event.nativeEvent;
        gesture.current = beginDigBrush(
          { x, y, t: Date.now() },
          touches?.length ?? 1,
        );
        onInteractionChangeRef.current?.(
          gesture.current.active && !gesture.current.cancelled,
        );
      },
      onPanResponderMove: (event) => {
        if (disabledRef.current) return;
        const { locationX: x, locationY: y, touches } = event.nativeEvent;
        const moved = moveDigBrush(
          gesture.current,
          { x, y, t: Date.now() },
          geometryRef.current,
          touches?.length ?? 1,
        );
        gesture.current = moved.state;
        emit(moved.actions);
        if (
          !reduceMotionRef.current &&
          moved.state.active &&
          !moved.state.cancelled
        ) {
          setTrail((current) => [
            ...current.slice(-(TRAIL_LIMIT - 1)),
            { x, y, id: nextTrailId.current++ },
          ]);
        }
      },
      onPanResponderRelease: (event) => {
        const { locationX: x, locationY: y } = event.nativeEvent;
        const ended = endDigBrush(
          gesture.current,
          { x, y, t: Date.now() },
          geometryRef.current,
          1,
        );
        gesture.current = ended.state;
        emit(ended.actions);
        setTrail([]);
        onInteractionChangeRef.current?.(false);
      },
      onPanResponderTerminate: resetGesture,
      onPanResponderTerminationRequest: () => true,
    }),
  ).current;

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    resetGesture();
    setGeometry({ width, height, cols: PATCH_COLS, rows: PATCH_ROWS });
  };

  const patchPath = useMemo(() => {
    const { width, height } = geometry;
    const path = Skia.Path.Make();
    if (width <= 0 || height <= 0) return path;
    path.moveTo(width * 0.04, height * 0.12);
    path.cubicTo(
      width * 0.18,
      0,
      width * 0.78,
      height * 0.02,
      width * 0.94,
      height * 0.13,
    );
    path.cubicTo(
      width,
      height * 0.3,
      width * 0.98,
      height * 0.78,
      width * 0.9,
      height * 0.92,
    );
    path.cubicTo(
      width * 0.68,
      height,
      width * 0.2,
      height,
      width * 0.06,
      height * 0.88,
    );
    path.cubicTo(
      0,
      height * 0.68,
      0,
      height * 0.3,
      width * 0.04,
      height * 0.12,
    );
    path.close();
    return path;
  }, [geometry]);

  const visible = visibleFindCells(board, layers);
  const cellW = geometry.width / PATCH_COLS;
  const cellH = geometry.height / PATCH_ROWS;
  const cellPatches = useMemo(
    () =>
      Array.from({ length: TOTAL }, (_, index) => {
        const row = Math.floor(index / PATCH_COLS);
        const col = index % PATCH_COLS;
        const cx = (col + 0.5) * cellW;
        const cy = (row + 0.5) * cellH;
        const rx = cellW * (0.69 + ((index * 7) % 5) * 0.018);
        const ry = cellH * (0.69 + ((index * 11) % 5) * 0.016);
        const path = Skia.Path.Make();
        path.moveTo(cx - rx, cy - ry * 0.08);
        path.cubicTo(
          cx - rx * 0.94,
          cy - ry,
          cx - rx * 0.26,
          cy - ry,
          cx,
          cy - ry * 0.92,
        );
        path.cubicTo(
          cx + rx * 0.72,
          cy - ry,
          cx + rx,
          cy - ry * 0.34,
          cx + rx * 0.94,
          cy,
        );
        path.cubicTo(
          cx + rx,
          cy + ry * 0.72,
          cx + rx * 0.28,
          cy + ry,
          cx,
          cy + ry * 0.92,
        );
        path.cubicTo(
          cx - rx * 0.74,
          cy + ry,
          cx - rx,
          cy + ry * 0.3,
          cx - rx,
          cy - ry * 0.08,
        );
        path.close();
        return path;
      }),
    [cellH, cellW],
  );
  const truffleClusters = [
    { kind: "truffle_l" as const, indices: board.truffleL },
    { kind: "truffle_d" as const, indices: board.truffleD },
  ].flatMap(({ kind, indices }) => {
    if (
      !indices.length ||
      !indices.every((index) => (layers[index] ?? Infinity) <= 0)
    )
      return [];
    const box = clusterBox(indices);
    return box ? [{ kind, box }] : [];
  });

  return (
    <View
      style={[styles.surface, { aspectRatio }, style]}
      onLayout={onLayout}
      testID="living-mud-surface"
      {...pan.panHandlers}
    >
      <Canvas pointerEvents="none" style={StyleSheet.absoluteFill}>
        <Group clip={patchPath}>
          {Array.from({ length: TOTAL }, (_, index) => {
            const depth = layers[index] ?? board.layers[index] ?? 0;
            if (depth <= 0) return null;
            return (
              <Group key={`mud-${index}`} clip={cellPatches[index]}>
                {mudTexture ? (
                  <SkiaImage
                    image={mudTexture}
                    x={0}
                    y={0}
                    width={geometry.width}
                    height={geometry.height}
                    fit="cover"
                  />
                ) : null}
                <Path
                  path={cellPatches[index]}
                  color={
                    DIG_TILE.mud[Math.min(2, Math.max(0, Math.ceil(depth) - 1))]
                  }
                  opacity={mudTexture ? 0.12 + Math.min(depth, 3) * 0.035 : 1}
                />
              </Group>
            );
          })}
          {trail.map((point, index) => (
            <Circle
              key={point.id}
              cx={point.x}
              cy={point.y}
              r={TRAIL_RADIUS}
              color={DIG_TILE.mud[0]}
              opacity={(index + 1) / (trail.length + 2)}
            />
          ))}
          {board.cells.map((cell, index) => {
            const depth = layers[index] ?? board.layers[index] ?? 0;
            const gilded = gildedIndices.includes(index);
            const threshold = gilded ? gildSilhouetteDepth : 1;
            if (!cell || depth <= 0 || depth > threshold) return null;
            const row = Math.floor(index / PATCH_COLS);
            const col = index % PATCH_COLS;
            return (
              <Circle
                key={`silhouette-${index}`}
                cx={col * cellW + cellW / 2}
                cy={row * cellH + cellH / 2}
                r={Math.min(cellW, cellH) * 0.22}
                color={gilded ? DIG_TILE.uniqueEdge : DIG_TILE.silhouette}
              />
            );
          })}
        </Group>
        <Path
          path={patchPath}
          style="stroke"
          strokeWidth={2}
          color={WHIMSY.ink}
        />
      </Canvas>

      {visible
        .filter(({ kind }) => kind !== "truffle_l" && kind !== "truffle_d")
        .map(({ index, kind, uniqueId }) => {
          const source = findSource(kind, uniqueId);
          if (!source) return null;
          const row = Math.floor(index / PATCH_COLS);
          const col = index % PATCH_COLS;
          return (
            <Image
              key={`find-${index}`}
              source={source}
              resizeMode="contain"
              accessibilityIgnoresInvertColors
              style={[
                styles.find,
                {
                  left: col * cellW,
                  top: row * cellH,
                  width: cellW,
                  height: cellH,
                },
                collected.includes(kind) && styles.collectedFind,
              ]}
            />
          );
        })}
      {truffleClusters.map(({ kind, box }) => {
        const side = Math.min(cellW, cellH) * 1.45;
        return (
          <Image
            key={`cluster-${kind}`}
            source={FIND_ART.truffle}
            resizeMode="contain"
            accessibilityIgnoresInvertColors
            style={[
              styles.find,
              styles.clusterFind,
              {
                left: box.cx * cellW - side / 2,
                top: box.cy * cellH - side / 2,
                width: side,
                height: side,
              },
              collected.includes(kind) && styles.collectedFind,
            ]}
          />
        );
      })}

      <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
        {Array.from({ length: TOTAL }, (_, index) => {
          const row = Math.floor(index / PATCH_COLS);
          const col = index % PATCH_COLS;
          const cell = board.cells[index];
          const depth = layers[index] ?? board.layers[index] ?? 0;
          const revealed = depth <= 0;
          const label = revealed
            ? cell
              ? `Patch spot, ${FIND_LABEL[cell.kind]}`
              : "Patch spot, cleared mud"
            : "Patch spot, buried in mud";
          return (
            <View
              key={`target-${index}`}
              accessible
              accessibilityRole={!disabled && !revealed ? "button" : "text"}
              accessibilityLabel={label}
              accessibilityHint={
                !disabled && !revealed
                  ? "Double tap to rub quietly. Use the actions rotor to snout shove."
                  : undefined
              }
              accessibilityValue={
                !disabled && !revealed
                  ? {
                      text: `${depth} ${depth === 1 ? "layer" : "layers"} of mud`,
                    }
                  : undefined
              }
              accessibilityState={disabled ? { disabled: true } : undefined}
              accessibilityActions={
                !disabled && !revealed
                  ? [
                      { name: "activate", label: "Rub quietly" },
                      { name: "shove", label: "Snout shove" },
                    ]
                  : undefined
              }
              onAccessibilityAction={
                !disabled && !revealed
                  ? (event) => {
                      const kind =
                        event.nativeEvent.actionName === "shove"
                          ? "shove"
                          : "rub";
                      onAction({
                        kind,
                        index,
                        point: {
                          x: col * cellW + cellW / 2,
                          y: row * cellH + cellH / 2,
                        },
                      });
                    }
                  : undefined
              }
              style={{
                position: "absolute",
                left: `${(col / PATCH_COLS) * 100}%`,
                top: `${(row / PATCH_ROWS) * 100}%`,
                width: `${100 / PATCH_COLS}%`,
                height: `${100 / PATCH_ROWS}%`,
                minWidth: TAP_MIN,
                minHeight: TAP_MIN,
              }}
            />
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  surface: {
    position: "relative",
    width: "100%",
    minWidth: PATCH_COLS * TAP_MIN,
    overflow: "hidden",
  },
  find: { position: "absolute" },
  clusterFind: { zIndex: 1 },
  collectedFind: { transform: [{ scale: 1.08 }] },
});
