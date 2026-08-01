// Pig roster module — the single client seam for fetching the caller's pigs,
// making their one long-term Slop Club companion choice, and selecting the home pig.
// Server RPCs own authorization and invariants; callers receive parsed state
// and typed action results rather than knowing table or function names.

import { rpc, rpcAction, type RpcResult } from "./rpc";
import { PIGS, isPigId, type PigId } from "./pigs";

export interface RosterPig {
	id: PigId;
	name: string;
	coat: string;
	owned: boolean;
	selected: boolean;
	recruitable: boolean;
}

export interface PigRoster {
	isMember: boolean;
	activePigId: PigId;
	recruitedPigId: PigId | null;
	pigs: RosterPig[];
}

interface RawRosterPig {
	id?: unknown;
	name?: unknown;
	coat?: unknown;
	owned?: unknown;
	selected?: unknown;
	recruitable?: unknown;
}

interface RawPigRoster {
	is_member?: unknown;
	active_pig_id?: unknown;
	recruited_pig_id?: unknown;
	pigs?: unknown;
}

export const DEFAULT_PIG_ROSTER: PigRoster = {
	isMember: false,
	activePigId: "rosie",
	recruitedPigId: null,
	pigs: PIGS.map((pig) => ({
		id: pig.id,
		name: pig.name,
		coat: pig.coat,
		owned: pig.id === "rosie",
		selected: pig.id === "rosie",
		recruitable: false,
	})),
};

export function parsePigRoster(raw: unknown): PigRoster {
	if (!raw || typeof raw !== "object") return DEFAULT_PIG_ROSTER;
	const value = raw as RawPigRoster;
	const isMember = value.is_member === true;
	const activePigId =
		isPigId(value.active_pig_id) && (isMember || value.active_pig_id === "rosie")
			? value.active_pig_id
			: "rosie";
	const recruitedPigId =
		isPigId(value.recruited_pig_id) && value.recruited_pig_id !== "rosie"
			? value.recruited_pig_id
			: null;
	const rawPigs = Array.isArray(value.pigs) ? (value.pigs as RawRosterPig[]) : [];
	const byId = new Map(
		rawPigs.filter((pig) => isPigId(pig.id)).map((pig) => [pig.id as PigId, pig])
	);

	return {
		isMember,
		activePigId,
		recruitedPigId,
		pigs: PIGS.map((definition) => {
			const pig = byId.get(definition.id);
			const owned = definition.id === "rosie" || pig?.owned === true;
			return {
				id: definition.id,
				name: typeof pig?.name === "string" ? pig.name : definition.name,
				coat: typeof pig?.coat === "string" ? pig.coat : definition.coat,
				owned,
				selected: owned && definition.id === activePigId,
				recruitable:
					!owned &&
					isMember &&
					recruitedPigId === null &&
					pig?.recruitable === true,
			};
		}),
	};
}

export async function fetchPigRoster(): Promise<PigRoster> {
	return parsePigRoster(await rpc<RawPigRoster>("pig_roster"));
}

export function recruitPig(pigId: PigId) {
	return rpcAction<{ pig_id: PigId }>("recruit_pig", {
		target_pig_id: pigId,
	});
}

export function activatePig(pigId: PigId) {
	return rpcAction<{ pig_id: PigId }>("activate_pig", {
		target_pig_id: pigId,
	});
}

export function pigRosterActionMessage(result: RpcResult<{ pig_id: PigId }>): string {
	if (result.ok) return "Your pig is ready at home.";
	switch (result.reason) {
		case "membership_required":
			return "An active Slop Club membership is needed for a second pig.";
		case "roster_full":
			return "Your companion choice is locked for now.";
		case "not_owned":
			return "Recruit this pig before putting them at home.";
		case "default_pig":
			return "Rosie already comes home with everyone.";
		case "unknown_pig":
			return "That pig isn't available yet.";
		case "network":
		case "no_data":
			return "The roster couldn't be reached. Try again in a moment.";
		default:
			return "That roster change didn't take. Try again.";
	}
}
