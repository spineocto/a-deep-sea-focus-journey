"""
Hand-drawn / gouache-and-ink storybook pass for Deep Sea Focus Journey.

Direction (see .kiro/steering/visual-style.md): beautiful but uncanny,
dark picture book. Muted earthy-ink palette (indigo, ink black, faded teal,
bone paper, ONE amber lamp).

Usage:  python3 art/render_ink.py

Reads the original sprites from art/base/ (copied once from art/out/, so
re-running never stacks the effect) and writes into art/out/:
  paper.webp          tileable paper grain (grey, used with a blend mode)
  wash.webp           gouache / watercolour wash with pooled tide edges
  ink-bleed.webp      black ink creeping in from the page edges (RGBA)
  bell-*.webp, creature-*.webp, eye.webp   wobbly-ink restyled sprites
  zone-1..5-*.webp    painterly layered illustrations
Fixed seeds: identical output on every run.
"""
import math
import random
import shutil
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "out"
BASE = ROOT / "base"

INK = (16, 14, 24)
BONE = (214, 204, 178)


# ---------------------------------------------------------------- noise ----
def fbm(h, w, seed, power=1.6, lo=0.0, anis=(1.0, 1.0)):
    """Periodic 1/f^power noise in 0..1 (FFT filtered white noise)."""
    rng = np.random.default_rng(seed)
    f = np.fft.fft2(rng.standard_normal((h, w)))
    fy = np.fft.fftfreq(h)[:, None] * anis[0]
    fx = np.fft.fftfreq(w)[None, :] * anis[1]
    r = np.sqrt(fx * fx + fy * fy)
    r[0, 0] = 1
    filt = 1.0 / np.power(r + 1e-4, power)
    filt[0, 0] = 0
    filt *= (r * max(h, w) > lo)
    n = np.real(np.fft.ifft2(f * filt))
    n -= n.min()
    return n / max(n.max(), 1e-9)


def remap(arr, dx, dy):
    """Bilinear sample arr (H,W[,C]) at (x+dx, y+dy)."""
    h, w = arr.shape[:2]
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    sx = np.clip(xx + dx, 0, w - 1.001)
    sy = np.clip(yy + dy, 0, h - 1.001)
    x0, y0 = sx.astype(int), sy.astype(int)
    fx, fy = sx - x0, sy - y0
    if arr.ndim == 3:
        fx, fy = fx[..., None], fy[..., None]
    a = arr[y0, x0] * (1 - fx) + arr[y0, x0 + 1] * fx
    b = arr[y0 + 1, x0] * (1 - fx) + arr[y0 + 1, x0 + 1] * fx
    return a * (1 - fy) + b * fy


def save_webp(img, name, q=80):
    path = OUT / name
    img.save(path, "WEBP", quality=q, method=6)
    print(f"{name:34s}{path.stat().st_size // 1024:5d} KB")


# ------------------------------------------------------------ textures ----
def paper_texture():
    n = 512
    g = fbm(n, n, 1, 0.8, lo=6)           # fine tooth
    m = fbm(n, n, 2, 1.7)                  # blotches
    f1 = fbm(n, n, 3, 1.1, anis=(1, 9))    # horizontal fibres
    f2 = fbm(n, n, 4, 1.1, anis=(9, 1))    # vertical fibres
    t = 0.45 * g + 0.25 * m + 0.15 * f1 + 0.15 * f2
    t = (t - t.mean()) / (t.std() + 1e-6)
    rng = np.random.default_rng(5)
    spots = (rng.random((n, n)) > 0.9985).astype(np.float32)
    spots = np.array(Image.fromarray((spots * 255).astype("uint8")).filter(ImageFilter.GaussianBlur(1.1))) / 255.0
    t = 128 + t * 26 - spots * 90
    save_webp(Image.fromarray(t.clip(0, 255).astype("uint8"), "L"), "paper.webp", 70)


