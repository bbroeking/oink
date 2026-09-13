-- Barn furnishing expansion: 100 catalog designs, deterministic collection rewards,
-- and server-authoritative one-time discovery acknowledgment. No random/Mote paths.

ALTER TABLE public.habitat_items
  ADD COLUMN collection_id text,
  ADD COLUMN reward_threshold int CHECK (reward_threshold IN (4,8));

CREATE TABLE public.habitat_collections (
  id text PRIMARY KEY, name text NOT NULL UNIQUE, display_order int NOT NULL UNIQUE
);
INSERT INTO public.habitat_collections(id,name,display_order) VALUES
  ('orchard_morning','Orchard Morning',10),
  ('hearthside_supper','Hearthside Supper',20),
  ('meadow_picnic','Meadow Picnic',30),
  ('rainy_barn_day','Rainy Barn Day',40),
  ('harvest_hoedown','Harvest Hoedown',50),
  ('tinkers_workshop','Tinker’s Workshop',60),
  ('storybook_nook','Storybook Nook',70),
  ('winter_woolens','Winter Woolens',80),
  ('pondside_summer','Pondside Summer',90),
  ('moonlit_slumber','Moonlit Slumber',100);

INSERT INTO public.habitat_items(id,name,description,category,rarity,asset_key,snout_cost,is_for_sale,display_order,collection_id,reward_threshold) VALUES
  ('apple_crate_stool','Apple Crate Stool','An apple-stamped crate with a plump sage cushion offers the perfect cider-break perch.','floor_decor','common','apple_crate_stool',50,true,1000,'orchard_morning',NULL),
  ('pearwood_rocker','Pearwood Rocker','Curved pearwood rockers and a leaf-stitched seat make slow mornings even sweeter.','floor_decor','common','pearwood_rocker',50,true,1010,'orchard_morning',NULL),
  ('cider_jug_lamp','Cider Jug Lamp','A little amber jug keeps the evening light warm.','floor_decor','uncommon','cider_jug_lamp',100,true,1020,'orchard_morning',NULL),
  ('orchard_boot_rack','Orchard Boot Rack','Muddy boots line up beneath four apple-shaped pegs.','floor_decor','rare','orchard_boot_rack',175,true,1030,'orchard_morning',NULL),
  ('blossom_branch_print','Blossom Branch Print','A flowering branch and two bluebirds preserve the first bright day of spring.','wall_decor','common','blossom_branch_print',50,true,1040,'orchard_morning',NULL),
  ('apple_picking_apron','Apple-Picking Apron','Rosy pockets and a stitched apple make this apron look freshly home from picking.','wall_decor','uncommon','apple_picking_apron',100,true,1050,'orchard_morning',NULL),
  ('bluebird_sugar_bowl','Bluebird Sugar Bowl','A round bluebird lid guards the sugar cubes from curious snouts.','surface_decor','common','bluebird_sugar_bowl',50,true,1060,'orchard_morning',NULL),
  ('tiny_cider_press','Tiny Cider Press','One tiny crank turns a basket of apples into make-believe cider.','surface_decor','rare','tiny_cider_press',175,true,1070,'orchard_morning',NULL),
  ('blossom_bough_mobile','Blossom Bough Mobile','Paper blossoms and carved leaves drift softly above the room.','ceiling_decor','uncommon','blossom_bough_mobile',0,false,1080,'orchard_morning',4),
  ('orchard_round_rug','Orchard Round Rug','Rings of apples, leaves, and cream braid the orchard into one welcoming circle.','floor_centerpiece','rare','orchard_round_rug',0,false,1090,'orchard_morning',8),
  ('ladderback_supper_chair','Ladderback Supper Chair','A red-spindled chair waits patiently for whoever reaches supper first.','floor_decor','common','ladderback_supper_chair',50,true,1100,'hearthside_supper',NULL),
  ('beanpot_footstool','Beanpot Footstool','The beanpot’s checked cushion turns kitchen clutter into a cozy footrest.','floor_decor','common','beanpot_footstool',50,true,1110,'hearthside_supper',NULL),
  ('copper_kettle_lamp','Copper Kettle Lamp','A hammered copper kettle pours golden light instead of tea.','floor_decor','uncommon','copper_kettle_lamp',100,true,1120,'hearthside_supper',NULL),
  ('rolling_pie_cart','Rolling Pie Cart','A flour-dusted cart carries a cooling berry pie on bright red wheels.','floor_decor','rare','rolling_pie_cart',175,true,1130,'hearthside_supper',NULL),
  ('family_recipe_board','Family Recipe Board','Rosie’s favorite pie recipe curls across a chalk-dark kitchen board.','wall_decor','common','family_recipe_board',50,true,1140,'hearthside_supper',NULL),
  ('gingham_oven_mitts','Gingham Oven Mitts','Two gingham mitts hang together as if supper has just left the oven.','wall_decor','uncommon','gingham_oven_mitts',100,true,1150,'hearthside_supper',NULL),
  ('butter_bell','Butter Bell','A sunny yellow butter bell wears a tiny red checked cap.','surface_decor','common','butter_bell',50,true,1160,'hearthside_supper',NULL),
  ('pie_bird_crock','Pie Bird Crock','A black ceramic pie bird peeks from a crock of wooden baking spoons.','surface_decor','rare','pie_bird_crock',175,true,1170,'hearthside_supper',NULL),
  ('copper_pan_chime','Copper Pan Chime','Little copper pans chime whenever a happy draft crosses the rafters.','ceiling_decor','uncommon','copper_pan_chime',0,false,1180,'hearthside_supper',4),
  ('braided_hearth_mat','Braided Hearth Mat','Thick tomato and cream braids make the hearth feel warm before the fire is lit.','floor_centerpiece','rare','braided_hearth_mat',0,false,1190,'hearthside_supper',8),
  ('wicker_picnic_chair','Wicker Picnic Chair','A wicker chair with a strawberry cushion feels like lunch beneath an open sky.','floor_decor','common','wicker_picnic_chair',50,true,1200,'meadow_picnic',NULL),
  ('daisy_cushion_pouf','Daisy Cushion Pouf','A giant daisy pouf makes sitting on the floor feel like finding a flower.','floor_decor','common','daisy_cushion_pouf',50,true,1210,'meadow_picnic',NULL),
  ('lemonade_stand','Lemonade Stand','A striped awning and glass lemonade jar bring the county fair indoors.','floor_decor','uncommon','lemonade_stand',100,true,1220,'meadow_picnic',NULL),
  ('folded_quilt_bench','Folded Quilt Bench','A folded patchwork quilt softens a simple green picnic bench.','floor_decor','rare','folded_quilt_bench',175,true,1230,'meadow_picnic',NULL),
  ('pressed_daisy_chart','Pressed Daisy Chart','Pressed daisies are labeled in careful pencil like treasures from the meadow.','wall_decor','common','pressed_daisy_chart',50,true,1240,'meadow_picnic',NULL),
  ('kite_tail_banner','Kite-Tail Banner','A kite tail of knotted ribbons skips across the wall without any wind.','wall_decor','uncommon','kite_tail_banner',100,true,1250,'meadow_picnic',NULL),
  ('strawberry_jam_jar','Strawberry Jam Jar','Ruby jam catches the light beneath a strawberry-shaped cloth lid.','surface_decor','common','strawberry_jam_jar',50,true,1260,'meadow_picnic',NULL),
  ('ladybug_tea_tin','Ladybug Tea Tin','A red ladybug tin hides tea bags beneath two glossy black wings.','surface_decor','rare','ladybug_tea_tin',175,true,1270,'meadow_picnic',NULL),
  ('ribbon_kite_mobile','Ribbon Kite Mobile','A tiny kite and eight ribbon bows circle lazily overhead.','ceiling_decor','uncommon','ribbon_kite_mobile',0,false,1280,'meadow_picnic',4),
  ('picnic_check_rug','Picnic Check Rug','Red checks, blue corners, and a daisy border spread a picnic across the floor.','floor_centerpiece','rare','picnic_check_rug',0,false,1290,'meadow_picnic',8),
  ('yellow_welly_stand','Yellow Welly Stand','Four yellow wellies drip neatly into a cloud-blue tray.','floor_decor','common','yellow_welly_stand',50,true,1300,'rainy_barn_day',NULL),
  ('puddle_blue_settee','Puddle-Blue Settee','A deep blue settee curves like a friendly puddle without getting anyone wet.','floor_decor','common','puddle_blue_settee',50,true,1310,'rainy_barn_day',NULL),
  ('umbrella_floor_lamp','Umbrella Floor Lamp','A yellow umbrella shade makes every rainy corner feel sunny.','floor_decor','uncommon','umbrella_floor_lamp',100,true,1320,'rainy_barn_day',NULL),
  ('raincoat_pegs','Raincoat Pegs','Raincoats and hats wait on a sturdy tree that stands clear of the wall.','floor_decor','rare','raincoat_pegs',175,true,1330,'rainy_barn_day',NULL),
  ('cloudspotters_chart','Cloudspotter’s Chart','Cloud shapes and tiny silver arrows turn weather watching into an art.','wall_decor','common','cloudspotters_chart',50,true,1340,'rainy_barn_day',NULL),
  ('rainy_window_sampler','Rainy Window Sampler','Stitched raindrops bead across a window that is always cozy on this side.','wall_decor','uncommon','rainy_window_sampler',100,true,1350,'rainy_barn_day',NULL),
  ('frog_weather_vane','Frog Weather Vane','A green frog points toward fair weather from his tiny rooftop arrow.','surface_decor','common','frog_weather_vane',50,true,1360,'rainy_barn_day',NULL),
  ('snail_mail_box','Snail-Mail Box','A smiling snail carries rolled notes inside its blue shell mailbox.','surface_decor','rare','snail_mail_box',175,true,1370,'rainy_barn_day',NULL),
  ('raindrop_bell_mobile','Raindrop Bell Mobile','Glass raindrops ring three pewter bells with a soft shower-song.','ceiling_decor','uncommon','raindrop_bell_mobile',0,false,1380,'rainy_barn_day',4),
  ('puddle_ring_rug','Puddle-Ring Rug','Concentric blue rings and one embroidered frog make a puddle safe for hooves.','floor_centerpiece','rare','puddle_ring_rug',0,false,1390,'rainy_barn_day',8),
  ('pumpkin_cushion_chair','Pumpkin Cushion Chair','A ribbed pumpkin chair gives every sitter the best seat at the harvest dance.','floor_decor','common','pumpkin_cushion_chair',50,true,1400,'harvest_hoedown',NULL),
  ('cornshuck_ottoman','Cornshuck Ottoman','Bound corn husks wrap a golden cushion made for tapping hooves.','floor_decor','common','cornshuck_ottoman',50,true,1410,'harvest_hoedown',NULL),
  ('pitchfork_coat_tree','Pitchfork Coat Tree','A polished pitchfork grows hooks for hats instead of hay.','floor_decor','uncommon','pitchfork_coat_tree',100,true,1420,'harvest_hoedown',NULL),
  ('barrel_side_table','Barrel Side Table','A half barrel holds cider cups beside the dance floor.','floor_decor','rare','barrel_side_table',175,true,1430,'harvest_hoedown',NULL),
  ('harvest_moon_print','Harvest Moon Print','A huge cream moon rises behind a tiny red barn and rows of corn.','wall_decor','common','harvest_moon_print',50,true,1440,'harvest_hoedown',NULL),
  ('calico_dance_banner','Calico Dance Banner','Calico squares and dancing hoofprints march across a festive banner.','wall_decor','uncommon','calico_dance_banner',100,true,1450,'harvest_hoedown',NULL),
  ('acorn_candleholder','Acorn Candleholder','A brass acorn cup cradles one beeswax flame.','surface_decor','common','acorn_candleholder',50,true,1460,'harvest_hoedown',NULL),
  ('mini_fiddle_case','Mini Fiddle Case','A walnut fiddle sleeps in a plum-lined case barely bigger than an apple.','surface_decor','rare','mini_fiddle_case',175,true,1470,'harvest_hoedown',NULL),
  ('corn_tassel_chandelier','Corn-Tassel Chandelier','Corn tassels and wooden beads tumble from a wagon-wheel ring.','ceiling_decor','uncommon','corn_tassel_chandelier',0,false,1480,'harvest_hoedown',4),
  ('hoedown_star_rug','Hoedown Star Rug','An eight-point harvest star spins through pumpkin, plum, and corn-gold wool.','floor_centerpiece','rare','hoedown_star_rug',0,false,1490,'harvest_hoedown',8),
  ('spool_leg_stool','Spool-Leg Stool','A giant thread spool becomes a clever stool for small inventors.','floor_decor','common','spool_leg_stool',50,true,1500,'tinkers_workshop',NULL),
  ('patched_tool_chest','Patched Tool Chest','Every dent in this blue tool chest looks earned and carefully mended.','floor_decor','common','patched_tool_chest',50,true,1510,'tinkers_workshop',NULL),
  ('oilcan_task_lamp','Oilcan Task Lamp','A brass oilcan bends its long spout over a focused pool of light.','floor_decor','uncommon','oilcan_task_lamp',100,true,1520,'tinkers_workshop',NULL),
  ('folding_sawhorse_table','Folding Sawhorse Table','Two folding sawhorses hold a pine top scattered with one perfect pencil.','floor_decor','rare','folding_sawhorse_table',175,true,1530,'tinkers_workshop',NULL),
  ('blueprint_pinboard','Blueprint Pinboard','Pinned plans reveal a marvelous machine powered mostly by optimism.','wall_decor','common','blueprint_pinboard',50,true,1540,'tinkers_workshop',NULL),
  ('wooden_gear_clock','Wooden Gear Clock','Exposed wooden gears tick around a tiny brass bell.','wall_decor','uncommon','wooden_gear_clock',100,true,1550,'tinkers_workshop',NULL),
  ('button_sorter_tray','Button Sorter Tray','Rows of bright buttons sort themselves into a satisfying rainbow.','surface_decor','common','button_sorter_tray',50,true,1560,'tinkers_workshop',NULL),
  ('windup_pig_toy','Wind-Up Pig Toy','A tin pig marches forward whenever its brass key gets a turn.','surface_decor','rare','windup_pig_toy',175,true,1570,'tinkers_workshop',NULL),
  ('pulley_cage_light','Pulley-Cage Light','A caged workshop bulb rises and falls on a real little pulley.','ceiling_decor','uncommon','pulley_cage_light',0,false,1580,'tinkers_workshop',4),
  ('measuring_tape_rug','Measuring-Tape Rug','A curling yellow tape measure marks out a playful path across blue canvas.','floor_centerpiece','rare','measuring_tape_rug',0,false,1590,'tinkers_workshop',8),
  ('toadstool_reading_seat','Toadstool Reading Seat','A red-capped toadstool makes chapter time feel like a woodland secret.','floor_decor','common','toadstool_reading_seat',50,true,1600,'storybook_nook',NULL),
  ('stacked_book_step','Stacked-Book Step','Three oversized books stack into a sturdy step for reaching the next tale.','floor_decor','common','stacked_book_step',50,true,1610,'storybook_nook',NULL),
  ('pencil_post_lamp','Pencil-Post Lamp','A sharpened yellow pencil holds a pleated paper shade above late-night readers.','floor_decor','uncommon','pencil_post_lamp',100,true,1620,'storybook_nook',NULL),
  ('little_library_cart','Little Library Cart','A wheeled teal library cart keeps favorite tales within easy trotting distance.','floor_decor','rare','little_library_cart',175,true,1630,'storybook_nook',NULL),
  ('once_upon_a_barn_map','Once-Upon-a-Barn Map','A curling map leads from the Barn to castles, woods, and one suspiciously round dragon.','wall_decor','common','once_upon_a_barn_map',50,true,1640,'storybook_nook',NULL),
  ('paper_crown_shadowbox','Paper Crown Shadowbox','A crinkled gold paper crown looks surprisingly grand inside its deep blue box.','wall_decor','uncommon','paper_crown_shadowbox',100,true,1650,'storybook_nook',NULL),
  ('inkpot_and_quill','Inkpot and Quill','A teal inkpot and striped feather wait beside one unfinished sentence.','surface_decor','common','inkpot_and_quill',50,true,1660,'storybook_nook',NULL),
  ('three_bears_bookends','Three Bears Bookends','Three carved bears hold up a row of bedtime books.','surface_decor','rare','three_bears_bookends',175,true,1670,'storybook_nook',NULL),
  ('paper_star_canopy','Paper-Star Canopy','Folded paper stars float beneath an indigo cloth canopy.','ceiling_decor','uncommon','paper_star_canopy',0,false,1680,'storybook_nook',4),
  ('alphabet_story_rug','Alphabet Story Rug','Bright stitched letters wander around a book-shaped center panel.','floor_centerpiece','rare','alphabet_story_rug',0,false,1690,'storybook_nook',8),
  ('sheepskin_slipper_chair','Sheepskin Slipper Chair','A cream slipper chair wraps its sitter like the warmest mitten.','floor_decor','common','sheepskin_slipper_chair',50,true,1700,'winter_woolens',NULL),
  ('mitten_storage_bench','Mitten Storage Bench','A long red bench hides scarves beneath a lid tufted like a mitten cuff.','floor_decor','common','mitten_storage_bench',50,true,1710,'winter_woolens',NULL),
  ('candycane_floor_lamp','Candy-Cane Floor Lamp','Red and cream stripes climb to a lamp glowing like holiday candy.','floor_decor','uncommon','candycane_floor_lamp',100,true,1720,'winter_woolens',NULL),
  ('sled_blanket_rack','Sled Blanket Rack','An old green sled leans upright with three folded blankets on its rails.','floor_decor','rare','sled_blanket_rack',175,true,1730,'winter_woolens',NULL),
  ('snowy_barn_papercut','Snowy Barn Papercut','Cut-paper snow settles around a tiny cranberry barn without ever melting.','wall_decor','common','snowy_barn_papercut',50,true,1740,'winter_woolens',NULL),
  ('wool_swatch_sampler','Wool-Swatch Sampler','Twelve little wool squares turn mending scraps into a proud wall sampler.','wall_decor','uncommon','wool_swatch_sampler',100,true,1750,'winter_woolens',NULL),
  ('cocoa_marshmallow_mug','Cocoa Marshmallow Mug','Marshmallows crowd a blue mug painted with one sleepy snowpig.','surface_decor','common','cocoa_marshmallow_mug',50,true,1760,'winter_woolens',NULL),
  ('tiny_knitting_basket','Tiny Knitting Basket','Two tiny birch needles rest in a basket of cranberry yarn.','surface_decor','rare','tiny_knitting_basket',175,true,1770,'winter_woolens',NULL),
  ('snowflake_wool_mobile','Snowflake Wool Mobile','Cream wool snowflakes turn slowly beneath an evergreen hoop.','ceiling_decor','uncommon','snowflake_wool_mobile',0,false,1780,'winter_woolens',4),
  ('cozy_cableknit_rug','Cozy Cable-Knit Rug','Oversized cream cable stitches make the floor look wrapped in a sweater.','floor_centerpiece','rare','cozy_cableknit_rug',0,false,1790,'winter_woolens',8),
  ('lily_pad_floor_cushion','Lily-Pad Floor Cushion','A broad green lily pad and pink bud make a delightfully splash-free seat.','floor_decor','common','lily_pad_floor_cushion',50,true,1800,'pondside_summer',NULL),
  ('reed_woven_chair','Reed-Woven Chair','Bent pond reeds weave into a breezy chair with a striped coral cushion.','floor_decor','common','reed_woven_chair',50,true,1810,'pondside_summer',NULL),
  ('firefly_bottle_lamp','Firefly Bottle Lamp','Golden fireflies blink inside a blue bottle beneath a leaf-green shade.','floor_decor','uncommon','firefly_bottle_lamp',100,true,1820,'pondside_summer',NULL),
  ('fishing_creel_table','Fishing Creel Table','A lidded fishing creel makes a sturdy table for lemonade and pebble collections.','floor_decor','rare','fishing_creel_table',175,true,1830,'pondside_summer',NULL),
  ('dragonfly_field_print','Dragonfly Field Print','Jewel-bright dragonflies hover over careful pond notes and reed sketches.','wall_decor','common','dragonfly_field_print',50,true,1840,'pondside_summer',NULL),
  ('striped_swim_towel','Striped Swim Towel','A coral-and-blue swim towel hangs in sun-faded stripes and jaunty fringe.','wall_decor','uncommon','striped_swim_towel',100,true,1850,'pondside_summer',NULL),
  ('duckling_watering_can','Duckling Watering Can','A yellow duckling watering can tips its beak toward a pot of pond grass.','surface_decor','common','duckling_watering_can',50,true,1860,'pondside_summer',NULL),
  ('pebble_fountain_bowl','Pebble Fountain Bowl','Smooth blue pebbles circle a tiny fountain no taller than a teacup.','surface_decor','rare','pebble_fountain_bowl',175,true,1870,'pondside_summer',NULL),
  ('cattail_lantern_string','Cattail Lantern String','Cattail shades hide a string of firefly-gold bulbs above the room.','ceiling_decor','uncommon','cattail_lantern_string',0,false,1880,'pondside_summer',4),
  ('pond_ripple_rug','Pond-Ripple Rug','Blue ripples circle three lily leaves and one coral dragonfly.','floor_centerpiece','rare','pond_ripple_rug',0,false,1890,'pondside_summer',8),
  ('crescent_nap_chair','Crescent Nap Chair','A crescent-shaped chair cradles naps beneath a single golden star pillow.','floor_decor','common','crescent_nap_chair',50,true,1900,'moonlit_slumber',NULL),
  ('cloud_pillow_hamper','Cloud-Pillow Hamper','A lavender hamper overflows with pillows shaped like drowsy little clouds.','floor_decor','common','cloud_pillow_hamper',50,true,1910,'moonlit_slumber',NULL),
  ('starlight_floor_lantern','Starlight Floor Lantern','A pierced indigo lantern scatters tiny stars across the floor.','floor_decor','uncommon','starlight_floor_lantern',100,true,1920,'moonlit_slumber',NULL),
  ('bedtime_trunk','Bedtime Trunk','A midnight-blue trunk keeps quilts, books, and tomorrow’s dreams safely tucked away.','floor_decor','rare','bedtime_trunk',175,true,1930,'moonlit_slumber',NULL),
  ('constellation_stitchery','Constellation Stitchery','Golden thread joins the stars into a pig-shaped constellation.','wall_decor','common','constellation_stitchery',50,true,1940,'moonlit_slumber',NULL),
  ('goodnight_pig_portrait','Goodnight Pig Portrait','A tiny pig in a nightcap waves goodnight from a moon-cream frame.','wall_decor','uncommon','goodnight_pig_portrait',100,true,1950,'moonlit_slumber',NULL),
  ('moon_milk_carafe','Moon-Milk Carafe','A frosted carafe and moon cup wait quietly for midnight thirst.','surface_decor','common','moon_milk_carafe',50,true,1960,'moonlit_slumber',NULL),
  ('sleepy_clock','Sleepy Clock','The round blue clock looks half asleep, but its golden hands stay punctual.','surface_decor','rare','sleepy_clock',175,true,1970,'moonlit_slumber',NULL),
  ('glowstar_dreamcatcher','Glowstar Dreamcatcher','A woven crescent catches seven glowing stars and three lavender feathers.','ceiling_decor','uncommon','glowstar_dreamcatcher',0,false,1980,'moonlit_slumber',4),
  ('midnight_patch_rug','Midnight Patch Rug','Indigo patches, cream moons, and lavender stars quilt bedtime across the floor.','floor_centerpiece','rare','midnight_patch_rug',0,false,1990,'moonlit_slumber',8);

