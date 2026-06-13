// Username moderation list + checker.
//
// Client-side pre-check only — the authoritative copy of this policy
// lives in the DB (is_username_allowed() + the profiles trigger from
// supabase/migrations/20260645000000_username_moderation.sql). Keep
// the two curations in sync when editing: Tier 1 (substrings) must
// always match the SQL list; Tier 2 / reserved may drift slightly.
//
// Policy: normalize (lowercase → leet-map → strip non-alphanumerics),
// then:
//   1. Tier 1 — banned wherever they appear in the name. Only strings
//      with no real false-positive surface belong here.
//   2. Tier 2 — banned only as the WHOLE normalized name. Too short or
//      too embeddable to scan as substrings (cucumber, bassist,
//      sussex, grape, conspicuous...).
//   3. Reserved — names the barn itself owns. Exact match only.

// Leet map applied before stripping symbols, so "n1gg3r" and "b!tch"
// normalize into their letter forms. Mirrors translate() in SQL:
// '0134578$@!+' → 'oieastbsait'.
const LEET_MAP: Record<string, string> = {
	"0": "o",
	"1": "i",
	"3": "e",
	"4": "a",
	"5": "s",
	"7": "t",
	"8": "b",
	$: "s",
	"@": "a",
	"!": "i",
	"+": "t",
};

const BANNED_SUBSTRINGS: string[] = [
	"nigger",
	"nigga",
	"faggot",
	"kike",
	"chink",
	"wetback",
	"beaner",
	"tranny",
	"whore",
	"slut",
	"bitch",
	"fucker",
	"fucking",
	"motherfuck",
	"cocksuck",
	"dickhead",
	"asshole",
	"pedophile",
	"paedo",
	"childporn",
	"hitler",
	"nazi",
	"kukluxklan",
	"lynchnig",
	"goatfuck",
	"pigfuck",
];

// NB: "cunt" (Scunthorpe), "rapist" (therapist), "pedo" (torpedo,
// pedometer) and "loli" (hololive, Lolita, lolipop) live here, not in
// Tier 1 — each has a real innocent superstring. Tier 1 compensates
// with the unambiguous long forms (pedophile/paedo, childporn).
const BANNED_EXACT: string[] = [
	"fuck",
	"shit",
	"piss",
	"cock",
	"dick",
	"twat",
	"cunt",
	"rapist",
	"pedo",
	"loli",
	"clit",
	"fag",
	"ass",
	"arse",
	"anus",
	"sex",
	"cum",
	"jizz",
	"tit",
	"tits",
	"hoe",
	"rape",
	"spic",
	"kys",
	"porn",
	"penis",
	"vagina",
	"boobs",
	"nude",
	"nudes",
	"hooker",
	"prostitute",
];

const RESERVED: string[] = [
	"rosie",
	"admin",
	"administrator",
	"mod",
	"moderator",
	"system",
	"support",
	"staff",
	"official",
	"owner",
	"dev",
	"developer",
	"gamemaster",
	"ticklethepig",
	"ttp",
];

/** NFKC → lowercase → leet-map → strip everything outside [a-z0-9]. */
function normalize(name: string): string {
	return name
		.normalize("NFKC") // fold fullwidth lookalikes: ｆｕｃｋ→fuck, １→1
		.toLowerCase()
		.split("")
		.map((ch) => LEET_MAP[ch] ?? ch)
		.join("")
		.replace(/[^a-z0-9]/g, "");
}

export type UsernameCheck =
	| { ok: true }
	| { ok: false; reason: "banned" | "reserved" };

/**
 * Moderation check for a proposed username. `{ok: false}` means the
 * save must be blocked; `reason` picks the player-facing copy
 * ("banned" → won't fly in the barn, "reserved" → barn owns it).
 */
export function isUsernameAllowed(name: string): UsernameCheck {
	const normalized = normalize(name);

	for (const word of BANNED_SUBSTRINGS) {
		if (normalized.includes(word)) {
			return { ok: false, reason: "banned" };
		}
	}
	if (BANNED_EXACT.includes(normalized)) {
		return { ok: false, reason: "banned" };
	}
	if (RESERVED.includes(normalized)) {
		return { ok: false, reason: "reserved" };
	}
	return { ok: true };
}
