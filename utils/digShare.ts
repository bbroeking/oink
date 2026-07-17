// Dig-receipt text-grid share (wedge 5b — docs/wedge-plan.md §Phase 1, spec 09).
//
// Turns a finished dig into the compact, spoiler-light text block the player
// hands to the native share sheet (or copies), e.g.
//
//   tickle the pig · feeding #402
//   🟫🟫✨🍄🟫
//   ✨🟫👑🟫🟫
//   4 finds in 19 digs
//   ticklethepig.com
//
// EMOJI LIVE HERE ONLY: this is outbound MESSAGE content, not app chrome — the
// UI emoji ban (CLAUDE.md + taste standard) still stands everywhere else. The
// pure builders below take the dig's board + final layer depths + claimed finds
// and never touch React/Share, so they unit-test as plain data → text.
//
// SPOILER-LIGHT CONTRACT: the grid shows ONLY the player's own DUG tiles —
// undug tiles are omitted entirely (never a coordinate of undug board content),
// and only the sweet finds carry a shape (truffle/shimmer/relic); stones, junk
// and plain mud all read as 🟫 so nothing about the buried layout leaks. Truffle
// CLUSTERS collapse to a single 🍄 (a multi-tile truffle is one find, as the
// receipt counts it), so the grid's find-emoji count equals the "N finds" stat.

import { PATCH_COLS } from "@/constants/dig";
import type { Find, PatchBoard } from "@/utils/rooting";

// The grid's shape vocabulary: the three sweet finds + mud (the catch-all for
// every dug-but-dull tile — empty mud, stones, junk, and truffle pieces the
// player scratched but never claimed).
export type ShareCell = "truffle" | "shimmer" | "unique" | "mud";

const SHARE_EMOJI: Record<ShareCell, string> = {
	truffle: "🍄",
	shimmer: "✨",
	unique: "👑",
	mud: "🟫",
};

// Compact texty row width for the shared grid — matches the founder-approved
// mock (a 5-wide block reads cleanly in a message bubble), NOT the board's
// 6-wide geometry: the grid is a spoiler-light sequence of dug tiles, not a
// board map, so it needn't echo PATCH_COLS.
const GRID_COLS = 5;

const SHARE_FOOTER_URL = "ticklethepig.com";

export interface DigShareData {
	/** The feeding/window number (session.windowIndex) — comparable across a herd. */
	feedingNumber: number;
	/** The dug-tile grid cells, row-major, clusters collapsed, undug omitted. */
	cells: ShareCell[];
	/** Dug tiles (layers[i] <= 0) — the "digs" stat. */
	digs: number;
	/** Claimed sweet finds — the "finds" stat (== count of shaped grid cells). */
	finds: number;
}

/**
 * Reduce a finished dig (its board, the FINAL layer depths, and the finds the
 * player actually claimed) into the spoiler-light share data. Pure + read-only
 * over the parity-locked board — it never mutates board contents.
 */
export function digShareData(
	board: PatchBoard,
	layers: number[],
	collected: Iterable<Find>,
	feedingNumber: number
): DigShareData {
	const claimed = new Set<Find>(collected);
	const gotL = claimed.has("truffle_l");
	const gotD = claimed.has("truffle_d");
	// Cluster collapse: emit the single 🍄 at the cluster's FIRST (lowest-index)
	// tile; its other tiles are dropped so a multi-tile truffle reads as one find.
	const inL = new Set(board.truffleL);
	const inD = new Set(board.truffleD);
	const firstL = board.truffleL.length ? Math.min(...board.truffleL) : -1;
	const firstD = board.truffleD.length ? Math.min(...board.truffleD) : -1;

	const cells: ShareCell[] = [];
	let digs = 0;
	for (let i = 0; i < layers.length; i++) {
		if (layers[i] > 0) continue; // undug — omitted (spoiler-light)
		digs++;
		if (inL.has(i)) {
			if (gotL && i === firstL) cells.push("truffle");
			else if (!gotL) cells.push("mud"); // scratched but never claimed → mud
			// claimed but a non-first cluster tile → collapsed away (no cell)
			continue;
		}
		if (inD.has(i)) {
			if (gotD && i === firstD) cells.push("truffle");
			else if (!gotD) cells.push("mud");
			continue;
		}
		const cell = board.cells[i];
		if (cell?.kind === "shimmer" && claimed.has("shimmer")) cells.push("shimmer");
		else if (cell?.kind === "unique" && claimed.has("unique")) cells.push("unique");
		else cells.push("mud"); // empty mud, stone, junk, or an unclaimed single find
	}

	// The "finds" stat IS the shaped-cell count — each claimed sweet find yields
	// exactly one shape (a cluster collapses to one 🍄), so the brag number and
	// the grid can never disagree.
	const finds = cells.reduce((n, c) => (c === "mud" ? n : n + 1), 0);

	return { feedingNumber, cells, digs, finds };
}

/**
 * The outbound text block — header · grid · comparable count · footer link.
 * Pure: data in, string out. The unit-tested core of the share.
 */
export function buildDigShareText(data: DigShareData): string {
	const rows: string[] = [];
	for (let i = 0; i < data.cells.length; i += GRID_COLS) {
		rows.push(
			data.cells
				.slice(i, i + GRID_COLS)
				.map((c) => SHARE_EMOJI[c])
				.join("")
		);
	}
	const findWord = data.finds === 1 ? "find" : "finds";
	const digWord = data.digs === 1 ? "dig" : "digs";
	return [
		`tickle the pig · feeding #${data.feedingNumber}`,
		rows.join("\n"),
		`${data.finds} ${findWord} in ${data.digs} ${digWord}`,
		SHARE_FOOTER_URL,
	]
		.filter((line) => line.length > 0) // a dig with zero dug tiles has no grid
		.join("\n");
}

// ── Measurement (fire-and-forget, fail-soft) ─────────────────────────────────
// Count share-affordance taps. No analytics lane exists in the app, so this is
// the sanctioned fallback: a fail-soft RPC counter behind an AUTHORED-but-
// UNPUSHED migration (20260749000000_dig_share_count). rpc() maps the missing
// function (PGRST202, migration not yet pushed) to null — a warn breadcrumb, no
// error — so the share works fully offline / against today's prod. Never awaited
// by the UI; a rejected promise is swallowed here too. rpc() is LAZY-required so
// this file's pure text builders don't drag the supabase/AsyncStorage import
// chain into unit tests (or any other pure consumer).
export function bumpDigShareCount(): void {
	try {
		const { rpc } = require("@/utils/rpc") as typeof import("@/utils/rpc");
		void rpc("bump_dig_share_count").catch(() => {});
	} catch {
		// fail-soft — measurement must never block or break the share.
	}
}
