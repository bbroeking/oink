// The multiplayer config cell: wss-only sanitizer, the dev URL override, and
// the server-over-fallback refresh.

import {
	DEFAULT_MULTIPLAYER_CONFIG,
	applyMultiplayerConfig,
	isPlayServerUrl,
	multiplayerConfig,
	playServerUrl,
	refreshMultiplayerConfig,
	resetMultiplayerConfigForTests,
	sanitizeMultiplayerConfig,
} from "../../utils/multiplayer/config";

// jest.mock is hoisted above the imports; the factory reads this lazily.
const mockRpc = jest.fn();
jest.mock("@/utils/rpc", () => ({ rpc: (...args: unknown[]) => mockRpc(...args) }));

describe("sanitizeMultiplayerConfig", () => {
	it("accepts a wss row and fills missing flags from the fallback", () => {
		expect(sanitizeMultiplayerConfig({ url: "wss://ttp-play.onrender.com/ws", practice: false, async: true }, false)).toEqual({
			url: "wss://ttp-play.onrender.com/ws",
			practice: false,
			async: true,
		});
		expect(sanitizeMultiplayerConfig({ url: " wss://play.ticklethepig.com/ws " }, false)).toEqual({
			url: "wss://play.ticklethepig.com/ws",
			practice: DEFAULT_MULTIPLAYER_CONFIG.practice,
			async: DEFAULT_MULTIPLAYER_CONFIG.async,
		});
	});

	it("rejects anything that is not a WebSocket URL, and plain ws outside development", () => {
		for (const url of ["https://ttp-play.onrender.com/ws", "http://x/ws", "ftp://x", "wss://", "wss://has space/ws", "", 42, null, undefined]) {
			expect(sanitizeMultiplayerConfig({ url }, true)).toBeNull();
		}
		expect(sanitizeMultiplayerConfig({ url: "ws://192.168.1.20:8787/ws" }, false)).toBeNull();
		expect(sanitizeMultiplayerConfig({ url: "ws://192.168.1.20:8787/ws" }, true)?.url).toBe("ws://192.168.1.20:8787/ws");
		expect(sanitizeMultiplayerConfig(null)).toBeNull();
		expect(sanitizeMultiplayerConfig([{ url: "wss://x/ws" }])).toBeNull();
		expect(isPlayServerUrl(`wss://x/${"a".repeat(600)}`)).toBe(false);
	});
});

describe("config cell", () => {
	const saved = process.env.EXPO_PUBLIC_PLAY_URL;
	beforeEach(() => {
		resetMultiplayerConfigForTests();
		mockRpc.mockReset();
		delete process.env.EXPO_PUBLIC_PLAY_URL;
	});
	afterAll(() => {
		if (saved === undefined) delete process.env.EXPO_PUBLIC_PLAY_URL;
		else process.env.EXPO_PUBLIC_PLAY_URL = saved;
	});

	it("boots on the compiled fallback", () => {
		expect(multiplayerConfig()).toEqual(DEFAULT_MULTIPLAYER_CONFIG);
		expect(playServerUrl()).toBe("wss://ttp-play.onrender.com/ws");
	});

	it("takes the server row, and keeps what it has when the row is bad", async () => {
		mockRpc.mockResolvedValueOnce({ url: "wss://play.ticklethepig.com/ws", practice: false, async: false });
		await expect(refreshMultiplayerConfig()).resolves.toBe(true);
		expect(mockRpc).toHaveBeenCalledWith("app_setting", { p_key: "multiplayer" });
		expect(multiplayerConfig()).toEqual({ url: "wss://play.ticklethepig.com/ws", practice: false, async: false });

		resetMultiplayerConfigForTests();
		applyMultiplayerConfig({ url: "wss://keep.example/ws", practice: true, async: true });
		mockRpc.mockResolvedValueOnce({ url: "http://downgrade.example/ws" });
		await expect(refreshMultiplayerConfig()).resolves.toBe(false);
		expect(playServerUrl()).toBe("wss://keep.example/ws");
	});

	it("points a development build at a local server through EXPO_PUBLIC_PLAY_URL", () => {
		process.env.EXPO_PUBLIC_PLAY_URL = "ws://192.168.1.20:8787/ws";
		expect(playServerUrl()).toBe("ws://192.168.1.20:8787/ws");
		expect(multiplayerConfig().practice).toBe(DEFAULT_MULTIPLAYER_CONFIG.practice);
		process.env.EXPO_PUBLIC_PLAY_URL = "not a url";
		expect(playServerUrl()).toBe(DEFAULT_MULTIPLAYER_CONFIG.url);
	});
});
