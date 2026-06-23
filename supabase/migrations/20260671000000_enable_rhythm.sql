-- Activate Songs of the Bog (rhythm mode) for PLAYTEST. Flips mud_rhythm_on() -> true
-- so new mud-war challenges become 7-day rhythm wars. Still dark to the public: the
-- client entry (the Sounder Mud Fight CTA + the screen) is gated on MUD_FIGHTS_VISIBLE
-- = DEV_PREVIEW (false in prod builds), so only dev/is_test sessions can reach it.
--
-- REVERSIBLE: push a sibling migration that CREATE OR REPLACE-s this back to `false`
-- to deactivate (existing rhythm wars finish on their own; new ones go classic).
CREATE OR REPLACE FUNCTION public.mud_rhythm_on()
RETURNS boolean LANGUAGE sql IMMUTABLE AS $function$ SELECT true; $function$;
