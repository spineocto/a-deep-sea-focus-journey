"""Render the transparent sprites used by the main screen.

Outputs (art/out/):
  bell-normal.webp, bell-alert.webp, bell-sleeping.webp  - bell + Dumbo octopus
  eye.webp                                                - the resident giant eye

The bell shapes and palette are taken from scene_preview.py (approved
reference). All tunable values are constants at the top.
Run:  python3 art/render_bell.py
"""
import math
import random
import os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

# ---- tunables -------------------------------------------------------------
S = 2                      # supersampling; final image is downscaled by S
CW, CH = 900, 880          # final canvas size (px)
BR = 300                   # bell radius (px, final size)
BX, BY = 450, 520          # bell centre (px, final size)
SEED = 7
EYE_W, EYE_H = 1400, 640   # eye canvas (px)
EYE_BLUR = 3               # px, keeps the eye soft but readable
OUT = os.path.join(os.path.dirname(__file__), "out")
# ---------------------------------------------------------------------------

W, H = CW * S, CH * S
bx, by, br = BX * S, BY * S, BR * S
yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)


def layer():
    return Image.new("RGBA", (W, H), (0, 0, 0, 0))


def jit(cx, cy, rx, ry, n=160, amp=6, rot=0):
    pts = []
    for a in np.linspace(0, 2 * math.pi, n, endpoint=False):
        r = 1 + random.uniform(-amp, amp) / max(rx, 1)
        x = rx * r * math.cos(a)
        y = ry * r * math.sin(a)
        pts.append((cx + x * math.cos(rot) - y * math.sin(rot),
                    cy + x * math.sin(rot) + y * math.cos(rot)))
    return pts


def comp(base, lay, blur=0):
    if blur:
        lay = lay.filter(ImageFilter.GaussianBlur(blur))
    return Image.alpha_composite(base, lay)


