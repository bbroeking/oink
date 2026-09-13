-- The shipped Sparkle Particle is a five-point star. Keep the existing art and
-- correct the shared catalog row consumed by both the Shop and Closet.
UPDATE public.hats
SET description = 'A bright five-point star that sparkles with every tap.'
WHERE id = 'particle_sparkle'
	AND description IS DISTINCT FROM 'A bright five-point star that sparkles with every tap.';
