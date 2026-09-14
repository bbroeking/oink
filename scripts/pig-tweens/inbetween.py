import cv2, numpy as np, sys, os
from PIL import Image
SRC=sys.argv[1]; OUT=sys.argv[2]; N=int(sys.argv[3]); KEYS=[int(k) for k in sys.argv[4].split(",")] if len(sys.argv)>4 else [1,2,3,4]
PREFIX=sys.argv[5] if len(sys.argv)>5 else "idle"
SNAP=float(sys.argv[6]) if len(sys.argv)>6 else 40
os.makedirs(OUT,exist_ok=True)
def load(i):
    im=np.array(Image.open(f"{SRC}/{PREFIX}_{i}.png").convert("RGBA")).astype(np.float32); a=im[...,3:4]/255.0
    return np.concatenate([im[...,:3]*a, im[...,3:4]],axis=2)
keys=[load(i) for i in KEYS]
def gray(p):
    a=p[...,3:4]/255.0; rgb=p[...,:3]+128*(1-a); return cv2.cvtColor(rgb.astype(np.uint8),cv2.COLOR_RGB2GRAY)
def feat(p):
    g=gray(p); al=(p[...,3]>32).astype(np.uint8)
    dt=np.clip(cv2.distanceTransform(al,cv2.DIST_L2,5)*4,0,255).astype(np.uint8)
    return cv2.addWeighted(g,0.5,dt,0.5,0)   # gray + silhouette ramp: best warp error in the sweep
def flow(src,dst):  # field such that remap(src_img, x+field) ~= dst_img  == farneback(dst, src)
    return cv2.calcOpticalFlowFarneback(feat(dst),feat(src),None,0.5,6,41,8,7,1.5,0)
def warp(img,fl,t):
    h,w=img.shape[:2]; ys,xs=np.mgrid[0:h,0:w].astype(np.float32)
    return cv2.remap(img,xs+fl[...,0]*t,ys+fl[...,1]*t,cv2.INTER_LINEAR,borderMode=cv2.BORDER_CONSTANT,borderValue=(0,0,0,0))
def unpremult(p):
    a=p[...,3:4]; rgb=np.where(a>1,p[...,:3]/np.maximum(a,1)*255.0,0); return np.concatenate([rgb,a],axis=2)
frames=[]
for i in range(len(keys)):
    a,b=keys[i],keys[(i+1)%len(keys)]
    f_a2b=flow(a,b); f_b2a=flow(b,a)   # remap(a, x+f_a2b) ≈ b ; remap(b, x+f_b2a) ≈ a
    frames.append(a)
    for k in range(1,N+1):
        t=k/(N+1)
        wa=warp(a,f_a2b,t); wb=warp(b,f_b2a,1-t)
        blend=(1-t)*wa+t*wb
        # Where the two warped sources disagree on coverage, the flow lost a thin
        # part (ear tip, tail). Blending there paints a ghost; take the nearer key
        # outright instead so the part snaps rather than doubles.
        near=wa if t<=0.5 else wb
        # Coverage OR colour disagreement (a doubled outline is two dark lines
        # where one source has pink): thin parts snap, the body still morphs.
        cov=np.abs(wa[...,3:4]-wb[...,3:4])>96
        col=np.abs(wa[...,:3]-wb[...,:3]).mean(axis=2,keepdims=True)>SNAP
        mask=cov|col
        mask=cv2.GaussianBlur(mask.astype(np.float32),(0,0),1.5)[...,None]
        frames.append(mask*near+(1-mask)*blend)
outs=[np.clip(unpremult(f),0,255).astype(np.uint8) for f in frames]
for i,f in enumerate(outs,1): Image.fromarray(f,"RGBA").save(f"{OUT}/{PREFIX}_{i}.png")
fps=len(frames)/1.6; seq=[]
for f in outs:
    im=Image.fromarray(f,"RGBA"); bg=Image.new("RGBA",im.size,(252,246,238,255)); bg.alpha_composite(im); seq.append(bg.convert("P",palette=Image.ADAPTIVE))
seq[0].save(f"{OUT}/preview.gif",save_all=True,append_images=seq[1:],duration=int(1000/fps),loop=0)
w,h=seq[0].size; strip=Image.new("RGB",(w*len(outs),h),(252,246,238))
for i,s in enumerate(seq): strip.paste(s.convert("RGB"),(i*w,0))
strip.resize((strip.width//2,strip.height//2)).save(f"{OUT}/strip_small.png"); print(len(outs),"frames @",round(fps,2),"fps")
