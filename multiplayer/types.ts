// The game contract — the one interface every matchmade game implements.
//
// A game is a PURE module: (state, seat, action) → next state. The same module
// runs in three places, which is the whole reason it exists in this shape:
//   1. the Render play server (`server/`), which is the only authority over a
//      real match — it owns the seed, the clock and every accepted action;
//   2. the app, which renders the per-seat `view` the server sends and runs
//      the module locally for Practice (a bot pig plays the other seats);
//   3. tests (`__tests__/multiplayer/*`, `server/test/*`), which drive whole
//      games with bots and assert that no view ever leaks a secret.
//
// Boundary rule (enforced by .eslintrc): nothing under `multiplayer/` imports
// react-native, expo, node built-ins, or any `@/` alias path. Relative imports
// only, so Metro, jest, tsx and esbuild can all resolve it unchanged.

/** A seat index, 0..seats-1. Seat order is assigned by the room (random for
 *  the queue, host first for invites); a game must not assume seat 0 is
 *  special unless its own rules say so (e.g. "seat 0 moves first"). */
export type Seat = number;

/** live: every seat is in the app; decisions have short deadlines (seconds).
 *  async: play-by-push; decisions have long deadlines (hours) and the seat is
 *  pinged when it is their move. A game declares which paces it supports. */
export type Pace = "live" | "async";

/** competitive: someone wins (or it draws). cooperative: the table wins or
 *  falls short together. social: nobody wins; the result is a warm summary. */
export type GameKind = "competitive" | "cooperative" | "social";

/** The five matchmade games (docs/multiplayer/README.md §Games). Server-side
 *  switches live in app_settings.multiplayer.games; adding a game means a new
 *  id here, a rules module, a registry line and a board. */
export type GameId =
	/** The dice game Pig: rootle for truffles, roll the Hungerer and lose the basket. */
	| "rootle"
	/** Dots and Boxes: draw a fence; close a pen and it is yours. */
	| "fence_the_pen"
	/** Wind-up penalty guessing: follow through or flick; catch to score. */
	| "mud_volley"
	/** Co-op picture clues (Just One / Codenames Duet): one picture, one guess. */
	| "snout_says"
	/** Errands as a meeting game: alone you take the pile, pigs who meet share. */
	| "out_looking";

/** Seeded, deterministic randomness. The room derives a fresh Rng for every
 *  step from its secret seed and the revision number, so a replay of the
 *  action log reproduces every roll — and no game state ever needs to carry
 *  RNG internals. Seeds never leave the server. */
export interface Rng {
	/** Uniform float in [0, 1). */
	next(): number;
	/** Uniform integer in [0, maxExclusive). */
	int(maxExclusive: number): number;
	/** Uniform integer in [min, max] inclusive. */
	range(min: number, max: number): number;
	pick<T>(items: readonly T[]): T;
	/** Returns a shuffled copy; never mutates its input. */
	shuffle<T>(items: readonly T[]): T[];
	/** True with probability p. */
	chance(p: number): boolean;
}

/** An animation cue the UI may play when moving to the new revision. Events
 *  are presentation only: the client must render correctly from the view
 *  alone, so a dropped or skipped event can never desync a match.
 *  `visibleTo` scopes an event that carries private information (a card only
 *  its owner should see revealed); omitted = every seat sees it. */
export interface GameEvent {
	type: string;
	seat?: Seat;
	visibleTo?: readonly Seat[];
	[key: string]: unknown;
}

export type ApplyResult<S> =
	| { ok: true; state: S; events?: GameEvent[] }
	| { ok: false; error: GameErrorCode };

export interface StepResult<S> {
	state: S;
	events?: GameEvent[];
}

/** Errors an illegal action can produce. Kept small and shared so the client
 *  can map each to one line of copy. */
export type GameErrorCode =
	| "not_your_turn"
	| "illegal_move"
	| "bad_action"
	| "game_over";

export interface GameResult {
	/** win: one seat took it. draw: the seats in `winners` share the top
	 *  place (every seat, for a full draw; in a 3–4 seat game the others
	 *  simply placed below). coop: the table finished together. */
	kind: "win" | "draw" | "coop";
	/** win: the one winner. draw: every seat sharing the top place (an empty
	 *  list is read as "every seat drew"). coop: every seat (`success` says
	 *  how it went). The server records a seat in `winners` as win/draw by
	 *  `kind`, and every other seat as a loss. */
	winners: Seat[];
	/** One number per seat, in seat order (cooperative games repeat the shared
	 *  score). Presented as the game's own unit ("pens", "splats", "truffles"). */
	scores: number[];
	/** Cooperative only: did the table reach its goal? A fall-short is still a
	 *  warm, complete result — never framed as a failure of one pig. */
	success?: boolean;
	/** A short, name-free line for the result card: "5 pens to 4". */
	summary: string;
}

