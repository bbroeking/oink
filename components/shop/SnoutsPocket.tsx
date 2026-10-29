// The snouts pocket: the balance as a tilted sun sticker in a crown's right
// slot (the shop redesign's "a chip you keep, not a system bar"). The Shop tab
// and the Pop-up Stall's page wear the same one. (Moved out of
// app/(tabs)/shop.tsx 2026-10-29.)
import { StyleSheet } from "react-native";
import { Numeral, SnoutCoin, Sticker } from "@/components/ui";
import { RADII, SPACE } from "@/constants/theme";

/** The coin riding the pocket. */
const COIN_MARK = 20;
/** The pocket leans the other way, like a chip tucked in a pocket. */
const BALANCE_TILT = 2;

export function SnoutsPocket({ balance }: { balance: number }) {
	return (
		<Sticker
			color="sun"
			radius={RADII.md}
			rotate={BALANCE_TILT}
			accessibilityRole="text"
			accessibilityLabel={`${balance.toLocaleString()} snouts`}
			style={styles.balance}
		>
			<SnoutCoin size={COIN_MARK} />
			<Numeral>{balance.toLocaleString()}</Numeral>
		</Sticker>
	);
}

const styles = StyleSheet.create({
	balance: {
		flexDirection: "row",
		alignItems: "center",
		gap: SPACE.sm,
		paddingHorizontal: SPACE.md,
		paddingVertical: SPACE.sm,
	},
});
