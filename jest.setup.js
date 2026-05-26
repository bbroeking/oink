// Jest setup — runs once before the test environment is ready.
//
// @expo/vector-icons loads native font files at import time, which
// jest-expo's renderer-only environment doesn't ship. Mocking the
// two families we actually use (MaterialCommunityIcons + Feather)
// keeps tests passing without losing the rendered-tree shape — the
// mock renders a Text node carrying the icon's name so assertions
// like `findByProps({ name: 'crown' })` still resolve.

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
