-- Existing high-rank player for migration-time keepsake catch-up.
INSERT INTO auth.users(id) VALUES('00000000-0000-0000-0000-000000079010');
INSERT INTO public.profiles(id,username,counter,wallow_count)
VALUES('00000000-0000-0000-0000-000000079010','habitat-completion-rank10',610,10);
