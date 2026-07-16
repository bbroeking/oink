// The Den — player feedback contract. Owns the kind type and the one
// typed wrapper around submit_feedback (the in-app door). Render surfaces
// (Account's "send an idea to the den" dialog) consume this; no other
// module reaches into the feedback RPC.
//
// The website door (submit_feedback_web) and the founder's archive pull
// (feedback_dump/feedback_mark) live outside the app — this module covers
// only the authenticated in-app submit.

import { rpcAction, type RpcResult } from "./rpc";

// The three whisper flavors the picker offers. Server CHECK enforces the
// same set (see 20260745000000_feedback_den.sql); keep this in lockstep.
export type FeedbackKind = "idea" | "bug" | "love";

// Whispers the in-app door sends. { ok:true } on success; on refusal,
// reason carries the server code — 'resting' (the den's ears are full
// today), 'too_short'/'too_long'/'bad_kind' (validation), or the
// rpcAction fallbacks ('network', 'no_data', and 'unknown' — the last of
// which also covers the feature-dark miss when the migration is unpushed,
// since rpc returns null → rpcAction collapses it to a refusal).
export async function submitFeedback(
	kind: FeedbackKind,
	body: string
): Promise<RpcResult<Record<string, never>>> {
	return rpcAction("submit_feedback", { p_kind: kind, p_body: body });
}
