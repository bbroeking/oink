// "Sign out" signs out THIS device (2026-10-04 play verification): signing
// out the SE also signed the 17 Pro out (Supabase's default scope is global)
// and could silence its pushes (the account holds one push token).
import { readFileSync } from "fs";
import { join } from "path";

const mockRpcAction = jest.fn();
const mockGetItem = jest.fn();
const mockRemoveItem = jest.fn();

jest.mock("expo-notifications", () => ({
	setNotificationHandler: jest.fn(),
	getPermissionsAsync: jest.fn(),
	requestPermissionsAsync: jest.fn(),
	getExpoPushTokenAsync: jest.fn(),
}));
jest.mock("react-native", () => ({ Platform: { OS: "ios" } }));
jest.mock("expo-constants", () => ({ expoConfig: null, easConfig: null }));
jest.mock("@react-native-async-storage/async-storage", () => ({
	__esModule: true,
	default: {
		getItem: (...args: unknown[]) => mockGetItem(...args),
		setItem: jest.fn(),
		removeItem: (...args: unknown[]) => mockRemoveItem(...args),
	},
}));
jest.mock("../utils/rpc", () => ({
	rpcAction: (...args: unknown[]) => mockRpcAction(...args),
}));
jest.mock("../utils/notificationPolicy", () => ({
	foregroundNotificationBehavior: jest.fn(),
}));
jest.mock("../utils/rooting", () => ({ nextOpenAtMs: jest.fn() }));

// Jest factories must install native-module mocks before this import.
// eslint-disable-next-line import/first
import { clearPushToken } from "../utils/pushNotifications";

const THIS_PHONE = "ExponentPushToken[this-phone]";
const OTHER_PHONE = "ExponentPushToken[other-phone]";

describe("clearPushToken on sign-out", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		mockRpcAction.mockResolvedValue({ ok: true });
		mockRemoveItem.mockResolvedValue(undefined);
	});

	test("clears the account's token while it is still this device's", async () => {
		mockGetItem.mockResolvedValue(THIS_PHONE);
		await clearPushToken(THIS_PHONE);
		expect(mockRpcAction).toHaveBeenCalledWith("set_push_token", { token: null });
		expect(mockRemoveItem).toHaveBeenCalled();
	});

	test("leaves another phone's token alone, so that phone keeps its notifications", async () => {
		mockGetItem.mockResolvedValue(THIS_PHONE);
		await clearPushToken(OTHER_PHONE);
		expect(mockRpcAction).not.toHaveBeenCalled();
		// This device's own copy still goes.
		expect(mockRemoveItem).toHaveBeenCalled();
	});

	test("a device that never registered touches nothing on the account", async () => {
		mockGetItem.mockResolvedValue(null);
		await clearPushToken(OTHER_PHONE);
		expect(mockRpcAction).not.toHaveBeenCalled();
	});

	test("an unknown account token clears outright, as sign-out always did", async () => {
		mockGetItem.mockResolvedValue(THIS_PHONE);
		await clearPushToken(undefined);
		expect(mockRpcAction).toHaveBeenCalledWith("set_push_token", { token: null });
	});
});

describe("sign-out scope", () => {
	const account = readFileSync(join(__dirname, "../components/Account.tsx"), "utf8");

	test("Sign out revokes only this device's session", () => {
		const handler = account.slice(
			account.indexOf("const handleSignOut = async"),
			account.indexOf("};", account.indexOf("const handleSignOut = async")),
		);
		expect(handler).toContain('signOut({ scope: "local" })');
		// It reads the account's one push token so it clears only this device's.
		expect(handler).toContain('select("expo_push_token")');
		expect(handler).toMatch(/clearPushToken\(\s*pushReadError/);
	});

	test("deleting the account signs every device out, on purpose", () => {
		const del = account.slice(account.indexOf('rpc("delete_my_account")'));
		expect(del.slice(0, 400)).toContain('signOut({ scope: "global" })');
	});

	test("no sign-out in the app takes Supabase's implicit global default", () => {
		expect(account).not.toMatch(/auth\.signOut\(\s*\)/);
	});
});
