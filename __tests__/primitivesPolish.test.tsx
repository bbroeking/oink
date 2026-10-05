// The 2026-10-04 polish pass on the primitives and the shell. Each block pins
// one defect class the "before" captures showed (or one primitive ask an area
// agent forwarded), at the primitive level, so every caller inherits it.
import fs from "node:fs";
import path from "node:path";
import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import {
	Dimensions,
	ScrollView,
	StyleSheet,
	Text,
	TextInput,
	View,
	type ScaledSize,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";

import { ActionSheet } from "../components/ui/ActionSheet";
import { AdaptiveModalScaffold } from "../components/ui/AdaptiveModalScaffold";
import { Button } from "../components/ui/Button";
import { Ceremony } from "../components/ui/Ceremony";
import { Ribbon, Tag } from "../components/ui/Chip";
import { DialogCloseRow } from "../components/ui/DialogCloseRow";
import { useIconScale } from "../components/ui/DynamicTypeText";
import { EmptyState } from "../components/ui/EmptyState";
import { HangingSignsTabBar } from "../components/ui/HangingSignsTabBar";
import { Icon } from "../components/ui/Icon";
import { ListRow, NavRow } from "../components/ui/ListRow";
import { PageHeader } from "../components/ui/PageHeader";
import { PrestigeAvatar } from "../components/ui/PrestigeAvatar";
import { ProfileIdentity } from "../components/ui/ProfileIdentity";
import { ReceiptRows, ReceiptTotal } from "../components/ui/Receipt";
import { ScrollEdge, useScrollEdge } from "../components/ui/ScrollEdge";
import { SectionHeader } from "../components/ui/SectionHeader";
import { SegmentedControl } from "../components/ui/SegmentedControl";
import { Sheet } from "../components/ui/Sheet";
import { STACK_SCROLL_EDGES, StackPage, useStackScrollPad } from "../components/ui/StackPage";
import { Sticker } from "../components/ui/Sticker";
import { TextField } from "../components/ui/TextField";
import { TicketButton } from "../components/ui/TicketButton";
import { ToastHost, showToast } from "../components/ui/Toast";
import * as UI from "../components/ui";
import {
	ART_SIZE,
	BORDER,
	CHROME_TYPE_CAP,
	LIST_BLEED,
	OPACITY,
	PAGE_PAD,
	RADII,
	SHADOW_SM,
	SPACE,
	STICKER_SHADOW,
	TILE_TYPE_CAP,
	TILT,
	TITLE_RULE,
	TYPE,
	UI_COLORS,
} from "../constants/theme";

jest.mock("../components/AppleAuth", () => ({ AppleAuth: () => null }));
jest.mock("../components/GoogleAuth", () => ({ GoogleAuth: () => null }));
jest.mock("../utils/supabase", () => ({ supabase: { auth: {} } }));
jest.mock("../components/ui/PigStage", () => ({ PigStage: () => null }));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const SupaAuth = require("../components/SupaAuth").default as React.ComponentType;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { fitRosieHeight } = require("../components/rosieHero") as typeof import("../components/rosieHero");

const ROOT = path.resolve(__dirname, "..");
const metrics = {
	frame: { x: 0, y: 0, width: 375, height: 667 },
	insets: { top: 20, left: 0, right: 0, bottom: 34 },
};

function mount(node: React.ReactNode) {
	let renderer!: TestRenderer.ReactTestRenderer;
	act(() => {
		renderer = TestRenderer.create(
			<SafeAreaProvider initialMetrics={metrics}>{node}</SafeAreaProvider>,
		);
	});
	return renderer;
}

const host = (r: TestRenderer.ReactTestRenderer, id: string) =>
	r.root.findAll((n) => n.props.testID === id && typeof n.type === "string")[0];
const flat = (node: TestRenderer.ReactTestInstance) => StyleSheet.flatten(node.props.style);
const edgeOpacity = (r: TestRenderer.ReactTestRenderer, id: string) => flat(host(r, id)).opacity;

const scrollEvent = (offset: number, viewport: number, content: number) => ({
	nativeEvent: {
		contentOffset: { x: 0, y: offset },
		layoutMeasurement: { width: 339, height: viewport },
		contentSize: { width: 339, height: content },
	},
});

const initialWindow = { ...Dimensions.get("window") };
const initialScreen = { ...Dimensions.get("screen") };
const setFontScale = (fontScale: number) =>
	act(() => {
		Dimensions.set({ window: { ...initialWindow, fontScale } as ScaledSize, screen: initialScreen });
	});
afterEach(() => setFontScale(initialWindow.fontScale ?? 1));

describe("ScrollEdge: one scroll-edge rule for every fixed header", () => {
	test("is the crown's own rule, run full width, always laid out, its opacity the state", () => {
		const r = mount(<ScrollEdge visible={false} testID="edge" />);
		const rule = host(r, "edge");
		expect(flat(rule).height).toBe(BORDER.ink);
		expect(flat(rule).backgroundColor).toBe(TITLE_RULE.backgroundColor);
		expect(flat(rule).opacity).toBe(0);
		expect(flat(rule).position).toBeUndefined();
		expect(rule.props.importantForAccessibility).toBe("no-hide-descendants");
		act(() => r.update(
			<SafeAreaProvider initialMetrics={metrics}>
				<ScrollEdge visible testID="edge" />
			</SafeAreaProvider>,
		));
		expect(edgeOpacity(r, "edge")).toBe(OPACITY.rule);
		act(() => r.unmount());
	});

	test("overlay places it on its parent's edge, bled past a padded host", () => {
		const r = mount(<ScrollEdge visible overlay="bottom" bleed={PAGE_PAD} testID="edge" />);
		const style = flat(host(r, "edge"));
		expect(style.position).toBe("absolute");
		expect(style.bottom).toBe(0);
		expect(style.left).toBe(-PAGE_PAD);
		expect(style.right).toBe(-PAGE_PAD);
		act(() => r.unmount());
	});

	test("useScrollEdge flips once past its threshold, composes the caller's handler, and throttles", () => {
		const callerOnScroll = jest.fn();
		let edge!: ReturnType<typeof useScrollEdge>;
		function Probe({ threshold }: { threshold?: number }) {
			edge = useScrollEdge({ threshold, onScroll: callerOnScroll });
			return null;
		}
		const r = mount(<Probe threshold={120} />);
		expect(edge.edgeVisible).toBe(false);
		expect(edge.scrollEventThrottle).toBe(16);
		act(() => edge.onScroll(scrollEvent(100, 400, 1200) as never));
		expect(edge.edgeVisible).toBe(false);
		act(() => edge.onScroll(scrollEvent(150, 400, 1200) as never));
		expect(edge.edgeVisible).toBe(true);
		expect(callerOnScroll).toHaveBeenCalledTimes(2);
		act(() => r.unmount());
	});

	test("the barrel exports the new public pieces", () => {
		for (const name of [
			"ScrollEdge",
			"useScrollEdge",
			"useScrollEdgeBelow",
			"useIconScale",
			"DynamicTypeText",
			"STACK_SCROLL_EDGES",
			"useStackScrollPad",
			"TAB_ROLE",
			"TAB_LIST_ROLE",
			"profileIdentityText",
		]) {
			expect((UI as Record<string, unknown>)[name]).toBeDefined();
		}
	});
});

describe("Sheet: the header owns its scroll edge", () => {
	const longBody = Array.from({ length: 30 }, (_, i) => <Text key={i}>row {i}</Text>);

	test("at rest the first row sits SPACE.md under the title, split so the clip edge keeps paper", () => {
		const r = mount(
			<Sheet open onClose={() => {}} kicker="your satchel" title="6 finds">
				{longBody}
			</Sheet>,
		);
		const body = StyleSheet.flatten(r.root.findByType(ScrollView).props.contentContainerStyle);
		// The header's breath is the title's descender room: Caprasimo's "y"
		// reaches 4.2pt under its baseline, and at SPACE.xxs the rule sat 3pt
		// below it and read as touching (after/074).
		const header = r.root.findAll(
			(n) =>
				typeof n.type === "string" &&
				flat(n)?.paddingBottom === SPACE.xs &&
				n.findAll((c) => c.props.accessibilityRole === "header").length > 0,
		)[0];
		expect(header).toBeDefined();
		// header pad + the always-laid-out edge rule + the body's top pad = 12pt.
		expect(SPACE.xs + BORDER.ink + body.paddingTop).toBe(SPACE.md);
		// The body keeps enough paper for a tilted first sticker's corner (~3.6pt).
		expect(body.paddingTop).toBeGreaterThan(3.6);
		act(() => r.unmount());
	});

	test("the edge rule shows once a row scrolls under the header, and leaves at the top", () => {
		const r = mount(
			<Sheet open onClose={() => {}} title="all you've done">
				{longBody}
			</Sheet>,
		);
		const scroll = r.root.findByType(ScrollView);
		expect(scroll.props.scrollEventThrottle).toBe(16);
		expect(edgeOpacity(r, "sheet-edge-top")).toBe(0);
		act(() => scroll.props.onScroll(scrollEvent(40, 300, 900)));
		expect(edgeOpacity(r, "sheet-edge-top")).toBe(OPACITY.rule);
		// Bled past the panel's PAGE_PAD: ink border to ink border.
		expect(flat(host(r, "sheet-edge-top")).marginHorizontal).toBe(-PAGE_PAD);
		act(() => scroll.props.onScroll(scrollEvent(0, 300, 900)));
		expect(edgeOpacity(r, "sheet-edge-top")).toBe(0);
		act(() => r.unmount());
	});

	test("a pinned footer owns its top edge while there is more body below it", () => {
		const r = mount(
			<Sheet open onClose={() => {}} title="Profile" footer={<Text>Report · Block</Text>}>
				{longBody}
			</Sheet>,
		);
		const scroll = r.root.findByType(ScrollView);
		act(() => {
			scroll.props.onLayout({ nativeEvent: { layout: { x: 0, y: 0, width: 339, height: 300 } } });
			scroll.props.onContentSizeChange(339, 900);
		});
		expect(edgeOpacity(r, "sheet-edge-bottom")).toBe(OPACITY.rule);
		expect(flat(host(r, "sheet-edge-bottom")).position).toBe("absolute");
		act(() => scroll.props.onScroll(scrollEvent(600, 300, 900)));
		expect(edgeOpacity(r, "sheet-edge-bottom")).toBe(0);
		act(() => r.unmount());
	});

	test("a sheet closed while scrolled reopens with its edge at rest", () => {
		const sheet = (open: boolean) => (
			<SafeAreaProvider initialMetrics={metrics}>
				<Sheet open={open} onClose={() => {}} title="Wallow rank">
					{longBody}
				</Sheet>
			</SafeAreaProvider>
		);
		let r!: TestRenderer.ReactTestRenderer;
		act(() => {
			r = TestRenderer.create(sheet(true));
		});
		act(() => r.root.findByType(ScrollView).props.onScroll(scrollEvent(120, 300, 900)));
		expect(edgeOpacity(r, "sheet-edge-top")).toBe(OPACITY.rule);
		act(() => r.update(sheet(false)));
		act(() => r.update(sheet(true)));
		expect(edgeOpacity(r, "sheet-edge-top")).toBe(0);
		act(() => r.unmount());
	});

	test("the body bleeds LIST_BLEED and pads back, so shadows land inside the clip (A-2)", () => {
		const r = mount(
			<Sheet open onClose={() => {}} title="Rewards">
				{longBody}
			</Sheet>,
		);
		const scroll = r.root.findByType(ScrollView);
		expect(flat(scroll).marginHorizontal).toBe(-LIST_BLEED);
		expect(StyleSheet.flatten(scroll.props.contentContainerStyle).paddingHorizontal).toBe(LIST_BLEED);
		// The height-cap chain still shrinks.
		expect(flat(scroll).flexShrink).toBe(1);
		expect(flat(scroll).minHeight).toBe(0);
		act(() => r.unmount());
	});

	test("VoiceOver's escape gesture closes it, like the × and the scrim", () => {
		const onClose = jest.fn();
		const r = mount(
			<Sheet open onClose={onClose} title="Settings" testID="settings-sheet">
				<Text>body</Text>
			</Sheet>,
		);
		const panel = host(r, "settings-sheet");
		expect(panel.props.accessibilityViewIsModal).toBe(true);
		act(() => panel.props.onAccessibilityEscape());
		expect(onClose).toHaveBeenCalledTimes(1);
		act(() => r.unmount());
	});
});

describe("AdaptiveModalScaffold", () => {
	test("a pinned close rail owns its edge; the caller's onScroll still runs", () => {
		const callerOnScroll = jest.fn();
		const r = mount(
			<AdaptiveModalScaffold
				visible
				presentation="inline"
				onRequestClose={() => {}}
				showCloseButton
				scrollViewProps={{ onScroll: callerOnScroll }}
			>
				<Text>a long explainer</Text>
			</AdaptiveModalScaffold>,
		);
		const scroll = r.root.findByType(ScrollView);
		expect(edgeOpacity(r, "dialog-edge-top")).toBe(0);
		act(() => scroll.props.onScroll(scrollEvent(30, 400, 1200)));
		expect(edgeOpacity(r, "dialog-edge-top")).toBe(OPACITY.rule);
		expect(callerOnScroll).toHaveBeenCalledTimes(1);
		act(() => r.unmount());
	});

	test("a dialog without a rail does not listen to its scroll at all", () => {
		const r = mount(
			<AdaptiveModalScaffold visible presentation="inline" onRequestClose={() => {}}>
				<Text>a decision</Text>
			</AdaptiveModalScaffold>,
		);
		const scroll = r.root.findByType(ScrollView);
		expect(scroll.props.onScroll).toBeUndefined();
		expect(scroll.props.scrollEventThrottle).toBeUndefined();
		act(() => r.unmount());
	});

	test("the sticker-card frame: paper, heavy ink, dialog lean, hard shadow, unclipped, × pinned (Season ask 4)", () => {
		const r = mount(
			<AdaptiveModalScaffold visible presentation="inline" onRequestClose={() => {}} card testID="card">
				<Text>The Season of the Hunger</Text>
			</AdaptiveModalScaffold>,
		);
		const frame = flat(host(r, "card"));
		expect(frame.borderWidth).toBe(BORDER.heavy);
		expect(frame.borderRadius).toBe(RADII.xxl);
		expect(frame.overflow).toBe("visible");
		expect(frame.transform).toEqual([{ rotate: `${TILT.dialog}deg` }]);
		expect(frame.shadowOffset).toEqual(STICKER_SHADOW.shadowOffset);
		// The × rides the card, above the scroller.
		const close = r.root.findAll(
			(n) => n.props.accessibilityRole === "button" && n.props.accessibilityLabel === "Close" && typeof n.props.style === "function",
		);
		expect(close.length).toBeGreaterThan(0);
		// The side inset belongs to the scrolling body.
		expect(StyleSheet.flatten(r.root.findByType(ScrollView).props.contentContainerStyle).paddingHorizontal).toBe(SPACE.lg);
		act(() => r.unmount());
	});
});

describe("ActionSheet: one way out", () => {
	test("the panel's × is the only Close; items carry their hints", () => {
		const r = mount(
			<ActionSheet
				open
				onClose={() => {}}
				title="The Great Hunger"
				items={[
					{ label: "The season's story", onPress: () => {}, accessibilityHint: "Opens the story" },
					{ label: "Your tickle receipt", onPress: () => {} },
				]}
			/>,
		);
		const pills = r.root.findAll(
			(n) =>
				n.props.accessibilityRole === "button" &&
				n.props.accessibilityLabel === "Close" &&
				typeof n.type !== "string" &&
				n.findAll((c) => c.props.children === "Close").length > 0,
		);
		expect(pills).toHaveLength(0);
		const story = r.root.findAll(
			(n) => n.props.accessibilityLabel === "The season's story" && n.props.accessibilityRole === "button",
		)[0];
		expect(story.props.accessibilityHint).toBe("Opens the story");
		act(() => r.unmount());
	});
});

describe("close and back controls are named buttons", () => {
	test("DialogCloseRow's × is a button named Close with a consequence (and takes a hint)", () => {
		const onPress = jest.fn();
		const r = mount(
			<View>
				<DialogCloseRow onPress={onPress} />
				<DialogCloseRow onPress={onPress} accessibilityHint="Closes the guide" />
			</View>,
		);
		const xs = r.root.findAll(
			(n) => n.props.accessibilityRole === "button" && typeof n.props.style === "function",
		);
		expect(xs[0].props.accessibilityLabel).toBe("Close");
		expect(xs[0].props.accessibilityHint).toBe("Closes this dialog");
		expect(xs[1].props.accessibilityHint).toBe("Closes the guide");
		act(() => xs[0].props.onPress());
		expect(onPress).toHaveBeenCalledTimes(1);
		act(() => r.unmount());
	});

	test("Ceremony routes VoiceOver's escape to the scene's own exit", () => {
		const onRequestClose = jest.fn();
		const r = mount(
			<Ceremony open onRequestClose={onRequestClose}>
				<Text>a visit</Text>
			</Ceremony>,
		);
		const ground = r.root.findAll(
			(n) => n.props.accessibilityViewIsModal === true && typeof n.type === "string",
		)[0];
		act(() => ground.props.onAccessibilityEscape());
		expect(onRequestClose).toHaveBeenCalledTimes(1);
		act(() => r.unmount());
	});
});

describe("HangingSignsTabBar at large text", () => {
	const routes = ["index", "friends", "season", "shop", "account"].map((name) => ({
		key: `${name}-key`,
		name,
	}));
	const bar = () => {
		const navigation = { emit: jest.fn(() => ({ defaultPrevented: false })), navigate: jest.fn() };
		const props = {
			state: { index: 1, routes },
			navigation,
		} as unknown as React.ComponentProps<typeof HangingSignsTabBar>;
		return { r: mount(<HangingSignsTabBar {...props} />), navigation };
	};
	const signs = (r: TestRenderer.ReactTestRenderer) =>
		r.root.findAll(
			(n) => typeof n.type !== "string" && n.props.accessibilityLargeContentTitle !== undefined && typeof n.props.onPress === "function",
		);
	const label = (r: TestRenderer.ReactTestRenderer, word: string) =>
		r.root.find((n) => n.type === Text && n.props.children === word);

	test("signs are iOS buttons (selected) inside a tab-bar container — role tab has no iOS trait", () => {
		const { r, navigation } = bar();
		const all = signs(r);
		expect(all).toHaveLength(5);
		for (const sign of all) {
			expect(sign.props.accessibilityRole).toBe("button");
			expect(sign.props.accessible).not.toBe(false);
		}
		expect(all.map((s) => s.props.accessibilityLabel)).toEqual(["Barn", "Friends", "Season", "Shop", "Me"]);
		expect(all.map((s) => s.props.accessibilityState.selected)).toEqual([false, true, false, false, false]);
		expect(r.root.findAll((n) => n.props.accessibilityRole === "tabbar").length).toBeGreaterThan(0);
		act(() => all[2].props.onPress());
		expect(navigation.navigate).toHaveBeenCalledWith("season", undefined);
		act(() => r.unmount());
	});

	test("every word is capped at the chrome ceiling and offers the Large Content Viewer", () => {
		const { r } = bar();
		for (const word of ["Barn", "Friends", "Season", "Shop", "Me"]) {
			expect(label(r, word).props.maxFontSizeMultiplier).toBe(CHROME_TYPE_CAP);
		}
		for (const sign of signs(r)) expect(sign.props.accessibilityShowsLargeContentViewer).toBe(true);
		act(() => r.unmount());
	});

	test("a sign is 64pt at least, never a fixed 64", () => {
		const { r } = bar();
		const frames = r.root.findAll((n) => typeof n.type === "string" && flat(n)?.minWidth === 64);
		expect(frames).toHaveLength(5);
		for (const f of frames) expect(flat(f).width).toBeUndefined();
		act(() => r.unmount());
	});

	test("a live text-size change re-measures the words without remounting the signs", () => {
		const { r } = bar();
		const signBefore = signs(r)[1];
		const wordBefore = label(r, "Friends");
		setFontScale(2.143);
		expect(label(r, "Friends")).not.toBe(wordBefore);
		expect(signs(r)[1]).toBe(signBefore);
		act(() => r.unmount());
	});
});

describe("SegmentedControl hub layout states its ceiling", () => {
	const hub = (extra: Partial<React.ComponentProps<typeof SegmentedControl>> = {}) =>
		mount(
			<SegmentedControl
				label="Friends hub sections"
				layout="icon-over-label"
				value="friends"
				onChange={() => {}}
				options={[
					{ value: "friends", label: "Friends", icon: "friends" },
					{ value: "inbox", label: "Inbox", icon: "bell" },
					{ value: "rankings", label: "Rankings", icon: "trophy" },
					{ value: "sounder", label: "Sounder", icon: "crown" },
				]}
				{...extra}
			/>,
		);
	const segments = (r: TestRenderer.ReactTestRenderer) =>
		r.root.findAll((n) => n.props.accessibilityRole === "radio" && typeof n.props.style === "function");

	test("icon-over-label caps its words at CHROME_TYPE_CAP and offers the Large Content Viewer", () => {
		const r = hub();
		for (const word of r.root.findAllByType(Text)) expect(word.props.maxFontSizeMultiplier).toBe(CHROME_TYPE_CAP);
		const all = segments(r);
		expect(all.map((s) => s.props.accessibilityLargeContentTitle)).toEqual(["Friends", "Inbox", "Rankings", "Sounder"]);
		for (const s of all) expect(s.props.accessibilityShowsLargeContentViewer).toBe(true);
		act(() => r.unmount());
	});

	test("its minimum side pad leaves the four words room at the cap on a 375pt phone", () => {
		const r = hub();
		const style = StyleSheet.flatten(segments(r)[0].props.style({ pressed: false }));
		expect(style.paddingHorizontal).toBe(SPACE.xxs);
		expect(style.flexGrow).toBe(1);
		expect(style.flexBasis).toBe("auto");
		act(() => r.unmount());
	});

	test("a caller's own ceiling wins; the row layout keeps the 200% rule", () => {
		const capped = hub({ maxFontSizeMultiplier: 1.2 });
		for (const word of capped.root.findAllByType(Text)) expect(word.props.maxFontSizeMultiplier).toBe(1.2);
		act(() => capped.unmount());
		const row = mount(
			<SegmentedControl
				label="Friends panel"
				value="friends"
				onChange={() => {}}
				options={[
					{ value: "friends", label: "Friends · 5" },
					{ value: "add", label: "Add" },
				]}
			/>,
		);
		for (const word of row.root.findAllByType(Text)) expect(word.props.maxFontSizeMultiplier).toBeUndefined();
		for (const s of segments(row)) expect(s.props.accessibilityShowsLargeContentViewer).toBeUndefined();
		act(() => row.unmount());
	});
});

describe("Button", () => {
	test("a full Button wraps a long verb to centred lines in every drawing", () => {
		for (const variant of ["primary", "lilac", "ghost"] as const) {
			const r = mount(
				<Button full variant={variant} onPress={() => {}}>
					Send Rosie to look for something
				</Button>,
			);
			const word = r.root.findByType(Text);
			expect(word.props.numberOfLines).toBeUndefined();
			expect(word.props.adjustsFontSizeToFit).toBeUndefined();
			expect(flat(word).textAlign).toBe("center");
			expect(flat(word).flexShrink).toBe(1);
			act(() => r.unmount());
		}
	});

	test("a gradient button's placement and padding reach the Pressable; the gradient only paints it (Barn ask 2, after/083)", () => {
		const r = mount(
			<Button full variant="primary" style={{ marginTop: SPACE.md, flex: 1, paddingHorizontal: SPACE.xl }}>
				Dig now
			</Button>,
		);
		const pressable = r.root.find(
			(n) => n.props.accessibilityRole === "button" && typeof n.props.style === "function",
		);
		const outer = StyleSheet.flatten(pressable.props.style({ pressed: false }));
		expect(outer.alignSelf).toBe("stretch");
		expect(outer.marginTop).toBe(SPACE.md);
		expect(outer.flex).toBe(1);
		expect(outer.paddingHorizontal).toBe(SPACE.xl);
		expect(outer.minHeight).toBeGreaterThanOrEqual(44);
		// The paint is an absolute layer: it never grows, so it can never fill the
		// height a centred button is measured against (the Redeem card's column).
		const paint = StyleSheet.flatten(r.root.findByType(LinearGradient).props.style);
		expect(paint.position).toBe("absolute");
		expect(paint.flexGrow).toBeUndefined();
		expect(paint.marginTop).toBeUndefined();
		expect(paint.alignSelf).toBeUndefined();
		expect(paint.paddingHorizontal).toBeUndefined();
		expect(paint.minHeight).toBeUndefined();
		act(() => r.unmount());
	});

	test("its mark grows with the word, up to its cap (Me ask M-05)", () => {
		setFontScale(1.6);
		const r = mount(
			<View>
				<Button icon={<Icon name="share" size={16} />}>Share</Button>
				<Button icon={<Icon name="x" size={16} />} maxFontSizeMultiplier={CHROME_TYPE_CAP}>
					Leave
				</Button>
			</View>,
		);
		const marks = r.root.findAllByType(Icon).map((n) => n.props.size);
		expect(marks[0]).toBeCloseTo(16 * 1.6, 5);
		expect(marks[1]).toBeCloseTo(16 * CHROME_TYPE_CAP, 5);
		act(() => r.unmount());
	});

	test("useIconScale never shrinks, never passes 2x", () => {
		let scale = 0;
		function Probe() {
			scale = useIconScale();
			return null;
		}
		setFontScale(0.82);
		const small = mount(<Probe />);
		expect(scale).toBe(1);
		act(() => small.unmount());
		setFontScale(3.57);
		const huge = mount(<Probe />);
		expect(scale).toBe(2);
		act(() => huge.unmount());
	});

	test("TicketButton caps its fixed face at the chrome ceiling and still never shrinks", () => {
		const r = mount(<TicketButton label="Pick a find to hand over" stub="+3" stubCaption="tickles" />);
		const words = r.root.findAllByType(Text);
		expect(words.length).toBeGreaterThanOrEqual(3);
		for (const word of words) {
			expect(word.props.maxFontSizeMultiplier).toBe(CHROME_TYPE_CAP);
			expect(word.props.adjustsFontSizeToFit).toBeUndefined();
			expect(word.props.numberOfLines).toBeUndefined();
		}
		act(() => r.unmount());
	});
});

describe("rows and identity", () => {
	test("NavRow says its sub line and badge, and keeps an action outside its button (M-02, M-03)", () => {
		const onShare = jest.fn();
		const onPress = jest.fn();
		const r = mount(
			<NavRow
				icon="friends"
				label="Invite new pigs"
				sub="0 of 3 pigs"
				badge={<Tag label="W0" />}
				action={<Button variant="ghost" size="sm" onPress={onShare} accessibilityLabel="Share your code">Share</Button>}
				onPress={onPress}
			/>,
		);
		const row = r.root.findAll(
			(n) => n.props.accessibilityLabel === "Invite new pigs, 0 of 3 pigs, W0" && n.props.accessibilityRole === "button",
		)[0];
		expect(row).toBeDefined();
		// The Share pill is NOT inside the row's button: it stays its own target.
		expect(row.findAll((n) => n.props.accessibilityLabel === "Share your code")).toHaveLength(0);
		const share = r.root.findAll(
			(n) => n.props.accessibilityLabel === "Share your code" && n.props.accessibilityRole === "button",
		)[0];
		act(() => share.props.onPress());
		expect(onShare).toHaveBeenCalledTimes(1);
		// The chevron still answers the row's tap, out of the tree.
		const rail = r.root.findAll(
			(n) => n.props.accessible === false && typeof n.props.onPress === "function" && n.props.importantForAccessibility === "no-hide-descendants",
		)[0];
		act(() => rail.props.onPress());
		act(() => row.props.onPress());
		expect(onPress).toHaveBeenCalledTimes(2);
		act(() => r.unmount());
	});

	test("NavRow's bubble and marks grow with the text, up to 2x (M-05)", () => {
		setFontScale(2.5);
		const r = mount(<NavRow icon="gear" label="Settings" onPress={() => {}} />);
		const sizes = r.root.findAllByType(Icon).map((n) => n.props.size);
		expect(sizes).toEqual([36, 36]);
		act(() => r.unmount());
	});

	test("a plain ListRow without an action is unchanged: one grouped button", () => {
		const r = mount(<ListRow title="Maple" onPress={() => {}} trailing={<Text>3</Text>} />);
		const buttons = r.root.findAll(
			(n) => n.props.accessibilityRole === "button" && typeof n.props.style === "function",
		);
		expect(buttons).toHaveLength(1);
		act(() => r.unmount());
	});

	test("ProfileIdentity: a space before #code, a row's title under the name in its own case, two lines not '…' (A-3, M-08)", () => {
		const r = mount(
			<View>
				<ProfileIdentity username="DemoHelper1" discriminator="1035" title={{ name: "Silvester Sow", placement: "pre" }} />
				<ProfileIdentity username="DemoPig" title={{ name: "Silvester Sow", placement: "pre" }} variant="profile" />
			</View>,
		);
		const texts = r.root.findAll((n) => n.type === Text);
		const code = texts.find((n) => Array.isArray(n.props.children) && n.props.children.join("") === " #1035");
		expect(code).toBeDefined();
		const roots = r.root.findAll((n) => typeof n.type === "string" && flat(n)?.minWidth === 0);
		// Row: name first, then the title; profile: a pre title above the name.
		const order = (root: TestRenderer.ReactTestInstance) =>
			root.findAll((n) => n.type === Text && typeof n.props.children !== "undefined").map((n) => (Array.isArray(n.props.children) ? n.props.children[0] : n.props.children));
		expect(order(roots[0])[0]).toBe("DemoHelper1");
		expect(order(roots[1])[0]).toBe("Silvester Sow");
		for (const t of texts) {
			if (t.props.numberOfLines !== undefined) expect(t.props.numberOfLines).toBe(2);
			expect(flat(t)?.textTransform).toBeUndefined();
		}
		// The profile name sits beside the portrait in a ~240pt column: one word,
		// so it states the chrome ceiling (it broke "DemoPi / g" at
		// accessibility-large); a row's name keeps the full 200%.
		const nameOf = (who: string) =>
			texts.find((n) => Array.isArray(n.props.children) ? n.props.children[0] === who : n.props.children === who);
		expect(nameOf("DemoPig")?.props.maxFontSizeMultiplier).toBe(CHROME_TYPE_CAP);
		expect(nameOf("DemoHelper1")?.props.maxFontSizeMultiplier).toBeUndefined();
		act(() => r.unmount());
	});

	test("PrestigeAvatar forwards an explicit mode, and keeps its old rule without one (M-01)", () => {
		const src = fs.readFileSync(path.join(ROOT, "components/ui/PrestigeAvatar.tsx"), "utf8");
		expect(src).toMatch(/mode = modeProp \?\? \(staticPigFx\(ritual\)/);
		const r = mount(<PrestigeAvatar size={40} hatId="tophat" mode="worn" />);
		const pig = r.root.findAll((n) => n.props.mode !== undefined && typeof n.type !== "string")[0];
		expect(pig.props.mode).toBe("worn");
		act(() => r.unmount());
	});
});

describe("capsules, cards and fields", () => {
	test("Tag is one accessible element; flat drops the lift (Barn 1, M-06)", () => {
		const r = mount(
			<View>
				<Tag label="W0" accessibilityLabel="Wallow rank 0" testID="lifted" />
				<Tag label="Owned" flat testID="flat" />
			</View>,
		);
		const lifted = host(r, "lifted");
		expect(lifted.props.accessible).toBe(true);
		expect(flat(lifted).shadowOffset).toEqual(SHADOW_SM.shadowOffset);
		expect(flat(host(r, "flat")).shadowOffset).toBeUndefined();
		act(() => r.unmount());
	});

	test("a labelled plain Sticker is one element, a summary group is not, and actions pass through (Barn 1, Shop b)", () => {
		const onAction = jest.fn();
		const r = mount(
			<View>
				<Sticker accessibilityLabel="Two finds" testID="labelled" />
				<Sticker accessibilityLabel="Room" accessibilityRole="summary" testID="group" />
				<Sticker testID="plain" />
				<Sticker
					onPress={() => {}}
					accessibilityLabel="river pebble"
					accessibilityActions={[{ name: "toss", label: "Toss it" }]}
					onAccessibilityAction={onAction}
					testID="press"
				/>
			</View>,
		);
		expect(host(r, "labelled").props.accessible).toBe(true);
		expect(host(r, "group").props.accessible).toBeUndefined();
		expect(host(r, "plain").props.accessible).toBeUndefined();
		const press = host(r, "press");
		expect(press.props.accessibilityActions).toEqual([{ name: "toss", label: "Toss it" }]);
		act(() => press.props.onAccessibilityAction({ nativeEvent: { actionName: "toss" } }));
		expect(onAction).toHaveBeenCalledTimes(1);
		act(() => r.unmount());
	});

	test("a Ribbon with clipRadius owns its clip layer, so the card keeps its shadow (M-09)", () => {
		const r = mount(<Ribbon label="NEXT" tone="sun" clipRadius={RADII.xl} testID="next" />);
		const clip = flat(host(r, "next-clip"));
		expect(clip.overflow).toBe("hidden");
		expect(clip.borderRadius).toBe(RADII.xl);
		expect(host(r, "next-clip").props.pointerEvents).toBe("none");
		expect(host(r, "next").props.accessible).toBe(true);
		act(() => r.unmount());
		const bare = mount(<Ribbon label="New" testID="new" />);
		expect(host(bare, "new-clip")).toBeUndefined();
		act(() => bare.unmount());
	});

	test("EmptyState flush sits on the host's inset (M-10)", () => {
		const r = mount(
			<View>
				<EmptyState title="No referrals yet" />
				<EmptyState title="No referrals yet" flush />
			</View>,
		);
		const wraps = r.root.findAll((n) => typeof n.type === "string" && flat(n)?.paddingTop === SPACE.md);
		expect(flat(wraps[0]).paddingHorizontal).toBe(SPACE.card);
		expect(flat(wraps[1]).paddingHorizontal).toBe(0);
		act(() => r.unmount());
	});

	test("a code well's example is lighter than a value, but not on the error well (M-04)", () => {
		const r = mount(
			<View>
				<TextField label="Golden Ticket" value="" onChangeText={() => {}} placeholder="PIG-XXXX-XXXX" variant="code" />
				<TextField label="Golden Ticket" value="" onChangeText={() => {}} placeholder="PIG-XXXX-XXXX" variant="code" state="error" errorText="That code isn't real." />
				<TextField label="Email" value="" onChangeText={() => {}} placeholder="email" />
			</View>,
		);
		const inputs = r.root.findAllByType(TextInput);
		expect(inputs[0].props.placeholderTextColor).toBe(UI_COLORS.uiMuted);
		expect(inputs[1].props.placeholderTextColor).toBe(UI_COLORS.textPlaceholder);
		expect(inputs[2].props.placeholderTextColor).toBe(UI_COLORS.textPlaceholder);
		act(() => r.unmount());
	});

	test("SectionHeader sm speaks one step under a sheet's title (Barn 4)", () => {
		const r = mount(
			<View>
				<SectionHeader title="Every find" />
				<SectionHeader title="Every find" size="sm" />
			</View>,
		);
		const heads = r.root.findAll((n) => n.type === Text && n.props.accessibilityRole === "header");
		expect(flat(heads[0]).fontSize).toBe(TYPE.sectionTitle.fontSize);
		expect(flat(heads[1]).fontSize).toBe(TYPE.cardTitle.fontSize);
		act(() => r.unmount());
	});

	test("PageHeader takes a type cap for a pinned crown (Season 2)", () => {
		const r = mount(<PageHeader variant="tab" kicker="your pig pals" title="Friends" maxFontSizeMultiplier={CHROME_TYPE_CAP} />);
		for (const word of r.root.findAllByType(Text)) expect(word.props.maxFontSizeMultiplier).toBe(CHROME_TYPE_CAP);
		act(() => r.unmount());
		const free = mount(<PageHeader title="Collection" />);
		for (const word of free.root.findAllByType(Text)) expect(word.props.maxFontSizeMultiplier).toBeUndefined();
		act(() => free.unmount());
	});

	test("TILE_TYPE_CAP sits under the chrome cap, where Cloudspotter's still fits half a 375pt phone (Barn 5)", () => {
		expect(TILE_TYPE_CAP).toBeLessThan(CHROME_TYPE_CAP);
		// 112.9pt at 15pt (measured from the font) × the cap ≤ the 143.5pt tile box.
		expect(112.9 * TILE_TYPE_CAP).toBeLessThanOrEqual(143.5);
		expect(TYPE.cardTitleSm.fontSize).toBe(15);
	});

	test("a toast title wraps instead of clamping a name", () => {
		jest.useFakeTimers();
		const r = mount(<ToastHost />);
		act(() => showToast({ tone: "success", title: "Bought the Wallow Sovereign Crown" }));
		const title = r.root.find((n) => n.type === Text && n.props.children === "Bought the Wallow Sovereign Crown");
		expect(title.props.numberOfLines).toBeUndefined();
		act(() => r.unmount());
		jest.useRealTimers();
	});
});

describe("the shell", () => {
	test("StackPage stands in safe-area-context's SafeAreaView; all four edges by default", () => {
		const r = mount(
			<StackPage testID="page">
				<Text>crown</Text>
			</StackPage>,
		);
		const safe = r.root.findByType(SafeAreaView);
		expect(safe.props.edges).toBeUndefined();
		act(() => r.unmount());
		const src = fs.readFileSync(path.join(ROOT, "components/ui/StackPage.tsx"), "utf8");
		expect(src).not.toMatch(/import\s*\{[^}]*\bSafeAreaView\b[^}]*\}\s*from\s*"react-native"/);
	});

	test("a scrolling stack screen pads top/sides and ends its scroller on SPACE.xl + the indicator (Barn 3, Shop c)", () => {
		let pad = 0;
		function Screen() {
			pad = useStackScrollPad();
			return (
				<StackPage edges={STACK_SCROLL_EDGES}>
					<Text>list</Text>
				</StackPage>
			);
		}
		const r = mount(<Screen />);
		expect(r.root.findByType(SafeAreaView).props.edges).toEqual(["top", "left", "right"]);
		expect(pad).toBe(SPACE.xl + metrics.insets.bottom);
		act(() => r.unmount());
	});

	test("the receipt's dashed total rule wears one colour on every side, so iOS draws it", () => {
		const r = mount(
			<ReceiptRows>
				<ReceiptTotal icon={<View />} label="curses exchanged" value={115} />
			</ReceiptRows>,
		);
		const rule = r.root.findAll((n) => typeof n.type === "string" && flat(n)?.borderStyle === "dashed")[0];
		expect(flat(rule).borderColor).toBe(UI_COLORS.uiMuted);
		expect(flat(rule).borderTopColor).toBeUndefined();
		expect(flat(rule).borderTopWidth).toBe(BORDER.thin);
		act(() => r.unmount());
	});
});

