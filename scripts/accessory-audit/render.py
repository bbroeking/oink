"""Render exported production overlay geometry without changing source artwork."""
import json
import math
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'docs/reviews/accessory-attachment-2026-10-14'
DATA = ROOT / 'artifacts/accessory-attachment-preview/audit-data'

def render(data, item, pig, animation, frame):
    layer = Image.new('RGBA', (500, 500), '#fffaf0')
    sprite = Image.open(ROOT / f"assets/images/sprites/{pig}/{data['animations'][animation]['frames'][frame]}.png").convert('RGBA')
    ratio = 300 / max(sprite.size)
    sprite = sprite.resize(tuple(round(v * ratio) for v in sprite.size), Image.Resampling.LANCZOS)
    placement = data.get('pigPlacements', {}).get(pig, data['placements'])[item][animation][frame]
    overlay = placement['overlay']
    art = Image.open(ROOT / placement['imageSrc']['path']).convert('RGBA')
    art = art.resize((max(1,round(overlay['width'])),max(1,round(overlay['height']))), Image.Resampling.LANCZOS)
    art = art.rotate(-(overlay.get('rotate') or 0), Image.Resampling.BICUBIC, expand=True)
    cx = 100 + overlay['left'] + overlay['width']/2
    cy = 140 + 300-overlay['bottom']-overlay['height']/2
    def wear(): layer.alpha_composite(art,(round(cx-art.width/2),round(cy-art.height/2)))
    if overlay.get('behind'): wear()
    layer.alpha_composite(sprite,(100+(300-sprite.width)//2,140+(300-sprite.height)//2))
    if not overlay.get('behind'): wear()
    return layer

def sheet(data, item, pig, name, destination=OUT):
    frames=[(a,f) for a in data['animations'] if a not in ('sit','bounce') for f in range(len(data['animations'][a]['frames']))]
    image=Image.new('RGB',(1500,math.ceil(len(frames)/6)*270),'#fffaf0')
    draw=ImageDraw.Draw(image)
    for i,(anim,frame) in enumerate(frames):
        cell=render(data,item,pig,anim,frame).resize((250,250),Image.Resampling.LANCZOS)
        x=i%6*250;y=i//6*270
        image.paste(cell,(x,y));draw.text((x+8,y+250),f'{pig} · {item} · {anim} {frame+1}',fill='#2a1f15')
    destination.mkdir(parents=True, exist_ok=True)
    image.save(destination/name, **({'quality': 88} if name.endswith('.jpg') else {}))

if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser(description='Render production accessory placement contact sheets.')
    parser.add_argument('--data', type=Path, default=DATA/'placements.json')
    parser.add_argument('--destination', type=Path, default=ROOT/'artifacts/accessory-attachment-preview/contact-sheets')
    parser.add_argument('--all-hats', action='store_true')
    parser.add_argument('--items', nargs='+')
    parser.add_argument('--pigs', nargs='+')
    parser.add_argument('--baseline', action='store_true', help='Use the preserved baseline export.')
    args = parser.parse_args()
    source = DATA/'baseline.json' if args.baseline else args.data
    data=json.loads(source.read_text())
    prefix='baseline' if args.baseline else 'corrected'
    if args.all_hats or args.items:
        from concurrent.futures import ThreadPoolExecutor
        hats=args.items or [item['id'] for item in data['items'] if item['category']=='hat' or item.get('spec',{}).get('anchor')=='head']
        pigs=args.pigs or list(data.get('pigPlacements',{'rosie':{}}))
        known_items={item['id'] for item in data['items']}
        unknown_items=sorted(set(hats)-known_items)
        unknown_pigs=sorted(set(pigs)-set(data.get('pigPlacements',{'rosie':{}})))
        if unknown_items: parser.error(f"unknown item(s): {', '.join(unknown_items)}")
        if unknown_pigs: parser.error(f"unknown pig(s): {', '.join(unknown_pigs)}")
        jobs=[(item,pig) for item in hats for pig in pigs]
        with ThreadPoolExecutor(max_workers=6) as pool:
            list(pool.map(lambda job: sheet(data,*job,f'{job[0]}-{job[1]}.jpg',args.destination),jobs))
        print(f'Rendered {len(jobs)} complete item/pig source-frame sheets to {args.destination}')
        raise SystemExit
    for item in ['cowboy','beanie','tophat','astronaut']:
        sheet(data,item,'rosie',f'{prefix}-{item}-rosie.png')
    refs=Image.new('RGB',(1500,550),'#fffaf0'); draw=ImageDraw.Draw(refs)
    for i,item in enumerate(['cowboy','beanie','tophat']):
        refs.paste(render(data,item,'rosie','idle',0),(i*500,0))
        draw.text((i*500+12,510),f'{item} · idle 1 · stage at 300px',fill='#2a1f15')
    refs.save(OUT/f'{prefix}-fit-reference.png')
