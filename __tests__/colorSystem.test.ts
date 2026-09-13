import fs from "node:fs";
import path from "node:path";
import {
	ACCENT_SAFE_FILLS,
	PIG_ACCENT,
	RARITY_BADGE,
	RARITY_BG_SOLID,
	RARITY_STRIPE,
	TINT,
	UI_COLORS,
	WHIMSY,
} from "@/constants/theme";

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
			green: "0.980392156862745",
			blue: "0.941176470588235",
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

// The twelve named Sticker fills, mirroring components/ui/Sticker.tsx's
// COLOR_MAP. `bark` is the one dark fill: ink and mute are unreadable on it by
// construction (1.19:1 / 1.84:1), so it is tested against textOnDark instead —
// the taste standard's "barkText on bark" pair. (2026-09-11)
const LIGHT_STICKER_FILLS: [string, string][] = [
	["paper", WHIMSY.paper],
	["cream", WHIMSY.cream],
	["cream2", WHIMSY.cream2],
	["rose", WHIMSY.rose],
	["roseDeep", WHIMSY.roseDeep],
	["sky", WHIMSY.sky],
	["sage", WHIMSY.sage],
	["sun", WHIMSY.sun],
	["lilac", WHIMSY.lilac],
	["lilacDeep", WHIMSY.lilacDeep],
	["peach", WHIMSY.peach],
];

// `mute` is text-safe on every fill except the two "deep" pastels, where the
// taste standard already says the text is ink. The carve-out is asserted with
// the measured floor rather than skipped, so a palette tweak that makes either
// one worse still fails. (2026-09-11)
const MUTE_CARVE_OUT: Record<string, number> = {
	roseDeep: 3.9, // measured 3.93
	lilacDeep: 3.0, // measured 3.07
};

describe("sticker fill contrast", () => {
	it.each(LIGHT_STICKER_FILLS)(
		"keeps ink above AA on the %s fill",
		(_name, fill) => {
			expect(contrast(WHIMSY.ink, fill)).toBeGreaterThanOrEqual(4.5);
		},
	);

	it("keeps barkText above AA on the bark fill", () => {
		expect(contrast(UI_COLORS.textOnDark, WHIMSY.bark)).toBeGreaterThanOrEqual(
			4.5,
		);
	});

	it.each(LIGHT_STICKER_FILLS)(
		"keeps mute legible on the %s fill",
		(name, fill) => {
			expect(contrast(WHIMSY.mute, fill)).toBeGreaterThanOrEqual(
				MUTE_CARVE_OUT[name] ?? 4.5,
			);
		},
	);

	it.each(ACCENT_SAFE_FILLS)(
		"keeps the accent kicker above AA on %s",
		(fill) => {
			expect(contrast(WHIMSY.accent, fill)).toBeGreaterThanOrEqual(4.5);
		},
	);

	it.each(ACCENT_SAFE_FILLS)(
		"keeps disabled text above AA on %s",
		(fill) => {
			expect(contrast(UI_COLORS.textDisabled, fill)).toBeGreaterThanOrEqual(
				4.5,
			);
		},
	);

	it("keeps muteSoft out of the text roles it used to hold", () => {
		// muteSoft is a boundary color (3.78:1 on paper), which is why
		// textDisabled moved to muteDim and muteSoft became uiMuted.
		expect(UI_COLORS.uiMuted).toBe(WHIMSY.muteSoft);
		expect(UI_COLORS.textDisabled).toBe(WHIMSY.muteDim);
		expect(UI_COLORS.textPlaceholder).toBe(WHIMSY.muteDim);
		expect(contrast(WHIMSY.muteSoft, WHIMSY.paper)).toBeLessThan(4.5);
	});
});

