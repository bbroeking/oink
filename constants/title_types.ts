// Shared shape for a player-owned cosmetic title row.
//
// A title is a name decoration (e.g. "Sir", "the Bountiful") with a
// `placement` controlling whether it renders before or after the
// username. This same row shape comes back from several queries —
// the `titles` join in TitlesSection, the lucky-drop grant in Barn,
// and the unlock modal — so it lives here as the single source of
// truth rather than being re-declared per file.
//
// NOTE: this is the FULL title row. The leaderboard's `ActiveTitle`
// is intentionally a narrower shape ({id,name,placement}, no
// description) — keep that one local to Leaderboard.tsx.
export type TitlePlacement = "pre" | "post";

export interface TitleRow {
	id: string;
	name: string;
	placement: TitlePlacement;
	description: string | null;
}