ALTER TABLE public.habitat_items ADD CONSTRAINT habitat_expansion_acquisition_check CHECK ((collection_id IS NULL AND reward_threshold IS NULL) OR (collection_id IS NOT NULL AND ((is_for_sale AND reward_threshold IS NULL AND snout_cost>0) OR (NOT is_for_sale AND reward_threshold IS NOT NULL AND snout_cost=0))));
ALTER TABLE public.habitat_items ADD CONSTRAINT habitat_items_collection_fk FOREIGN KEY(collection_id) REFERENCES public.habitat_collections(id);

CREATE TABLE public.habitat_expansion_acknowledgments (
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, version text NOT NULL, request_id uuid NOT NULL, acknowledged_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(user_id,version), UNIQUE(user_id,request_id)
);
ALTER TABLE public.habitat_collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.habitat_expansion_acknowledgments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.habitat_collections,public.habitat_expansion_acknowledgments FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public._reconcile_habitat_collection(p_user uuid,p_collection text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public AS $$
DECLARE owned_count int; reward record; ins int;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('habitat:'||p_user::text,0));
 SELECT count(*) INTO owned_count FROM public.user_habitat_items o JOIN public.habitat_items i ON i.id=o.item_id WHERE o.user_id=p_user AND i.collection_id=p_collection AND i.is_for_sale;
 FOR reward IN SELECT id,reward_threshold FROM public.habitat_items WHERE collection_id=p_collection AND reward_threshold IS NOT NULL AND reward_threshold<=owned_count ORDER BY reward_threshold LOOP
  INSERT INTO public.habitat_milestones(user_id,milestone,item_id) VALUES(p_user,'collection:'||p_collection||':own'||reward.reward_threshold||':v1',reward.id) ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS ins=ROW_COUNT;
  IF ins=1 THEN PERFORM public._require_habitat_grant(p_user,reward.id,'habitat_collection','collection:'||p_collection||':own'||reward.reward_threshold||':v1'); END IF;
 END LOOP;
