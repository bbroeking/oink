import {
  beginDigBrush,
  boardIndexAtPoint,
  cancelDigBrush,
  endDigBrush,
  idleDigBrush,
  moveDigBrush,
  type BrushPoint,
} from "../utils/digBrush";

const geometry = { width: 300, height: 250, cols: 6, rows: 5 };
const p = (x: number, y: number, t: number): BrushPoint => ({ x, y, t });

function run(points: BrushPoint[]) {
  let state = beginDigBrush(points[0]);
  const actions = [];
  for (const point of points.slice(1)) {
    const moved = moveDigBrush(state, point, geometry);
    state = moved.state;
    actions.push(...moved.actions);
  }
  return actions;
}

describe("dig brush sampling", () => {
  test("dense and sparse samples of the same trace emit identical rubs", () => {
    const sparse = run([p(10, 50, 0), p(290, 50, 1000)]);
    const dense = run(
      Array.from({ length: 29 }, (_, i) => p(10 + i * 10, 50, i * 36)),
    );
    expect(dense).toEqual(sparse);
    expect(sparse.length).toBe(10);
  });

  test("tap rubs, stationary hold shoves, and movement cancels the hold", () => {
    const tap = endDigBrush(
      beginDigBrush(p(25, 25, 0)),
      p(25, 25, 100),
      geometry,
    );
    expect(tap.actions).toEqual([
      { kind: "rub", index: 0, point: { x: 25, y: 25 } },
    ]);
    const hold = endDigBrush(
      beginDigBrush(p(25, 25, 0)),
      p(25, 25, 500),
      geometry,
    );
    expect(hold.actions[0]?.kind).toBe("shove");
    const moved = moveDigBrush(
      beginDigBrush(p(25, 25, 0)),
      p(80, 25, 300),
      geometry,
    );
    expect(endDigBrush(moved.state, p(80, 25, 500), geometry).actions).toEqual(
      [],
    );
  });

  test("outside, multitouch, cancellation, and invalid geometry emit nothing", () => {
    expect(boardIndexAtPoint(p(-1, 10, 0), geometry)).toBe(-1);
    expect(boardIndexAtPoint(p(10, 10, 0), { ...geometry, width: 0 })).toBe(-1);
    expect(
      endDigBrush(beginDigBrush(p(10, 10, 0), 2), p(10, 10, 500), geometry)
        .actions,
    ).toEqual([]);
    expect(
      endDigBrush(cancelDigBrush(), p(10, 10, 100), geometry).actions,
    ).toEqual([]);
  });

  test("resize reset starts a fresh trace without inventing an action", () => {
    const moved = moveDigBrush(
      beginDigBrush(p(10, 10, 0)),
      p(50, 10, 100),
      geometry,
    );
    expect(moved.actions).toHaveLength(1);
    expect(
      endDigBrush(idleDigBrush(), p(50, 10, 150), { ...geometry, width: 600 })
        .actions,
    ).toEqual([]);
  });

  test("all 30 board cells are reachable through the shared geometry", () => {
    const reached = new Set<number>();
    for (let row = 0; row < 5; row++) {
      for (let col = 0; col < 6; col++) {
        reached.add(
          boardIndexAtPoint(p(col * 50 + 25, row * 50 + 25, 0), geometry),
        );
      }
    }
    expect([...reached].sort((a, b) => a - b)).toEqual(
      Array.from({ length: 30 }, (_, index) => index),
    );
  });
});
