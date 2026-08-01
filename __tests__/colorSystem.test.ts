import fs from "node:fs";
import path from "node:path";
import { UI_COLORS, WHIMSY } from "@/constants/theme";

const ROOT = path.resolve(__dirname, "..");

function relativeLuminance(hex: string): number {
	const channels = hex
		.slice(1)
		.match(/../g)!
		.map((channel) => Number.parseInt(channel, 16) / 255)
		.map((channel) =>
			channel <= 0.04045
				? channel / 12.92
				: ((channel + 0.055) / 1.055) ** 2.4,
		);
	return (
		channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722
	);
}

function contrast(foreground: string, background: string): number {
	const a = relativeLuminance(foreground);
	const b = relativeLuminance(background);
	return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

describe("appearance contract", () => {
	it("declares the Expo and native iOS app light-only", () => {
		const app = JSON.parse(
			fs.readFileSync(path.join(ROOT, "app.json"), "utf8"),
		);
		const plist = fs.readFileSync(
			path.join(ROOT, "ios/ttp/Info.plist"),
			"utf8",
		);
		const nativeSplash = JSON.parse(
			fs.readFileSync(
				path.join(
					ROOT,
					"ios/ttp/Images.xcassets/SplashScreenBackground.colorset/Contents.json",
				),
				"utf8",
			),
		);

		expect(app.expo.userInterfaceStyle).toBe("light");
		expect(app.expo.android.adaptiveIcon.backgroundColor).toBe(
			UI_COLORS.canvas,
		);
		const splashPlugin = app.expo.plugins.find(
			(plugin: unknown) =>
				Array.isArray(plugin) && plugin[0] === "expo-splash-screen",
		);
		expect(splashPlugin[1].backgroundColor).toBe(UI_COLORS.canvas);
		expect(plist).toMatch(
			/<key>UIUserInterfaceStyle<\/key>\s*<string>Light<\/string>/,
		);
		expect(nativeSplash.colors[0].color.components).toMatchObject({
			red: "1.00000000000000",
			green: "0.98039215686275",
			blue: "0.94117647058824",
		});
	});

	it("uses one light navigation theme and an explicit dark status bar", () => {
		const layout = fs.readFileSync(
			path.join(ROOT, "app/_layout.tsx"),
			"utf8",
		);

		expect(layout).toContain("value={APP_NAV_THEME}");
		expect(layout).toContain('<StatusBar style="dark"');
		expect(layout).not.toContain("DarkTheme");
		expect(layout).not.toContain("useColorScheme");
		expect(layout).not.toContain('style="auto"');
	});
});

describe("semantic color contrast", () => {
	const calmSurfaces = [
		WHIMSY.paper,
		WHIMSY.cream,
		WHIMSY.cream2,
		WHIMSY.rose,
		WHIMSY.sky,
		WHIMSY.sage,
		WHIMSY.sun,
		WHIMSY.lilac,
		WHIMSY.peach,
	];

	it.each(calmSurfaces)(
		"keeps primary text above AA on %s",
		(surface) => {
			expect(contrast(UI_COLORS.textPrimary, surface)).toBeGreaterThanOrEqual(
				4.5,
			);
		},
	);

	it.each(calmSurfaces)(
		"keeps secondary body text above AA on %s",
		(surface) => {
			expect(
				contrast(UI_COLORS.textSecondary, surface),
			).toBeGreaterThanOrEqual(4.5);
		},
	);

	it.each([
		[UI_COLORS.action, UI_COLORS.surface],
		[UI_COLORS.successText, UI_COLORS.successSurface],
		[UI_COLORS.warningText, UI_COLORS.warningSurface],
		[UI_COLORS.infoText, UI_COLORS.infoSurface],
		[UI_COLORS.dangerText, UI_COLORS.dangerSurface],
		[UI_COLORS.textOnDark, WHIMSY.bark],
	])("keeps semantic text pair %s / %s above AA", (text, surface) => {
		expect(contrast(text, surface)).toBeGreaterThanOrEqual(4.5);
	});

	it("keeps disabled controls and separators visually discernible", () => {
		expect(
			contrast(UI_COLORS.textDisabled, UI_COLORS.surface),
		).toBeGreaterThanOrEqual(3);
		expect(contrast(UI_COLORS.separator, UI_COLORS.surface)).toBeGreaterThanOrEqual(
			3,
		);
	});
});
