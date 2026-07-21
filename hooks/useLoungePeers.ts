// Lounge realtime peers (P2a — docs/lounge-farm-spec.md).
//
// One Supabase Realtime channel per shard. Presence announces who's here
// (username); broadcast `pos` events stream movement at ~10 Hz while a pig
// is walking. Client-authoritative — the lounge is a hangout, there is
// nothing to cheat for. Channel authorization on is_vip hardens at
// P2-final; this scaffold rides the client route gate.
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/utils/supabase";
import type { RealtimeChannel } from "@supabase/supabase-js";

export interface LoungePeer {
	key: string; // user id
	username: string;
	x: number;
	y: number;
	dir: number; // 0=S 1=N 2=E 3=W
	movedAt: number; // Date.now() of last pos event — drives walk anim
	emote?: { i: number; at: number }; // active emote bubble (index + Date.now)
}

export interface LoungeRoom {
	peers: LoungePeer[];
	// Publish my position (throttle at the call site).
	sendPos: (x: number, y: number, dir: number) => void;
	sendEmote: (i: number) => void;
}

const SHARD = "lounge:1"; // shard picker lands with P2-final

export function useLoungePeers(
	uid: string | null,
	username: string,
	spawn: { x: number; y: number }
): LoungeRoom {
	const [peers, setPeers] = useState<LoungePeer[]>([]);
	const chanRef = useRef<RealtimeChannel | null>(null);
	const peersRef = useRef<Map<string, LoungePeer>>(new Map());

	useEffect(() => {
		if (!uid) return;
		const chan = supabase.channel(SHARD, {
			config: {
				presence: { key: uid },
				broadcast: { self: false },
			},
		});
		chanRef.current = chan;

		const flush = () => setPeers(Array.from(peersRef.current.values()));

		chan.on("presence", { event: "sync" }, () => {
			const state = chan.presenceState<{ username: string }>();
			const seen = new Set<string>();
			for (const key of Object.keys(state)) {
				if (key === uid) continue;
				seen.add(key);
				const existing = peersRef.current.get(key);
				if (!existing) {
					peersRef.current.set(key, {
						key,
						username: state[key][0]?.username ?? "a pig",
						// Spawn where we spawn until their first pos event lands.
						x: spawn.x,
						y: spawn.y,
						dir: 0,
						movedAt: 0,
					});
				}
			}
			for (const key of peersRef.current.keys()) {
				if (!seen.has(key)) peersRef.current.delete(key);
			}
			flush();
		});

		chan.on("broadcast", { event: "pos" }, ({ payload }) => {
			const p = payload as {
				key: string;
				x: number;
				y: number;
				dir: number;
			};
			if (!p?.key || p.key === uid) return;
			const peer = peersRef.current.get(p.key);
			if (peer) {
				peer.x = p.x;
				peer.y = p.y;
				peer.dir = p.dir;
				peer.movedAt = Date.now();
			} else {
				peersRef.current.set(p.key, {
					key: p.key,
					username: "a pig",
					x: p.x,
					y: p.y,
					dir: p.dir,
					movedAt: Date.now(),
				});
			}
			flush();
		});

		chan.on("broadcast", { event: "emote" }, ({ payload }) => {
			const p = payload as { key: string; i: number };
			if (!p?.key || p.key === uid) return;
			const peer = peersRef.current.get(p.key);
			if (peer) {
				peer.emote = { i: p.i, at: Date.now() };
				flush();
			}
		});

		chan.subscribe(async (status) => {
			if (status === "SUBSCRIBED") {
				await chan.track({ username });
			}
		});

		return () => {
			chanRef.current = null;
			peersRef.current.clear();
			supabase.removeChannel(chan);
		};
	}, [uid, username, spawn.x, spawn.y]);

	const sendPos = (x: number, y: number, dir: number) => {
		chanRef.current
			?.send({
				type: "broadcast",
				event: "pos",
				payload: { key: uid, x: Math.round(x), y: Math.round(y), dir },
			})
			.catch(() => {});
	};

	const sendEmote = (i: number) => {
		chanRef.current
			?.send({ type: "broadcast", event: "emote", payload: { key: uid, i } })
			.catch(() => {});
	};

	return { peers, sendPos, sendEmote };
}
