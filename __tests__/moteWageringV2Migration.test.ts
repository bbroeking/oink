import fs from 'node:fs';
import path from 'node:path';

const sql = fs.readFileSync(
  path.join(process.cwd(), 'supabase/migrations/20260906010000_mote_wagering_v2.sql'),
  'utf8',
);

describe('Mote wagering v2 migration contract', () => {
  it('freezes the exact wager-v1 table and earned stakes', () => {
    expect(sql).toContain("('wager-v1', 'wager', ARRAY[1,3,5], 'mote-animation-v4')");
    expect(sql).toContain("('wager-v1','loss',5000,0,0)");
    expect(sql).toContain("('wager-v1','returned_stake',2500,1,0)");
    expect(sql).toContain("('wager-v1','small',1800,2,0)");
    expect(sql).toContain("('wager-v1','big',600,3,1)");
    expect(sql).toContain("('wager-v1','jackpot',100,10,5)");
  });

  it('keeps rollout off and exposes owner-scoped recovery', () => {
    expect(sql).toContain("VALUES ('mote_wager_enabled', 'false'::jsonb");
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.mote_play_receipt');
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.mote_play_history');
    expect(sql).toContain('WHERE user_id=caller_id AND request_id=p_request_id');
  });

  it('uses rejection sampling and one central wallet revision trigger', () => {
    expect(sql).toContain('n < ceiling THEN RETURN n % p_size');
    expect(sql).toContain('BEFORE UPDATE OF mote_balance ON public.profiles');
    expect(sql).toContain('mote_wallet_revision := OLD.mote_wallet_revision + 1');
  });

  it('normalizes Reveal presentation and adapts both historical receipt families', () => {
    expect(sql).toContain("IF p_mode='reveal' THEN");
    expect(sql).toContain("chosen:='legacy_resource'");
    expect(sql).toContain('stops:=ARRAY[selector,selector,selector]');
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public._mote_v1_receipt');
    expect(sql).toContain("'reward_tickles',p.reward_tickles");
    expect(sql).toContain('UNION ALL');
  });
});
