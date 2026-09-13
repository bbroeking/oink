import React from "react";
import fs from "fs";
import path from "path";
import TestRenderer, { act } from "react-test-renderer";
import { Text } from "react-native";
import ts from "typescript";
import {
  habitatPigBridgeSnapshot,
  publishHabitatPigPresentation,
  registerHabitatPigConsumer,
  registerHabitatPigController,
  resetHabitatPigBridgeForTests,
} from "@/hooks/useHabitatPigBridge";

const mockConsumerState = jest.fn();
const mockBarn = jest.fn();
jest.mock("@/hooks/useHabitatPigBridge", () => {
  const actual = jest.requireActual("@/hooks/useHabitatPigBridge");
  return { ...actual, useHabitatPigConsumer: () => mockConsumerState() };
});
jest.mock("@/hooks/ActiveEffectsProvider", () => ({
  ActiveEffectsProvider: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock("@/components/Barn", () => {
  const { Text: NativeText } = jest.requireActual("react-native");
  return function MockBarn(props: { interiorPigOnly?: boolean; bridgeFallback?: boolean }) {
    mockBarn(props);
    return <NativeText testID="fallback">fallback</NativeText>;
  };
});

// eslint-disable-next-line import/first -- import after the component mocks.
import { HabitatOwnerPig } from "@/components/habitat/HabitatOwnerPig";

describe("habitat pig presentation bridge", () => {
  beforeEach(() => resetHabitatPigBridgeForTests());

  it("moves one mounted Home presentation to an Interior consumer", () => {
    const releaseController = registerHabitatPigController("pig-a");
    publishHabitatPigPresentation("pig-a", <Text testID="shared">Rosie</Text>);
    const releaseConsumer = registerHabitatPigConsumer("pig-a");
    expect(habitatPigBridgeSnapshot("pig-a")).toMatchObject({
      controllers: 1,
      consumers: 1,
    });
    expect(habitatPigBridgeSnapshot("pig-a").presentation).not.toBeNull();
    releaseConsumer();
    releaseController();
  });

  it("uses a sole compact controller for a cold Interior entry", () => {
    mockConsumerState.mockReturnValue({
      loaded: true,
      accountId: "pig-a",
      registered: true,
      controllers: 0,
      consumers: 1,
      presentation: null,
    });
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => { renderer = TestRenderer.create(<HabitatOwnerPig />); });
    expect(renderer.root.findByProps({ testID: "fallback" })).toBeTruthy();
    expect(mockBarn).toHaveBeenCalledWith(
      expect.objectContaining({ interiorPigOnly: true, bridgeFallback: true }),
    );
  });

  it("renders no fallback controller after sign-out", () => {
    mockConsumerState.mockReturnValue({
      loaded: true,
      accountId: null,
      controllers: 0,
      consumers: 0,
      presentation: null,
    });
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => { renderer = TestRenderer.create(<HabitatOwnerPig />); });
    expect(renderer.toJSON()).toBeNull();
  });

  it("publishes background-free Interior art and unmounts the Home pig copy", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "components/Barn.tsx"),
      "utf8",
    );
    expect(source).toContain("const interiorPigContent = renderPigContent(true)");
    expect(source).toContain("equippedBackground={forInterior ? null : stats.activeBackground}");
    expect(source).toContain("{pigPresentedInHabitat ? null : pigContent}");
    expect(source).not.toContain("bridgedPigHidden");
  });

  it("does not emit raw text from the shared pig presentation fragment", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "components/Barn.tsx"),
      "utf8",
    );
    const file = ts.createSourceFile(
      "Barn.tsx",
      source,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );
    const rawText: string[] = [];
    const emittedJsxText = (value: string) => {
      const lines = value.replace(/\r\n?/g, "\n").split("\n");
      let emitted = "";
      lines.forEach((line, index) => {
        let normalized = line.replace(/\t/g, " ");
        if (index !== 0) normalized = normalized.replace(/^ +/, "");
        if (index !== lines.length - 1) normalized = normalized.replace(/ +$/, "");
        if (normalized) emitted += normalized + (index !== lines.length - 1 ? " " : "");
      });
      return emitted;
    };
    const visit = (node: ts.Node) => {
      if (ts.isVariableDeclaration(node) && node.name.getText(file) === "renderPigContent") {
        const expression = node.initializer;
        if (expression && ts.isArrowFunction(expression)) {
          const collect = (child: ts.Node) => {
            if (ts.isJsxText(child)) {
              const emitted = emittedJsxText(child.getFullText(file));
              if (emitted) rawText.push(emitted);
            }
            ts.forEachChild(child, collect);
          };
          collect(expression.body);
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(file);
    expect(rawText).toEqual([]);
  });

  it("does not let a late getSession result overwrite a newer auth event", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "hooks/useHabitatPigBridge.tsx"),
      "utf8",
    );
    expect(source).toContain("authRevision === sessionRevision");
    expect(source).toMatch(/onAuthStateChange[\s\S]*authRevision\+\+/);
  });

  it("clears the old account presentation and never serves it to another", () => {
    const release = registerHabitatPigController("pig-a");
    publishHabitatPigPresentation("pig-a", <Text>old pig</Text>);
    release();
    registerHabitatPigConsumer("pig-b");
    expect(habitatPigBridgeSnapshot("pig-a").presentation).toBeNull();
    expect(habitatPigBridgeSnapshot("pig-b").presentation).toBeNull();
    expect(habitatPigBridgeSnapshot("pig-b").controllers).toBe(0);
  });
});
