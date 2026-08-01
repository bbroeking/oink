import AsyncStorage from "@react-native-async-storage/async-storage";
import {
	RIVE_PIG_ROLLOUT_KEY,
	getRivePigRolloutEnabled,
	loadRivePigRollout,
	recordRivePigRendererFailure,
	resetRivePigRolloutForTests,
	setRivePigRolloutEnabled,
} from "@/utils/rivePigRollout";
import { log } from "@/utils/log";

jest.mock("@/utils/log", () => ({
	log: {
		warn: jest.fn(),
	},
}));

describe("Rive pig rollout", () => {
	beforeEach(async () => {
		resetRivePigRolloutForTests();
		await AsyncStorage.clear();
		jest.clearAllMocks();
	});

	it("defaults safely to raster and restores a persisted opt-in", async () => {
		expect(getRivePigRolloutEnabled()).toBe(false);

		await AsyncStorage.setItem(RIVE_PIG_ROLLOUT_KEY, "1");
		await loadRivePigRollout();

		expect(getRivePigRolloutEnabled()).toBe(true);
	});

	it("persists rollout changes across launches", async () => {
		await setRivePigRolloutEnabled(true);

		expect(getRivePigRolloutEnabled()).toBe(true);
		expect(AsyncStorage.setItem).toHaveBeenCalledWith(
			RIVE_PIG_ROLLOUT_KEY,
			"1",
		);

		await setRivePigRolloutEnabled(false);
		expect(getRivePigRolloutEnabled()).toBe(false);
		expect(AsyncStorage.setItem).toHaveBeenCalledWith(
			RIVE_PIG_ROLLOUT_KEY,
			"0",
		);
	});

	it("records renderer failures with actionable development context", () => {
		recordRivePigRendererFailure(new Error("invalid authored contract"), {
			pigId: "pickles",
			animation: "wave",
			platform: "ios",
		});

		expect(log.warn).toHaveBeenCalledWith(
			"[rive-pig:renderer-failure]",
			JSON.stringify({
				message: "invalid authored contract",
				pigId: "pickles",
				animation: "wave",
				platform: "ios",
			}),
		);
	});
});
