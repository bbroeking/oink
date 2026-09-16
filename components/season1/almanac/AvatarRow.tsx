// The herd as a row of snouts — every member who dug this feeding as their own
// pig in full colour, every one who hasn't as a dashed empty ring. Nobody is
// named here (no shame states): the row says "4 of 6 dug" and nothing more.

import { StyleSheet, View } from "react-native";
import { CrewPortrait, Hand } from "@/components/ui";
import { AVATAR_SIZE, SPACE } from "@/constants/theme";
import type { RosterProfile } from "@/utils/crews";

export interface AvatarRowMember {
	user_id: string;
	dug: boolean;
}

export interface AvatarRowProps {
	members: readonly AvatarRowMember[];
	profiles: Map<string, RosterProfile>;
	/** The trailing hand line ("4 of 6 dug"). Omit to print the count. */
	caption?: string;
	testID?: string;
}

export function AvatarRow({ members, profiles, caption, testID }: AvatarRowProps) {
	const dug = members.filter((m) => m.dug).length;
	const line = caption ?? `${dug} of ${members.length} dug`;
	// Diggers first, so the row reads "who dug" left to right, never "who slept".
	const ordered = [...members].sort((a, b) => Number(b.dug) - Number(a.dug));
	return (
		<View
			style={styles.row}
			accessible
			accessibilityRole="text"
			accessibilityLabel={line}
			testID={testID}
		>
			<View style={styles.snouts}>
				{ordered.map((m) => {
					const p = profiles.get(m.user_id);
					return (
						<CrewPortrait
							key={m.user_id}
							size={AVATAR_SIZE[1]}
							ghost={!m.dug}
							hatId={p?.hatId ?? null}
							bowId={p?.bowId ?? null}
							prestigeLevel={p?.wallowCount ?? 0}
						/>
					);
				})}
			</View>
			<Hand tone="secondary" style={styles.caption}>
				{line}
			</Hand>
		</View>
	);
}

const styles = StyleSheet.create({
	row: {
		flexDirection: "row",
		alignItems: "center",
		gap: SPACE.sm,
	},
	snouts: {
		flex: 1,
		minWidth: 0,
		flexDirection: "row",
		flexWrap: "wrap",
		alignItems: "center",
		gap: SPACE.xs,
	},
	caption: { flexShrink: 0 },
});
