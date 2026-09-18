// Joining the Slop Club (lifted out of the Shop tab, 2026-09-17).
//
// The Pen became a pushed route of its own that day, and joining went with it:
// this is the shop screen's `handleJoinSlopClub`, unchanged in behaviour —
// the same RevenueCat offering `components/Account.tsx` and the season premium
// unlock present, the same toasts, the same "membership worked but the pig
// couldn't join" fallback.
//
// With no pig it is the plain membership purchase; with one it buys the
// membership and recruits that pig in the same breath (`joinSlopClubAndRecruit`).
// `is_vip` flips server-side through the webhook, so the caller hands in
// whatever re-read makes its own screen true again — the Pen passes its roster
// refresh, which is all the Pen shows.
import { useCallback } from "react";
import { showPurchaseToast } from "@/components/PurchaseToast";
import { IAP_ENABLED, presentPaywall, OFFERING_IDS } from "@/utils/iap";
import { joinSlopClubAndRecruit } from "@/utils/joinSlopClub";
import { recruitPig } from "@/utils/pigRoster";
import { pigDefinition, type PigId } from "@/utils/pigs";

export function useJoinSlopClub(
	/** Re-read whatever membership changed on this screen. */
	refreshProfile: () => Promise<unknown>,
): (pigId?: PigId) => Promise<void> {
	return useCallback(
		async (pigId?: PigId) => {
			if (!pigId) {
				if (!IAP_ENABLED) {
					showPurchaseToast({
						type: "fail",
						title: "Slop Club isn’t enabled in this build",
						text: "Open a store-enabled build to join the Slop Club.",
					});
					return;
				}
				const paywall = await presentPaywall(OFFERING_IDS.slopClub);
				if (paywall.ok) {
					await refreshProfile();
					showPurchaseToast({
						type: "success",
						title: "Welcome to the Slop Club!",
						text: "Choose Rosie’s friend in the Pen.",
					});
				} else if (paywall.reason !== "cancelled") {
					showPurchaseToast({
						type: "fail",
						title: "Couldn’t open the Slop Club",
						text:
							paywall.reason === "no_offering"
								? "The storefront isn’t available right now. Please try again soon."
								: "Please try again.",
					});
				}
				return;
			}

			const outcome = await joinSlopClubAndRecruit(pigId, {
				iapEnabled: IAP_ENABLED,
				presentPaywall: () => presentPaywall(OFFERING_IDS.slopClub),
				recruit: recruitPig,
			});

			if (outcome.kind === "cancelled") return;
			if (outcome.kind === "unavailable") {
				showPurchaseToast({
					type: "fail",
					title: "Slop Club isn’t enabled in this build",
					text: "Open a store-enabled build to join and recruit this pig.",
				});
				return;
			}
			if (outcome.kind === "paywall_error") {
				showPurchaseToast({
					type: "fail",
					title: "Couldn’t open the Slop Club",
					text:
						outcome.reason === "no_offering"
							? "The storefront isn’t available right now. Please try again soon."
							: "Please try again.",
				});
				return;
			}

			await refreshProfile();
			if (outcome.kind === "joined") {
				const pig = pigDefinition(outcome.pigId);
				showPurchaseToast({
					type: "success",
					title: `${pig.name} joined the Pen!`,
					text: "Your Slop Club membership is active.",
				});
				return;
			}

			showPurchaseToast({
				type: "success",
				title: "Membership active",
				text:
					outcome.reason === "membership_syncing"
						? "Your membership is still syncing. Try Recruit again in a moment."
						: "The membership worked, but this pig couldn’t join yet. Try Recruit again.",
			});
		},
		[refreshProfile],
	);
}
