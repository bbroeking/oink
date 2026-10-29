// Export the production placement function with actual PNG dimensions for visual audits.
import fs from 'node:fs';
import path from 'node:path';
import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';

const root = path.resolve(import.meta.dirname, '../..');
const out = path.join(root, 'artifacts/accessory-attachment-preview/audit-data');
fs.mkdirSync(out, { recursive: true });
const stage = fs.readFileSync(path.join(root, 'components/ui/PigStage.tsx'), 'utf8');
const resolver = stage.slice(stage.indexOf('export function resolveSlot('), stage.indexOf('// A ritual\'s forced cosmetic'));
const aspect = stage.slice(stage.indexOf('export function resolvePigStageAssetAspect('), stage.indexOf('// Canonical'));
const categories = JSON.parse(execFileSync('python3', ['-c', 'import sys,json;sys.path.insert(0,"tools");import placement_studio as p;print(json.dumps(p.catalog_categories()))'], {cwd:root,encoding:'utf8'}));
const entry = `
import { HAT_IMAGES, HAT_REL, CATEGORY_OVERLAYS, CATEGORY_ANCHORS, CATEGORY_PERANIM_SHIFTS, DEFAULT_HAT_OVERLAY, PIG_CANVAS, frameDelta, resolveAnchor, resolveWearablePose, TURNED_EYE_SHIFT } from './constants/hats';
import { HAT_SIDE_IMAGES } from './constants/hat_side.generated';
import { ITEM_PREBAKED, isPrebaked } from './constants/prebaked';
import { PIG_ANIMATION_SPECS, pigAnchorAnimation, pigDrawnFacing } from './components/ui/pigRendererContract';
import { PIG_IDS } from './utils/pigs';
const Image = { resolveAssetSource: source => source };
${aspect}
${resolver}
const categories=${JSON.stringify(categories)};
const excluded=new Set(['goblin_grunt','goblin_scout','goblin_brute','goblin_warboss','goblin_grunt_hit','goblin_scout_hit','goblin_brute_hit','goblin_warboss_hit','mud_splat','mud_splat_gold']);
const items = Object.keys(HAT_IMAGES).filter(id => !excluded.has(id) && !id.startsWith('flag_') && (HAT_REL[id] || categories[id]) && !['background','tickle_particle'].includes(categories[id]?.category)).map(id => {
  const spec=HAT_REL[id];
  return {id,spec,category:categories[id]?.category ?? (spec?.anchor === 'head' ? 'hat' : ['eyes','eye_l','eye_r'].includes(spec?.anchor) ? 'glasses' : spec?.anchor === 'neck' ? 'necklace' : spec?.anchor === 'body' ? 'aura' : 'held')};
});
const pigPlacements = Object.fromEntries(PIG_IDS.map(pig => [pig,Object.fromEntries(items.map(item => [item.id, Object.fromEntries(Object.entries(PIG_ANIMATION_SPECS).map(([animation,spec]) => [animation, spec.frames.map((_,frame) => resolveSlot({id:item.id,category:item.category,emoji:null},animation,frame,{},pig))]))]))]));
const pigAnchors=Object.fromEntries(PIG_IDS.map(pig=>[pig,Object.fromEntries(Object.entries(PIG_ANIMATION_SPECS).map(([animation,spec]) => [animation,spec.frames.map((_,frame) => Object.fromEntries(['head','eye_l','eye_r','neck','hand_r'].map(anchor => [anchor,resolveAnchor(pigAnchorAnimation(animation),frame,anchor,pig)])))]))]));
console.log(JSON.stringify({items,animations:PIG_ANIMATION_SPECS,placements:pigPlacements.rosie,pigPlacements,anchors:pigAnchors.rosie,pigAnchors}));
`;
const bundle = await build({ stdin:{contents:entry, resolveDir:root, loader:'ts'}, bundle:true, platform:'node', format:'esm', loader:{'.jpg':'file'}, write:false, outdir:'/tmp/pig-attachment-audit', plugins:[{name:'png-metadata',setup(b){b.onLoad({filter:/\.png$/},args=>{ const bytes=fs.readFileSync(args.path); return {contents:`module.exports = ${JSON.stringify({path:path.relative(root,args.path),width:bytes.readUInt32BE(16),height:bytes.readUInt32BE(20)})}`,loader:'js'};});}}] });
const resultPath = path.join(out, 'placement-runtime.mjs');
fs.writeFileSync(resultPath,bundle.outputFiles.find(file => file.path.endsWith('.js')).text);
const data = execFileSync(process.execPath,[resultPath],{maxBuffer:40*1024*1024});
if(process.argv.includes('--baseline') && fs.existsSync(path.join(out,'baseline.json'))) throw new Error('Baseline already captured; preserve it for comparison.');
fs.writeFileSync(path.join(out, process.argv.includes('--baseline') ? 'baseline.json' : 'placements.json'),data);
fs.unlinkSync(resultPath);
console.log(`Exported production placements to ${out}`);
