-- ═══════════════════════════════════════════════════════════════════════════
-- QR REDEMPTION — "Golden Ticket" giveaway codes (event/booth grants).
-- HELD FOR REVIEW: push only on Brian's explicit "go" (CLAUDE.md — DB pushes
-- are never autonomous). Applied head at authoring time: 20260730.
--
-- Spec: "SPEC — QR Code Redemption (Golden Ticket)" §1.
--
-- What ships here (all brand-new — NO CREATE OR REPLACE of anything existing,
-- so the carry-latest-def footgun is avoided by construction):
--   • redemption_codes  — bearer-token catalog (code PK, normalized: UPPER,
--     no dashes). max_uses + uses (event posters vs single-use prints),
--     expires_at, and a jsonb `grant` describing hat | truffles | snouts.
--   • redemption_claims  — per-user-once ledger, PK (code, user_id).
--   • Both RLS-enabled with ZERO policies: clients can never SELECT/enumerate
--     codes. The only doors are the SECURITY DEFINER redeem_code() RPC and the
--     service-role mint script.
--   • redeem_code(p_code)  — the ONE redemption path. Normalizes at the single
--     chokepoint, row-locks the code (race-safe uses), guards expiry/exhaustion/
--     per-user-once, then applies the grant via the established idioms
--     (user_hats INSERT, mint_truffles ledger, profiles.counter bump).
--
-- Fairness (SKILL.md — Collect, fair-by-construction): grants are server-side,
-- ledgered (truffles ride war_truffles via mint_truffles), per-user-once,
-- cap-respecting (mint_truffles clamps at 999), refusal-enveloped. Codes are
-- GIFTED at events, never bought — status stays earned/gifted.
--
-- Codes: plaintext PK (§1a) — low-value bearer tokens with ~40 bits entropy;
-- RLS-with-no-policies already makes them non-enumerable, and hashing would
-- break the printed-sheet audit workflow for no real threat reduction.
--
-- ACCEPTED RESIDUAL RISK (adversarial review, 2026-07): redeem_code() has no
-- per-user rate limit / lockout, and does not audit failed attempts. Brute
-- force over the ~40-bit code space (30-symbol alphabet) is impractical at
-- giveaway scale for low-value gifted grants, and the codes are already
-- non-enumerable via RLS. If the threat profile ever rises (high-value grants,
-- large campaigns), add a per-caller failed-attempt counter or a Supabase edge
-- rate limit — deliberately NOT done here.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Schema ────────────────────────────────────────────────────────────────