def wash_texture():
    h, w = 576, 1024
    a = fbm(h, w, 11, 2.3)
    b = fbm(h, w, 12, 2.0)
    base = 0.6 * a + 0.4 * b
    # pooled tide edges: thin dark lines where the wash dries
    iso = np.abs(((base * 7) % 1.0) - 0.5)
    tide = np.clip(1 - iso * 14, 0, 1) * 0.35
    v = 150 + (base - 0.5) * 120 - tide * 70
    img = Image.fromarray(v.clip(0, 255).astype("uint8"), "L").filter(ImageFilter.GaussianBlur(0.8))
    save_webp(img, "wash.webp", 62)


def ink_bleed():
    w, h = 1440, 900
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    ex = np.minimum(xx, w - xx) / (w * 0.5)
    ey = np.minimum(yy, h - yy) / (h * 0.5)
    d = np.minimum(ex, ey * 1.0) * 0.6 + np.sqrt(ex * ey) * 0.4   # 0 at edge
    n = fbm(h, w, 21, 1.9)
    t = fbm(h, w, 22, 1.2, anis=(1, 1))
    field = d + (n - 0.5) * 0.55 + (t - 0.5) * 0.18
    # soft ink pool + sharp tendril threshold edge
    alpha = np.clip((0.30 - field) * 7.0, 0, 1)
    alpha = np.maximum(alpha, np.clip((0.12 - d) * 8, 0, 1))
    alpha *= 0.96
    rgba = np.zeros((h, w, 4), np.uint8)
    rgba[..., 0], rgba[..., 1], rgba[..., 2] = 8, 7, 14
    rgba[..., 3] = (alpha * 255).astype("uint8")
    save_webp(Image.fromarray(rgba, "RGBA"), "ink-bleed.webp", 70)


# --------------------------------------------------------------- sprites ----
def dilate(a, size):
    return np.array(Image.fromarray(a).filter(ImageFilter.MaxFilter(size)))


def inkify(name, wobble=2.5, line=3, bone_line=False, desat=0.22, seed=1, keep_warm=False):
    src = Image.open(BASE / name).convert("RGBA")
    arr = np.array(src).astype(np.float32)
    h, w = arr.shape[:2]
    k = max(h, w) / 512.0
    # 1. wobbly re-draw: low-frequency displacement of the whole drawing
    dx = (fbm(h, w, seed, 2.4) - 0.5) * 2 * wobble * k * 2
    dy = (fbm(h, w, seed + 50, 2.4) - 0.5) * 2 * wobble * k * 2
    arr = remap(arr, dx, dy)
    rgb, a = arr[..., :3], arr[..., 3]
    # 2. muted earthy grade: desaturate, pull shadows to indigo, lights to bone
    lum = rgb.mean(axis=2, keepdims=True)
    rgb = rgb * (1 - desat) + lum * desat
    tint = np.array([22, 26, 52], np.float32)
    shadow = np.clip(1 - lum / 140.0, 0, 1)
    rgb = rgb * (1 - 0.18 * shadow) + tint * 0.18 * shadow
    bone = np.array(BONE, np.float32)
    hi = np.clip((lum - 150) / 105.0, 0, 1)
    rgb = rgb * (1 - 0.22 * hi) + bone * 0.22 * hi
    # 3. gouache body: dry-brush mottling
    m = fbm(h, w, seed + 7, 1.2)
    rgb *= (0.90 + 0.2 * m)[..., None]
    # 4. ink outline with varying width (two dilations mixed by noise)
    al = np.clip(a, 0, 255).astype("uint8")
    sol = (al > 40).astype("uint8") * 255
    thin = dilate(sol, int(line * k) * 2 + 1).astype(np.float32) - sol
    thick = dilate(sol, int(line * k * 2.2) * 2 + 1).astype(np.float32) - sol
    wmix = fbm(h, w, seed + 9, 2.0)[..., None][..., 0]
    edge = np.clip(thin * (1 - wmix) + thick * wmix, 0, 255) / 255.0
    # broken line: dry gaps along the stroke
    gaps = fbm(h, w, seed + 11, 1.0)
    edge *= np.clip((gaps - 0.18) * 4, 0, 1)
    if bone_line:
        col = np.array(BONE, np.float32)
        edge *= 0.55
    else:
        col = np.array(INK, np.float32)
    out_rgb = rgb * (1 - edge[..., None]) + col * edge[..., None]
    out_a = np.maximum(a / 255.0, edge * 0.95)
    out = np.dstack([out_rgb.clip(0, 255), out_a * 255]).astype("uint8")
    save_webp(Image.fromarray(out, "RGBA"), name, 82)