END $$;
REVOKE ALL ON FUNCTION public._reconcile_habitat_collection(uuid,text) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public._reconcile_all_habitat_collections(p_user uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public AS $$
DECLARE cid text; BEGIN FOR cid IN SELECT id FROM public.habitat_collections LOOP PERFORM public._reconcile_habitat_collection(p_user,cid); END LOOP; END $$;
REVOKE ALL ON FUNCTION public._reconcile_all_habitat_collections(uuid) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.grant_habitat_item(p_user_id uuid,p_item_id text,p_source text,p_source_ref text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public AS $$
DECLARE old public.habitat_grant_receipts%ROWTYPE; item public.habitat_items%ROWTYPE; fresh_count int; stamped timestamptz:=now();
BEGIN
 IF p_user_id IS NULL OR p_source IS NULL OR p_source_ref IS NULL OR btrim(p_source)='' OR btrim(p_source_ref)='' THEN RETURN jsonb_build_object('ok',false,'reason','invalid_grant'); END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('habitat:'||p_user_id::text,0));
 SELECT * INTO old FROM public.habitat_grant_receipts WHERE user_id=p_user_id AND source=p_source AND source_ref=p_source_ref;
 IF FOUND THEN IF old.item_id IS DISTINCT FROM p_item_id THEN RETURN jsonb_build_object('ok',false,'reason','idempotency_mismatch'); END IF; RETURN jsonb_build_object('ok',true,'itemId',old.item_id,'newlyOwned',old.newly_owned,'grantedAt',old.granted_at); END IF;
 SELECT * INTO item FROM public.habitat_items WHERE id=p_item_id;
 IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'reason','unknown_item'); END IF; IF NOT item.active THEN RETURN jsonb_build_object('ok',false,'reason','inactive'); END IF;
 INSERT INTO public.user_habitat_items(user_id,item_id) VALUES(p_user_id,p_item_id) ON CONFLICT DO NOTHING; GET DIAGNOSTICS fresh_count=ROW_COUNT;
 INSERT INTO public.habitat_grant_receipts(user_id,source,source_ref,item_id,newly_owned,granted_at) VALUES(p_user_id,p_source,p_source_ref,p_item_id,fresh_count=1,stamped);
 IF item.collection_id IS NOT NULL AND item.is_for_sale THEN PERFORM public._reconcile_habitat_collection(p_user_id,item.collection_id); END IF;
 RETURN jsonb_build_object('ok',true,'itemId',p_item_id,'newlyOwned',fresh_count=1,'grantedAt',stamped);
