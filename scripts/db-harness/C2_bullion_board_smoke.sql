-- Bullion's manual daily board regression. Run after C1 on 00x_market_prep
-- with 20261101150000_bullion_board.sql applied. Local disposable DB only.
\set ON_ERROR_STOP on
INSERT INTO auth.users(id) VALUES
 ('00000000-0000-0000-0000-00000000c201'),
 ('00000000-0000-0000-0000-00000000c202'),
 ('00000000-0000-0000-0000-00000000c203');
INSERT INTO public.profiles(id,username) VALUES
 ('00000000-0000-0000-0000-00000000c201','board buyer'),
 ('00000000-0000-0000-0000-00000000c202','other buyer'),
 ('00000000-0000-0000-0000-00000000c203','no bank');
INSERT INTO public.user_items(user_id,item_count) VALUES
 ('00000000-0000-0000-0000-00000000c201',1000),
 ('00000000-0000-0000-0000-00000000c202',1000);
SELECT set_config('ttp.fake_now','2026-11-10 14:10:00+00',false);
DO $board$
DECLARE
 a uuid := '00000000-0000-0000-0000-00000000c201';
 b uuid := '00000000-0000-0000-0000-00000000c202';
 c uuid := '00000000-0000-0000-0000-00000000c203';
 st jsonb; st2 jsonb; o jsonb; f jsonb; res jsonb; replay jsonb;
 nonce uuid := gen_random_uuid(); oid bigint; oldid bigint; fid text;
 quote int; qty int; bank int; held int; ledger int; trades int; posts int;
 p numeric; usual int; tuning jsonb; today date := '2026-11-10';
 saved jsonb; umax int;
