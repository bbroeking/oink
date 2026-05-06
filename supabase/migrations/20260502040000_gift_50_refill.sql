-- Gift everyone +50 tickles and refill AVAILABLE to the cap (25).
UPDATE public.profiles SET counter = counter + 50;
UPDATE public.user_items
SET item_count = 25, last_increment = now();
