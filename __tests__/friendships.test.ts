// Friendships module — covers the error→copy mapping and confirms
// each typed wrapper calls the right RPC with the right param
// shape. Same testing style as activeEffects.test.ts: mock supabase
// at the boundary, exercise the pure module.

const mockRpc = jest.fn();
jest.mock("../utils/supabase", () => ({
	supabase: { rpc: (...args: unknown[]) => mockRpc(...args) },
}));
jest.mock("../utils/log", () => ({
	log: { error: jest.fn() },
}));

import {
	FRIEND_CAP_LIMIT,
	friendActionMessage,
	getFriendIds,
	sendFriendRequest,
	acceptFriendRequest,
	cancelFriendRequest,
	removeFriendship,
	getSuggestedUsers,
	searchUsers,
} from "../utils/friendships";

describe("friendActionMessage", () => {
	test("at_cap uses the provided cap when present", () => {
		expect(friendActionMessage("at_cap", 50, "Rosie")).toContain("50-friend cap");
	});

	test("at_cap falls back to FRIEND_CAP_LIMIT when cap is undefined", () => {
		expect(friendActionMessage("at_cap", undefined, "Rosie")).toContain(
			`${FRIEND_CAP_LIMIT}-friend cap`
		);
	});

	test("target_at_cap names the other player", () => {
		expect(friendActionMessage("target_at_cap", undefined, "Rosie")).toBe(
			"Rosie is at the friend cap."
		);
	});

	test("target_at_cap falls back to 'this player' when no name", () => {
		expect(friendActionMessage("target_at_cap", undefined, null)).toBe(
			"this player is at the friend cap."
		);
	});

	test("already_friends names the other player", () => {
		expect(friendActionMessage("already_friends", undefined, "Rosie")).toBe(
			"You and Rosie are already friends."
		);
	});

	test("pending → already-pending copy", () => {
		expect(friendActionMessage("pending", undefined, "Rosie")).toBe(
			"A request is already pending."
		);
	});

	test("self → tongue-in-cheek copy", () => {
		expect(friendActionMessage("self", undefined, null)).toBe("That's you.");
	});

	test("no_pending_request → no-pending copy", () => {
		expect(friendActionMessage("no_pending_request", undefined, "Rosie")).toBe(
			"No pending request to accept."
		);
	});

	test("no_such_user + not_found both → user-not-found copy", () => {
		expect(friendActionMessage("no_such_user", undefined, null)).toBe(
			"User not found."
		);
		expect(friendActionMessage("not_found", undefined, null)).toBe(
			"User not found."
		);
	});

	test("unknown reason → falls back to the reason string", () => {
		expect(friendActionMessage("rate_limited", undefined, null)).toBe(
			"rate_limited"
		);
	});

	test("undefined reason → generic copy", () => {
		expect(friendActionMessage(undefined, undefined, null)).toBe(
			"Couldn't complete that."
		);
	});
});

describe("typed wrappers", () => {
	beforeEach(() => {
		mockRpc.mockReset();
		mockRpc.mockResolvedValue({ data: null, error: null });
	});

	test("getFriendIds calls friend_ids with no params", async () => {
		await getFriendIds();
		expect(mockRpc).toHaveBeenCalledWith("friend_ids", undefined);
	});

	test("sendFriendRequest passes username + discriminator", async () => {
		await sendFriendRequest("rosie", "1234");
		expect(mockRpc).toHaveBeenCalledWith("send_friend_request", {
			target_username: "rosie",
			target_discriminator: "1234",
		});
	});

	test("sendFriendRequest defaults discriminator to null", async () => {
		await sendFriendRequest("rosie");
		expect(mockRpc).toHaveBeenCalledWith("send_friend_request", {
			target_username: "rosie",
			target_discriminator: null,
		});
	});

	test("acceptFriendRequest passes the other user id", async () => {
		await acceptFriendRequest("user-uuid");
		expect(mockRpc).toHaveBeenCalledWith("accept_friend_request", {
			other_user_id: "user-uuid",
		});
	});

	test("cancelFriendRequest passes the target user id", async () => {
		await cancelFriendRequest("user-uuid");
		expect(mockRpc).toHaveBeenCalledWith("cancel_friend_request", {
			target_user_id: "user-uuid",
		});
	});

	// Decline (Inbox) and unfriend both route here — the direction-agnostic
	// RPC, distinct from cancel_friend_request's outgoing-only delete.
	test("removeFriendship passes the other user id", async () => {
		await removeFriendship("user-uuid");
		expect(mockRpc).toHaveBeenCalledWith("remove_friendship", {
			other_user_id: "user-uuid",
		});
	});

	test("getSuggestedUsers passes the limit", async () => {
		await getSuggestedUsers(5);
		expect(mockRpc).toHaveBeenCalledWith("suggested_users", { limit_n: 5 });
	});

	test("getSuggestedUsers defaults limit to 3", async () => {
		await getSuggestedUsers();
		expect(mockRpc).toHaveBeenCalledWith("suggested_users", { limit_n: 3 });
	});

	test("searchUsers passes prefix + max_results", async () => {
		await searchUsers("ros", 20);
		expect(mockRpc).toHaveBeenCalledWith("search_users", {
			prefix: "ros",
			max_results: 20,
		});
	});

	test("searchUsers defaults max_results to 10", async () => {
		await searchUsers("ros");
		expect(mockRpc).toHaveBeenCalledWith("search_users", {
			prefix: "ros",
			max_results: 10,
		});
	});

	test("returns null when supabase yields error", async () => {
		mockRpc.mockResolvedValueOnce({
			data: null,
			error: { message: "boom" },
		});
		expect(await getFriendIds()).toBeNull();
	});

	test("returns parsed data on success", async () => {
		mockRpc.mockResolvedValueOnce({
			data: ["a", "b", "c"],
			error: null,
		});
		expect(await getFriendIds()).toEqual(["a", "b", "c"]);
	});
});
