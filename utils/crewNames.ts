// Playful default Sounder names for the found-your-own flow. Seeds the FoundForm
// input so a new leader always starts with a name they can keep or reroll.
//
// The 24-char cap mirrors the server's crew-name limit (create_crew / rename_crew
// both reject longer names); when "The {adj} {noun}" would exceed it we drop the
// leading "The " so the generated name always fits.

const ADJ = ["Muddy", "Velvet", "Truffle", "Puddle", "Acorn", "Snuffling", "Rooting", "Cozy", "Thundering", "Bramble", "Clover", "Dozy"];
const NOUN = ["Snouts", "Hooves", "Rooters", "Diggers", "Rascals", "Barons", "Puddlers", "Sniffers", "Trotters", "Wallowers", "Scoundrels", "Herd"];

const CREW_NAME_CAP = 24;

export function randomCrewName(): string {
	const adj = ADJ[Math.floor(Math.random() * ADJ.length)];
	const noun = NOUN[Math.floor(Math.random() * NOUN.length)];
	const full = `The ${adj} ${noun}`;
	return full.length > CREW_NAME_CAP ? `${adj} ${noun}` : full;
}