export interface SetupContext {
	seats: number;
	rng: Rng;
	pace: Pace;
	/** Server time the table starts, epoch ms. Optional so a test may call
	 *  setup directly; the room engine always passes it. */
	now?: number;
}

export interface StepContext {
	/** Server time, epoch ms. Rules may compare it with deadlines they store. */
	now: number;
	rng: Rng;
	pace: Pace;
	/** present[seat] is false once that pig has left the table for good (an
	 *  open async chair still waiting for its pig counts as present). A
	 *  3–4 seat game may use it to skip a departed pig when it rotates turns
	 *  or roles; it may also ignore it — the room resolves a departed seat's
	 *  decisions through `onTimeout` either way, and departed seats never
	 *  appear among a competitive result's winners (a co-op result belongs to
	 *  every pig who sat at the table, including one who had to leave). */
	present: readonly boolean[];
}

/**
 * State, actions and views must be plain JSON (objects, arrays, strings,
 * finite numbers, booleans, null): rooms are persisted between steps for
 * play-by-push and restored after a server restart. No Map, Set, Date,
 * class instance, undefined-in-arrays or function values.
 */
export interface GameDefinition<S = unknown, A = unknown, V = unknown> {
	id: GameId;
	/** Player-facing name ("Fence the Pen"). Used in push copy too. */
	title: string;
	/** The one-sentence rule (the charter's legibility test). */
	tagline: string;
	/** Bump on any change to rules or scoring; only equal versions pair. */
	rulesVersion: number;
	seats: { min: number; max: number };
	kind: GameKind;
	paces: readonly Pace[];
	/** Default per-decision deadline for each pace (ms). The room arms a
	 *  deadline for every seat in `activeSeats` whenever the revision changes;
	 *  if it passes, `onTimeout` resolves that seat's decision. */
	decisionMs: { live: number; async?: number };

	setup(ctx: SetupContext): S;

	/** Seats that owe a decision right now. One seat for a turn-based game,
	 *  several for simultaneous choices, none while the result is final. */
	activeSeats(state: S): Seat[];

	/** Optional per-state override of the deadline (e.g. a short reveal beat,
	 *  or a longer first turn). Return null for "no deadline". */
	deadlineMs?(state: S, pace: Pace): number | null;

	apply(state: S, seat: Seat, action: A, ctx: StepContext): ApplyResult<S>;

	/** Resolve a missed deadline deterministically: the game's default move
	 *  for that seat (bank the pot, a fallback lane, pass). Must always return
	 *  a state in which that seat no longer owes this decision, so a match can
	 *  never stall. The room also calls this, immediately, for every decision
	 *  of a seat that has left a 3–4 seat match. */
	onTimeout(state: S, seat: Seat, ctx: StepContext): StepResult<S>;

	/** Optional server-driven clock for light real-time beats (≤ 10 Hz). Most
	 *  games leave it out; turn and simultaneous-choice games never need it. */
	tick?: {
		everyMs: number;
		run(state: S, ctx: StepContext): StepResult<S> | null;
	};

	/** What `seat` may see. MUST strip every secret (hidden boards, unrevealed
	 *  choices, the other role's clue, anything derived from the seed). The
	 *  test kit fuzzes this against `secretsOf`. */
	view(state: S, seat: Seat): V;

	/** Optional: marker strings that must NOT appear in `seat`'s serialised
	 *  view or events right now (e.g. `"truffle@7"` while the truffle is
	 *  hidden from that seat). Games that hold secrets embed matching markers
	 *  in their state; the test kit asserts none of them ever leak. */
	secretsOf?(state: S, seat: Seat): string[];

	/** Null while play continues; the final result once the game is over. */
	result(state: S): GameResult | null;

	/** The practice pig. Picks a legal action for `seat` from that seat's OWN
	 *  view — it never sees the state, so it can never peek. Null when the
	 *  seat has nothing to do. Used by Practice, the e2e bots and the fuzzers. */
	bot(view: V, seat: Seat, rng: Rng): A | null;

	/** Runtime guard for untrusted input from the wire. Returns a well-formed
	 *  action or null; legality is `apply`'s job, shape is this one's. */
	parseAction(raw: unknown): A | null;
}

/** Any game, with its type parameters erased — what registries and rooms hold. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyGame = GameDefinition<any, any, any>;
