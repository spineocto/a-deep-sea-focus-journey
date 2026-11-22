"""Antique naturalist-engraving versions of the six codex creatures.

Writes art/out/creature-*.webp (transparent, 512 px). Each animal is built
from parts. A part gets: a barely-there tint wash, directional hatching and
cross-hatching that gets denser on the shadow side, stippling, and a broken
ink contour. Detail lines (rays, tentacles, teeth) are drawn as strokes.
No flat fills. Fixed seeds: identical output on every run.

Run:  python3 art/render_engravings.py     (do NOT run render_ink.py's
creature pass over these; it skips creature-* files).
"""
import math
import random
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

S = 3
SIZE = 512
N = SIZE * S
OUT = Path(__file__).resolve().parent / "out"

SEPIA = (62, 42, 32)
INDIGO = (36, 42, 78)
BONE = (226, 216, 190)


def P(x, y):
    return (x * S, y * S)


def smooth_noise(seed, cells=48, power=1.0):
    rng = np.random.default_rng(seed)
    a = rng.random((cells, cells)).astype(np.float32)
    im = Image.fromarray((a * 255).astype("uint8")).resize((N, N), Image.BICUBIC)
    return np.asarray(im, np.float32) / 255.0


NOISE = [smooth_noise(s) for s in (1, 2, 3, 4)]