def sprites():
    BASE.mkdir(exist_ok=True)
    for p in OUT.glob("*.webp"):
        if p.name.startswith(("bell-", "creature-", "eye")) and not (BASE / p.name).exists():
            shutil.copy(p, BASE / p.name)
    for i, m in enumerate(("normal", "alert", "sleeping")):
        inkify(f"bell-{m}.webp", wobble=1.6, line=2, bone_line=True, seed=10 + i, desat=0.15)
    # creature-*.webp are engravings from art/render_engravings.py: leave them as drawn.
    inkify("eye.webp", wobble=3.0, line=2, seed=70, desat=0.35)


# ----------------------------------------------------------------- zones ----
W, H = 1920, 1080

ZONES = [
    # top, bottom, shaft, ink silhouette tone
    dict(file="zone-1-sunlit.webp", top=(70, 120, 118), bot=(24, 58, 66), shaft=(205, 214, 186), ink=(14, 28, 34)),
    dict(file="zone-2-twilight.webp", top=(36, 54, 92), bot=(12, 18, 40), shaft=(130, 146, 176), ink=(8, 12, 26)),
    dict(file="zone-3-midnight.webp", top=(18, 28, 56), bot=(6, 8, 20), shaft=(70, 88, 128), ink=(4, 6, 14)),
    dict(file="zone-4-abyssal.webp", top=(14, 15, 32), bot=(4, 4, 11), shaft=(56, 60, 112), ink=(2, 3, 8)),
    dict(file="zone-5-hadal.webp", top=(11, 8, 14), bot=(3, 2, 6), shaft=(52, 30, 40), ink=(1, 1, 4)),
]


def wobble_poly(pts, amp, rng, sub=6):
    out = []
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        for s in range(sub):
            t = s / sub
            out.append((x0 + (x1 - x0) * t + rng.uniform(-amp, amp), y0 + (y1 - y0) * t + rng.uniform(-amp, amp)))
    out.append(pts[-1])
    return out


def kelp(d, x, base_y, height, width, sway, color, rng):
    """A curved blade of kelp: polygon with tapering width."""
    n = 18
    left, right = [], []
    for i in range(n + 1):
        t = i / n
        cx = x + math.sin(t * 3.0 + sway) * width * 5 * t + sway * 18 * t * t
        cy = base_y - height * t
        wd = width * (1 - t * 0.85) * (1 + 0.25 * math.sin(t * 9 + sway))
        left.append((cx - wd + rng.uniform(-1.5, 1.5), cy))
        right.append((cx + wd + rng.uniform(-1.5, 1.5), cy))
    d.polygon(left + right[::-1], fill=color)


def rock_mass(d, side, depth_idx, color, rng, scale=1.0):
    """Jagged silhouetted rock wall at the left/right edge."""
    pts = []
    x_edge = 0 if side == "l" else W
    sgn = 1 if side == "l" else -1
    y = H * 0.1
    pts.append((x_edge, 0))
    while y < H:
        reach = (120 + 260 * (math.sin(y / 170.0 + depth_idx) * 0.5 + 0.5) + rng.uniform(0, 90)) * scale
        pts.append((x_edge + sgn * reach, y))
        y += rng.uniform(50, 120)
    pts.append((x_edge, H))
    d.polygon(wobble_poly(pts, 4, rng, 3), fill=color)


