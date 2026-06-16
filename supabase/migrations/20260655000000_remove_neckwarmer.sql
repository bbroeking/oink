-- Remove the Neckwarmer ('neckwarmer', a common scarf from the 20260502 catalog)
-- from the game — it doesn't fit Rosie. FK cascade/set-null cleans up ownership,
-- equips, and any open Troughs (same as the gas_mask removal). Client art +
-- mappings removed alongside this.
DELETE FROM public.hats WHERE id = 'neckwarmer';
