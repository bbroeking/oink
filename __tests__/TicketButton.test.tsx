import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { TicketButton } from "../components/ui/TicketButton";

describe("TicketButton", () => {
  test("exposes a stable 68pt ticket face inside a 74pt touch target", () => {
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        <TicketButton
          label="Choose Rosie’s friend"
          stub="P"
          stubCaption="The Pen"
        />,
      );
    });

    const pressable = renderer.root.findByType(Pressable);
    const chrome = renderer.root
      .findAllByType(View)
      .map((node) => StyleSheet.flatten(node.props.style))
      .find((style) => style?.height === 74);

    expect(pressable.props.accessibilityRole).toBe("button");
    expect(pressable.props.accessibilityLabel).toBe("Choose Rosie’s friend");
    expect(chrome?.height).toBeGreaterThanOrEqual(44);
    act(() => renderer.unmount());
  });

  test("keeps its outline semantics when disabled instead of fading", () => {
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        <TicketButton label="Redeem ticket" stub="Golden" disabled />,
      );
    });

    const pressable = renderer.root.findByType(Pressable);
    expect(pressable.props.accessibilityState).toEqual({
      disabled: true,
      busy: false,
    });
    expect(StyleSheet.flatten(pressable.props.style).opacity).toBeUndefined();
    act(() => renderer.unmount());
  });

  test("announces and renders a stable loading label", () => {
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        <TicketButton
          label="Redeem ticket"
          stub="Golden"
          loading
          loadingLabel="Checking…"
        />,
      );
    });

    const pressable = renderer.root.findByType(Pressable);
    const labels = renderer.root
      .findAllByType(Text)
      .map((node) => node.props.children);
    expect(pressable.props.accessibilityState).toEqual({
      disabled: true,
      busy: true,
    });
    expect(labels).toContain("Checking…");
    act(() => renderer.unmount());
  });

  test("does not shrink longer action labels below the type floor", () => {
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        <TicketButton
          label="A longer translated admission-ticket action"
          stub="$12.99"
          tone="season"
        />,
      );
    });

    const label = renderer.root
      .findAllByType(Text)
      .find(
        (node) =>
          node.props.children === "A longer translated admission-ticket action",
      );
    expect(label?.props.adjustsFontSizeToFit).toBeUndefined();
    expect(label?.props.minimumFontScale).toBeUndefined();
    act(() => renderer.unmount());
  });
});
