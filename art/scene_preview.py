import numpy as np, math, random
from PIL import Image, ImageDraw, ImageFilter, ImageChops
random.seed(7); np.random.seed(7)
S=2; W,H=1600*S,900*S
yy,xx=np.mgrid[0:H,0:W].astype(np.float32)
# sea gradient
top=np.array([10,22,34]); bot=np.array([2,4,8])
t=(yy/H)[...,None]
sea=top*(1-t)+bot*t
# vignette
cx0,cy0=W*0.42,H*0.55
dist=np.sqrt(((xx-cx0)/W)**2+((yy-cy0)/H)**2)[...,None]
sea*=np.clip(1.15-dist*1.6,0.15,1)
sea+=np.random.normal(0,2.2,sea.shape)
img=Image.fromarray(sea.clip(0,255).astype('uint8'))

def layer(): return Image.new("RGBA",(W,H),(0,0,0,0))
def jit(cx,cy,rx,ry,n=160,amp=6,rot=0):
    pts=[]
    for k,a in enumerate(np.linspace(0,2*math.pi,n,endpoint=False)):
        r=1+random.uniform(-amp,amp)/max(rx,1)
        x=rx*r*math.cos(a); y=ry*r*math.sin(a)
        pts.append((cx+x*math.cos(rot)-y*math.sin(rot), cy+x*math.sin(rot)+y*math.cos(rot)))
    return pts
def comp(base,lay,blur=0):
    if blur: lay=lay.filter(ImageFilter.GaussianBlur(blur))
    return Image.alpha_composite(base.convert("RGBA"),lay)

# giant eye, far right, barely visible
L=layer(); d=ImageDraw.Draw(L)
ex,ey=W*0.80,H*0.36; ew,eh=W*0.26,H*0.12
eye=[(ex+ew*math.cos(a), ey+eh*math.sin(a)*(1 if math.sin(a)>0 else 1.15)*abs(math.sin(a))**0.6*(1 if True else 1)) for a in np.linspace(0,2*math.pi,200)]
d.polygon(eye,fill=(40,46,34,70))
d.ellipse((ex-H*0.085,ey-H*0.085,ex+H*0.085,ey+H*0.085),fill=(90,104,60,90))
d.ellipse((ex-H*0.018,ey-H*0.075,ex+H*0.018,ey+H*0.075),fill=(4,5,4,160))
img=comp(img,L,blur=18*S)

# searchlight cone downward-right from bell
bx,by=W*0.40,H*0.56; br=H*0.13
L=layer(); d=ImageDraw.Draw(L)
d.polygon([(bx+br*0.6,by+br*0.5),(W*0.72,H*1.05),(W*0.42,H*1.05)],fill=(150,170,160,22))
img=comp(img,L,blur=30*S)

# marine snow
L=layer(); d=ImageDraw.Draw(L)
for _ in range(900):
    x,y=random.uniform(0,W),random.uniform(0,H); r=random.uniform(0.6,2.2)*S
    d.ellipse((x-r,y-r,x+r,y+r),fill=(170,185,190,random.randint(20,90)))
img=comp(img,L,blur=1*S)

# bell body (bathysphere-style, rough)
L=layer(); d=ImageDraw.Draw(L)
# side searchlight housing (lower right)
lx,ly=bx+br*0.82,by+br*0.55
d.polygon(jit(lx,ly,br*0.22,br*0.15,n=60,amp=2.5*S,rot=0.7),fill=(34,38,42,255))
# side oxygen tank (left)
d.polygon(jit(bx-br*1.02,by+br*0.05,br*0.13,br*0.42,n=70,amp=2.5*S),fill=(40,45,48,255))
for t in (-0.25,0.15):
    d.line([(bx-br*1.15,by+br*t),(bx-br*0.88,by+br*t)],fill=(70,64,56,255),width=3*S)
