// Ceremony — the third modal shape (spec §2 row 05): a FULL-SCREEN scene
// (a Barn visit, a season-end reveal, a judgement) that neither `Sheet`
// (bottom-anchored panel) nor `AdaptiveModalScaffold` (a 430pt dialog frame)
// can host. It owns the native Modal, the popup-queue latch, the Reduce Motion
// fade, and the cream ground; the scene inside owns its own art and its own
// exit (a ceremony always has one — pass it `onRequestClose`). Retires the
// last written `no-raw-modal` exception (Friends.tsx). (2026-09-11)
import type { ReactNode } from "react";
import { Modal, StyleSheet, View } from "react-native";
import { UI_COLORS } from "@/constants/theme";
import { useMotionPolicy } from "@/hooks/useMotionPolicy";
import { useUnmanagedModalHold } from "./PopupQueue";
import { ToastHost } from "./Toast";

interface Props {
	open: boolean;
	onRequestClose: () => void;
	children: ReactNode;
	/** "slide" is the scene-change (a visit); "fade" is the reveal. */
	entrance?: "slide" | "fade";
	/** PopupQueue consumers only — see ConfirmDialog's `visible` contract. */
	visible?: boolean;
	testID?: string;
}

export function Ceremony({
	open,
	onRequestClose,
	children,
	entrance = "slide",
	visible,
	testID,
}: Props) {
	const { reduceMotion } = useMotionPolicy();
	useUnmanagedModalHold(open);
	if (!open) return null;
	return (
		<Modal
			visible={visible ?? true}
			animationType={reduceMotion ? "fade" : entrance}
			onRequestClose={onRequestClose}
			testID={testID}
		>
			<View style={styles.ground} accessibilityViewIsModal>
				{/* A native Modal paints over the root ToastHost, so the ceremony
				    carries a host of its own. It comes BEFORE the children in
				    tree order: effects run in tree order, and a scene that mounts
				    its own host on its own line (the visit) must register after
				    this one to take the calls. The wrap's zIndex keeps it on top
				    regardless of order. */}
				<ToastHost />
				{children}
			</View>
		</Modal>
	);
}

const styles = StyleSheet.create({
	ground: {
		flex: 1,
		backgroundColor: UI_COLORS.canvas,
	},
});