def zone_image(i, z):
    rng = random.Random(100 + i)
    nrng = np.random.default_rng(200 + i)
    yy = np.linspace(0, 1, H, dtype=np.float32)[:, None, None]
    top = np.array(z["top"], np.float32)
    bot = np.array(z["bot"], np.float32)
    sea = top * (1 - yy) ** 1.2 + bot * (1 - (1 - yy) ** 1.2)
    sea = np.broadcast_to(sea, (H, W, 3)).copy()

    # gouache wash: broad pigment mottling + pooled tide edge lines
    n1 = fbm(H, W, 300 + i, 2.2)
    n2 = fbm(H, W, 310 + i, 1.5)
    amp = 22 - i * 3.2
    sea *= (1 + (n1 - 0.5) * amp / 60.0)[..., None]
    iso = np.abs(((n1 * 6) % 1) - 0.5)
    tide = np.clip(1 - iso * 18, 0, 1)
    sea *= (1 - tide * (0.10 - i * 0.012))[..., None]

    # light shafts: soft brush washes, streaked along the stroke direction
    shaft = np.array(z["shaft"], np.float32)
    count = (5, 4, 3, 2, 1)[i]
    strength = (0.30, 0.20, 0.12, 0.07, 0.035)[i]
    streak = fbm(H, W, 400 + i, 1.0, anis=(1.0, 14.0))
    yg, xg = np.mgrid[0:H, 0:W].astype(np.float32)
    light = np.zeros((H, W), np.float32)
    for k in range(count):
        x0 = rng.uniform(0.25, 0.85) * W
        ang = rng.uniform(0.18, 0.34)
        wdt = rng.uniform(70, 150)
        cx = x0 - yg * math.tan(ang)
        band = np.exp(-((xg - cx) / wdt) ** 2) * (1 - yg / H) ** 1.4
        light += band * (0.55 + 0.9 * streak)
    light = np.array(Image.fromarray((np.clip(light, 0, 1.5) / 1.5 * 255).astype("uint8")).filter(ImageFilter.GaussianBlur(6))) / 255.0 * 1.5
    # keep the bell's own area calmer
    sea += light[..., None] * shaft * strength

    img = Image.fromarray(sea.clip(0, 255).astype("uint8")).convert("RGBA")

    # silhouette layers, far (hazy, lighter) to near (ink black)
    ink = z["ink"]
    layers = 3 if i < 4 else 2
    for L in range(layers):
        lay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        d = ImageDraw.Draw(lay)
        far = L / max(layers - 1, 1)        # 0 far .. 1 near
        mix = 0.35 + 0.65 * far
        col = tuple(int(c * mix + t * (1 - mix)) for c, t in zip(ink, z["bot"])) + (255,)
        if i <= 1:
            rock_mass(d, "l", L, col, rng, 0.55 + 0.5 * far)
            rock_mass(d, "r", L + 3, col, rng, 0.45 + 0.4 * far)
            for _ in range(int(14 - i * 6)):
                side = rng.random()
                x = (rng.uniform(0.0, 0.28) if side < 0.5 else rng.uniform(0.74, 1.0)) * W
                kelp(d, x, H + 10, rng.uniform(260, 640) * (0.6 + far * 0.6), rng.uniform(6, 13) * (0.8 + far), rng.uniform(0, 6), col, rng)
        elif i == 2:
            rock_mass(d, "l", L, col, rng, 0.6 + 0.6 * far)
            rock_mass(d, "r", L + 2, col, rng, 0.5 + 0.5 * far)
            # huge shadow forms in the water
            if L == 0:
                for _ in range(3):
                    cx, cy = rng.uniform(0.15, 0.9) * W, rng.uniform(0.25, 0.7) * H
                    d.polygon(wobble_poly([(cx - 260, cy), (cx - 40, cy - 55), (cx + 330, cy + 10), (cx + 40, cy + 38), (cx - 260, cy)], 6, rng), fill=col[:3] + (150,))
        elif i == 3:
            rock_mass(d, "l", L, col, rng, 0.8 + 0.5 * far)
            rock_mass(d, "r", L + 2, col, rng, 0.7 + 0.5 * far)
            # hanging spires from above and a jagged floor
            for _ in range(9):
                x = rng.uniform(0, W)
                hh = rng.uniform(80, 300) * (0.6 + far)
                d.polygon(wobble_poly([(x - 28, 0), (x, hh), (x + 30, 0)], 4, rng, 4), fill=col)
            floor = [(0, H)]
            xx_ = 0
            while xx_ < W + 80:
                floor.append((xx_, H - rng.uniform(40, 150) * (0.7 + far)))
                xx_ += rng.uniform(40, 110)
            floor += [(W, H)]
            d.polygon(wobble_poly(floor, 3, rng, 2), fill=col)
        else:
            # hadal: barely-visible huge things. Ribs, a vast curved limb.
            tone = tuple(int(c) for c in (5 + 3 * L, 4 + 2 * L, 8 + 4 * L)) + (255,)
            if L == 0:
                for k in range(7):
                    cx = W * (0.62 + 0.05 * k)
                    d.arc((cx - 520, H * 0.1 - 80 * k * 0.2, cx + 520, H * 1.7), 200, 292, fill=tone, width=26 - k)
                d.polygon(wobble_poly([(W * 0.75, 0), (W * 0.9, H * 0.35), (W * 1.02, H * 0.9), (W * 0.96, H * 0.4), (W * 0.84, 0)], 8, rng, 6), fill=tone)
            else:
                rock_mass(d, "l", 5, (2, 2, 5, 255), rng, 0.9)
                floor = [(0, H)]
                xx_ = 0
                while xx_ < W + 80:
                    floor.append((xx_, H - rng.uniform(30, 110)))
                    xx_ += rng.uniform(60, 150)
                floor += [(W, H)]
                d.polygon(wobble_poly(floor, 3, rng, 2), fill=(1, 1, 3, 255))
        # soft painted edge: slight blur on far layers, ink rim on near
        if far < 1:
            lay = lay.filter(ImageFilter.GaussianBlur(5 - 4 * far))
        img = Image.alpha_composite(img, lay)

    # hadal: dull red eyes-of-nothing, barely there
    if i == 4:
        d = ImageDraw.Draw(img, "RGBA")
        for _ in range(6):
            x, y = rng.uniform(0.55, 0.95) * W, rng.uniform(0.1, 0.6) * H
            d.ellipse((x - 3, y - 2, x + 3, y + 2), fill=(90, 18, 24, 70))
    if i == 3:
        glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        d = ImageDraw.Draw(glow)
        for _ in range(26):
            x, y = rng.uniform(0, W), rng.uniform(0.3, 0.95) * H
            d.ellipse((x - 3, y - 3, x + 3, y + 3), fill=(90, 120, 200, 130))
        img = Image.alpha_composite(img, glow.filter(ImageFilter.GaussianBlur(3)))

    # ink-and-brush finish: displace the whole painting very slightly
    arr = np.array(img.convert("RGB")).astype(np.float32)
    dx = (fbm(H, W, 500 + i, 2.6) - 0.5) * 7
    dy = (fbm(H, W, 510 + i, 2.6) - 0.5) * 7
    arr = remap(arr, dx, dy)
    # vignette in ink, thickening with depth
    vx = (xg / W - 0.45) ** 2 * 1.2 + (yg / H - 0.52) ** 2 * 1.5
    arr *= np.clip(1.08 - vx * (0.9 + i * 0.25), 0.18, 1)[..., None]
    out = Image.fromarray(arr.clip(0, 255).astype("uint8"))
    save_webp(out, z["file"], 74)


def zones():
    for i, z in enumerate(ZONES):
        zone_image(i, z)


if __name__ == "__main__":
    OUT.mkdir(exist_ok=True)
    paper_texture()
    wash_texture()
    ink_bleed()
    sprites()
    zones()
