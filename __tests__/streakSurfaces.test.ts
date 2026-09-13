import fs from "node:fs";
import path from "node:path";

const read = (relative: string) =>
  fs.readFileSync(path.join(process.cwd(), relative), "utf8");

describe("Streak surfaces", () => {
  it("shows and owner-shares personal Streak around the Home Tickle bank", () => {
    const barn = read("components/Barn.tsx");
    expect(barn).toContain("streak={stats.currentStreak}");
    expect(barn).toContain('<Glyph name="flame"');
    expect(barn).toContain("Share.share");
    expect(barn).toContain("-day tickle streak");
  });

  it("shows one explicit Visit Streak flame on each friend row", () => {
    const friends = read("components/Friends.tsx");
    expect(friends).toContain("fetchFriendVisitStreaks");
    expect(friends).toContain("visitStreak.current_streak");
    expect(friends).toContain("resting · best");
    expect(friends).toContain("Visit streak with");
  });
});