END $$;
REVOKE ALL ON FUNCTION public.grant_habitat_item(uuid,text,text,text) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public._habitat_item_json(p_item public.habitat_items,p_catalog boolean DEFAULT false)
RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path TO public AS $$ SELECT jsonb_strip_nulls(jsonb_build_object('id',p_item.id,'name',p_item.name,'description',p_item.description,'category',p_item.category,'rarity',p_item.rarity,'assetKey',p_item.asset_key,'snoutCost',CASE WHEN p_catalog THEN p_item.snout_cost END,'isForSale',CASE WHEN p_catalog THEN p_item.is_for_sale END,'active',CASE WHEN p_catalog THEN p_item.active END,'displayOrder',CASE WHEN p_catalog THEN p_item.display_order END,'collectionId',p_item.collection_id,'rewardThreshold',p_item.reward_threshold)); $$;
REVOKE ALL ON FUNCTION public._habitat_item_json(public.habitat_items,boolean) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.my_habitat_collection_progress() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public AS $$
DECLARE uid uuid:=auth.uid(); collections jsonb; BEGIN IF uid IS NULL THEN RETURN jsonb_build_object('ok',false,'reason','not_authenticated'); END IF; PERFORM public._reconcile_all_habitat_collections(uid);
 SELECT jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'ownedPaidCount',(SELECT count(*) FROM public.user_habitat_items o JOIN public.habitat_items i ON i.id=o.item_id WHERE o.user_id=uid AND i.collection_id=c.id AND i.is_for_sale),'paidCount',8,'rewards',(SELECT jsonb_agg(jsonb_build_object('itemId',r.id,'threshold',r.reward_threshold,'earned',EXISTS(SELECT 1 FROM public.user_habitat_items o WHERE o.user_id=uid AND o.item_id=r.id)) ORDER BY r.reward_threshold) FROM public.habitat_items r WHERE r.collection_id=c.id AND r.reward_threshold IS NOT NULL)) ORDER BY c.display_order) INTO collections FROM public.habitat_collections c; RETURN jsonb_build_object('ok',true,'collections',collections); END $$;
