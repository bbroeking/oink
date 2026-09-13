import { blockUser, reportUser, unblockUser } from "@/utils/moderation";
import { rpcAction } from "@/utils/rpc";

jest.mock("@/utils/rpc", () => ({ rpcAction: jest.fn() }));
jest.mock("@/utils/supabase", () => ({ supabase: {} }));

const mockedRpcAction = rpcAction as jest.MockedFunction<typeof rpcAction>;

describe("player moderation actions", () => {
	beforeEach(() => {
		mockedRpcAction.mockReset();
		mockedRpcAction.mockResolvedValue({ ok: true });
	});

	it("reports a user without implicitly blocking them", async () => {
		await expect(reportUser("pig-2")).resolves.toEqual({ ok: true });
		expect(mockedRpcAction).toHaveBeenCalledTimes(1);
		expect(mockedRpcAction).toHaveBeenCalledWith("report_user", {
			target_user_id: "pig-2",
			reason: "user_report",
		});
	});

	it("blocks and unblocks through separate explicit actions", async () => {
		await blockUser("pig-2");
		await unblockUser("pig-2");

		expect(mockedRpcAction).toHaveBeenNthCalledWith(1, "block_user", {
			target_user_id: "pig-2",
		});
		expect(mockedRpcAction).toHaveBeenNthCalledWith(2, "unblock_user", {
			target_user_id: "pig-2",
		});
	});
});
