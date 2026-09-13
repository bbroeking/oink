// Directional receipt for one Enemy-board rivalry. The leaderboard ranks the
// pair by total curses; this bottom sheet answers the next question—who cursed
// whom—without making every ranked row taller.
//
// The panel is the `Sheet` primitive; the lines and the summed total are the
// shared `Receipt` grammar. [C-09, C-18]

import type { EnemyPairRow } from "@/utils/pairBonds";
import { WHIMSY } from "@/constants/theme";
import {
	Icon,
	ReceiptNote,
	ReceiptRow,
	ReceiptRows,
	ReceiptTotal,
	Sheet,
} from "./ui";

// The marks in the receipt's icon column.
const ROW_MARK = 22;
const TOTAL_MARK = 24;

interface Props {
	enemy: EnemyPairRow | null;
	onClose: () => void;
}

function name(value: string | null) {
	return value ?? "Anonymous";
}

export function EnemyBreakdownSheet({ enemy, onClose }: Props) {
	const open = !!enemy;

	if (!enemy) return null;

	const nameA = name(enemy.name_a);
	const nameB = name(enemy.name_b);
	const rows =
		enemy.curses_a_to_b == null || enemy.curses_b_to_a == null
			? []
			: [
					{ key: "a-b", label: `${nameA} cursed ${nameB}`, value: enemy.curses_a_to_b },
					{ key: "b-a", label: `${nameB} cursed ${nameA}`, value: enemy.curses_b_to_a },
				];

	return (
		<Sheet
			open={open}
			onClose={onClose}
			closeLabel="Close rivalry breakdown"
			kicker="the rivalry receipt"
			title={`${nameA} vs ${nameB}`}
			testID="enemy-breakdown-sheet"
		>
			{rows.length > 0 ? (
				<ReceiptRows>
					{rows.map((row, i) => (
						<ReceiptRow
							key={row.key}
							index={i}
							icon={<Icon name="ghost" size={ROW_MARK} color={WHIMSY.curseGreen} />}
							label={row.label}
							value={row.value}
						/>
					))}
				</ReceiptRows>
			) : (
				<ReceiptNote>the rivalry ledger is still catching up</ReceiptNote>
			)}

			<ReceiptTotal
				icon={<Icon name="ghost" size={TOTAL_MARK} color={WHIMSY.ink} />}
				label="curses exchanged"
				value={enemy.curses}
			/>
		</Sheet>
	);
}
