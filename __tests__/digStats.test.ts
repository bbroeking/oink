import { rpc } from "@/utils/rpc";
import { fetchPlayerDigStats } from "@/utils/digStats";

jest.mock("@/utils/rpc", () => ({ rpc: jest.fn() }));

const mockedRpc = rpc as jest.MockedFunction<typeof rpc>;

describe("fetchPlayerDigStats", () => {
	beforeEach(() => mockedRpc.mockReset());

	it("returns the canonical four totals", async () => {
		mockedRpc.mockResolvedValue({
			ok: true,
			user_id: "pig-1",
			digs: 12,
			finds: 31,
			motes: 4,
			echoes: 9,
		});

		await expect(fetchPlayerDigStats("pig-1")).resolves.toEqual({
			ok: true,
			user_id: "pig-1",
			digs: 12,
			finds: 31,
			motes: 4,
			echoes: 9,
		});
		expect(mockedRpc).toHaveBeenCalledWith("player_dig_stats", {
			p_user_id: "pig-1",
		});
	});

	it("fails dark when the RPC is unavailable or refuses the viewer", async () => {
		mockedRpc.mockResolvedValueOnce(null).mockResolvedValueOnce({
			ok: false,
			reason: "blocked",
		});

		await expect(fetchPlayerDigStats("pig-1")).resolves.toBeNull();
		await expect(fetchPlayerDigStats("pig-2")).resolves.toBeNull();
	});
});