def draw_bell():
    random.seed(SEED)
    img = layer()
    L = layer(); d = ImageDraw.Draw(L)
    lx, ly = bx + br * 0.82, by + br * 0.55
    d.polygon(jit(lx, ly, br * 0.22, br * 0.15, n=60, amp=2.5 * S, rot=0.7), fill=(34, 38, 42, 255))
    d.polygon(jit(bx - br * 1.02, by + br * 0.05, br * 0.13, br * 0.42, n=70, amp=2.5 * S), fill=(40, 45, 48, 255))
    for t in (-0.25, 0.15):
        d.line([(bx - br * 1.15, by + br * t), (bx - br * 0.88, by + br * t)], fill=(70, 64, 56, 255), width=3 * S)
    d.polygon(jit(bx, by, br, br, amp=7 * S), fill=(30, 35, 40, 255))
    img = comp(img, L)
    # shading, clipped to the sphere so it never spills outside
    sphere = Image.new("L", (W, H), 0)
    ImageDraw.Draw(sphere).ellipse((bx - br, by - br, bx + br, by + br), fill=255)
    for (cx, cy, rx, ry, col) in (
        (bx - br * 0.28, by - br * 0.32, br * 0.55, br * 0.42, (56, 62, 68, 150)),
        (bx + br * 0.35, by + br * 0.4, br * 0.6, br * 0.5, (8, 10, 12, 150)),
    ):
        L = layer(); d = ImageDraw.Draw(L)
        d.polygon(jit(cx, cy, rx, ry, amp=8 * S), fill=col)
        L = L.filter(ImageFilter.GaussianBlur(15 * S))
        a = L.getchannel("A")
        L.putalpha(Image.fromarray(np.minimum(np.array(a), np.array(sphere)).astype("uint8")))
        img = Image.alpha_composite(img, L)
    # seams, rivets, rust
    L = layer(); d = ImageDraw.Draw(L)
    for yf in (-0.45, 0.45):
        w = br * math.sqrt(1 - yf ** 2)
        pts = [(bx + w * math.cos(t) + random.uniform(-1.5, 1.5) * S,
                by + br * yf + w * 0.16 * math.sin(t) + random.uniform(-1.5, 1.5) * S)
               for t in np.linspace(0.05, math.pi - 0.05, 70)]
        d.line(pts, fill=(10, 11, 13, 255), width=4 * S)
        for t in np.linspace(0.15, math.pi - 0.15, 14):
            x = bx + w * math.cos(t); y = by + br * yf + w * 0.16 * math.sin(t) - 5 * S; r = 3.2 * S
            d.ellipse((x - r, y - r, x + r, y + r), fill=(78, 82, 84, 230))
    pts = [(bx + br * 0.62 + random.uniform(-1.5, 1.5) * S + br * 0.18 * math.sin(t),
            by + br * 0.92 * math.sin(t - math.pi / 2) * -1) for t in np.linspace(0.3, math.pi - 0.3, 60)]
    d.line(pts, fill=(10, 11, 13, 240), width=4 * S)
    for _ in range(11):
        x = bx + random.uniform(-0.75, 0.75) * br; y0 = by + random.uniform(-0.3, 0.55) * br
        d.line([(x, y0), (x + random.uniform(-3, 3) * S, y0 + random.uniform(18, 55) * S)],
               fill=(110, 62, 38, 110), width=random.randint(2, 4) * S)
    d.polygon(jit(lx + br * 0.12, ly + br * 0.08, br * 0.09, br * 0.07, n=40, amp=1.5 * S, rot=0.7), fill=(235, 235, 210, 255))
    img = comp(img, L)
    L = layer(); d = ImageDraw.Draw(L)
    d.ellipse((lx - br * 0.15, ly - br * 0.15, lx + br * 0.4, ly + br * 0.35), fill=(220, 230, 210, 60))
    img = comp(img, L, blur=18 * S)
    # lug + hatch + rim lines
    L = layer(); d = ImageDraw.Draw(L)
    d.polygon(jit(bx, by - br * 1.18, br * 0.10, br * 0.10, n=40, amp=2 * S), outline=(70, 76, 80, 255), fill=(0, 0, 0, 0))
    d.line([(bx, by - br * 1.08), (bx, by - br * 0.98)], fill=(60, 66, 70, 255), width=6 * S)
    d.polygon(jit(bx, by - br * 0.98, br * 0.30, br * 0.10, n=70, amp=3 * S), fill=(44, 49, 53, 255), outline=(85, 90, 94, 255))
    for k in range(3):
        p = jit(bx, by, br * (1.0 + 0.02 * k), br * (1.0 + 0.02 * k), amp=5 * S)
        d.line(p + [p[0]], fill=(80, 88, 92, 110), width=2 * S)
    img = comp(img, L)
    # porthole
    pr = br * 0.6
    L = layer(); d = ImageDraw.Draw(L)
    d.polygon(jit(bx, by, pr, pr, amp=3 * S), fill=(58, 40, 38, 255))
    img = comp(img, L)
    ia = np.zeros((H, W, 4), np.float32)
    rr = np.sqrt((xx - bx) ** 2 + (yy - by) ** 2)
    glow = np.clip(1 - rr / pr, 0, 1)
    ia[..., 0] = 120 + 110 * glow; ia[..., 1] = 70 + 70 * glow; ia[..., 2] = 55 + 40 * glow
    ia[..., 3] = (rr < pr * 0.98) * 255
    img = Image.alpha_composite(img, Image.fromarray(ia.clip(0, 255).astype("uint8")))
    return img, pr