BEGIN
 PERFORM pg_temp.as_user(a);
 SELECT value INTO tuning FROM public.app_settings WHERE key='market_tuning';
 -- The newest offer id, not a count: the day's first read may prune old closed rows (20261102200000).
 SELECT coalesce(max(id),0) INTO posts FROM public.market_offers;
 st := public.market_state();
 PERFORM pg_temp.ok((SELECT count(*) FROM jsonb_array_elements(st->'board') x WHERE x->>'source'='bullion')=3,'C2 three global daily offers');
 PERFORM pg_temp.ok((SELECT count(*) FROM public.market_bullion_offers WHERE day=today)=3,'C2 exactly three persisted slots');
 FOR o IN SELECT x FROM jsonb_array_elements(st->'board') x WHERE x->>'source'='bullion' LOOP
  SELECT x INTO f FROM jsonb_array_elements(st->'finds') x WHERE x->>'id'=o->>'find_id';
  PERFORM pg_temp.ok((o->>'id')::bigint<0 AND o->>'side'='sell','C2 negative sell id');
  PERFORM pg_temp.ok(o->'poster'=jsonb_build_object('id','bullion','kind','bullion','name','Bullion'),'C2 explicit Bullion identity');
  PERFORM pg_temp.ok((o->>'price')::int=floor(((f->>'bid')::int+(f->>'ask')::int)/2.0) AND (o->>'price')::int>(f->>'bid')::int AND (o->>'price')::int<(f->>'ask')::int,'C2 quote strictly in live spread');
  PERFORM pg_temp.ok((o->>'qty')::int=public._market_set_size(o->>'find_id',public._market_tuning()),'C2 current set size');
  PERFORM pg_temp.ok((o->>'expires_at')::timestamptz='2026-11-11 00:00:00+00','C2 UTC midnight expiry');
 END LOOP;
 PERFORM pg_temp.as_user(b); st2:=public.market_state();
 PERFORM pg_temp.ok(st->'board'=st2->'board','C2 same global offers for both users');
 PERFORM pg_temp.ok((SELECT count(*) FROM public.market_bullion_offers WHERE day=today)=3,'C2 repeat reads do not seed more');
 PERFORM pg_temp.ok((SELECT coalesce(max(id),0) FROM public.market_offers)=posts,'C2 no player stock allocated');
 PERFORM pg_temp.ok((public.market_ping()->>'listings')::int=0,'C2 ping player listing count unchanged');
 SELECT x INTO o FROM jsonb_array_elements(st->'board') x WHERE x->>'source'='bullion' ORDER BY (x->>'id')::bigint LIMIT 1;
 oid:=(o->>'id')::bigint; fid:=o->>'find_id'; quote:=(o->>'price')::int; qty:=(o->>'qty')::int;
 PERFORM pg_temp.as_user(NULL);
 PERFORM pg_temp.ok(public.market_take(oid,NULL,gen_random_uuid())->>'reason'='not_authenticated','C2 auth required');
 PERFORM pg_temp.as_user(c);
 PERFORM pg_temp.ok(public.market_take(oid,NULL,gen_random_uuid())->>'reason'='no_bank','C2 bank required');
 PERFORM pg_temp.as_user(a);
 PERFORM pg_temp.ok(public.market_take(oid,NULL,NULL)->>'reason'='bad_nonce','C2 nonce required');
 PERFORM pg_temp.ok(public.market_take('-9223372036854775808'::bigint,NULL,gen_random_uuid())->>'reason'='not_found','C2 minimum bigint id fails closed');
 PERFORM pg_temp.ok(public.market_take(oid,quote-1,gen_random_uuid())->>'reason'='price_moved','C2 max price guard');
 UPDATE public.user_items SET item_count=0 WHERE user_id=a;
 PERFORM pg_temp.ok(public.market_take(oid,NULL,gen_random_uuid())->>'reason'='not_enough_tickles','C2 insufficient bank');
 UPDATE public.user_items SET item_count=1000 WHERE user_id=a;
 UPDATE public.app_settings SET value=jsonb_set(value,'{counter_caps}','{"buy":0}'::jsonb) WHERE key='market_tuning';
 PERFORM pg_temp.ok(public.market_take(oid,NULL,gen_random_uuid())->>'reason'='counter_limit','C2 buy cap applies');
 UPDATE public.app_settings SET value=tuning WHERE key='market_tuning';
 bank:=pg_temp.coin(a); held:=pg_temp.held(a,fid); p:=pg_temp.price(fid);
 usual:=public._market_usual(fid,public._market_tuning());
 SELECT coalesce((SELECT spent FROM public.market_ledgers WHERE user_id=a),0) INTO ledger;
 SELECT count(*) INTO trades FROM public.market_trades;
 res:=public.market_take(oid,quote,nonce);
 PERFORM pg_temp.ok(res->>'ok'='true' AND res->'trade'->>'kind'='counter' AND res->'trade'->>'side'='buy' AND res->'trade'->>'how'='board','C2 manual counter receipt');
 PERFORM pg_temp.ok(pg_temp.coin(a)=bank-quote AND pg_temp.held(a,fid)=held+qty,'C2 exact bank and set');
 PERFORM pg_temp.ok((SELECT round(sum(market_cost)) FROM public.satchel_items WHERE user_id=a AND find_id=fid)=quote,'C2 exact total cost basis');
 PERFORM pg_temp.ok((SELECT spent FROM public.market_ledgers WHERE user_id=a)=ledger+quote,'C2 ledger charged');
 PERFORM pg_temp.ok(abs(pg_temp.price(fid)-least(1.15*usual,p+(public._market_tuning()->'price'->>'impact')::numeric*usual))<0.00001,'C2 normal counter buy impact');
 PERFORM pg_temp.ok((SELECT status='filled' AND buyer_id=a AND trade_id=(res->'trade'->>'id')::bigint FROM public.market_bullion_offers WHERE id=-oid),'C2 offer links winner and trade');
 replay:=public.market_take(oid,quote,nonce);
 PERFORM pg_temp.ok(replay->>'replay'='true' AND replay->'trade'->>'id'=res->'trade'->>'id','C2 nonce replay same receipt');
 PERFORM pg_temp.ok(pg_temp.coin(a)=bank-quote AND pg_temp.held(a,fid)=held+qty AND (SELECT count(*) FROM public.market_trades)=trades+1,'C2 replay no mutation');
 PERFORM pg_temp.as_user(b);
 PERFORM pg_temp.ok(public.market_take(oid,NULL,gen_random_uuid())->>'reason'='not_found','C2 second buyer loses');
 st:=public.market_state();
 PERFORM pg_temp.ok((SELECT count(*) FROM jsonb_array_elements(st->'board') x WHERE x->>'source'='bullion')=2 AND (SELECT count(*) FROM public.market_bullion_offers WHERE day=today)=3,'C2 sold slots never refill');
 SELECT (x->>'id')::bigint INTO oldid FROM jsonb_array_elements(st->'board') x WHERE x->>'source'='bullion' LIMIT 1;
 -- Force a one-tickle gap: there is no integer strictly inside it. With a
 -- VALID tuning (20261102200000 validates market_tuning: a buy_factor of 100
 -- now falls back to the defaults): every find priced so that bid = U, ask = U + 1.
 bank:=pg_temp.coin(b);
 SELECT jsonb_object_agg(find_id,price) INTO saved FROM public.market_prices;
 umax:=(SELECT max(public._market_usual(id,public._market_tuning())) FROM public.satchel_finds);
 UPDATE public.app_settings SET value=jsonb_set(value,'{price}',(value->'price')||jsonb_build_object('lo',0.9999,'hi',1+0.6/umax,'buy_factor',(umax+0.01)/(umax+0.5),'sell_factor',(umax+0.99)/(umax+0.5))) WHERE key='market_tuning';
 UPDATE public.market_prices SET price=public._market_usual(find_id,public._market_tuning())*(umax+0.5)/umax;
 PERFORM pg_temp.ok(public._market_bullion_price((SELECT find_id FROM public.market_bullion_offers WHERE id=-oldid),public._market_tuning()) IS NULL,'C2 one-tickle gap has no quote');
 st2:=public.market_state();
 PERFORM pg_temp.ok(NOT EXISTS(SELECT 1 FROM jsonb_array_elements(st2->'board') x WHERE x->>'source'='bullion'),'C2 narrow spread hidden');
 PERFORM pg_temp.ok(public.market_take(oldid,NULL,gen_random_uuid())->>'reason'='not_found' AND pg_temp.coin(b)=bank,'C2 narrow spread refuses without charge');
 UPDATE public.market_prices mp SET price=(saved->>mp.find_id)::numeric;
 UPDATE public.app_settings SET value=tuning WHERE key='market_tuning';
 -- A displayed quote is advisory: the take recomputes against live prices.
 SELECT x INTO o FROM jsonb_array_elements(st->'board') x WHERE (x->>'id')::bigint=oldid;
 fid:=o->>'find_id'; quote:=(o->>'price')::int;
 p:=pg_temp.price(fid); usual:=public._market_usual(fid,public._market_tuning());
 -- Inject a changed live price at the same tick; no advance can overwrite it.
 UPDATE public.market_prices SET price=2*usual WHERE find_id=fid;
 PERFORM pg_temp.ok(public._market_bullion_price(fid,public._market_tuning())>quote,'C2 fixture moves live quote above displayed price');
 res:=public.market_take(oldid,quote,gen_random_uuid());
 PERFORM pg_temp.ok(res->>'reason'='price_moved' AND (res->>'now')::int=public._market_bullion_price(fid,public._market_tuning()),'C2 stale screen repriced before payment');
 UPDATE public.market_prices SET price=p WHERE find_id=fid;
 UPDATE public.app_settings SET value=jsonb_set(value,'{bullion_board}','{"daily_listings":0}'::jsonb) WHERE key='market_tuning';
 st:=public.market_state();
 PERFORM pg_temp.ok(NOT EXISTS(SELECT 1 FROM jsonb_array_elements(st->'board') x WHERE x->>'source'='bullion'),'C2 zero hides existing offers');
 PERFORM pg_temp.ok(public.market_take(oldid,NULL,gen_random_uuid())->>'ok' IS DISTINCT FROM 'true','C2 zero refuses existing offers');
 UPDATE public.app_settings SET value=tuning WHERE key='market_tuning';
 PERFORM set_config('ttp.fake_now','2026-11-13 00:00:01+00',false);
 PERFORM pg_temp.ok(public.market_take(oldid,NULL,gen_random_uuid())->>'reason'='not_found','C2 prior day cannot be purchased');
 st:=public.market_state();
 PERFORM pg_temp.ok((SELECT count(*) FROM public.market_bullion_offers WHERE day='2026-11-13')=3,'C2 new UTC day seeds three');
 PERFORM pg_temp.ok(NOT EXISTS(SELECT 1 FROM public.market_bullion_offers WHERE day IN ('2026-11-11','2026-11-12')),'C2 no missed day backfill');
 UPDATE public.app_settings SET value=jsonb_set(value,'{bullion_board}','{"daily_listings":99}'::jsonb) WHERE key='market_tuning';
 PERFORM set_config('ttp.fake_now','2026-11-14 00:00:01+00',false);
 st:=public.market_state();
 PERFORM pg_temp.ok((SELECT count(*) FROM public.market_bullion_offers WHERE day='2026-11-14')=6,'C2 daily listings clamp at six');
 UPDATE public.app_settings SET value=jsonb_set(value,'{bullion_board}','{"daily_listings":0}'::jsonb) WHERE key='market_tuning';
 PERFORM set_config('ttp.fake_now','2026-11-15 00:00:01+00',false);
 st:=public.market_state();
 PERFORM pg_temp.ok(NOT EXISTS(SELECT 1 FROM public.market_bullion_offers WHERE day='2026-11-15'),'C2 zero skips new day seeding');
 UPDATE public.app_settings SET value=tuning WHERE key='market_tuning';
 UPDATE public.app_settings SET value=jsonb_set(value,'{bullion_board}','{"daily_listings":-10}'::jsonb) WHERE key='market_tuning';
 PERFORM set_config('ttp.fake_now','2026-11-16 00:00:01+00',false);
 st:=public.market_state();
 PERFORM pg_temp.ok(NOT EXISTS(SELECT 1 FROM public.market_bullion_offers WHERE day='2026-11-16'),'C2 negative daily listings clamp to zero');
 UPDATE public.app_settings SET value=tuning WHERE key='market_tuning';
 PERFORM pg_temp.ok(NOT has_sequence_privilege('anon','public.market_bullion_offers_id_seq','USAGE,SELECT,UPDATE') AND NOT has_sequence_privilege('authenticated','public.market_bullion_offers_id_seq','USAGE,SELECT,UPDATE'),'C2 sequence inaccessible to clients');
 PERFORM pg_temp.ok((SELECT pc.relrowsecurity FROM pg_class pc WHERE pc.oid='public.market_bullion_offers'::regclass),'C2 RLS enabled');
 PERFORM pg_temp.ok(NOT has_table_privilege('anon','public.market_bullion_offers','SELECT,INSERT,UPDATE,DELETE') AND NOT has_table_privilege('authenticated','public.market_bullion_offers','SELECT,INSERT,UPDATE,DELETE'),'C2 table inaccessible to clients');
 PERFORM pg_temp.ok(NOT EXISTS(SELECT 1 FROM pg_proc pr JOIN pg_namespace ns ON ns.oid=pr.pronamespace WHERE ns.nspname='public' AND pr.proname IN ('_market_bullion_price','_market_bullion_board','_market_bullion_take') AND (has_function_privilege('anon',pr.oid,'EXECUTE') OR has_function_privilege('authenticated',pr.oid,'EXECUTE'))),'C2 helpers inaccessible to clients');
 RAISE NOTICE 'C2 Bullion daily board: all green';
END
$board$;
