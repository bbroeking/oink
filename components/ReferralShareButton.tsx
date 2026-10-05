// The one Share for a referral code: ask for push permission, then open the
// system share sheet with the invite message.
//
// Three doors share it: the "Invite new pigs" row on Me (as the row's action,
// its own VoiceOver target), Referral Rewards' empty state and the foot of the
// Top Recruiters board. Referral Rewards' empty state used to tell the player
// to "share your code from the Me tab" with nothing to press, and the board
// ended in a blank half-screen; one component means the ask and the message
// never drift between the three. (polish 2026-10-04)
//
// Share is the second push-permission ask site after Friends. A pig sharing a
// code is about to trigger inbound social activity (friend requests, the +100
// referral-completed push), so the ask lands at the moment it makes sense. It
// is awaited so the prompt resolves before the share sheet covers it, and it is
// idempotent (a no-op after a grant or a denial).
import { Share } from "react-native";
import { Button, Icon } from "@/components/ui";
import { ART_SIZE, UI_COLORS } from "@/constants/theme";
import { shareMessageForCode } from "@/utils/referrals";
import { ensurePushPermission } from "@/utils/pushNotifications";

export async function shareReferralCode(code: string): Promise<void> {
	await ensurePushPermission();
	try {
		await Share.share({ message: shareMessageForCode(code) });
	} catch {
		// Cancelled, or the share sheet errored: a player's choice, not a bug.
	}
}

export function ReferralShareButton({
	code,
	size = "sm",
	label = "Share",
	full,
}: {
	code: string;
	size?: "xs" | "sm" | "md";
	label?: string;
	full?: boolean;
}) {
	// The mark is stated at rest; `Button` grows it with the label (to 2x).
	return (
		<Button
			variant="ghost"
			size={size}
			full={full}
			icon={
				<Icon
					name="share"
					size={ART_SIZE.mark}
					color={UI_COLORS.textPrimary}
					strokeWidth={2.2}
				/>
			}
			onPress={() => void shareReferralCode(code)}
			accessibilityLabel="Share your referral code"
			accessibilityHint="Opens the share sheet with your invite message"
		>
			{label}
		</Button>
	);
}
