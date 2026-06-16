-- Remove the Gas Mask ('gas_mask', a rare mask from the 20260502 shop catalog)
-- from the game entirely. The FKs do the cleanup for us:
--   • user_hats.hat_id        ON DELETE CASCADE  → ownership rows removed
--   • profiles.active_mask_id  ON DELETE SET NULL → unequipped for anyone wearing it
--   • item_drives.item_id      ON DELETE CASCADE  → any open Trough for it removed
--   • achievements.reward_item_id ON DELETE SET NULL
-- so a single delete is safe. Client art + mappings removed alongside this.
DELETE FROM public.hats WHERE id = 'gas_mask';
