export const QUALITY_CONFIG = Object.freeze({
  layout: {
    /**
     * Zero-tolerance contracts are already clean and may never regress.
     */
    maxShrinkToFit: 0,
    maxSub11LiteralFonts: 0,

    /**
     * Explicit legacy-debt budgets from the 2026-07-26 native re-audit.
     * These are ceilings, not targets. Lower them whenever a migration
     * tranche removes debt; the loop prevents it from growing back.
     */
    maxTextLineClamps: 91,
    maxRawModalUses: 43,
    maxDimensionsGetCalls: 14,

    /**
     * Foundation coverage may only move forward.
     */
    minAdaptiveModalConsumers: 3,
    minIconButtonConsumers: 3,
    minSegmentedControlConsumers: 1,
  },
  security: {
    /**
     * The recent migration chain was audited together. Every later
     * migration automatically joins this security contract.
     */
    migrationFloor: "20260775000000",
    allowedAnonFunctions: new Set(["season_state"]),

    /**
     * Trigger functions cannot be invoked as ordinary functions, but they
     * should still be revoked when touched. One legacy trigger currently
     * relies on that PostgreSQL restriction; do not allow another.
     */
    maxUnrevokedSecurityDefinerTriggers: 1,
  },
});

export const LAYOUT_TESTS = Object.freeze([
  "__tests__/polishPrimitives.test.tsx",
  "__tests__/AdaptiveModalScaffold.test.tsx",
  "__tests__/adaptiveLayout.test.ts",
  "__tests__/navigationClarity.test.ts",
  "__tests__/motionPolicy.test.tsx",
  "__tests__/colorSystem.test.ts",
  "__tests__/listAndImageOptimization.test.ts",
  "__tests__/HungerHero.test.ts",
]);

export const SECURITY_TESTS = Object.freeze([
  "__tests__/rpc.test.ts",
  "__tests__/cosmetics.test.ts",
  "__tests__/redemption.test.ts",
  "__tests__/referralConsolidation.test.ts",
  "__tests__/pigRoster.test.ts",
  "__tests__/wallowTruffleOverflowMigration.test.ts",
  "__tests__/shopExclusivity.test.ts",
  "__tests__/rooting.test.ts",
  "__tests__/joinSlopClub.test.ts",
  "__tests__/hungerStageRewards.test.ts",
  "__tests__/visitEmotes.test.ts",
]);

/**
 * The harness owns a stable base chain, while these later migrations are
 * required by smoke files that are always appended by run.sh. Keep the list
 * ordered; a new always-on smoke must add its migration here.
 */
export const DB_HARNESS_EXTRAS = Object.freeze([
  "supabase/migrations/20260746000000_trough_nudge_supersede.sql",
  "supabase/migrations/20260747000000_storybook_seen.sql",
  "supabase/migrations/20260749000000_dig_share_count.sql",
  "supabase/migrations/20260750000000_mudwrap_stacking.sql",
  "supabase/migrations/20260751000000_retire_trough_tickle_reward.sql",
  "supabase/migrations/20260752000000_field_guide_pages.sql",
  "supabase/migrations/20260753000000_tickle_breakdown.sql",
  "supabase/migrations/20260774000000_equip_cosmetic.sql",
	"supabase/migrations/20260776000000_cosmetic_owner_caps.sql",
	"scripts/db-harness/00i_pig_roster_prep.sql",
	"supabase/migrations/20260781000000_member_pig_roster.sql",
	"supabase/migrations/20260785000000_pig_roster_privilege_hardening.sql",
	"supabase/migrations/20260791000000_lock_member_pig_choice.sql",
	"supabase/migrations/20260795000000_enemy_rankings.sql",
	"supabase/migrations/20260797000000_enemy_ranking_directions.sql",
	"scripts/db-harness/00j_archery_bow_prep.sql",
	"supabase/migrations/20260798000000_fix_archery_bow_slot.sql",
]);
