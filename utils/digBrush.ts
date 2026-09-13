export type DigActionKind = "rub" | "shove";

export interface BrushPoint {
  x: number;
  y: number;
  t: number;
}

export interface BrushGeometry {
  x?: number;
  y?: number;
  width: number;
  height: number;
  cols: number;
  rows: number;
}

export interface DigBrushAction {
  kind: DigActionKind;
  index: number;
  point: { x: number; y: number };
}

export interface DigBrushState {
  active: boolean;
  cancelled: boolean;
  start: BrushPoint | null;
  last: BrushPoint | null;
  distanceToNextRub: number;
  totalDistance: number;
}

export interface DigBrushOptions {
  rubSpacing: number;
  tapMaxMs: number;
  holdMs: number;
  moveTolerance: number;
}

const DEFAULT_DIG_BRUSH_OPTIONS: DigBrushOptions = {
  rubSpacing: 28,
  tapMaxMs: 250,
  holdMs: 400,
  moveTolerance: 14,
};

export function idleDigBrush(): DigBrushState {
  return {
    active: false,
    cancelled: false,
    start: null,
    last: null,
    distanceToNextRub: DEFAULT_DIG_BRUSH_OPTIONS.rubSpacing,
    totalDistance: 0,
  };
}

export function boardIndexAtPoint(
  point: Pick<BrushPoint, "x" | "y">,
  geometry: BrushGeometry,
): number {
  const left = geometry.x ?? 0;
  const top = geometry.y ?? 0;
  const x = point.x - left;
  const y = point.y - top;
  if (
    geometry.width <= 0 ||
    geometry.height <= 0 ||
    geometry.cols <= 0 ||
    geometry.rows <= 0 ||
    x < 0 ||
    y < 0 ||
    x >= geometry.width ||
    y >= geometry.height
  ) {
    return -1;
  }
  const col = Math.min(
    geometry.cols - 1,
    Math.floor((x / geometry.width) * geometry.cols),
  );
  const row = Math.min(
    geometry.rows - 1,
    Math.floor((y / geometry.height) * geometry.rows),
  );
  return row * geometry.cols + col;
}

export function beginDigBrush(
  point: BrushPoint,
  pointerCount = 1,
  options: DigBrushOptions = DEFAULT_DIG_BRUSH_OPTIONS,
): DigBrushState {
  if (pointerCount !== 1) return { ...idleDigBrush(), cancelled: true };
  return {
    active: true,
    cancelled: false,
    start: point,
    last: point,
    distanceToNextRub: options.rubSpacing,
    totalDistance: 0,
  };
}

function actionAt(
  kind: DigActionKind,
  point: BrushPoint,
  geometry: BrushGeometry,
): DigBrushAction | null {
  const index = boardIndexAtPoint(point, geometry);
  return index < 0 ? null : { kind, index, point: { x: point.x, y: point.y } };
}

export function moveDigBrush(
  state: DigBrushState,
  point: BrushPoint,
  geometry: BrushGeometry,
  pointerCount = 1,
  options: DigBrushOptions = DEFAULT_DIG_BRUSH_OPTIONS,
): { state: DigBrushState; actions: DigBrushAction[] } {
  if (!state.active || state.cancelled || !state.last || pointerCount !== 1) {
    return {
      state: pointerCount === 1 ? state : cancelDigBrush(state),
      actions: [],
    };
  }
  const from = state.last;
  const dx = point.x - from.x;
  const dy = point.y - from.y;
  const segment = Math.hypot(dx, dy);
  if (segment === 0) return { state: { ...state, last: point }, actions: [] };

  const actions: DigBrushAction[] = [];
  let remaining = segment;
  let travelled = 0;
  let toNext = state.distanceToNextRub;
  while (remaining >= toNext) {
    travelled += toNext;
    const ratio = travelled / segment;
    const sample: BrushPoint = {
      x: from.x + dx * ratio,
      y: from.y + dy * ratio,
      t: from.t + (point.t - from.t) * ratio,
    };
    const action = actionAt("rub", sample, geometry);
    if (action) actions.push(action);
    remaining -= toNext;
    toNext = options.rubSpacing;
  }

  return {
    state: {
      ...state,
      last: point,
      totalDistance: state.totalDistance + segment,
      distanceToNextRub: toNext - remaining,
    },
    actions,
  };
}

export function endDigBrush(
  state: DigBrushState,
  point: BrushPoint,
  geometry: BrushGeometry,
  pointerCount = 1,
  options: DigBrushOptions = DEFAULT_DIG_BRUSH_OPTIONS,
): { state: DigBrushState; actions: DigBrushAction[] } {
  if (!state.active || state.cancelled || !state.start || pointerCount !== 1) {
    return { state: idleDigBrush(), actions: [] };
  }
  const elapsed = Math.max(0, point.t - state.start.t);
  const moved = state.totalDistance > options.moveTolerance;
  const kind =
    !moved && elapsed >= options.holdMs
      ? "shove"
      : !moved && elapsed <= options.tapMaxMs
        ? "rub"
        : null;
  const action = kind ? actionAt(kind, point, geometry) : null;
  return { state: idleDigBrush(), actions: action ? [action] : [] };
}

export function cancelDigBrush(_state?: DigBrushState): DigBrushState {
  return { ...idleDigBrush(), cancelled: true };
}
