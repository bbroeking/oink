// Your OWN barn's buried truffle — total pot, how much is left, and who's dug
// it. Backed by the truffle_status() RPC. Shared by the bury control, the
// buried-mound visual, and the "check on your truffle" sheet.
import { useCallback, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { rpcAction } from "@/utils/rpc";

export interface TruffleDigger {
	username: string;
	amount: number;
	dug_at: string;
}

export interface TruffleStatus {
	buried: boolean;
	total: number;
	remaining: number;
	diggers: TruffleDigger[];
}

// A fresh object each call, NOT a shared singleton — consumers run effects keyed
// on the status reference (e.g. Barn's optimistic bury-spot hide), and a reused
// reference makes setState bail out so those effects never re-fire.
const empty = (): TruffleStatus => ({ buried: false, total: 0, remaining: 0, diggers: [] });

export function useBuriedTruffle() {
	const [status, setStatus] = useState<TruffleStatus | null>(null); // null = loading

	const refresh = useCallback(async () => {
		const r = await rpcAction<{
			buried?: boolean;
			total?: number;
			remaining?: number;
			diggers?: TruffleDigger[];
		}>("truffle_status");
		if (r.ok) {
			setStatus(
				r.buried
					? {
							buried: true,
							total: r.total ?? 0,
							remaining: r.remaining ?? 0,
							diggers: r.diggers ?? [],
						}
					: empty()
			);
		} else {
			setStatus(empty());
		}
	}, []);

	useFocusEffect(
		useCallback(() => {
			refresh();
		}, [refresh])
	);

	return { status, refresh };
}
