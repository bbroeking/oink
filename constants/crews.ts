// Sounder (crew) constants — client mirror of the server crew rules.
//
// The war/league constants that used to live alongside these are gone; a
// Sounder is now purely a co-op roster that gates the Truffle Patch dig.

export const CREW_CAP = 8; // max members per Sounder (server mirror)

// Prose form for player-facing copy ("Eight snouts, one banner") — derived so
// the story can never oversell the roster if the cap moves again. Capitalized;
// mid-sentence sites lowercase it.
export const CREW_CAP_WORD = (
	["zero", "one", "two", "three", "four", "five", "six", "seven", "eight"][
		CREW_CAP
	] ?? String(CREW_CAP)
).replace(/^./, (c) => c.toUpperCase());
