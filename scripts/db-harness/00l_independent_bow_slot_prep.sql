-- Harness fixture applied immediately before the independent Bow-slot
-- migration. Seed one legacy bow wearer so the migration's data move is
-- exercised, plus a second Bow and a Hat for post-migration equip checks.

ALTER TABLE public.hats ADD COLUMN IF NOT EXISTS category text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS active_hat_id text;

INSERT INTO public.hats (id, category) VALUES
	('bow_slot_legacy', 'bow'),
	('bow_slot_fresh', 'bow'),
	('bow_slot_hat', 'hat')
ON CONFLICT (id) DO UPDATE SET category = EXCLUDED.category;

INSERT INTO auth.users (id)
VALUES ('00000000-0000-0000-0000-000000067001')
ON CONFLICT DO NOTHING;

INSERT INTO public.profiles (id, username, active_hat_id)
VALUES (
	'00000000-0000-0000-0000-000000067001',
	'bow-slot-smoke',
	'bow_slot_legacy'
)
ON CONFLICT (id) DO UPDATE SET active_hat_id = EXCLUDED.active_hat_id;

INSERT INTO public.user_hats (user_id, hat_id) VALUES
	('00000000-0000-0000-0000-000000067001', 'bow_slot_legacy'),
	('00000000-0000-0000-0000-000000067001', 'bow_slot_fresh'),
	('00000000-0000-0000-0000-000000067001', 'bow_slot_hat')
ON CONFLICT DO NOTHING;
