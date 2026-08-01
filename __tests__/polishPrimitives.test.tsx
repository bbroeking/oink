import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { Pressable, StyleSheet } from "react-native";
import fs from "node:fs";
import path from "node:path";
import { IconButton } from "@/components/ui/IconButton";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { PageHeader } from "@/components/ui/PageHeader";

const ROOT = path.resolve(__dirname, "..");

describe("polish control primitives", () => {
	test("IconButton keeps a 44pt target around a small visual badge", () => {
		const onPress = jest.fn();
		let renderer!: TestRenderer.ReactTestRenderer;
		act(() => {
			renderer = TestRenderer.create(
				<IconButton
					name="x"
					label="Remove wizard hat"
					onPress={onPress}
					visualSize={20}
				/>,
			);
		});

		const button = renderer.root.findByType(Pressable);
		const style = StyleSheet.flatten(button.props.style({ pressed: false }));
		expect(style.width).toBe(44);
		expect(style.height).toBe(44);
		expect(button.props.accessibilityRole).toBe("button");
		expect(button.props.accessibilityLabel).toBe("Remove wizard hat");
		act(() => button.props.onPress());
		expect(onPress).toHaveBeenCalledTimes(1);
		act(() => renderer.unmount());
	});

	test("SegmentedControl exposes one selected radio and changes by value", () => {
		const onChange = jest.fn();
		let renderer!: TestRenderer.ReactTestRenderer;
		act(() => {
			renderer = TestRenderer.create(
				<SegmentedControl
					label="Leaderboard scope"
					value="global"
					onChange={onChange}
					options={[
						{ value: "global", label: "Global", icon: "globe" },
						{ value: "friends", label: "Friends", icon: "friends" },
					]}
				/>,
			);
		});

		const options = renderer.root
			.findAllByType(Pressable)
			.filter((node) => node.props.accessibilityRole === "radio");
		expect(options).toHaveLength(2);
		expect(options[0].props.accessibilityState).toEqual({ selected: true });
		expect(options[1].props.accessibilityState).toEqual({ selected: false });
		const style = StyleSheet.flatten(options[0].props.style({ pressed: false }));
		expect(style.minHeight).toBeGreaterThanOrEqual(44);
		act(() => options[1].props.onPress());
		expect(onChange).toHaveBeenCalledWith("friends");
		act(() => renderer.unmount());
	});

	test("PageHeader provides a named 44pt back action", () => {
		let renderer!: TestRenderer.ReactTestRenderer;
		act(() => {
			renderer = TestRenderer.create(
				<PageHeader title="Collection" onBack={() => {}} />,
			);
		});

		const back = renderer.root
			.findAllByType(Pressable)
			.find((node) => node.props.accessibilityLabel === "Back");
		expect(back?.props.accessibilityRole).toBe("button");
		const style = StyleSheet.flatten(back?.props.style);
		expect(style.minHeight).toBeGreaterThanOrEqual(44);
		act(() => renderer.unmount());
	});

	test("keeps player-facing native text at the iOS 11pt floor", () => {
		const roots = ["app", "components"];
		const offenders: string[] = [];
		const visit = (relative: string) => {
			const absolute = path.join(ROOT, relative);
			for (const entry of fs.readdirSync(absolute, { withFileTypes: true })) {
				const child = path.join(relative, entry.name);
				if (
					entry.isDirectory() &&
					["dev", "prototypes", "tools"].includes(entry.name)
				) {
					continue;
				}
				if (entry.isDirectory()) visit(child);
				else if (
					entry.isFile() &&
					entry.name.endsWith(".tsx") &&
					!entry.name.includes("prototype")
				) {
					const source = fs.readFileSync(path.join(ROOT, child), "utf8");
					if (
						/fontSize:\s*(?:[0-9](?:\.[0-9]+)?|10(?:\.[0-9]+)?)\b/.test(
							source,
						)
					) {
						offenders.push(child);
					}
				}
			}
		};
		roots.forEach(visit);
		expect(offenders).toEqual([]);
	});
});