CREATE OR REPLACE FUNCTION public.habitat_expansion_discovery() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO public AS $$ SELECT CASE WHEN auth.uid() IS NULL THEN jsonb_build_object('ok',false,'reason','not_authenticated') ELSE jsonb_build_object('ok',true,'available',(SELECT count(*)=100 FROM public.habitat_items WHERE collection_id IS NOT NULL),'pending',(SELECT count(*)=100 FROM public.habitat_items WHERE collection_id IS NOT NULL) AND NOT EXISTS(SELECT 1 FROM public.habitat_expansion_acknowledgments WHERE user_id=auth.uid() AND version='barn100:v1'),'version','barn100:v1') END $$;
CREATE OR REPLACE FUNCTION public.acknowledge_habitat_expansion(p_version text,p_request_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public AS $$ DECLARE uid uuid:=auth.uid(); old uuid; ins int; BEGIN IF uid IS NULL THEN RETURN jsonb_build_object('ok',false,'reason','not_authenticated'); END IF; IF p_version IS DISTINCT FROM 'barn100:v1' OR p_request_id IS NULL THEN RETURN jsonb_build_object('ok',false,'reason','invalid_request'); END IF; SELECT request_id INTO old FROM public.habitat_expansion_acknowledgments WHERE user_id=uid AND version=p_version; IF FOUND THEN RETURN jsonb_build_object('ok',true,'replayed',true); END IF; INSERT INTO public.habitat_expansion_acknowledgments(user_id,version,request_id) VALUES(uid,p_version,p_request_id) ON CONFLICT DO NOTHING; GET DIAGNOSTICS ins=ROW_COUNT; RETURN jsonb_build_object('ok',true,'replayed',ins=0); END $$;
REVOKE ALL ON FUNCTION public.my_habitat_collection_progress() FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.habitat_expansion_discovery() FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.acknowledge_habitat_expansion(text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.my_habitat_collection_progress() TO authenticated;
GRANT EXECUTE ON FUNCTION public.habitat_expansion_discovery() TO authenticated;
GRANT EXECUTE ON FUNCTION public.acknowledge_habitat_expansion(text,uuid) TO authenticated;

DO $$ DECLARE uid uuid; BEGIN FOR uid IN SELECT DISTINCT o.user_id FROM public.user_habitat_items o JOIN public.habitat_items i ON i.id=o.item_id WHERE i.collection_id IS NOT NULL LOOP PERFORM public._reconcile_all_habitat_collections(uid); END LOOP; END $$;