class Plate:
    def __init__(self, seed):
        self.img = Image.new("RGBA", (N, N), (0, 0, 0, 0))
        self.rnd = random.Random(seed)
        self.np = np.random.default_rng(seed)

    # ---- geometry -------------------------------------------------------
    def blob(self, cx, cy, rx, ry, rot=0.0, amp=1.6, n=96):
        pts = []
        for a in np.linspace(0, 2 * math.pi, n, endpoint=False):
            j = 1 + self.rnd.uniform(-amp, amp) / max(rx, 1)
            x, y = rx * j * math.cos(a), ry * j * math.sin(a)
            pts.append((cx + x * math.cos(rot) - y * math.sin(rot), cy + x * math.sin(rot) + y * math.cos(rot)))
        return pts

    def jitter(self, pts, amp=1.2):
        return [(x + self.rnd.uniform(-amp, amp), y + self.rnd.uniform(-amp, amp)) for x, y in pts]

    def mask(self, pts):
        m = Image.new("L", (N, N), 0)
        ImageDraw.Draw(m).polygon([P(*p) for p in pts], fill=255)
        return m

    def wavy(self, x0, y0, x1, y1, amp=6, waves=2.0, n=22):
        pts = []
        dx, dy = x1 - x0, y1 - y0
        L = math.hypot(dx, dy) or 1
        nx, ny = -dy / L, dx / L
        ph = self.rnd.uniform(0, 6.28)
        for i in range(n + 1):
            t = i / n
            off = math.sin(t * waves * 6.283 + ph) * amp * (0.35 + 0.65 * t)
            pts.append((x0 + dx * t + nx * off, y0 + dy * t + ny * off))
        return pts

    # ---- ink ------------------------------------------------------------
    def strokes(self, lines, w=1.1, alpha=200, color=SEPIA, wob=0.5, taper=True):
        """Polylines drawn as short tapered ink segments."""
        lay = Image.new("RGBA", (N, N), (0, 0, 0, 0))
        d = ImageDraw.Draw(lay)
        for pts in lines:
            pts = self.jitter(pts, wob)
            n = len(pts) - 1
            for i in range(n):
                t = i / max(n - 1, 1)
                ww = w * (1.0 - 0.55 * t) if taper else w
                ww = max(ww, 0.35)
                d.line([P(*pts[i]), P(*pts[i + 1])], fill=color + (alpha,), width=max(1, int(ww * S)))
        self.img = Image.alpha_composite(self.img, lay)

    def dots(self, pts, r=1.0, alpha=220, color=SEPIA):
        lay = Image.new("RGBA", (N, N), (0, 0, 0, 0))
        d = ImageDraw.Draw(lay)
        for x, y in pts:
            d.ellipse((x * S - r * S, y * S - r * S, x * S + r * S, y * S + r * S), fill=color + (alpha,))
        self.img = Image.alpha_composite(self.img, lay)

    def fill_ink(self, pts, alpha=235, color=SEPIA):
        lay = Image.new("RGBA", (N, N), (0, 0, 0, 0))
        ImageDraw.Draw(lay).polygon([P(*p) for p in pts], fill=color + (alpha,))
        self.img = Image.alpha_composite(self.img, lay)

    def part(self, pts, tint=(200, 190, 170), tint_a=45, hatch=1.0, light=(-1, -1),
             sp=7.0, ink=SEPIA, ink2=INDIGO, outline=True, occlude=True, stipple=1.0,
             line_w=0.75, out_a=235, base_dark=0.12, angle=None):
        m = self.mask(pts)
        mf = np.asarray(m, np.float32) / 255.0
        # occlusion: the animal's own parts hide what is behind them
        if occlude:
            a = np.asarray(self.img.getchannel("A"), np.float32) * (1 - mf * 0.96)
            self.img.putalpha(Image.fromarray(a.astype("uint8")))
        # tint wash (faint, paper shows through)
        wash = Image.new("RGBA", (N, N), tint + (0,))
        wash.putalpha(Image.fromarray((mf * tint_a * (0.75 + 0.25 * NOISE[0])).astype("uint8")))
        self.img = Image.alpha_composite(self.img, wash)
        # shadow side: material in the direction away from the light
        blur = m.filter(ImageFilter.GaussianBlur(14 * S))
        bf = np.asarray(blur, np.float32) / 255.0
        sx, sy = int(-light[0] * 9 * S), int(-light[1] * 9 * S)
        shifted = np.roll(np.roll(bf, -sy, axis=0), -sx, axis=1)
        dark = mf * np.clip((1 - shifted) * 1.15 + base_dark + (NOISE[1] - 0.5) * 0.25, 0, 1)
        dark *= hatch
        ys, xs = np.mgrid[0:N, 0:N].astype(np.float32)
        spx = sp * S * 0.55
        layer = np.zeros((N, N), np.float32)
        layer2 = np.zeros((N, N), np.float32)
        ang = math.radians(angle if angle is not None else 38 + self.rnd.uniform(-6, 6))
        for k, (a_, thr, store) in enumerate(((ang, 0.22, layer), (ang + math.radians(80), 0.5, layer2),
                                               (ang + math.radians(40), 0.74, layer2))):
            u = xs * math.cos(a_) + ys * math.sin(a_)
            v = -xs * math.sin(a_) + ys * math.cos(a_)
            wob = (NOISE[(k + 2) % 4] - 0.5) * 3.0 * S
            lid = np.floor((u + wob) / spx)
            rr = np.random.default_rng(100 + k).random(int(lid.max() - lid.min() + 3))
            lr = rr[(lid - lid.min()).astype(int)]
            t = np.mod(u + wob, spx)
            dist = np.abs(t - spx / 2)
            cov = np.clip(line_w * S / 2 - dist + 0.5, 0, 1)
            # lines start/stop at different depths of shadow, ends fray with v-noise
            gate = (dark + (lr - 0.5) * 0.22 + (np.sin(v / (9 * S)) * 0.04)) > thr
            store += cov * gate
        # stipple on the darkest areas
        rng = np.random.default_rng(self.rnd.randint(0, 1 << 30))
        pts_n = int(mf.sum() / (S * S) * 0.010 * stipple)
        sx_ = rng.integers(0, N, pts_n * 3)
        sy_ = rng.integers(0, N, pts_n * 3)
        keep = rng.random(pts_n * 3) < (dark[sy_, sx_] * 1.1 + 0.03) * (mf[sy_, sx_] > 0.5)
        sx_, sy_ = sx_[keep][:pts_n], sy_[keep][:pts_n]
        st = Image.new("L", (N, N), 0)
        sd = ImageDraw.Draw(st)
        for x, y in zip(sx_, sy_):
            sd.ellipse((x - 1.1, y - 1.1, x + 1.1, y + 1.1), fill=255)
        hat1 = Image.new("RGBA", (N, N), ink + (0,))
        hat1.putalpha(Image.fromarray((np.clip(layer, 0, 1) * 205).astype("uint8")))
        hat2 = Image.new("RGBA", (N, N), ink2 + (0,))
        hat2.putalpha(Image.fromarray((np.clip(layer2, 0, 1) * 190).astype("uint8")))
        sti = Image.new("RGBA", (N, N), ink + (0,))
        sti.putalpha(st.point(lambda v: int(v * 0.8)))
        for l in (hat1, hat2, sti):
            self.img = Image.alpha_composite(self.img, l)
        if outline:
            sz = 2 * max(1, round(S * 0.5)) + 1
            edge = np.asarray(m.filter(ImageFilter.MaxFilter(sz)), np.float32) / 255.0 - mf
            gaps = np.clip((NOISE[3] - 0.12) * 5, 0, 1)
            edge = np.clip(edge, 0, 1) * gaps
            # heavier on the shadow side
            heavy = 0.65 + 0.35 * np.clip(1 - shifted + 0.2, 0, 1)
            o = Image.new("RGBA", (N, N), ink + (0,))
            o.putalpha(Image.fromarray((edge * heavy * out_a).astype("uint8")))
            self.img = Image.alpha_composite(self.img, o)

    def save(self, name):
        img = self.img.resize((SIZE, SIZE), Image.LANCZOS)
        path = OUT / f"creature-{name}.webp"
        img.save(path, "WEBP", quality=90, method=6)
        print(path.name, path.stat().st_size // 1024, "KB")


# =========================================================================
def moon_jellyfish():
    p = Plate(11)
    # tentacles first (behind), fine hanging threads
    for i in range(46):
        x = 138 + i * 5.3 + p.rnd.uniform(-2, 2)
        p.strokes([p.wavy(x, 292, x + p.rnd.uniform(-12, 12), p.rnd.uniform(375, 462), amp=p.rnd.uniform(3, 8), waves=p.rnd.uniform(1.5, 3))],
                  w=0.7, alpha=140, taper=True)
    # four frilled oral arms
    for k, ox in enumerate((-46, -16, 16, 46)):
        top = (256 + ox * 0.6, 280)
        pts_l, pts_r = [], []
        for t in np.linspace(0, 1, 18):
            cx = top[0] + ox * 0.9 * t + math.sin(t * 9 + k) * 7
            y = 280 + t * (120 + 14 * (k % 2))
            wdt = 11 * (1 - t * 0.6) + math.sin(t * 22 + k) * 3
            pts_l.append((cx - wdt, y))
            pts_r.append((cx + wdt, y))
        p.part(pts_l + pts_r[::-1], tint=(210, 170, 170), tint_a=26, hatch=0.7, sp=5.5, light=(-1, -0.3))
    # bell: dome with a scalloped margin
    pts = []
    for a in np.linspace(math.pi, 2 * math.pi, 60):
        pts.append((256 + 136 * math.cos(a), 292 + 112 * math.sin(a)))
    for x in np.linspace(392, 120, 40):
        pts.append((x, 292 + 7 * abs(math.sin((x - 120) / 272 * 6.283 * 7)) + 4 * math.sin((x - 120) / 40)))
    p.part(pts, tint=(196, 206, 222), tint_a=36, hatch=0.85, sp=7.5, light=(-1, -1), line_w=0.7)
    # radial canals and rim
    cl = []
    for i in range(24):
        a = math.pi + (i + 0.5) / 24 * math.pi
        cl.append([(256 + 20 * math.cos(a), 276 + 14 * math.sin(a)),
                   (256 + 118 * math.cos(a), 284 + 94 * math.sin(a))])
    p.strokes(cl, w=0.55, alpha=105, wob=0.9, taper=False)
    # the four horseshoe gonads: inked rings with a breath of rose
    for k in range(4):
        a = k * math.pi / 2 + math.pi / 4
        cx, cy = 256 + 44 * math.cos(a), 238 + 30 * math.sin(a)
        p.part(p.blob(cx, cy, 24, 16, rot=a, amp=1.0, n=48), tint=(214, 160, 170), tint_a=40,
               hatch=1.1, sp=4.6, light=(-1, -1), occlude=False, line_w=0.6)
        p.strokes([[(cx + 11 * math.cos(t), cy + 7 * math.sin(t)) for t in np.linspace(0, 6.28, 20)]], w=0.6, alpha=170, taper=False)
    # specks along the margin
    p.dots([(130 + i * 7.6, 297 + p.rnd.uniform(0, 8)) for i in range(34)], r=0.8, alpha=150)
    return p


def barreleye():
    p = Plate(23)
    # tail and fins with rays
    tail = [(378, 300), (470, 252), (456, 306), (472, 362)]
    p.part(tail, tint=(150, 160, 170), tint_a=30, hatch=0.7, sp=6)
    rays = [[(380, 305), (468 - abs(i) * 1.5, 306 + i * 9)] for i in range(-5, 6)]
    p.strokes(rays, w=0.6, alpha=150, taper=True)
    p.part([(250, 248), (300, 204), (332, 258)], tint=(150, 160, 170), tint_a=30, hatch=0.8, sp=6)
    p.strokes([[(262 + i * 7, 246 - i * 2), (284 + i * 9, 218 + i * 4)] for i in range(5)], w=0.55, alpha=140)
    p.part(p.blob(285, 308, 142, 62, amp=1.6), tint=(150, 160, 172), tint_a=44, hatch=1.0, sp=7.5, light=(-1, -1))
    p.part([(206, 330), (246, 348), (262, 372), (228, 360)], tint=(150, 160, 170), tint_a=30, hatch=0.8, sp=5)  # pectoral fin
    # scale scallops and lateral line
    sc = []
    for r_, y in enumerate((292, 308, 324)):
        for i in range(11):
            x = 232 + i * 16 + (8 if r_ % 2 else 0)
            sc.append([(x, y - 5), (x + 5, y + 1), (x, y + 6)])
    p.strokes(sc, w=0.5, alpha=100, wob=0.3, taper=False)
    p.dots([(220 + i * 13, 300) for i in range(12)], r=0.7, alpha=150)
    # transparent dome head
    p.part(p.blob(190, 260, 80, 62, amp=1.4), tint=(190, 215, 220), tint_a=18, hatch=0.35, sp=9,
           light=(-1, -1), occlude=True, line_w=0.6, out_a=200)
    # tubular eyes (green only as a breath of tint), inked dark underneath
    for ex in (172, 210):
        p.part(p.blob(ex, 262, 14, 31, amp=0.8, n=56), tint=(150, 190, 150), tint_a=52, hatch=1.1, sp=4.2,
               light=(-1, 0.4), occlude=False, line_w=0.7, base_dark=0.3)
        p.strokes([[(ex - 12, 244), (ex - 8, 236), (ex, 233), (ex + 8, 236), (ex + 12, 244)]], w=0.8, alpha=200, taper=False)
        p.fill_ink([(ex - 3, 245), (ex + 3, 245), (ex + 3, 251), (ex - 3, 251)], alpha=200)
    # mouth, nostrils, gill arc
    p.strokes([[(110, 316), (124, 322), (138, 318)]], w=1.2, alpha=230)
    p.dots([(150, 292), (158, 290)], r=1.3, alpha=210)
    p.strokes([[(246, 280), (254, 312), (246, 342)], [(256, 280), (264, 312), (256, 342)]], w=0.7, alpha=150)
    return p


def anglerfish():
    p = Plate(37)
    tail = [(380, 300), (466, 250), (456, 306), (470, 362)]
    p.part(tail, tint=(90, 94, 110), tint_a=60, hatch=1.4, sp=5)
    p.strokes([[(382, 305), (462, 306 + i * 9)] for i in range(-5, 6)], w=0.6, alpha=150)
    p.part([(300, 205), (344, 190), (372, 262), (310, 262)], tint=(90, 94, 110), tint_a=55, hatch=1.3, sp=5)
    p.part(p.blob(255, 305, 136, 108, amp=2.0), tint=(84, 88, 106), tint_a=66, hatch=1.6, sp=5.2,
           light=(-1, -1), base_dark=0.3, stipple=2.2)
    # skin texture: short flick marks
    p.strokes([[(230 + i * 15, 230 + (i % 3) * 38), (236 + i * 15, 236 + (i % 3) * 38)] for i in range(9)], w=0.5, alpha=110, taper=False)
    # pectoral fin
    p.part([(290, 330), (350, 350), (338, 388), (278, 372)], tint=(110, 114, 126), tint_a=40, hatch=0.9, sp=5)
    p.strokes([[(292, 338 + i * 6), (344 - i * 2, 356 + i * 7)] for i in range(5)], w=0.5, alpha=140)
    # open jaws: ink-dark mouth, bone teeth
    mouth = [(128, 300), (186, 274), (250, 270), (302, 330), (214, 384), (142, 346)]
    p.fill_ink(mouth, alpha=240)
    for i in range(8):
        x = 142 + i * 15
        yt = 300 - i * 4 + (i % 2)
        tri = [(x, yt), (x + 6, yt + 26 + (i % 3) * 3), (x + 13, yt - 1)]
        p.part(tri, tint=BONE, tint_a=150, hatch=0.7, sp=3.2, occlude=False, out_a=240, line_w=0.5, ink=SEPIA)
        yb = 352 - i * 3
        tri2 = [(x + 4, yb), (x + 9, yb - 24 - (i % 2) * 4), (x + 17, yb - 2)]
        p.part(tri2, tint=BONE, tint_a=150, hatch=0.7, sp=3.2, occlude=False, out_a=240, line_w=0.5, ink=SEPIA)
    # eye
    p.part(p.blob(228, 254, 17, 17, amp=0.6, n=48), tint=BONE, tint_a=120, hatch=0.6, sp=3.5, occlude=True, out_a=240)
    p.fill_ink(p.blob(230, 256, 8, 8, amp=0.3, n=32), alpha=240)
    p.strokes([[(228 + 24 * math.cos(t), 254 + 24 * math.sin(t)) for t in np.linspace(0.2, 6.0, 26)]], w=0.6, alpha=140, taper=False)
    # the lure on its stalk: a small bulb drawn with radiating lines, a whisper of teal
    stalk = p.wavy(196, 218, 134, 120, amp=6, waves=0.8, n=16)
    p.strokes([stalk], w=1.5, alpha=230, taper=False)
    p.part(p.blob(128, 112, 14, 14, amp=0.5, n=40), tint=(160, 200, 190), tint_a=48, hatch=0.5, sp=3.4, occlude=False, out_a=240)
    rad = []
    for i in range(14):
        a = i / 14 * 6.283
        rad.append([(128 + 19 * math.cos(a), 112 + 19 * math.sin(a)), (128 + 29 * math.cos(a), 112 + 29 * math.sin(a))])
    p.strokes(rad, w=0.6, alpha=170, taper=False, wob=0.6)
    return p


def dumbo_octopus():
    p = Plate(51)
    coral = (206, 150, 134)
    # webbed arms: scalloped skirt with radial ribs
    sk = []
    for i, a in enumerate(np.linspace(0.04 * math.pi, 0.96 * math.pi, 17)):
        rad = 150 * (1.0 if i % 2 == 0 else 0.82)
        sk.append((256 + rad * 1.05 * math.cos(a), 300 + rad * 0.5 * math.sin(a)))
    p.part([(116, 292)] + sk[::-1] + [(396, 292)], tint=coral, tint_a=52, hatch=1.0, sp=5.5, light=(-1, -0.4))
    ribs = [[(256 + (40 + 10 * i) * 0.1 * math.cos(a), 300), (256 + 140 * 1.04 * math.cos(a), 300 + 140 * 0.49 * math.sin(a))]
            for i, a in enumerate(np.linspace(0.12 * math.pi, 0.88 * math.pi, 15))]
    p.strokes(ribs, w=0.55, alpha=130, taper=True)
    # ear-fins with ribs
    for sgn in (-1, 1):
        fin = p.blob(256 + sgn * 130, 206, 52, 30, rot=sgn * -0.5, amp=1.2, n=60)
        p.part(fin, tint=coral, tint_a=58, hatch=1.15, sp=5, light=(-sgn * 0.5, -1))
        p.strokes([[(256 + sgn * 100, 214), (256 + sgn * (140 + 14 * j), 180 + j * 14)] for j in range(-1, 4)], w=0.55, alpha=140)
    # mantle / head
    p.part(p.blob(256, 232, 112, 104, amp=2.0), tint=coral, tint_a=62, hatch=1.0, sp=5.6, light=(-1, -1), stipple=1.6)
    # eyes: ink dots with a bare paper highlight
    for sgn in (-1, 1):
        ex = 256 + sgn * 44
        p.fill_ink(p.blob(ex, 252, 14, 17, amp=0.4, n=40), alpha=240)
        p.dots([(ex - 4, 245)], r=3, alpha=0)
        p.strokes([[(ex - 20, 236), (ex - 10, 230), (ex + 4, 230)]], w=0.8, alpha=170)
    p.strokes([[(238, 288), (256, 294), (274, 288)]], w=0.9, alpha=200)
    return p


def snailfish():
    p = Plate(63)
    tone = (206, 196, 206)
    tail = [(250, 250), (472, 284), (250, 344)]
    p.part(tail, tint=tone, tint_a=38, hatch=0.8, sp=5.5, light=(-1, -1))
    # rippling fin rays along the upper and lower edge
    top, bot = [], []
    for i in range(30):
        t = i / 29
        x = 262 + t * 190
        yt = 254 + t * 28 + math.sin(t * 22) * 2.5
        yb = 342 - t * 52 - math.sin(t * 22) * 2.5
        top.append([(x, yt), (x - 2, yt + 18 * (1 - t) + 4)])
        bot.append([(x, yb), (x - 2, yb - 18 * (1 - t) - 4)])
    p.strokes(top + bot, w=0.5, alpha=130, taper=False)
    p.strokes([[(255, 298), (330, 296), (400, 292), (470, 286)]], w=0.6, alpha=110)
    p.part(p.blob(190, 298, 98, 72, amp=2.0), tint=tone, tint_a=48, hatch=1.0, sp=6, light=(-1, -1), stipple=1.4)
    # eye
    p.part(p.blob(142, 282, 13, 13, amp=0.4, n=40), tint=BONE, tint_a=60, hatch=0.5, sp=3.5, occlude=True)
    p.fill_ink(p.blob(144, 283, 6, 6, amp=0.2, n=24), alpha=240)
    # mouth, sucker disc, gill
    p.strokes([[(112, 316), (126, 324), (142, 318)]], w=1.2, alpha=220)
    p.part(p.blob(215, 352, 26, 9, amp=0.6, n=40), tint=tone, tint_a=40, hatch=0.7, sp=3.4, occlude=False)
    p.strokes([[(196, 276), (206, 300), (198, 326)], [(206, 274), (216, 300), (208, 328)]], w=0.6, alpha=130)
    p.dots([(130 + i * 6, 300 + (i % 2) * 3) for i in range(6)], r=0.6, alpha=130)
    return p


def amphipod():
    p = Plate(77)
    tone = (196, 148, 128)
    segs = 11
    pts = []
    for i in range(segs):
        t = i / (segs - 1)
        a = math.pi * (0.92 - 1.3 * t)
        r = 125
        cx, cy = 262 + r * math.cos(a), 250 - r * math.sin(a)
        pts.append((cx, cy, 40 - 8 * t, 36 - 16 * t, a))
    legs = []
    for (cx, cy, rx, ry, a) in pts:
        for k in (-1, 1):
            legs.append(p.wavy(cx + k * 9, cy + ry * 0.6, cx + k * 18, cy + ry + 28, amp=3, waves=1.2, n=7))
    p.strokes(legs, w=0.9, alpha=190)
    for (cx, cy, rx, ry, a) in pts[::-1]:
        p.part(p.blob(cx, cy, rx, ry, rot=a + math.pi / 2, amp=1.2, n=48), tint=tone, tint_a=44, hatch=1.1,
               sp=4.6, light=(-1, -1), angle=math.degrees(a) + 20, stipple=0.8)
    hx, hy = pts[0][0], pts[0][1]
    p.part(p.blob(hx - 8, hy - 6, 34, 28, amp=1.2), tint=tone, tint_a=50, hatch=1.0, sp=4.6, light=(-1, -1))
    p.fill_ink(p.blob(hx - 16, hy - 6, 8, 8, amp=0.3, n=24), alpha=235)
    for tgt in ((hx - 130, hy - 90), (hx - 140, hy - 40)):
        p.strokes([p.wavy(hx - 30, hy - 10, tgt[0], tgt[1], amp=7, waves=1.2, n=22)], w=1.1, alpha=200)
    return p


def main():
    OUT.mkdir(exist_ok=True)
    for name, fn in (("moon-jellyfish", moon_jellyfish), ("barreleye", barreleye),
                     ("humpback-anglerfish", anglerfish), ("dumbo-octopus", dumbo_octopus),
                     ("mariana-snailfish", snailfish), ("supergiant-amphipod", amphipod)):
        fn().save(name)


if __name__ == "__main__":
    main()
