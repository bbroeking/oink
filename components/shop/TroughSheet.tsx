// The Trough sheet (Storefront 2026-09-16): today's TroughSection in a Sheet.
// Opens from the trough by the counter (a row, its chip, or the pill) — and,
// in build 1, from the yard trough and the fan on Home. The row that opened it
// comes first in the list, so the chip you tapped is the card under your thumb.
import { useMemo } from "react";
import type { useTroughDrives } from "@/hooks/useTroughDrives";
import type { BarnPrize } from "@/utils/barnDraw";
import { Sheet } from "../ui/Sheet";
import { TroughSection } from "../TroughSection";

export function TroughSheet({
	open,
	focusDriveId,
	data,
	onClose,
	onBalance,
	onPrize,
}: {
	open: boolean;
	/** The drive whose row opened the sheet, if one did. */
	focusDriveId?: string | null;
	data: ReturnType<typeof useTroughDrives>;
	onClose: () => void;
	onBalance?: (balance: number) => void;
	/** A chip crossed the giver's quarter and drew — the caller shows it. */
	onPrize?: (prize: BarnPrize) => void;
}) {
	const sectionData = useMemo(() => {
		if (!focusDriveId) return data;
		const first = data.drives.find((d) => d.id === focusDriveId);
		if (!first) return data;
		return {
			...data,
			drives: [first, ...data.drives.filter((d) => d.id !== focusDriveId)],
		};
	}, [data, focusDriveId]);
	return (
		<Sheet
			open={open}
			onClose={onClose}
			kicker="the trough"
			title="The Trough"
			closeLabel="Close the Trough"
		>
			<TroughSection data={sectionData} onBalance={onBalance} onPrize={onPrize} />
		</Sheet>
	);
}