def draw_octopus(img, pr, mood):
    random.seed(SEED + 1)
    ox, oy = bx, by + pr * 0.08
    u = pr / 100
    fin_rot = {"normal": 0.35, "alert": 0.75, "sleeping": -0.15}[mood]
    dy = {"normal": 0, "alert": -3, "sleeping": 6}[mood] * u
    oy += dy
    L = layer(); d = ImageDraw.Draw(L)
    dark = (214, 122, 108, 255); body = (246, 170, 148, 255)
    sk = []
    for i, a in enumerate(np.linspace(0.08 * math.pi, 0.92 * math.pi, 13)):
        rad = 58 * u * (1.0 if i % 2 == 0 else 0.86)
        sk.append((ox + rad * 1.15 * math.cos(a) + random.uniform(-3, 3) * u,
                   oy + 14 * u + rad * 0.48 * math.sin(a) + random.uniform(-3, 3) * u))
    d.polygon([(ox - 52 * u, oy + 5 * u)] + sk[::-1] + [(ox + 52 * u, oy + 5 * u)], fill=dark)
    for sgn in (-1, 1):
        d.polygon(jit(ox + sgn * 58 * u, oy - 34 * u, 21 * u, 12 * u, n=60, amp=2.5 * u, rot=sgn * -fin_rot), fill=dark)
    d.polygon(jit(ox, oy - 25 * u, 50 * u, 47 * u, n=140, amp=4 * u), fill=body)
    img = comp(img, L)
    L = layer(); d = ImageDraw.Draw(L)
    d.ellipse((ox - 30 * u, oy - 64 * u, ox + 10 * u, oy - 34 * u), fill=(255, 220, 200, 90))
    img = comp(img, L, blur=6 * S)
    L = layer(); d = ImageDraw.Draw(L)
    for sgn in (-1, 1):
        ex = ox + sgn * 19 * u; ey = oy - 14 * u
        if mood == "sleeping":
            d.arc((ex - 8 * u, ey - 7 * u, ex + 8 * u, ey + 5 * u), 15, 165, fill=(36, 22, 24, 255), width=max(2, int(2.5 * u)))
        elif mood == "alert":
            d.ellipse((ex - 9.5 * u, ey - 11 * u, ex + 9.5 * u, ey + 11 * u), fill=(36, 22, 24, 255))
            d.ellipse((ex - 5 * u, ey - 7 * u, ex - 0.5 * u, ey - 2.5 * u), fill=(255, 250, 245, 255))
        else:
            d.ellipse((ex - 8 * u, ey - 9 * u, ex + 8 * u, ey + 9 * u), fill=(36, 22, 24, 255))
            d.ellipse((ex - 4.5 * u, ey - 6 * u, ex - 0.5 * u, ey - 2 * u), fill=(255, 250, 245, 255))
        d.ellipse((ex + sgn * 9 * u - 7 * u, ey + 11 * u, ex + sgn * 9 * u + 7 * u, ey + 16 * u), fill=(255, 130, 130, 120))
    img = comp(img, L)
    # rim + glass reflection
    L = layer(); d = ImageDraw.Draw(L)
    for k in range(4):
        p = jit(bx, by, pr * (1.02 + 0.03 * k), pr * (1.02 + 0.03 * k), amp=2.5 * S)
        d.line(p + [p[0]], fill=(70, 62, 52, 200), width=3 * S)
    for t in np.linspace(0, 2 * math.pi, 16, endpoint=False):
        x = bx + pr * 1.16 * math.cos(t); y = by + pr * 1.16 * math.sin(t); r = 4.5 * S
        d.ellipse((x - r, y - r, x + r, y + r), fill=(96, 88, 74, 255))
        d.ellipse((x - r * 0.4, y - r * 0.6, x, y - r * 0.2), fill=(150, 140, 120, 255))
    d.arc((bx - pr * 0.85, by - pr * 0.85, bx + pr * 0.85, by + pr * 0.85), 200, 250, fill=(255, 240, 230, 70), width=4 * S)
    return comp(img, L)


def save(img, name):
    final = img.resize((CW, CH), Image.LANCZOS)
    path = os.path.join(OUT, name)
    final.save(path, "WEBP", quality=88, method=6)
    print(name, os.path.getsize(path) // 1024, "KB")


def render_eye():
    random.seed(SEED + 2)
    w, h = EYE_W * 2, EYE_H * 2
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    cx, cy = w / 2, h / 2
    ew, eh = w * 0.46, h * 0.36
    xs = np.linspace(-1, 1, 160)
    top = [(cx + ew * x, cy - eh * (1 - x * x) ** 0.85) for x in xs]
    bot = [(cx + ew * x, cy + eh * 0.85 * (1 - x * x) ** 0.85) for x in xs[::-1]]
    d.polygon(top + bot, fill=(52, 58, 42, 150))
    r = h * 0.22
    d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=(112, 128, 70, 190))
    d.ellipse((cx - r * 0.72, cy - r * 0.72, cx + r * 0.72, cy + r * 0.72), outline=(150, 160, 90, 120), width=6)
    d.ellipse((cx - r * 0.2, cy - r * 0.95, cx + r * 0.2, cy + r * 0.95), fill=(4, 5, 4, 235))
    img = img.filter(ImageFilter.GaussianBlur(EYE_BLUR * 2))
    img = img.resize((EYE_W, EYE_H), Image.LANCZOS)
    path = os.path.join(OUT, "eye.webp")
    img.save(path, "WEBP", quality=85, method=6)
    print("eye.webp", os.path.getsize(path) // 1024, "KB")


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    base, pr_ = draw_bell()
    for mood in ("normal", "alert", "sleeping"):
        save(draw_octopus(base.copy(), pr_, mood), f"bell-{mood}.webp")
    render_eye()
