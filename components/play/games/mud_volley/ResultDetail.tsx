// The result sheet's detail: the six tosses as a receipt, each line naming
// the pig who scored ("You followed through", "Bandit caught it left") with
// what landed beside it and the points it was worth. The summary line on the
// card above is the rules' name-free one; this is where names belong.

import { Image, StyleSheet } from "react-native";
import { ReceiptRow, ReceiptRows } from "@/components/ui";
import { ART_SIZE } from "@/constants/theme";
import type { RoomSnapshot } from "@/multiplayer/protocol";
import type { Seat } from "@/multiplayer/types";
import type { VolleyView } from "@/multiplayer/games/mud_volley/rules";
import { VOLLEY_ART } from "../../playArt";
import { ledgerLine, outcomeMark, type VolleyMark } from "./copy";
import { seatName } from "./scene";

const MARK_ART: Record<VolleyMark, typeof VOLLEY_ART.mudball> = {
	splatBig: VOLLEY_ART.splatBig,
	splatSmall: VOLLEY_ART.splatSmall,
	bucket: VOLLEY_ART.bucket,
};

export function MudVolleyResultDetail({ view, room, you }: { view: VolleyView; room: RoomSnapshot<VolleyView>; you: Seat }) {
	if (view.history.length === 0) return null;
	const rival = seatName(room, view.rival);
	return (
		<ReceiptRows>
			{view.history.map((row, i) => (
				<ReceiptRow
					key={row.ex}
					index={i}
					icon={<Image source={MARK_ART[outcomeMark(row)]} style={styles.mark} resizeMode="contain" accessible={false} />}
					label={ledgerLine(row, you, rival)}
					value={`+${row.points}`}
				/>
			))}
		</ReceiptRows>
	);
}

const styles = StyleSheet.create({
	mark: { width: ART_SIZE.glyphSm, height: ART_SIZE.glyphSm },
});
