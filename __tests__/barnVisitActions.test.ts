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

  test("speaks one vocabulary for the visit counter", () => {
    // The counter is always "visits". The three retired phrasings — the zero
    // state's "barns visited", the tired bubble's sub-line, and the nap card's
    // "barns visited this round" — are gone from the tree, not hidden.
    expect(source).not.toContain("barns visited");
    expect(source).not.toContain("tap Leave for your visit note");
    expect(source).not.toContain("barns left this round");
    expect(source).not.toContain("until you can visit again");
  });

  test("tired is a toast and Leave never detours", () => {
    // One surface for one fact: no bubble, no Leave-triggered nap summary.
    expect(source).not.toContain("All tickled out!");
    expect(source).not.toContain("setNapOpen");
    expect(source).toContain('title: "All tickled out"');
    expect(source).toContain("Head home when you're ready.");
    // requestExit branches on the Slop Club parting card and nothing else.
    const requestExit = source.slice(
      source.indexOf("const requestExit = () => {"),
      source.indexOf("const leavePartingEmote"),
    );
    expect(requestExit).toContain("setPartingOpen(true)");
    expect(requestExit).not.toContain("nap");
  });


  test("the host's name is written once, on the header plaque", () => {
    // Every other on-screen copy of it is deleted: the INSIDE plaque, the
    // scoreboard kicker, and the host pig's nametag.
    expect(source).not.toContain("INSIDE");
    expect(source).not.toContain("nameTagFriend");
    expect(source).not.toContain("VISITING");
    expect(source).toContain("<VisitHeader hostName={hostName}");
    expect(source).toContain('tag={null}');
  });
});
