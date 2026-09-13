// "Pick where to go" — the slide-up chooser that replaces a multi-button
// Alert.alert. Alerts are for nothing: a refusal or an outcome is a toast, a
// decision is a ConfirmDialog, and a branch ("Mote Machine / Workshop shelf /
// Close") is this sheet.
//
// The panel is now the shared `Sheet` primitive (chrome, grabber, title row,
// close target, scrolling body, safe-area bottom); this owns only the list of
// destinations and the dismiss-then-run beat.
//
// Items dismiss FIRST and run a beat later — a router.push in the same frame as
// the native dismissal is the same modal wedge UserSheet's story links avoid.
// (`Sheet` carries the useUnmanagedModalHold latch, spec 02.)

import { StyleSheet, View } from "react-native";
import { MOTION, SPACE } from "@/constants/theme";
import { Button } from "./Button";
import { Sheet } from "./Sheet";

// Let the native sheet finish dismissing before an item's action (usually a
// route) runs. The one iOS nested-modal handoff gap.
const DISMISS_BEAT_MS = MOTION.modalHandoff;

export interface ActionSheetItem {
	label: string;
	onPress: () => void;
}

interface Props {
	open: boolean;
	onClose: () => void;
	title: string;
	subtitle?: string;
	items: ActionSheetItem[];
}

export function ActionSheet({ open, onClose, title, subtitle, items }: Props) {
	const choose = (item: ActionSheetItem) => {
		onClose();
		setTimeout(item.onPress, DISMISS_BEAT_MS);
	};
	return (
		<Sheet open={open} onClose={onClose} title={title} subtitle={subtitle}>
			<View style={styles.items}>
				{items.map((item) => (
					<Button
						key={item.label}
						variant="ghost"
						full
						onPress={() => choose(item)}
						accessibilityLabel={item.label}
					>
						{item.label}
					</Button>
				))}
				<Button
					variant="ghost"
					full
					onPress={onClose}
					accessibilityLabel="Close"
				>
					Close
				</Button>
			</View>
		</Sheet>
	);
}

const styles = StyleSheet.create({
	items: {
		gap: SPACE.sm,
	},
});
