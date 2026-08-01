jest.mock("../utils/rpc", () => ({
	rpcAction: jest.fn(),
}));

import { rpcAction } from "../utils/rpc";
import {
	analyticsSessionId,
	createAnalyticsSessionId,
	isValidInteractionEvent,
	trackInteraction,
} from "../utils/interactionAnalytics";

const mockRpcAction = rpcAction as jest.MockedFunction<typeof rpcAction>;

describe("interaction analytics", () => {
	beforeEach(() => {
		mockRpcAction.mockReset();
	});

	it("creates an RFC 4122 version-4 session id without a device identifier", () => {
		const id = createAnalyticsSessionId(() => 0.5);
		expect(id).toMatch(
			/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
		);
		expect(analyticsSessionId).toMatch(
			/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
		);
	});

	it("accepts a registered event/surface pair and small allow-listed properties", () => {
		expect(
			isValidInteractionEvent({
				eventName: "visit_stamp_left",
				surface: "visit",
				targetKind: "pig",
				targetUserId: "123e4567-e89b-42d3-a456-426614174000",
				contentId: "heart_stamp",
				experiment: "guestbook_v1",
				properties: { variant: "treatment", count: 1 },
			})
		).toBe(true);
	});

	it("rejects mismatched surfaces, arbitrary property keys, and free-form content", () => {
		expect(
			isValidInteractionEvent({
				eventName: "barn_tickle_succeeded",
				surface: "shop",
			})
		).toBe(false);
		expect(
			isValidInteractionEvent({
				eventName: "barn_opened",
				surface: "barn",
				properties: { message: "hello" } as never,
			})
		).toBe(false);
		expect(
			isValidInteractionEvent({
				eventName: "share_created",
				surface: "share",
				contentId: "a sentence with spaces",
			})
		).toBe(false);
	});

	it("maps a valid event to the single recording RPC", async () => {
		mockRpcAction.mockResolvedValue({ ok: true });

		await expect(
			trackInteraction({
				eventName: "rooting_submitted",
				surface: "feeding",
				result: "succeeded",
				properties: { count: 6 },
			})
		).resolves.toBe(true);

		expect(mockRpcAction).toHaveBeenCalledWith("record_interaction_event", {
			p_session_id: analyticsSessionId,
			p_event_name: "rooting_submitted",
			p_surface: "feeding",
			p_target_kind: null,
			p_target_user_id: null,
			p_result: "succeeded",
			p_content_id: null,
			p_experiment: null,
			p_properties: { count: 6 },
		});
	});

	it("fails soft without a request for invalid events or RPC failures", async () => {
		await expect(
			trackInteraction({
				eventName: "lounge_entered",
				surface: "barn",
			})
		).resolves.toBe(false);
		expect(mockRpcAction).not.toHaveBeenCalled();

		mockRpcAction.mockResolvedValue({ ok: false, reason: "network" });
		await expect(
			trackInteraction({
				eventName: "lounge_entered",
				surface: "lounge",
			})
		).resolves.toBe(false);

		mockRpcAction.mockRejectedValue(new Error("offline"));
		await expect(
			trackInteraction({
				eventName: "season_opened",
				surface: "season",
			})
		).resolves.toBe(false);
	});
});