# sphere
d.polygon(jit(bx,by,br,br,amp=7*S),fill=(30,35,40,255))
img=comp(img,L)
# shading: dark lower-right, lighter upper-left
L=layer(); d=ImageDraw.Draw(L)
d.polygon(jit(bx-br*0.28,by-br*0.32,br*0.55,br*0.42,amp=8*S),fill=(56,62,68,150))
img=comp(img,L,blur=14*S)
L=layer(); d=ImageDraw.Draw(L)
d.polygon(jit(bx+br*0.35,by+br*0.4,br*0.6,br*0.5,amp=8*S),fill=(8,10,12,150))
img=comp(img,L,blur=16*S)
# seams + rivets
L=layer(); d=ImageDraw.Draw(L)
def seam(yfrac):
    ry=br*0.18
    pts=[(bx+br*0.97*math.cos(t)+random.uniform(-1.5,1.5)*S, by+br*yfrac+ry*math.sin(t)*0.0+br*0.0+ (br*math.sqrt(max(0,1-yfrac**2))*0.18)*math.sin(t)) for t in np.linspace(0,math.pi,60)]
    return pts
for yf in (-0.45,0.45):
    w=br*math.sqrt(1-yf**2)
    pts=[(bx+w*math.cos(t)+random.uniform(-1.5,1.5)*S, by+br*yf+w*0.16*math.sin(t)+random.uniform(-1.5,1.5)*S) for t in np.linspace(0.05,math.pi-0.05,70)]
    d.line(pts,fill=(10,11,13,255),width=4*S)
    for t in np.linspace(0.15,math.pi-0.15,14):
        x=bx+w*math.cos(t); y=by+br*yf+w*0.16*math.sin(t)-5*S; r=3.2*S
        d.ellipse((x-r,y-r,x+r,y+r),fill=(78,82,84,230))
# vertical meridian seam
pts=[(bx+br*0.62+random.uniform(-1.5,1.5)*S+br*0.18*math.sin(t*1.0), by+br*0.92*math.sin(t-math.pi/2)*-1) for t in np.linspace(0.3,math.pi-0.3,60)]
d.line(pts,fill=(10,11,13,240),width=4*S)
# rust streaks under bolts
for k in range(11):
    x=bx+random.uniform(-0.75,0.75)*br; y0=by+random.uniform(-0.3,0.55)*br
    d.line([(x,y0),(x+random.uniform(-3,3)*S,y0+random.uniform(18,55)*S)],fill=(110,62,38,110),width=random.randint(2,4)*S)
# searchlight lens glow
d.polygon(jit(lx+br*0.12,ly+br*0.08,br*0.09,br*0.07,n=40,amp=1.5*S,rot=0.7),fill=(235,235,210,255))
img=comp(img,L)
L=layer(); d=ImageDraw.Draw(L)
d.ellipse((lx-br*0.15,ly-br*0.15,lx+br*0.4,ly+br*0.35),fill=(220,230,210,60))
img=comp(img,L,blur=18*S)
# rough outlines
L=layer(); d=ImageDraw.Draw(L)
# cable, slightly wavy
pts=[(bx+3*S*math.sin(k/7)+random.uniform(-1,1)*S, by-br*1.22-k*12*S) for k in range(80)]
d.line(pts,fill=(52,58,62,230),width=4*S)
# lifting lug + top hatch
d.polygon(jit(bx,by-br*1.18,br*0.10,br*0.10,n=40,amp=2*S),outline=(70,76,80,255),fill=(0,0,0,0))
d.line([(bx,by-br*1.08),(bx,by-br*0.98)],fill=(60,66,70,255),width=6*S)
d.polygon(jit(bx,by-br*0.98,br*0.30,br*0.10,n=70,amp=3*S),fill=(44,49,53,255),outline=(85,90,94,255))
for k in range(3):
    p=jit(bx,by,br*(1.0+0.02*k),br*(1.0+0.02*k),amp=5*S); d.line(p+[p[0]],fill=(80,88,92,110),width=2*S)
img=comp(img,L)