// Every PIG_ACCENT entry is a fill with ink text on it: `solid` is the pig's
// nameplate (PigPenView, PigFriendsLaunchModal), `tint` is the art well and the
// name ribbon (PigRosterPicker). So both halves are held to the Sticker-fill
// law. (2026-09-11, wave 4)
describe("pig accent contrast", () => {
	const entries = Object.entries(PIG_ACCENT);

	it.each(entries)(
		"keeps ink above AA on %s's nameplate solid",
		(_pig, accent) => {
			expect(contrast(WHIMSY.ink, accent.solid)).toBeGreaterThanOrEqual(4.5);
		},
	);

	it.each(entries)(
		"keeps %s's tint a legal Sticker fill",
		(_pig, accent) => {
			expect(contrast(WHIMSY.ink, accent.tint)).toBeGreaterThanOrEqual(4.5);
		},
	);

	it("records which identity hues lean on the nameplate's ink border", () => {
		// A `solid` that clears 3:1 against paper carries its own boundary; one
		// that doesn't is legible only because the nameplate is drawn with an ink
		// border. The three below are the characters' own pastels (Rosie IS pink),
		// so they are NOT re-hued — but the list is pinned, exactly like the
		// rarity stripes: a NEW sub-3:1 accent fails here, and so does fixing one,
		// which forces the call to be made deliberately.
		const borderCarried = Object.keys(PIG_ACCENT).filter(
			(pig) => contrast(PIG_ACCENT[pig].solid, UI_COLORS.surface) < 3,
		);
		expect(borderCarried.sort()).toEqual(["biscuit", "pickles", "rosie"]);
	});
});

describe("rarity badge contrast", () => {
	it.each(Object.entries(RARITY_BADGE))(
		"writes the %s rarity in an ink that clears AA on its own fill",
		(_rarity, pair) => {
			expect(contrast(pair.ink, pair.bg)).toBeGreaterThanOrEqual(4.5);
		},
	);

	it("keeps every badge fill in step with RARITY_BG_SOLID", () => {
		for (const [rarity, pair] of Object.entries(RARITY_BADGE)) {
			expect(pair.bg).toBe(RARITY_BG_SOLID[rarity]);
		}
	});
});

describe("non-text contrast", () => {
	it.each([
		["successBorder", UI_COLORS.successBorder],
		["separator", UI_COLORS.separator],
	])("keeps the %s boundary at or above 3:1 on paper", (_name, color) => {
		expect(contrast(color, UI_COLORS.surface)).toBeGreaterThanOrEqual(3);
	});

	it("records the rarity stripes as the open non-text gap", () => {
		// 2026-09-11 audit: none of the five saturated stripes clears 3:1 against
		// its own RARITY_BG_SOLID panel (1.69–2.95). On the shop's legend dot and
		// card dot the 2px ink border carries the boundary, so the marker is
		// legible; the closet's borderless 4px stripe is the real gap. Re-hueing
		// five brand markers is a design decision, not a test fix, so the gap is
		// recorded here: this fails if a NEW stripe drops below 3:1, and it also
		// fails when one is fixed, forcing the list to be updated deliberately.
		const below = Object.keys(RARITY_STRIPE).filter(
			(rarity) =>
				contrast(RARITY_STRIPE[rarity], RARITY_BG_SOLID[rarity]) < 3,
		);
		expect(below.sort()).toEqual(
			["common", "epic", "legendary", "rare", "uncommon"],
		);
	});
});

describe("ink-derived tints", () => {
	it("dims every modal with the same ink the outlines are drawn in", () => {
		expect(UI_COLORS.scrim).toBe(TINT.scrim);
		expect(TINT.scrim).toContain("42, 31, 21");
	});
});

describe("legacy palette", () => {
	it("has no screen, component, or hook importing constants/Colors", () => {
		const offenders: string[] = [];
		const visit = (relative: string) => {
			const absolute = path.join(ROOT, relative);
			for (const entry of fs.readdirSync(absolute, { withFileTypes: true })) {
				const child = path.join(relative, entry.name);
				if (entry.isDirectory()) {
					if (entry.name === "node_modules") continue;
					visit(child);
				} else if (/\.tsx?$/.test(entry.name)) {
					const source = fs.readFileSync(path.join(ROOT, child), "utf8");
					if (/from\s+["'][^"']*constants\/Colors["']/.test(source)) {
						offenders.push(child);
					}
				}
			}
		};
		["app", "components", "hooks"].forEach(visit);
		expect(offenders).toEqual([]);
	});
});