CREATE TABLE public.redemption_codes (
	code        text PRIMARY KEY,          -- normalized: UPPER, no dashes (§1c)
	label       text NOT NULL,             -- admin-facing: "PAX booth 2026"
	"grant"     jsonb NOT NULL,            -- {"kind":"hat","id":"mushroom_cap"} |
	                                        -- {"kind":"truffles","amount":50} |
	                                        -- {"kind":"snouts","amount":100}
	max_uses    int  NOT NULL DEFAULT 1,   -- 1 = printed single-use; N = poster
	uses        int  NOT NULL DEFAULT 0,
	expires_at  timestamptz,               -- NULL = never
	created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.redemption_claims (
	code       text NOT NULL REFERENCES public.redemption_codes(code),
	user_id    uuid NOT NULL REFERENCES public.profiles(id),
	claimed_at timestamptz NOT NULL DEFAULT now(),
	PRIMARY KEY (code, user_id)            -- per-user-once, by construction
);

ALTER TABLE public.redemption_codes  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.redemption_claims ENABLE ROW LEVEL SECURITY;
-- Deliberately ZERO policies: clients can never SELECT/enumerate codes; the
-- only doors are the SECURITY DEFINER RPC + service-role mint script.

-- ── 2. redeem_code — the ONE redemption path (SECURITY DEFINER) ──────────────
-- Body order (§1b): auth → normalize (single chokepoint) → row-lock lookup →
-- expiry/exhaustion → per-user-once claim → apply grant → bump uses → return.
-- Bad hat seed data refuses LOUDLY (bad_grant) BEFORE the claim insert, so a
-- half-claim can never happen. No announcement send here (and if one is ever
-- added, INLINE the system_announcements INSERT — the send_system_announcement()
-- admin_only silent-rollback footgun).
CREATE FUNCTION public.redeem_code(p_code text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
	caller     uuid := auth.uid();
	norm       text;
	rec        public.redemption_codes%ROWTYPE;
	g_kind     text;
	g_id       text;
	g_amount   int;
	hat_name   text;
	hat_rarity text;
	rows_ins   int;
	actual     int;
BEGIN
	IF caller IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'not_signed_in');
	END IF;

	-- Single normalize chokepoint: typed `pig-4kf2-9xqm`, a scanned URL tail,
	-- and printed uppercase all converge to PIGXXXXXXXX (commit 71cda55 lesson).
	norm := upper(regexp_replace(p_code, '[^A-Za-z0-9]', '', 'g'));

	-- Row lock serializes concurrent redemptions of one code (race-safe uses).
	SELECT * INTO rec FROM public.redemption_codes
		WHERE code = norm FOR UPDATE;
	IF NOT FOUND THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'unknown');
	END IF;

	IF rec.expires_at IS NOT NULL AND rec.expires_at < now() THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'expired');
	END IF;
	IF rec.uses >= rec.max_uses THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'exhausted');
	END IF;

	g_kind   := rec."grant"->>'kind';
	g_id     := rec."grant"->>'id';
	g_amount := (rec."grant"->>'amount')::int;

	-- Validate the grant BEFORE the claim insert, so bad seed data refuses
	-- loudly without consuming the code or half-claiming.
	IF g_kind = 'hat' THEN
		SELECT name, rarity INTO hat_name, hat_rarity FROM public.hats WHERE id = g_id;
		IF NOT FOUND THEN
			RETURN jsonb_build_object('ok', false, 'reason', 'bad_grant');
		END IF;
	ELSIF g_kind IN ('truffles', 'snouts') THEN
		-- Amount must be a real, positive count. A NULL amount would blow up the
		-- snouts `counter + NULL` (NOT NULL violation → raw 500), and a negative
		-- amount would silently DEDUCT snouts and still return ok:true (the snouts
		-- branch has no guard). Refuse both pre-claim as bad seed data.
		IF g_amount IS NULL OR g_amount < 1 THEN
			RETURN jsonb_build_object('ok', false, 'reason', 'bad_grant');
		END IF;

		-- Pouch-cap guard (truffles only): mint_truffles clamps at 999, so a
		-- caller already at the cap would receive 0 while the single-use ticket
		-- is consumed — a gift-framed reveal for nothing. Check the caller's
		-- current balance BEFORE any write; if there's no room at all, refuse
		-- pre-claim so the ticket survives. Partial room (some < amount) still
		-- proceeds and returns granted_amount honestly.
		IF g_kind = 'truffles' THEN
			SELECT COALESCE(golden_truffles, 0) INTO actual
				FROM public.profiles WHERE id = caller;
			IF actual >= 999 THEN
				RETURN jsonb_build_object('ok', false, 'reason', 'pouch_full');
			END IF;
		END IF;
	ELSE
		RETURN jsonb_build_object('ok', false, 'reason', 'bad_grant');
	END IF;

	-- Per-user-once, by construction: the PK collision means "already claimed".
	INSERT INTO public.redemption_claims (code, user_id)
		VALUES (norm, caller)
		ON CONFLICT DO NOTHING;
	GET DIAGNOSTICS rows_ins = ROW_COUNT;
	IF rows_ins = 0 THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'already_redeemed');
	END IF;

	-- Apply the grant.
	IF g_kind = 'hat' THEN
		INSERT INTO public.user_hats (user_id, hat_id)
			VALUES (caller, g_id)
			ON CONFLICT DO NOTHING;
		GET DIAGNOSTICS rows_ins = ROW_COUNT;
		-- already owned → still ok:true (the code is consumed; reveal copy handles it).
		UPDATE public.redemption_codes SET uses = uses + 1 WHERE code = norm;
		RETURN jsonb_build_object(
			'ok', true, 'kind', 'hat', 'id', g_id, 'name', hat_name,
			'rarity', hat_rarity, 'already_owned', (rows_ins = 0)
		);

	ELSIF g_kind = 'truffles' THEN
		-- Reuse the ledgered, 999-cap-clamped mint path; may return < amount
		-- at the cap (never lossy silently — granted_amount is the truth).
		actual := public.mint_truffles(caller, g_amount, 'redemption:' || norm, NULL);
		UPDATE public.redemption_codes SET uses = uses + 1 WHERE code = norm;
		RETURN jsonb_build_object(
			'ok', true, 'kind', 'truffles', 'granted_amount', actual
		);

	ELSE  -- snouts (validated above)
		UPDATE public.profiles SET counter = counter + g_amount WHERE id = caller;
		UPDATE public.redemption_codes SET uses = uses + 1 WHERE code = norm;
		RETURN jsonb_build_object(
			'ok', true, 'kind', 'snouts', 'amount', g_amount
		);
	END IF;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.redeem_code(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.redeem_code(text) TO authenticated;
