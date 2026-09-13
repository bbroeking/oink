import { rpc, rpcAction, type RpcResult } from "./rpc";

export const SOUNDER_COORDINATION_PRESETS = [
	{
		id: "patch_open",
		body: "The Truffle Patch is open—come dig!",
	},
	{
		id: "feeding_waiting",
		body: "Dig when you can; the Feeding is waiting.",
	},
	{
		id: "one_more_bonus",
		body: "One more pig can unlock our Sounder Bonus.",
	},
	{
		id: "fine_digging",
		body: "Fine digging, Sounder!",
	},
] as const;

export const SOUNDER_RECRUITING_COPY = "We saved you a place in our Sounder.";

export type SounderCoordinationPreset =
	(typeof SOUNDER_COORDINATION_PRESETS)[number]["id"];

export type SounderMessagePreset = SounderCoordinationPreset | "recruiting";

export interface SounderMessageState {
	ok: true;
	feeding_number: number;
	phase_open: boolean;
	dug_count: number;
	member_count: number;
	sent_presets: SounderCoordinationPreset[];
	available: Record<SounderCoordinationPreset, boolean>;
}

export interface SounderMessageRow {
	id: string;
	preset: SounderMessagePreset;
	body: string;
	crew_name: string;
	sender_id: string;
	sender_username: string | null;
	created_at: string;
	shown_at?: string | null;
	feeding_number?: number | null;
	invite_id?: string | null;
}

export async function fetchSounderMessageState(): Promise<SounderMessageState | null> {
	const state = await rpc<SounderMessageState & { ok?: boolean }>("sounder_message_state");
	return state?.ok === true ? state : null;
}

export function sendSounderCoordination(
	preset: SounderCoordinationPreset
): Promise<RpcResult<{ id: string; recipients: number; feeding_number: number }>> {
	return rpcAction("send_sounder_coordination", { p_preset: preset });
}

export async function fetchSounderMessages(limit = 100): Promise<SounderMessageRow[]> {
	return (await rpc<SounderMessageRow[]>("my_sounder_messages", { p_limit: limit })) ?? [];
}
