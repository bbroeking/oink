// Jest setup — runs once before the test environment is ready.
//
// @expo/vector-icons loads native font files at import time, which
// jest-expo's renderer-only environment doesn't ship. Mocking the
// two families we actually use (MaterialCommunityIcons + Feather)
// keeps tests passing without losing the rendered-tree shape — the
// mock renders a Text node carrying the icon's name so assertions
// like `findByProps({ name: 'crown' })` still resolve.

// React 19 schedules react-test-renderer mounts concurrently. Most of this
// suite predates that behavior and expects create() to have committed before
// reading renderer.root. Keep that useful synchronous test contract by making
// the initial mount an explicit act(), as React 19 requires.
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// RN 0.86's preset gives this data property a jest.fn. Model a foreground app;
// lifecycle tests explicitly drive background/foreground and navigation events.
require("react-native").AppState.currentState = "active";

// Expo 57 installs some web-compatible globals lazily. When a test first
// touches one during teardown, expo-modules-core also initializes its native
// JS logger. Supply the harmless native logger surface that exists on-device
// so the renderer-only environment does not emit a post-test warning.
globalThis.expo = {
	...(globalThis.expo || {}),
	modules: {
		...(globalThis.expo?.modules || {}),
		ExpoModulesCoreJSLogger: { addListener: jest.fn() },
	},
};

const TestRenderer = require("react-test-renderer");
const createRenderer = TestRenderer.create.bind(TestRenderer);
TestRenderer.create = (element, options) => {
	let renderer;
	TestRenderer.act(() => {
		renderer = createRenderer(element, options);
	});
	return renderer;
};

// AsyncStorage's native module isn't linked in the renderer-only test env.
// Use the package's official in-memory jest mock so any module that imports
// AsyncStorage (e.g. utils/pigSkin via the pig render path) works out of the
// box. Individual test files that jest.mock the module themselves still win.
jest.mock("@react-native-async-storage/async-storage", () =>
	require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

jest.mock("@expo/vector-icons", () => {
	const React = require("react");
	const { Text } = require("react-native");
	const make = (family) =>
		function Stub({ name, size, color }) {
			return React.createElement(
				Text,
				{ "data-icon-family": family, "data-icon-name": name, "data-icon-size": size, "data-icon-color": color },
				""
			);
		};
	return {
		MaterialCommunityIcons: make("MaterialCommunityIcons"),
		Feather: make("Feather"),
		// Re-export anything else used in the future as no-ops returning a Text.
		FontAwesome: make("FontAwesome"),
		FontAwesome5: make("FontAwesome5"),
		Ionicons: make("Ionicons"),
		AntDesign: make("AntDesign"),
	};
});

// Reanimated 4 needs the worklets native module, which the renderer-only test
// env doesn't ship — and `components/ui/index.tsx` (the sanctioned import path)
// re-exports Spotlight, so ANY module that imports the barrel now pulls it in.
// Spotlight uses reanimated only for the decorative halo breathe and the caption
// wiggle, so a plain-View stand-in keeps the tree shape intact without the
// runtime. Individual test files that jest.mock the module themselves still win.
// (2026-09-11)
jest.mock("react-native-reanimated", () => {
	const React = require("react");
	const { View } = require("react-native");
	const passthrough = (v) => v;
	const Animated = {
		View: React.forwardRef((props, ref) =>
			React.createElement(View, { ...props, ref })
		),
		createAnimatedComponent: (Component) => Component,
	};
	return {
		__esModule: true,
		default: Animated,
		Easing: {
			inOut: passthrough,
			out: passthrough,
			in: passthrough,
			quad: passthrough,
			cubic: passthrough,
			linear: passthrough,
			bezier: () => passthrough,
		},
		useSharedValue: (value) => ({ value }),
		useAnimatedProps: (fn) => fn(),
		useAnimatedStyle: (fn) => fn(),
		useDerivedValue: (fn) => ({ value: fn() }),
		withDelay: (_d, v) => v,
		withRepeat: passthrough,
		withSequence: passthrough,
		withSpring: passthrough,
		withTiming: passthrough,
		runOnJS: (fn) => fn,
		runOnUI: (fn) => fn,
		cancelAnimation: () => {},
	};
});

// expo-audio has no renderer-only implementation, and the barrel re-exports
// `BuyCelebration` / the tray sounds, so importing `@/components/ui` now reaches
// it. Default no-op players; a test that asserts on playback still supplies its
// own mock. (2026-09-11)
jest.mock("expo-audio", () => {
	const player = () => ({
		play: jest.fn(),
		pause: jest.fn(),
		seekTo: jest.fn(),
		replace: jest.fn(),
		release: jest.fn(),
		remove: jest.fn(),
		volume: 1,
	});
	return {
		useAudioPlayer: player,
		createAudioPlayer: jest.fn(player),
		setAudioModeAsync: jest.fn().mockResolvedValue(undefined),
	};
});

// The Rive runtime has no renderer-only build, and the barrel exports the
// index-resolved `RivePig` (which Metro/Jest resolve to the .native file). The
// pig render path already degrades to `RasterPig`, so the stub only has to
// exist. Tests that drive Rive supply their own mock. (2026-09-11)
jest.mock("@rive-app/react-native", () => ({
	Alignment: { Center: "center" },
	Fit: { Contain: "contain", Cover: "cover" },
	RiveView: () => null,
	useRive: () => [null, null],
	useRiveFile: () => ({ riveFile: null, status: "idle" }),
}));
