import type { Find, PatchBoard } from "@/utils/rooting";

export interface VisibleFindCell {
  index: number;
  kind: Find;
  uniqueId: string | null;
}

/** Reward visibility is derived only from accepted board depth. Brush pixels
 * are deliberately absent from this interface, so cosmetic trails cannot
 * expose or mint a find. */
export function visibleFindCells(
  board: PatchBoard,
  layers: readonly number[],
): VisibleFindCell[] {
  const visible: VisibleFindCell[] = [];
  for (let index = 0; index < board.cells.length; index++) {
    const cell = board.cells[index];
    if (!cell || (layers[index] ?? Infinity) > 0) continue;
    visible.push({
      index,
      kind: cell.kind,
      uniqueId: cell.kind === "unique" ? (board.unique?.id ?? null) : null,
    });
  }
  return visible;
}
