import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { Text } from "react-native";
import { CollectibleCard } from "@/components/prototypes/card-packs/CollectibleCard";
import { SPOOKY_SNOUTS_CATALOG } from "@/features/cards/data/seasonalCatalog";

describe("Spooky Snouts shared card renderer", () => {
  it("identifies Hollow Jack as a dedicated costume on its collection card", async () => {
    const card = SPOOKY_SNOUTS_CATALOG.find((entry) => entry.unlock?.category === "costume")!;
    expect(card.unlock?.itemId).toBe("halloween_2026_hollow_jack_costume");
    let renderer: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(<CollectibleCard card={card} variant="compact" />);
    });
    const text = renderer!.root.findAllByType(Text).map((node) => node.props.children).flat(Infinity).join(" ");
    expect(text).toContain("COSTUME");
    expect(text).not.toContain("HAT");
  });
  it("prints the seasonal collector footer and readable unlock rule without game stats", async () => {
    const card = SPOOKY_SNOUTS_CATALOG[0];
    let renderer: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(<CollectibleCard card={card} artwork={<Text>Concept illustration</Text>} variant="detail" />);
    });
    const text = renderer!.root.findAllByType(Text).map((node) => node.props.children).flat(Infinity).join(" ")
      .replace(/\s+/g, " ").replace(/ ?([·/]) ?/g, "$1");
    expect(text).toContain("SSN·001/49");
    expect(text).toContain("FIRST COPY UNLOCK");
    expect(text).toContain(card.unlock?.itemName);
    expect(text).not.toContain("RANK");
    expect(text).not.toContain("BASH");
    expect(text).not.toContain("TRAINING");
  });

  it("renders an item compactly without an empty slot or rank socket", async () => {
    const card = SPOOKY_SNOUTS_CATALOG.find((entry) => entry.unlock?.category !== "background")!;
    let renderer: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(<CollectibleCard card={card} artwork={<Text>Item art</Text>} variant="compact" />);
    });
    const text = renderer!.root.findAllByType(Text).map((node) => node.props.children).flat(Infinity).join(" ");
    expect(text).toContain("FIRST COPY UNLOCK");
    expect(text).not.toContain("RANK");
    expect(text.toLowerCase()).not.toContain("undefined");
  });

  it("renders the final login-gift costume card as SSN 049/49 in detail", async () => {
    const card = SPOOKY_SNOUTS_CATALOG.at(-1)!;
    expect(card.id).toBe("halloween_2026_card_marshmallow_boo_costume");
    expect(card.unlock?.category).toBe("costume");
    let renderer: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(<CollectibleCard card={card} artwork={<Text>Costume art</Text>} variant="detail" />);
    });
    const text = renderer!.root.findAllByType(Text).map((node) => node.props.children).flat(Infinity).join(" ")
      .replace(/\s+/g, " ").replace(/ ?([·/]) ?/g, "$1");
    expect(text).toContain("SSN·049/49");
    expect(text).toContain("COSTUME·FIRST COPY UNLOCK");
    expect(text).toContain("Marshmallow Boo");
    expect(text).toContain("COLLECTION CARD");
    expect(text).toContain("NOT IN DECKS OR HEDGE RUN");
    expect(text).not.toContain("RANK");
    expect(text.toLowerCase()).not.toContain("undefined");
  });
});
