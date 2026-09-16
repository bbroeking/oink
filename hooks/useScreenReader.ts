// Whether a screen reader (VoiceOver / TalkBack) is driving the app. The
// storefront (2026-09-16, ruling 5) hands a screen reader the 2-col grid
// underneath the scene, so its shelves are a plain list of cards rather than
// a picture you find your way around by touch. Subscribed, so toggling
// VoiceOver over the app re-renders the store without a relaunch.
import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";

export function useScreenReader(): boolean {
	const [enabled, setEnabled] = useState(false);
	useEffect(() => {
		let alive = true;
		AccessibilityInfo.isScreenReaderEnabled()
			.then((on) => {
				if (alive) setEnabled(on);
			})
			.catch(() => {});
		const sub = AccessibilityInfo.addEventListener(
			"screenReaderChanged",
			(on) => setEnabled(on),
		);
		return () => {
			alive = false;
			sub.remove();
		};
	}, []);
	return enabled;
}
