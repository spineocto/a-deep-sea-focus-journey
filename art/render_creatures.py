"""Render the six codex creatures as transparent sprites (art/out/creature-*.webp).

Same hand-made method as scene_preview.py: jittered, rough-edged shapes
drawn at 2x and downscaled. Colours are muted. The web page makes the
"locked" silhouette from the same image with a CSS filter, so there is
only one drawing per species.
Run:  python3 art/render_creatures.py
"""
import math
import os
import random
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

# ---- tunables -------------------------------------------------------------
S = 2
SIZE = 512                 # final px (square)
JITTER = 3.0               # edge roughness in final px
SEED = 11
OUT = os.path.join(os.path.dirname(__file__), "out")
# ---------------------------------------------------------------------------

N = SIZE * S


def canvas():
    return Image.new("RGBA", (N, N), (0, 0, 0, 0))


def P(x, y):
    """Final-pixel coordinates -> supersampled coordinates."""
    return (x * S, y * S)


def blob(cx, cy, rx, ry, n=90, amp=JITTER, rot=0.0):
    pts = []
    for a in np.linspace(0, 2 * math.pi, n, endpoint=False):
        r = 1 + random.uniform(-amp, amp) / max(rx, 1)
        x = rx * r * math.cos(a)
        y = ry * r * math.sin(a)
        pts.append(P(cx + x * math.cos(rot) - y * math.sin(rot),
                     cy + x * math.sin(rot) + y * math.cos(rot)))
    return pts


def wavy(x0, y0, x1, y1, amp=8, waves=2.0, n=24, jitter=1.2):
    pts = []
    dx, dy = x1 - x0, y1 - y0
    length = math.hypot(dx, dy) or 1
    nx, ny = -dy / length, dx / length
    for i in range(n + 1):
        t = i / n
        off = math.sin(t * waves * math.pi * 2) * amp * (0.4 + 0.6 * t)
        pts.append(P(x0 + dx * t + nx * off + random.uniform(-jitter, jitter),
                     y0 + dy * t + ny * off + random.uniform(-jitter, jitter)))
    return pts


def add(base, lay, blur=0):
    if blur:
        lay = lay.filter(ImageFilter.GaussianBlur(blur * S))
    return Image.alpha_composite(base, lay)