# porthole warm glow
pr=br*0.6
L=layer(); d=ImageDraw.Draw(L)
d.ellipse((bx-pr*1.6,by-pr*1.6,bx+pr*1.6,by+pr*1.6),fill=(240,170,120,40))
img=comp(img,L,blur=40*S)
L=layer(); d=ImageDraw.Draw(L)
d.polygon(jit(bx,by,pr,pr,amp=3*S),fill=(58,40,38,255))
img=comp(img,L)
# interior radial warm
ia=np.zeros((H,W,4),np.float32)
rr=np.sqrt((xx-bx)**2+(yy-by)**2)
m=(rr<pr*0.98)
glow=np.clip(1-rr/pr,0,1)
ia[...,0]=120+110*glow; ia[...,1]=70+70*glow; ia[...,2]=55+40*glow; ia[...,3]=m*255
img=Image.alpha_composite(img,Image.fromarray(ia.clip(0,255).astype('uint8')))

# octopus (smooth, supersampled)
ox,oy=bx,by+pr*0.08; u=pr/100
L=layer(); d=ImageDraw.Draw(L)
dark=(214,122,108,255); body=(246,170,148,255)
# web skirt
sk=[]
for i,a in enumerate(np.linspace(0.08*math.pi,0.92*math.pi,13)):
    rad=58*u*(1.0 if i%2==0 else 0.86)
    sk.append((ox+rad*1.15*math.cos(a)+random.uniform(-3,3)*u, oy+14*u+rad*0.48*math.sin(a)+random.uniform(-3,3)*u))
d.polygon([(ox-52*u,oy+5*u)]+sk[::-1]+[(ox+52*u,oy+5*u)],fill=dark)
# ear fins
for sgn in (-1,1):
    d.polygon(jit(ox+sgn*58*u,oy-34*u,21*u,12*u,n=60,amp=2.5*u,rot=sgn*-0.35),fill=dark)
# mantle
d.polygon(jit(ox,oy-25*u,50*u,47*u,n=140,amp=4*u),fill=body)
img=comp(img,L)
# shading highlight
L=layer(); d=ImageDraw.Draw(L)
d.ellipse((ox-30*u,oy-64*u,ox+10*u,oy-34*u),fill=(255,220,200,90))
img=comp(img,L,blur=6*S)
L=layer(); d=ImageDraw.Draw(L)
for sgn in (-1,1):
    exx=ox+sgn*19*u; eyy=oy-14*u
    d.ellipse((exx-8*u,eyy-9*u,exx+8*u,eyy+9*u),fill=(36,22,24,255))
    d.ellipse((exx-4.5*u,eyy-6*u,exx-0.5*u,eyy-2*u),fill=(255,250,245,255))
    d.ellipse((exx+sgn*9*u-7*u,eyy+11*u,exx+sgn*9*u+7*u,eyy+16*u),fill=(255,130,130,120))
img=comp(img,L)
# porthole rim (rough brass-dark)
L=layer(); d=ImageDraw.Draw(L)
for k in range(4):
    p=jit(bx,by,pr*(1.02+0.03*k),pr*(1.02+0.03*k),amp=2.5*S); d.line(p+[p[0]],fill=(70,62,52,200),width=3*S)
for t in np.linspace(0,2*math.pi,16,endpoint=False):
    x=bx+pr*1.16*math.cos(t); y=by+pr*1.16*math.sin(t); r=4.5*S
    d.ellipse((x-r,y-r,x+r,y+r),fill=(96,88,74,255)); d.ellipse((x-r*0.4,y-r*0.6,x,y-r*0.2),fill=(150,140,120,255))
# glass reflection
d.arc((bx-pr*0.85,by-pr*0.85,bx+pr*0.85,by+pr*0.85),200,250,fill=(255,240,230,70),width=4*S)
img=comp(img,L)

# bubbles
L=layer(); d=ImageDraw.Draw(L)
for k in range(9):
    x=bx+br*0.45+random.uniform(-15,15)*S+k*3*S; y=by-br*0.7-k*38*S-random.uniform(0,20)*S; r=random.uniform(3,8)*S
    d.ellipse((x-r,y-r,x+r,y+r),outline=(170,200,215,150),width=S)
img=comp(img,L)

# film grain + slight blur jitter
a=np.array(img.convert("RGB")).astype(np.float32)
a+=np.random.normal(0,2,a.shape)
img=Image.fromarray(a.clip(0,255).astype('uint8'))
d=ImageDraw.Draw(img)
d.text((80,1700),"DEPTH  1,842 m",fill=(150,160,165))
img.save("mochi_v6.png")
