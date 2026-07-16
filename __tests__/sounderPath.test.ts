// The Sounder onboarding step machine — covers the PURE deriveSounderStep
// boundary logic (including the new leaver branch) and the fail-soft AsyncStorage
// writers in utils/sounderPath. Same module-boundary stubbing style as
// crewState.test.ts / onboarding.test.ts: the hook pulls in @react-navigation +
// the supabase/crews chain (AsyncStorage native module), so mock those out.

const mockGetItem = jest.fn();
const mockSetItem = jest.fn();
const mockRemoveItem = jest.fn();
jest.mock("@react-native-async-storage/async-storage", () => ({
	__esModule: true,
	default: {
		getItem: (...a: unknown[]) => mockGetItem(...a),
		setItem: (...a: unknown[]) => mockSetItem(...a),
		removeItem: (...a: unknown[]) => mockRemoveItem(...a),
	},
}));
// The hook side-imports these; stub the module boundary so importing
// deriveSounderStep doesn't drag in native deps.
jest.mock("@react-navigation/native", () => ({ useFocusEffect: jest.fn() }));
jest.mock("../utils/supabase", () => ({
	supabase: { auth: { getSession: jest.fn() } },
}));
jest.mock("../utils/crews", () => ({ fetchCrewState: jest.fn() }));

import { deriveSounderStep, type SounderEvidence } from "../hooks/useSounderPath";
import {
	markSounderLeft,
	markRejoinDismissed,
	sounderLeftKey,
	rejoinDismissedKey,
} from "../utils/sounderPath";

// A fully-progressed-but-crewless leaver base; override per case.
const evidence = (over: Partial<SounderEvidence> = {}): SounderEvidence => ({
	introSeen: true,
	practiced: true,
	firstDig: false,
	hasCrew: false,
	left: false,
	rejoinDismissed: false,
	...over,
});

beforeEach(() => {
	mockGetItem.mockReset();
	mockSetItem.mockReset();
	mockRemoveItem.mockReset();
});

describe("deriveSounderStep — base ladder", () => {
	it("hook until the tale is seen", () => {
		expect(deriveSounderStep(evidence({ introSeen: false }))).toEqual({
			step: "hook",
			leaver: false,
		});
	});

	it("taste once seen but not practiced", () => {
		expect(deriveSounderStep(evidence({ practiced: false }))).toEqual({
			step: "taste",
			leaver: false,
		});
	});

	it("join for a fresh practiced-but-crewless player (never left)", () => {
		expect(deriveSounderStep(evidence())).toEqual({ step: "join", leaver: false });
	});

	it("first_dig when crewed without a real dig", () => {
		expect(deriveSounderStep(evidence({ hasCrew: true }))).toEqual({
			step: "first_dig",
			leaver: false,
		});
	});

	it("done when crewed with a real dig", () => {
		expect(
			deriveSounderStep(evidence({ hasCrew: true, firstDig: true }))
		).toEqual({ step: "done", leaver: false });
	});
});

describe("deriveSounderStep — leaver branch", () => {
	it("left + not-dismissed → join with the leaver flag", () => {
		expect(deriveSounderStep(evidence({ left: true }))).toEqual({
			step: "join",
			leaver: true,
		});
	});

	it("left + dismissed → done (the card retires)", () => {
		expect(
			deriveSounderStep(evidence({ left: true, rejoinDismissed: true }))
		).toEqual({ step: "done", leaver: false });
	});

	it("a re-joiner (left but now crewed) flows through the crewed branches, not leaver", () => {
		// left AND dismissed AND back in a crew, no real dig yet → first_dig, no flag.
		expect(
			deriveSounderStep(
				evidence({ left: true, rejoinDismissed: true, hasCrew: true })
			)
		).toEqual({ step: "first_dig", leaver: false });
	});
});

describe("sounderPath writers — fail-soft, per-user keys", () => {
	it("markSounderLeft stamps the per-user left key", async () => {
		mockSetItem.mockResolvedValue(undefined);
		await markSounderLeft("u1");
		expect(mockSetItem).toHaveBeenCalledWith(sounderLeftKey("u1"), "1");
	});

	it("markRejoinDismissed stamps the per-user dismissed key", async () => {
		mockSetItem.mockResolvedValue(undefined);
		await markRejoinDismissed("u1");
		expect(mockSetItem).toHaveBeenCalledWith(rejoinDismissedKey("u1"), "1");
	});

	it("both no-op on a null uid (no write)", async () => {
		await markSounderLeft(null);
		await markRejoinDismissed(null);
		expect(mockSetItem).not.toHaveBeenCalled();
	});

	it("swallow a storage error instead of throwing into the tap path", async () => {
		mockSetItem.mockRejectedValue(new Error("disk full"));
		await expect(markSounderLeft("u1")).resolves.toBeUndefined();
		await expect(markRejoinDismissed("u1")).resolves.toBeUndefined();
	});
});
