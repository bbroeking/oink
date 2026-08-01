import { useCallback, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { rpc } from "@/utils/rpc";

export interface TroughDrive {
	id: string;
	item_id: string;
	item_name: string | null;
	opener_id: string;
	opener_name: string | null;
	target: number;
	raised: number;
	status: string;
	closes_at: string;
	is_mine: boolean;
	donor_count: number;
	my_contribution: number;
}

export interface TroughReceipt {
	donation_id: string;
	drive_id: string;
	item_id: string;
	item_name: string | null;
}

interface MyDrivesPayload {
	ok?: boolean;
	balance?: number;
	donated_today?: boolean;
	drives?: TroughDrive[];
	claimable?: TroughReceipt[];
}

export function troughAttentionCount(
	drives: readonly TroughDrive[],
	receipts: readonly TroughReceipt[],
): number {
	return drives.length + receipts.length;
}

export function troughActiveCount(drives: readonly TroughDrive[]): number {
	return drives.length;
}

// One focus-aware read for every Trough surface. The Shop uses it for the
// always-visible segment badge; TroughSection uses the same contract for the
// full list and refreshes it after mutations.
export function useTroughDrives() {
	const [drives, setDrives] = useState<TroughDrive[]>([]);
	const [claimable, setClaimable] = useState<TroughReceipt[]>([]);
	const [balance, setBalance] = useState(0);
	const [donatedToday, setDonatedToday] = useState(false);
	const [loaded, setLoaded] = useState(false);

	const refresh = useCallback(async () => {
		const result = await rpc<MyDrivesPayload>("my_drives");
		if (result?.ok) {
			setDrives(result.drives ?? []);
			setClaimable(result.claimable ?? []);
			setBalance(result.balance ?? 0);
			setDonatedToday(!!result.donated_today);
		}
		setLoaded(true);
		return result;
	}, []);

	useFocusEffect(
		useCallback(() => {
			refresh();
		}, [refresh]),
	);

	return {
		drives,
		claimable,
		balance,
		donatedToday,
		loaded,
		activeCount: troughActiveCount(drives),
		count: troughAttentionCount(drives, claimable),
		refresh,
	};
}