def finish(img, name):
    img = img.resize((SIZE, SIZE), Image.LANCZOS)
    path = os.path.join(OUT, name)
    img.save(path, "WEBP", quality=88, method=6)
    print(name, os.path.getsize(path) // 1024, "KB")


def moon_jellyfish():
    img = canvas()
    d = ImageDraw.Draw(img)
    for i in range(14):  # frilly oral arms + tentacles
        x = 150 + i * 16 + random.uniform(-4, 4)
        d.line(wavy(x, 285, x + random.uniform(-14, 14), random.uniform(400, 470), amp=9, waves=2.3),
               fill=(205, 215, 235, 150), width=3 * S)
    d.polygon(blob(256, 250, 130, 100, amp=4), fill=(200, 214, 236, 170))
    d.polygon(blob(256, 292, 128, 22, amp=3), fill=(190, 206, 232, 190))
    for k in range(4):  # the four horseshoe gonads
        a = k * math.pi / 2 + math.pi / 4
        d.polygon(blob(256 + 42 * math.cos(a), 236 + 32 * math.sin(a), 22, 14, n=40, amp=2, rot=a),
                  fill=(232, 190, 214, 230))
    hl = canvas()
    ImageDraw.Draw(hl).polygon(blob(222, 200, 52, 26, amp=3), fill=(255, 255, 255, 80))
    return add(img, hl, blur=6)


def barreleye():
    img = canvas()
    d = ImageDraw.Draw(img)
    d.polygon([P(380, 300), P(470, 255), P(455, 310), P(470, 365)], fill=(92, 104, 112, 255))  # tail
    d.polygon(blob(285, 305, 140, 62, amp=3), fill=(104, 118, 126, 255))
    d.polygon([P(250, 245), P(300, 205), P(330, 255)], fill=(88, 100, 108, 255))  # dorsal
    # transparent dome head
    d.polygon(blob(190, 262, 78, 60, amp=3), fill=(190, 215, 220, 90), outline=(210, 230, 235, 170))
    for sgn in (0, 1):  # two green tubular eyes looking up
        ex = 172 + sgn * 36
        d.polygon(blob(ex, 262, 14, 30, n=40, amp=1.5), fill=(110, 200, 130, 255))
        d.ellipse((ex * S - 8 * S, 238 * S, ex * S + 8 * S, 254 * S), fill=(200, 255, 205, 255))
    d.ellipse(P(112, 316) + P(124, 326), fill=(40, 48, 52, 255))  # mouth dot
    return img


def anglerfish():
    img = canvas()
    d = ImageDraw.Draw(img)
    d.polygon([P(380, 300), P(465, 250), P(455, 305), P(468, 360)], fill=(50, 52, 58, 255))
    d.polygon(blob(255, 305, 135, 108, amp=4), fill=(58, 60, 68, 255))
    # lure on a long stalk
    d.line(wavy(190, 215, 130, 120, amp=7, waves=0.8, n=14), fill=(80, 82, 90, 255), width=4 * S)
    glow = canvas()
    ImageDraw.Draw(glow).ellipse(P(100, 88) + P(160, 148), fill=(150, 230, 210, 140))
    img = add(img, glow, blur=10)
    d = ImageDraw.Draw(img)
    d.ellipse(P(122, 108) + P(140, 126), fill=(220, 250, 235, 255))
    # huge mouth + teeth
    d.polygon([P(128, 300), P(250, 270), P(300, 330), P(210, 380), P(140, 345)], fill=(14, 14, 18, 255))
    for i in range(7):
        x = 140 + i * 17
        d.polygon([P(x, 303 - i * 4), P(x + 7, 303 - i * 4 + 28), P(x + 14, 300 - i * 4)], fill=(224, 226, 214, 255))
        d.polygon([P(x + 6, 352 - i * 3), P(x + 11, 326 - i * 3), P(x + 18, 350 - i * 3)], fill=(224, 226, 214, 255))
    d.ellipse(P(212, 240) + P(240, 268), fill=(224, 226, 214, 255))
    d.ellipse(P(222, 248) + P(234, 262), fill=(10, 10, 12, 255))
    return img


def dumbo_octopus():
    img = canvas()
    d = ImageDraw.Draw(img)
    dark = (196, 132, 168, 255)
    body = (222, 164, 196, 255)
    sk = []
    for i, a in enumerate(np.linspace(0.06 * math.pi, 0.94 * math.pi, 15)):
        rad = 150 * (1.0 if i % 2 == 0 else 0.84)
        sk.append(P(256 + rad * 1.05 * math.cos(a) + random.uniform(-3, 3),
                    300 + rad * 0.5 * math.sin(a) + random.uniform(-3, 3)))
    d.polygon([P(120, 292)] + sk[::-1] + [P(392, 292)], fill=dark)
    for sgn in (-1, 1):
        d.polygon(blob(256 + sgn * 128, 205, 50, 28, amp=3, rot=sgn * -0.5), fill=dark)
    d.polygon(blob(256, 232, 112, 104, amp=4), fill=body)
    hl = canvas()
    ImageDraw.Draw(hl).ellipse(P(190, 150) + P(280, 208), fill=(255, 235, 245, 90))
    img = add(img, hl, blur=8)
    d = ImageDraw.Draw(img)
    for sgn in (-1, 1):
        ex = 256 + sgn * 44
        d.ellipse(P(ex - 15, 232) + P(ex + 15, 270), fill=(40, 26, 36, 255))
        d.ellipse(P(ex - 9, 238) + P(ex - 1, 246), fill=(255, 250, 250, 255))
    return img


def snailfish():
    img = canvas()
    d = ImageDraw.Draw(img)
    col = (214, 200, 206, 255)
    # long tapering tail + rippling fin
    d.polygon([P(250, 255), P(470, 285), P(250, 340)], fill=(200, 186, 194, 255))
    d.line(wavy(250, 250, 470, 284, amp=6, waves=4, n=40), fill=(170, 154, 164, 255), width=3 * S)
    d.line(wavy(250, 342, 470, 288, amp=6, waves=4, n=40), fill=(170, 154, 164, 255), width=3 * S)
    d.polygon(blob(190, 298, 98, 70, amp=3), fill=col)  # big soft head
    d.ellipse(P(130, 270) + P(154, 294), fill=(30, 28, 34, 255))
    d.ellipse(P(138, 276) + P(146, 284), fill=(255, 255, 255, 255))
    d.polygon(blob(120, 322, 14, 8, n=30, amp=1.2), fill=(150, 124, 134, 255))  # mouth
    return img


def amphipod():
    img = canvas()
    d = ImageDraw.Draw(img)
    col = (204, 150, 128, 255)
    leg = (176, 120, 102, 255)
    # curved, segmented body (a "C" shape)
    segs = 11
    pts = []
    for i in range(segs):
        t = i / (segs - 1)
        a = math.pi * (0.92 - 1.3 * t)
        r = 125
        cx, cy = 262 + r * math.cos(a), 250 - r * math.sin(a)
        pts.append((cx, cy, 40 - 8 * t, 36 - 16 * t, a))
    for (cx, cy, rx, ry, a) in pts:  # legs first so the body overlaps them
        ox, oy = -math.cos(a) * 0.0, 0.0
        for k in (-1, 1):
            d.line([P(cx + k * 9, cy + ry * 0.6), P(cx + k * 16 + random.uniform(-3, 3), cy + ry + 26)],
                   fill=leg, width=3 * S)
    for (cx, cy, rx, ry, a) in pts[::-1]:
        shade = int(14 * (pts.index((cx, cy, rx, ry, a)) % 2))
        d.polygon(blob(cx, cy, rx, ry, n=44, amp=2.2, rot=a + math.pi / 2),
                  fill=(col[0] - shade, col[1] - shade, col[2] - shade, 255))
    # head, eye, long antennae
    hx, hy = pts[0][0], pts[0][1]
    d.polygon(blob(hx - 8, hy - 6, 34, 28, amp=2.5), fill=(214, 164, 142, 255))
    d.ellipse(P(hx - 24, hy - 14) + P(hx - 8, hy + 2), fill=(30, 20, 20, 255))
    d.line(wavy(hx - 30, hy - 14, hx - 130, hy - 90, amp=8, waves=1.2, n=20), fill=leg, width=3 * S)
    d.line(wavy(hx - 34, hy - 4, hx - 140, hy - 40, amp=8, waves=1.2, n=20), fill=leg, width=3 * S)
    return img


def main():
    os.makedirs(OUT, exist_ok=True)
    items = [
        ("moon-jellyfish", moon_jellyfish), ("barreleye", barreleye),
        ("humpback-anglerfish", anglerfish), ("dumbo-octopus", dumbo_octopus),
        ("mariana-snailfish", snailfish), ("supergiant-amphipod", amphipod),
    ]
    for name, fn in items:
        random.seed(SEED)
        finish(fn(), f"creature-{name}.webp")


if __name__ == "__main__":
    main()
