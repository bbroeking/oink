import fs from "node:fs";
import path from "node:path";

describe("Barn visit scene actions", () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), "components/BarnVisitModal.tsx"),
    "utf8",
  );

  test("reuses the main Barn truffle control in the upper-left", () => {
    expect(source).toContain('import { TruffleButton } from "./TruffleButton"');
    expect(source).toContain("<TruffleButton");
    expect(source).toContain('"Dig for a truffle"');
    expect(source).toContain("visitTruffleControl");
    expect(source).not.toContain("function DigSpot");
  });

  test("gives each all-tickled-out surface one clear job", () => {
    expect(source).toContain("barns visited");
    expect(source).toContain("tap Leave for your visit note");
    expect(source).toContain("barns visited this round");
    expect(source).not.toContain("until you can visit again");
  });
});
