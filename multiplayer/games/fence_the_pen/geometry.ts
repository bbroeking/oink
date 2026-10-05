// Fence the Pen: the board's arithmetic. This is the one piece of maths the
// server, the app's Practice table and the board all have to agree on, so it
// lives here and nowhere else (spec 01-classic-board-games.md §4.2, "Edge
// indexing"). The rules module builds on it; the board imports it to know
// where a fence index sits on the screen.
//
// For a rows × cols grid of pens (posts are the (rows+1) × (cols+1) lattice):
//   horizontal fences h(r, c), r ∈ 0..rows, c ∈ 0..cols-1, index r*cols + c;
//     there are H = (rows + 1) * cols of them;
//   vertical fences v(r, c), r ∈ 0..rows-1, c ∈ 0..cols, index H + r*(cols+1) + c;
//   pen (r, c) has sides h(r, c), h(r+1, c), v(r, c), v(r, c+1), index r*cols + c.
//
// 4×4 pens: 20 horizontal + 20 vertical = 40 fences. 3×3: 12 + 12 = 24.
// Pure functions of plain numbers; relative imports only (multiplayer/ rule).

export interface Grid {
	/** Pens per column (rows of pens). */
	rows: number;
	/** Pens per row (columns of pens). */
	cols: number;
}

/** A fence's place: which way it runs and its (row, col) in that family. */
export interface EdgeAt {
	dir: "h" | "v";
	r: number;
	c: number;
}

/** A post on the lattice, (row, col), both from 0. */
export interface PostAt {
	r: number;
	c: number;
}

/** H: the number of horizontal fences, and the first vertical index. */
export function horizontalCount(g: Grid): number {
	return (g.rows + 1) * g.cols;
}

export function edgeCount(g: Grid): number {
	return horizontalCount(g) + g.rows * (g.cols + 1);
}

export function penCount(g: Grid): number {
	return g.rows * g.cols;
}

/** Index of the horizontal fence h(r, c): r ∈ 0..rows, c ∈ 0..cols-1. */
export function hEdge(g: Grid, r: number, c: number): number {
	return r * g.cols + c;
}

/** Index of the vertical fence v(r, c): r ∈ 0..rows-1, c ∈ 0..cols. */
export function vEdge(g: Grid, r: number, c: number): number {
	return horizontalCount(g) + r * (g.cols + 1) + c;
}

/** Where a fence index sits. The inverse of hEdge / vEdge. */
export function edgeAt(g: Grid, edge: number): EdgeAt {
	const H = horizontalCount(g);
	if (edge < H) return { dir: "h", r: Math.floor(edge / g.cols), c: edge % g.cols };
	const k = edge - H;
	return { dir: "v", r: Math.floor(k / (g.cols + 1)), c: k % (g.cols + 1) };
}

/** The two posts a fence runs between, top/left first. */
export function edgePosts(g: Grid, edge: number): [PostAt, PostAt] {
	const { dir, r, c } = edgeAt(g, edge);
	return dir === "h"
		? [
				{ r, c },
				{ r, c: c + 1 },
			]
		: [
				{ r, c },
				{ r: r + 1, c },
			];
}

/** A pen's four sides, in the order top, bottom, left, right. */
export function penSides(g: Grid, pen: number): [number, number, number, number] {
	const r = Math.floor(pen / g.cols);
	const c = pen % g.cols;
	return [hEdge(g, r, c), hEdge(g, r + 1, c), vEdge(g, r, c), vEdge(g, r, c + 1)];
}

/** The pens a fence is a side of: one on the yard's rim, two inside it. */
export function pensOfEdge(g: Grid, edge: number): number[] {
	const { dir, r, c } = edgeAt(g, edge);
	const out: number[] = [];
	if (dir === "h") {
		if (r > 0) out.push((r - 1) * g.cols + c); // the pen above
		if (r < g.rows) out.push(r * g.cols + c); // the pen below
	} else {
		if (c > 0) out.push(r * g.cols + c - 1); // the pen to the left
		if (c < g.cols) out.push(r * g.cols + c); // the pen to the right
	}
	return out;
}

/** How many of a pen's sides are drawn (0..4). `edges[i] !== 0` is drawn. */
export function sidesDrawn(g: Grid, edges: readonly number[], pen: number): number {
	let n = 0;
	for (const e of penSides(g, pen)) if (edges[e] !== 0) n++;
	return n;
}
