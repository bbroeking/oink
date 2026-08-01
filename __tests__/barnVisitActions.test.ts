import fs from "node:fs";
import path from "node:path";

describe("Barn visit scene actions", () => {
  test("reuses the main Barn truffle control in the upper-left", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "components/BarnVisitModal.tsx"),
      "utf8",
    );

    expect(source).toContain('import { TruffleButton } from "./TruffleButton"');
    expect(source).toContain("<TruffleButton");
    expect(source).toContain('"Dig for a truffle"');
    expect(source).toContain("visitTruffleControl");
    expect(source).not.toContain("function DigSpot");
  });
});
