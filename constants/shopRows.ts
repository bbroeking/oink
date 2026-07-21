// Pure list-row builders for the Shop's Collectibles catalog. Kept in their
// own module (no React / RN / Supabase imports) so the banding logic is unit
// testable in jest without dragging in AsyncStorage et al. shop.tsx imports
// these; the on-screen rendering of each row stays in the component.
import type { HatRow } from "./hats";

// A flat list the FlatList renders. `header` = a rarity divider; `row` = a
// pair of item cards; `section` = a collapsible band banner (members /
// everyone) that wraps a run of rarity sections.
export type ListRow =
	| { type: "header"; key: string; title: string; rarity?: string }
	| { type: "row"; key: string; items: HatRow[] }
	| {
			type: "section";
			key: string;
			band: "members" | "everyone";
			title: string;
			subtitle?: string;
			collapsed: boolean;
			locked: boolean;
	  };

export const RARITY_ORDER: Array<HatRow["rarity"] & string> = [
	"legendary",
	"epic",
	"rare",
	"uncommon",
	"common",
];

export const RARITY_LABELS: Record<string, string> = {
	common: "Common",
	uncommon: "Uncommon",
	rare: "Rare",
	epic: "Epic",
	legendary: "Legendary",
};

// Group items into rarity sections (legendary → common), two cards per row.
// `keyPrefix` namespaces the row keys per band — the Collectibles list renders
// TWO rarity runs (members + everyone) in one FlatList, and unprefixed keys
// collide (`h-legendary` twice → React duplicate-key warning + dropped rows).
export function buildRowsByRarity(items: HatRow[], keyPrefix = ""): ListRow[] {
	const groups: Record<string, HatRow[]> = {};
	for (const i of items) {
		const r = i.rarity ?? "common";
		(groups[r] ??= []).push(i);
	}
	const rows: ListRow[] = [];
	for (const r of RARITY_ORDER) {
		const arr = groups[r];
		if (!arr?.length) continue;
		rows.push({
			type: "header",
			key: `h-${keyPrefix}${r}`,
			title: RARITY_LABELS[r],
			rarity: r,
		});
		for (let i = 0; i < arr.length; i += 2) {
			rows.push({
				type: "row",
				key: `r-${keyPrefix}${r}-${i}`,
				items: arr.slice(i, i + 2),
			});
		}
	}
	return rows;
}

// Collectibles list: Slop Club members-only goods FIRST (collapsible gold
// band), then everything else (collapsible). Both bands keep their internal
// rarity grouping. With NO members items the list is just the plain rarity
// sections (the pre-members behaviour), so nothing changes until the members
// catalog is seeded.
export function buildBrowseRows(
	items: HatRow[],
	collapsed: { members: boolean; everyone: boolean },
	isVip: boolean,
): ListRow[] {
	const members = items.filter((i) => i.members_only);
	const regular = items.filter((i) => !i.members_only);
	const rows: ListRow[] = [];
	if (members.length) {
		rows.push({
			type: "section",
			key: "sec-members",
			band: "members",
			title: "Slop Club Members",
			subtitle: isVip
				? "Your members-only collection"
				: "Members-only — join Slop Club to collect",
			collapsed: collapsed.members,
			locked: !isVip,
		});
		if (!collapsed.members) rows.push(...buildRowsByRarity(members, "m-"));
	}
	if (regular.length) {
		if (members.length) {
			rows.push({
				type: "section",
				key: "sec-everyone",
				band: "everyone",
				title: "Everyone",
				collapsed: collapsed.everyone,
				locked: false,
			});
			if (!collapsed.everyone) rows.push(...buildRowsByRarity(regular, "e-"));
		} else {
			rows.push(...buildRowsByRarity(regular));
		}
	}
	return rows;
}
