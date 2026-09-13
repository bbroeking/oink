import { generateBoard, applySplash } from "../utils/rooting";
import { visibleFindCells } from "../utils/livingMud";

describe("Living Mud reveal authority", () => {
  test("cosmetic brushing cannot expose a buried reward", () => {
    const board = generateBoard(42, "milk_tooth");
    expect(visibleFindCells(board, board.layers)).toEqual([]);
  });

  test("only accepted layer changes reveal the seeded board cell", () => {
    const board = generateBoard(42, "milk_tooth");
    const findIndex = board.cells.findIndex(Boolean);
    const layers = [...board.layers];
    while (layers[findIndex] > 0) applySplash(layers, findIndex, "rub");
    expect(visibleFindCells(board, layers)).toContainEqual({
      index: findIndex,
      kind: board.cells[findIndex]!.kind,
      uniqueId:
        board.cells[findIndex]!.kind === "unique" ? board.unique!.id : null,
    });
    expect(board.layers[findIndex]).toBeGreaterThan(0);
  });

  test("preserves unique identity from the authoritative board", () => {
    const board = generateBoard(7, "jam_letter");
    const layers = [...board.layers];
    layers[board.unique!.idx] = 0;
    expect(visibleFindCells(board, layers)).toContainEqual({
      index: board.unique!.idx,
      kind: "unique",
      uniqueId: "jam_letter",
    });
  });
});
