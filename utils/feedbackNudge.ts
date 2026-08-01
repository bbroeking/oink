// The feedback request itself now lives only in Me → Settings. Keep one
// per-user timestamp for product analytics and any future respectful follow-up;
// there is deliberately no automatic feedback-nudge gate.
import AsyncStorage from "@react-native-async-storage/async-storage";

const feedbackEverSentKey = (uid: string) =>
	`feedback_nudge_ever_sent_v1:${uid}`;

export async function stampFeedbackEverSent(uid: string): Promise<void> {
	try {
		await AsyncStorage.setItem(feedbackEverSentKey(uid), String(Date.now()));
	} catch {
		// Feedback submission already succeeded; telemetry must never block it.
	}
}
