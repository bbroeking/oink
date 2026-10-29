import type { SeasonalCardManifest } from "../domain/seasonalUnlocks";
import { validateSeasonalCardManifest } from "../domain/seasonalUnlocks";
import halloweenDraft from "../../../docs/design/halloween-2026/content.json";

/**
 * Dark draft. `docs/design/halloween-2026/content.json` remains the content
 * handoff; mappings stay empty until every referenced item is registered in
 * the production catalog with shippable art and dates are accepted.
 */
export const HALLOWEEN_2026_CARD_MANIFEST = validateSeasonalCardManifest({
	setKey: "halloween_2026_v1",
	name: "Spooky Snouts",
	mappingVersion: 1,
	active: false,
	packCardLimit: 3,
	cards: [],
} satisfies SeasonalCardManifest);

export function halloweenManifestFromDraft(value: unknown): SeasonalCardManifest {
	if (!value || typeof value !== "object") throw new Error("Halloween content draft must be an object");
	const draft = value as { unlockCards?: unknown; wearables?: unknown; backgrounds?: unknown };
	if (!Array.isArray(draft.unlockCards)) throw new Error("Halloween content draft has no unlockCards array");
	const items = [...(Array.isArray(draft.wearables) ? draft.wearables : []), ...(Array.isArray(draft.backgrounds) ? draft.backgrounds : [])];
	const itemIds = new Set(items.flatMap((item) => item && typeof item === "object" && typeof (item as { id?: unknown }).id === "string" ? [(item as { id: string }).id] : []));
	const itemNames = new Map(items.flatMap((item) => item && typeof item === "object" && typeof (item as { id?: unknown }).id === "string" && typeof (item as { name?: unknown }).name === "string" ? [[(item as { id: string }).id, (item as { name: string }).name] as const] : []));
	const cards = draft.unlockCards.map((card) => {
		if (!card || typeof card !== "object") throw new Error("Invalid Halloween card draft");
		const row = card as { id?: unknown; unlocks?: unknown; firstCopyUnlock?: unknown };
		const itemId = typeof row.unlocks === "string" && itemIds.has(row.unlocks) ? row.unlocks : undefined;
		if (!itemId || row.firstCopyUnlock !== true) throw new Error(`Invalid Halloween unlock mapping: ${String(row.id ?? "")}`);
		return { cardId: String(row.id ?? ""), name: itemNames.get(itemId) ?? itemId, itemId, unlockRule: "first_copy" as const };
	});
	return validateSeasonalCardManifest({ ...HALLOWEEN_2026_CARD_MANIFEST, cards });
}

/** Validated draft content for tooling. It remains inactive until launch acceptance. */
export const HALLOWEEN_2026_DRAFT_MANIFEST = halloweenManifestFromDraft(halloweenDraft);