describe("sign-in on a small phone", () => {
	test("Rosie takes what the scene can spare: the SE fits whole, the 17 Pro keeps her 383pt (after/110–111)", () => {
		// The default-type layout: the words take 96pt and the card with the
		// Terms · Privacy line 208pt; the hero spends 56pt of pads around her.
		// SE (667pt, 20pt status bar): everything fits, the legal line included.
		expect(fitRosieHeight({ sceneH: 667 - 20, wordsH: 96, cardH: 208 })).toBe(287);
		expect(56 + 96 + 208 + 287).toBe(667 - 20);
		// 17 Pro (874pt less 62 + 34): her own 383pt, the layout it always had.
		expect(fitRosieHeight({ sceneH: 874 - 62 - 34, wordsH: 96, cardH: 208 })).toBe(383);
		// The email form on an SE: the portrait floor, and the scene scrolls the rest.
		expect(fitRosieHeight({ sceneH: 647, wordsH: 96, cardH: 392 })).toBe(ART_SIZE.portrait);
		// Larger text grows the words and the card; she gives way first.
		expect(fitRosieHeight({ sceneH: 647, wordsH: 140, cardH: 230 })).toBe(647 - 56 - 140 - 230);
		// Whole points, so a scene that fits never becomes a half-point scroll.
		expect(Number.isInteger(fitRosieHeight({ sceneH: 647.5, wordsH: 96.3, cardH: 208.1 }))).toBe(true);
	});

	test("the slot wears her fitted height, the Image both axes, and a measured card re-fits her", () => {
		act(() => {
			Dimensions.set({ window: { ...initialWindow, width: 375, height: 667 } as ScaledSize, screen: initialScreen });
		});
		const r = mount(<SupaAuth />);
		const sceneH = 667 - metrics.insets.top - metrics.insets.bottom;
		const slot = host(r, "sign-in-rosie");
		const style = flat(slot);
		// Before anything is measured, the guesses are the default-type layout.
		expect(style.height).toBe(fitRosieHeight({ sceneH, wordsH: 96, cardH: 208 }));
		expect(style.aspectRatio).toBeCloseTo(370 / 383, 5);
		// No flex growth: inside the scroller it never shrank (the bug).
		expect(style.flexGrow).toBeUndefined();
		expect(style.flexBasis).toBeUndefined();
		expect(style.width).toBeUndefined();
		const image = slot.findAll((n) => n.props.resizeMode === "contain")[0];
		expect(flat(image).width).toBe("100%");
		expect(flat(image).height).toBe("100%");
		// The email form grows the card; she drops to the floor.
		act(() => host(r, "sign-in-card").props.onLayout({ nativeEvent: { layout: { x: 0, y: 0, width: 375, height: 392 } } }));
		expect(flat(host(r, "sign-in-rosie")).height).toBe(ART_SIZE.portrait);
		// Larger words take their share too.
		act(() => host(r, "sign-in-card").props.onLayout({ nativeEvent: { layout: { x: 0, y: 0, width: 375, height: 208 } } }));
		act(() => host(r, "sign-in-words").props.onLayout({ nativeEvent: { layout: { x: 0, y: 0, width: 339, height: 150 } } }));
		expect(flat(host(r, "sign-in-rosie")).height).toBe(fitRosieHeight({ sceneH, wordsH: 150, cardH: 208 }));
		act(() => r.unmount());
	});

	test("the handle screen wears the same hero: her fitted height, both axes on the Image, a scroller", () => {
		act(() => {
			Dimensions.set({ window: { ...initialWindow, width: 375, height: 667 } as ScaledSize, screen: initialScreen });
		});
		// eslint-disable-next-line @typescript-eslint/no-require-imports
		const UsernameSetup = require("../components/UsernameSetup").default as React.ComponentType<{
			userId: string;
			onSaved: () => void;
		}>;
		const r = mount(<UsernameSetup userId="u1" onSaved={() => {}} />);
		const sceneH = 667 - metrics.insets.top - metrics.insets.bottom;
		const slot = host(r, "username-rosie");
		// Unmeasured, the guesses: kicker + a two-line title (82pt), the card
		// with its helper line and bottom breath (184pt). On an SE she gives
		// way (291pt) so the Save button sits above the fold.
		expect(flat(slot).height).toBe(fitRosieHeight({ sceneH, wordsH: 82, cardH: 184 }));
		expect(flat(slot).height).toBe(291);
		expect(flat(slot).aspectRatio).toBeCloseTo(370 / 383, 5);
		// No flex growth: inside the scroller it never shrank (the SE overflow).
		expect(flat(slot).flexGrow).toBeUndefined();
		expect(flat(slot).maxHeight).toBeUndefined();
		expect(flat(slot).width).toBeUndefined();
		const image = slot.findAll((n) => n.props.resizeMode === "contain")[0];
		expect(flat(image).height).toBe("100%");
		// An error line grows the card; she gives the room back.
		act(() => host(r, "username-card").props.onLayout({ nativeEvent: { layout: { x: 0, y: 0, width: 375, height: 224 } } }));
		expect(flat(host(r, "username-rosie")).height).toBe(fitRosieHeight({ sceneH, wordsH: 82, cardH: 224 }));
		act(() => host(r, "username-words").props.onLayout({ nativeEvent: { layout: { x: 0, y: 0, width: 339, height: 130 } } }));
		expect(flat(host(r, "username-rosie")).height).toBe(fitRosieHeight({ sceneH, wordsH: 130, cardH: 224 }));
		const scene = r.root.findAll((n) => n.props.testID === "username-scene" && n.type === ScrollView)[0];
		expect(scene.props.automaticallyAdjustKeyboardInsets).toBe(true);
		// The side inset is on the scroller's content now; React Native's
		// SafeAreaView used to swallow it, so the card ran edge to edge.
		expect(StyleSheet.flatten(scene.props.contentContainerStyle).paddingHorizontal).toBe(PAGE_PAD);
		act(() => r.unmount());
		const src = fs.readFileSync(path.join(ROOT, "components/UsernameSetup.tsx"), "utf8");
		expect(src).not.toMatch(/import\s*\{[^}]*\bSafeAreaView\b[^}]*\}\s*from\s*"react-native"/);
		expect(src).not.toMatch(/<KeyboardAvoidingView\b/);
	});

	test("the scene scrolls only when it must, and the keyboard lifts the focused well", () => {
		const r = mount(<SupaAuth />);
		const scene = r.root.findAll((n) => n.props.testID === "sign-in-scene" && n.type === ScrollView)[0];
		expect(scene.props.automaticallyAdjustKeyboardInsets).toBe(true);
		expect(scene.props.keyboardShouldPersistTaps).toBe("handled");
		expect(scene.props.alwaysBounceVertical).toBe(false);
		expect(StyleSheet.flatten(scene.props.contentContainerStyle).flexGrow).toBe(1);
		const useEmail = r.root.findAll(
			(n) => n.props.accessibilityLabel === "Use email instead" && n.props.accessibilityRole === "button",
		)[0];
		act(() => useEmail.props.onPress());
		expect(r.root.findAll((n) => n.props.children === "Meet Rosie").length).toBeGreaterThan(0);
		expect(r.root.findAll((n) => n.props.accessibilityLabel === "Sign in with email").length).toBeGreaterThan(0);
		act(() => r.unmount());
		const src = fs.readFileSync(path.join(ROOT, "components/SupaAuth.tsx"), "utf8");
		expect(src).not.toMatch(/\bSafeAreaView\b/);
		expect(src).not.toMatch(/\bKeyboardAvoidingView\b/);
	});
});
