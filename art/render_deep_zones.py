"""Zones 3, 4 and 5: three very different places (art/out/zone-{3,4,5}-*.webp).

  3 Bathypelagic  "the last light"   no sun; only faded-teal bioluminescence
                                     on deep indigo: ghost jellies, bead chains.
  4 Abyssopelagic "the abyssal plain" cold grey-violet, a pale empty seabed,
                                     tall glass-sponge spires, huge drag marks.
  5 Hadal         "the trench"       near-black vertical walls closing in,
                                     a hint of dark red, ribs, an eye, limbs.

Zones 1-2 (render_ink.py) are untouched. Fixed seeds, identical output.
Run:  python3 art/render_deep_zones.py
"""
import math
import random

import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageFilter

from render_ink import H, OUT, W, fbm, remap, save_webp, wobble_poly

TEAL = (86, 170, 164)
PALE_TEAL = (150, 205, 196)


# ----------------------------------------------------------------- utils ----
def vgrad(top, bot, power=1.0):
    t = np.linspace(0, 1, H, dtype=np.float32)[:, None, None] ** power
    a = np.array(top, np.float32) * (1 - t) + np.array(bot, np.float32) * t
    return np.broadcast_to(a, (H, W, 3)).copy()


def layer():
    return Image.new("RGBA", (W, H), (0, 0, 0, 0))


def over(arr, lay):
    """Composite an RGBA PIL layer over a float RGB array."""
    l = np.asarray(lay, np.float32)
    a = l[..., 3:4] / 255.0
    return arr * (1 - a) + l[..., :3] * a


def add_glow(arr, lay_l, color, strength=1.0, blur=0.0):
    """Additive light: lay_l is an 'L' mask of where light is."""
    if blur:
        lay_l = lay_l.filter(ImageFilter.GaussianBlur(blur))
    m = np.asarray(lay_l, np.float32)[..., None] / 255.0
    return arr + m * np.array(color, np.float32) * strength


def finish(arr, name, seed, vign=1.0, q=82, wobble=5.0):
    # a little hand displacement + paper-tooth noise; vignette in ink
    img = np.clip(arr, 0, 255)
    dx = (fbm(H, W, 500 + seed, 2.6) - 0.5) * wobble
    dy = (fbm(H, W, 510 + seed, 2.6) - 0.5) * wobble
    img = remap(img, dx, dy)
    yg, xg = np.mgrid[0:H, 0:W].astype(np.float32)
    vx = (xg / W - 0.45) ** 2 * 1.2 + (yg / H - 0.52) ** 2 * 1.5
    img *= np.clip(1.06 - vx * vign, 0.2, 1)[..., None]
    img += (fbm(H, W, 600 + seed, 0.9) - 0.5)[..., None] * 5  # dither: no banding in the dark
    save_webp(Image.fromarray(np.clip(img, 0, 255).astype("uint8")), name, q)


def wavy(rng, x0, y0, x1, y1, amp, waves, n=26):
    pts = []
    dx, dy = x1 - x0, y1 - y0
    L = math.hypot(dx, dy) or 1
    nx, ny = -dy / L, dx / L
    ph = rng.uniform(0, 6.28)
    for i in range(n + 1):
        t = i / n
        off = math.sin(t * waves * 6.283 + ph) * amp * (0.3 + 0.7 * t)
        pts.append((x0 + dx * t + nx * off, y0 + dy * t + ny * off))
    return pts


# --------------------------------------------------------------- zone 3 ----
def ghost_jelly(d_line, d_fill, rng, cx, cy, w, strength=255):
    """A bell + tentacles, as glow masks (line mask, soft fill mask)."""
    h = w * rng.uniform(0.55, 0.75)
    dome = [(cx + w / 2 * math.cos(a), cy + h * math.sin(a)) for a in np.linspace(math.pi, 2 * math.pi, 28)]
    rim = [(cx + w / 2 - i * w / 14, cy + 3 * math.sin(i * 1.7)) for i in range(15)]
    d_fill.polygon(dome + rim[1:], fill=int(strength * 0.28))
    d_line.line(wobble_poly(dome, 1.2, rng, 2), fill=strength, width=max(2, int(w / 60)), joint="curve")
    d_line.line(rim, fill=int(strength * 0.7), width=max(1, int(w / 90)))
    for k in range(rng.randint(5, 9)):
        x = cx - w / 2 * 0.8 + k * (w * 0.8 / 7)
        d_line.line(wavy(rng, x, cy + 2, x + rng.uniform(-w * 0.2, w * 0.2), cy + rng.uniform(1.0, 2.6) * w,
                         amp=w * 0.07, waves=rng.uniform(1.5, 2.8)),
                    fill=int(strength * 0.65), width=max(1, int(w / 110)))
    # inner organ rings
    r = w * 0.09
    for ox in (-w * 0.12, w * 0.12):
        d_line.ellipse((cx + ox - r, cy - h * 0.45 - r * 0.7, cx + ox + r, cy - h * 0.45 + r * 0.7), outline=int(strength * 0.6), width=max(1, int(w / 120)))


def zone3():
    rng = random.Random(303)
    arr = vgrad((10, 14, 42), (3, 4, 15), 0.9)
    n1 = fbm(H, W, 330, 2.2)
    arr *= (1 + (n1 - 0.5) * 0.28)[..., None]
    # a faint cold bloom low in the water, nothing from above
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    bloom = np.exp(-(((xx - W * 0.45) / (W * 0.5)) ** 2 + ((yy - H * 0.78) / (H * 0.4)) ** 2))
    arr += bloom[..., None] * np.array((4, 14, 20), np.float32)

    # far ghosts: huge, blurred, barely there
    for blur, count, wr, st in ((9, 5, (300, 520), 70), (3.2, 9, (110, 230), 130), (1.1, 12, (40, 90), 210)):
        lines, fills = Image.new("L", (W, H), 0), Image.new("L", (W, H), 0)
        dl, df = ImageDraw.Draw(lines), ImageDraw.Draw(fills)
        for _ in range(count):
            cx = rng.uniform(0.04, 0.96) * W
            cy = rng.uniform(0.08, 0.78) * H
            ghost_jelly(dl, df, rng, cx, cy, rng.uniform(*wr), st)
        arr = add_glow(arr, fills, (60, 130, 130), 0.55, blur * 1.6)
        arr = add_glow(arr, lines, TEAL, 0.62, blur)
        if blur < 4:
            arr = add_glow(arr, lines, PALE_TEAL, 0.18, 0.4)

    # bead chains (siphonophores): two long, curved strings of lights
    chain, core = Image.new("L", (W, H), 0), Image.new("L", (W, H), 0)
    dc, dk = ImageDraw.Draw(chain), ImageDraw.Draw(core)
    for (x0, y0, x1, y1, amp) in ((0.06, 0.08, 0.30, 0.9, 120), (0.93, 0.15, 0.7, 0.98, 90)):
        pts = wavy(rng, x0 * W, y0 * H, x1 * W, y1 * H, amp, 1.4, n=64)
        for i, (x, y) in enumerate(pts):
            r = 3 + 3 * abs(math.sin(i * 0.6))
            dc.ellipse((x - r, y - r, x + r, y + r), fill=170)
            dk.ellipse((x - 1.4, y - 1.4, x + 1.4, y + 1.4), fill=255)
        dc.line(pts, fill=60, width=2)
    arr = add_glow(arr, chain, TEAL, 0.5, 2.5)
    arr = add_glow(arr, core, PALE_TEAL, 0.45, 0.6)

    # scattered glowing points in loose clusters
    pts_l, pts_c = Image.new("L", (W, H), 0), Image.new("L", (W, H), 0)
    dl, dc2 = ImageDraw.Draw(pts_l), ImageDraw.Draw(pts_c)
    centers = [(rng.uniform(0.05, 0.95) * W, rng.uniform(0.05, 0.95) * H) for _ in range(11)]
    for i in range(260):
        if i < 170:
            cx, cy = rng.choice(centers)
            x, y = rng.gauss(cx, 130), rng.gauss(cy, 90)
        else:
            x, y = rng.uniform(0, W), rng.uniform(0, H)
        r = rng.choice((1.4, 1.8, 2.4, 3.2, 4.4))
        a = rng.randint(110, 255)
        dl.ellipse((x - r * 2.4, y - r * 2.4, x + r * 2.4, y + r * 2.4), fill=a // 3)
        dc2.ellipse((x - r, y - r, x + r, y + r), fill=a)
    arr = add_glow(arr, pts_l, TEAL, 0.5, 5)
    arr = add_glow(arr, pts_c, PALE_TEAL, 0.55, 0.8)

    # soft ink silhouette: one distant, enormous shape moving through the dark
    sil = layer()
    ds = ImageDraw.Draw(sil)
    ds.polygon(wobble_poly([(W * 0.55, H * 0.95), (W * 0.7, H * 0.78), (W * 0.98, H * 0.74), (W * 1.0, H), (W * 0.55, H * 0.95)], 8, rng, 6), fill=(2, 3, 12, 190))
    arr = over(arr, sil.filter(ImageFilter.GaussianBlur(14)))
    finish(arr, "zone-3-midnight.webp", 3, vign=0.95)


# --------------------------------------------------------------- zone 4 ----
HORIZON = 0.72


def lattice_spire(arr, rng, cx, base_y, h, w, kind, haze):
    """A glass-sponge column or funnel with a lattice skin, in pale lilac bone."""
    L = Image.new("L", (W, H), 0)
    d = ImageDraw.Draw(L)
    top_y = base_y - h
    if kind == "spire":
        pts = [(cx - w / 2, base_y), (cx - w * 0.30, base_y - h * 0.5), (cx - w * 0.07, top_y), (cx + w * 0.07, top_y),
               (cx + w * 0.30, base_y - h * 0.5), (cx + w / 2, base_y)]
    else:  # funnel / vase: stalk and a flared cup
        cup_y = base_y - h * 0.62
        pts = [(cx - w * 0.14, base_y), (cx - w * 0.12, cup_y + h * 0.1), (cx - w * 0.5, top_y + h * 0.04),
               (cx - w * 0.44, top_y), (cx + w * 0.44, top_y), (cx + w * 0.5, top_y + h * 0.04),
               (cx + w * 0.12, cup_y + h * 0.1), (cx + w * 0.14, base_y)]
    pts = wobble_poly(pts + [pts[0]], max(1.2, w * 0.035), rng, 4)
    d.polygon(pts, fill=255)
    m = np.asarray(L, np.float32) / 255.0
    ys, xs = np.mgrid[0:H, 0:W].astype(np.float32)
    # lit from the upper left: pale on the left, violet-grey on the right
    u = np.clip((xs - (cx - w / 2)) / max(w, 1), 0, 1)
    pale = np.array((176, 172, 196), np.float32)
    dusk = np.array((92, 88, 120), np.float32)
    col = pale * (1 - u[..., None]) + dusk * u[..., None]
    # lattice: two families of diagonal lines
    s = max(7.0, w * 0.2)
    lat = np.zeros((H, W), np.float32)
    for sgn in (1, -1):
        t = np.mod(xs * 0.9 + sgn * ys * 0.9, s)
        lat = np.maximum(lat, np.clip(1.1 - np.abs(t - s / 2) * 1.3 + (s / 2 - 1.0), 0, 1) * 0 + (np.abs(t - s / 2) > s / 2 - 1.2))
    col = col * (1 - 0.55 * lat[..., None] * m[..., None]) + np.array((26, 24, 40), np.float32) * 0.55 * lat[..., None] * m[..., None]
    # engraved shade strokes down the right-hand side, and a pooled shadow at the foot
    hatch = (np.mod(xs + ys * 0.15, 5.0) < 1.3) * (u > 0.5) * m
    col = col * (1 - 0.4 * hatch[..., None]) + np.array((22, 20, 36), np.float32) * 0.4 * hatch[..., None]
    col *= (0.86 + 0.28 * fbm(H, W, int(cx) % 97 + 700, 1.6))[..., None]
    a = (m * (1 - haze))[..., None]
    foot = Image.new("L", (W, H), 0)
    ImageDraw.Draw(foot).ellipse((cx - w * 0.9, base_y - w * 0.12, cx + w * 1.1, base_y + w * 0.18), fill=int(120 * (1 - haze)))
    fa = (np.asarray(foot.filter(ImageFilter.GaussianBlur(6)), np.float32) / 255.0)[..., None]
    arr = arr * (1 - fa * 0.6) + np.array((24, 22, 38), np.float32) * fa * 0.6
    arr = arr * (1 - a) + col * a
    # ink outline
    edge = np.asarray(L.filter(ImageFilter.MaxFilter(5)), np.float32) / 255.0 - m
    ea = (np.clip(edge, 0, 1) * (0.75 - 0.5 * haze))[..., None]
    arr = arr * (1 - ea) + np.array((18, 16, 30), np.float32) * ea
    return arr


def zone4():
    rng = random.Random(404)
    hy = int(H * HORIZON)
    arr = vgrad((20, 19, 34), (72, 70, 94), 1.0)
    # plain: pale and flat, darkening toward the viewer
    plain = np.zeros((H, W, 3), np.float32)
    t = np.clip((np.arange(H, dtype=np.float32) - hy) / (H - hy), 0, 1)[:, None, None]
    plain[:] = np.array((120, 116, 140), np.float32) * (1 - t) + np.array((50, 48, 66), np.float32) * t
    tex = fbm(H, W, 440, 2.0)
    fine = fbm(H, W, 441, 1.0, anis=(2.5, 1.0))
    plain *= (0.72 + 0.5 * tex + 0.1 * fine)[..., None]
    plain[..., 0] *= 1 + (fbm(H, W, 443, 1.8) - 0.5) * 0.18
    ridge_y = hy + (fbm(1, W, 441, 2.0)[0] - 0.5) * 26
    mask = (np.arange(H, dtype=np.float32)[:, None] > ridge_y[None, :]).astype(np.float32)
    mask = np.asarray(Image.fromarray((mask * 255).astype("uint8")).filter(ImageFilter.GaussianBlur(3)), np.float32) / 255.0
    arr = arr * (1 - mask[..., None]) + plain * mask[..., None]
    arr *= (1 + (fbm(H, W, 442, 2.4) - 0.5) * 0.14)[..., None]

    # marks of something huge: three long drag furrows and shallow footprints, in perspective
    vp = (W * 0.58, hy)
    mark = layer()
    dm = ImageDraw.Draw(mark)
    ridge = layer()
    dr = ImageDraw.Draw(ridge)
    for i, (x_bot, bend, wid) in enumerate(((0.06, -90, 190), (0.30, 70, 120), (0.70, -60, 230), (1.0, 120, 150))):
        n = 40
        left, right = [], []
        for k in range(n + 1):
            f = k / n                       # 0 at the viewer, 1 at the horizon
            y = H + 10 - (H + 10 - hy) * (f ** 0.8)
            xc = x_bot * W + (vp[0] - x_bot * W) * (f ** 0.9) + math.sin(f * 3.2 + i) * bend * (1 - f)
            wd = wid * (1 - f) ** 1.5 + 1.5
            left.append((xc - wd, y))
            right.append((xc + wd, y))
        dm.polygon(left + right[::-1], fill=(30, 28, 44, 150))
        dr.line(left, fill=(168, 164, 188, 120), width=3)
        dr.line(right, fill=(168, 164, 188, 90), width=2)
        dr.line([(x - 3, y) for x, y in left], fill=(20, 18, 32, 140), width=2)
    for (px, py, rx) in ((0.30, 0.86, 170), (0.78, 0.8, 120), (0.52, 0.76, 60)):
        ry = rx * 0.22
        dm.ellipse((px * W - rx, py * H - ry, px * W + rx, py * H + ry), fill=(30, 28, 44, 130))
        dr.arc((px * W - rx, py * H - ry, px * W + rx, py * H + ry), 190, 350, fill=(176, 172, 196, 110), width=3)
        dr.arc((px * W - rx, py * H - ry, px * W + rx, py * H + ry), 10, 170, fill=(16, 14, 28, 150), width=3)
    arr = over(arr, mark.filter(ImageFilter.GaussianBlur(2.5)))
    arr = over(arr, ridge.filter(ImageFilter.GaussianBlur(0.8)))

    # glass sponges and spires, far to near
    specs = []
    for _ in range(26):
        f = rng.random() ** 0.7                       # 0 far .. 1 near
        y = hy + 4 + f * (H - hy - 10)
        s = 0.16 + 0.84 * f
        x = rng.choice((rng.uniform(0.0, 0.34), rng.uniform(0.62, 1.0), rng.uniform(0.0, 1.0))) * W
        if 0.30 < x / W < 0.56 and y > H * 0.92:
            x += W * 0.28
        specs.append((y, x, rng.uniform(260, 620) * s, rng.uniform(40, 96) * s, rng.choice(("spire", "spire", "funnel")), 0.62 * (1 - f)))
    for (y, x, h, w, kind, haze) in sorted(specs):
        arr = lattice_spire(arr, rng, x, y, h, w, kind, haze)
    # two great spires right at the edges, half out of frame
    arr = lattice_spire(arr, rng, W * 0.035, H * 1.03, H * 0.95, 190, "spire", 0.0)
    arr = lattice_spire(arr, rng, W * 0.965, H * 1.02, H * 0.8, 160, "spire", 0.05)

    # fog banks lying on the plain; the empty water above gets a cold glow at the horizon
    mist = fbm(H, W, 450, 2.0, anis=(1.0, 6.0))
    band = np.exp(-(((np.arange(H, dtype=np.float32) - hy) / (H * 0.09)) ** 2))[:, None]
    arr += (band * (0.35 + 0.65 * mist))[..., None] * np.array((54, 52, 72), np.float32) * 0.9
    finish(arr, "zone-4-abyssal.webp", 4, vign=0.7, wobble=4.0)


# --------------------------------------------------------------- zone 5 ----
def edge_poly(rng, side, depth_k, y_step=(26, 90)):
    """Jagged inner edge of a trench wall, stepping like strata."""
    pts = []
    y = -20.0
    while y < H + 40:
        f = max(0.0, min(1.0, y / H))
        if side == "l":
            x = (0.13 + 0.15 * f + depth_k) * W
        else:
            x = W - (0.10 + 0.14 * f + depth_k) * W
        x += rng.uniform(-26, 26) + 30 * math.sin(y / 140.0 + depth_k * 9)
        pts.append((x, y))
        if rng.random() < 0.28:  # a ledge: the wall steps out, then drops sheer
            ls = rng.uniform(18, 44) * (1 if side == "l" else -1) * -1
            pts.append((x + ls, y + 1))
        y += rng.uniform(*y_step)
    return pts


def wall(side, pts):
    edge = pts if side == "l" else pts
    if side == "l":
        return [(-40, -40)] + edge + [(-40, H + 60)]
    return [(W + 40, -40)] + edge + [(W + 40, H + 60)]


def zone5():
    rng = random.Random(505)
    arr = vgrad((5, 3, 8), (2, 1, 4), 1.0)
    arr *= (1 + (fbm(H, W, 530, 2.2) - 0.5) * 0.5)[..., None]
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    # the only colour: a dull red haze rising from the bottom of the trench
    red = np.exp(-(((xx - W * 0.56) / (W * 0.22)) ** 2 + ((yy - H * 1.08) / (H * 0.5)) ** 2))
    arr += red[..., None] * np.array((62, 8, 12), np.float32)

    # --- the huge things, behind the near walls ---
    big = layer()
    bd = ImageDraw.Draw(big)
    rim = layer()
    rd = ImageDraw.Draw(rim)
    # ribs: a vast cage curving out of the right-hand dark
    for k in range(8):
        y0 = H * (0.02 + 0.125 * k)
        cx, cy = W * 1.02, y0 + H * 0.34
        rx, ry = W * (0.58 - 0.012 * k), H * 0.36
        pts = [(cx - rx * math.cos(a) * (1 + 0.05 * math.sin(a * 3)), cy - ry * math.sin(a)) for a in np.linspace(0.05, 1.45, 46)]
        wd = 34 - 2 * k
        bd.line(pts, fill=(40, 24, 32, 255), width=wd, joint="curve")
        rd.line([(x - wd * 0.35, y - wd * 0.2) for x, y in pts], fill=(150, 36, 40, 150), width=3, joint="curve")
    spine = [(W * (0.97 - 0.012 * math.sin(i / 4.0)), H * i / 40) for i in range(41)]
    bd.line(spine, fill=(36, 22, 30, 255), width=58)
    rd.line([(x - 22, y) for x, y in spine], fill=(140, 34, 38, 120), width=3)
    # a limb: a tentacle sagging down the left side, suckers along its length
    limb = [(W * 0.14, -30)] + [(W * (0.16 + 0.26 * (i / 30) ** 1.4), H * (0.55 * (i / 30))) for i in range(1, 31)]
    for i in range(len(limb) - 1):
        f = i / (len(limb) - 1)
        bd.line([limb[i], limb[i + 1]], fill=(34, 20, 28, 255), width=int(78 * (1 - f) + 10), joint="curve")
        if i % 2 == 0:
            sx, sy = limb[i][0] + (60 * (1 - f) + 6), limb[i][1]
            r = 11 * (1 - f) + 2.5
            rd.ellipse((sx - r, sy - r, sx + r, sy + r), outline=(150, 36, 40, 150), width=2)
    # the eye: half-lidded, deep in the middle distance
    ex, ey, er = W * 0.585, H * 0.80, 150
    for ring, col in ((er, (52, 12, 16, 255)), (er * 0.78, (92, 18, 20, 255)), (er * 0.5, (40, 8, 12, 255))):
        bd.ellipse((ex - ring, ey - ring * 0.82, ex + ring, ey + ring * 0.82), fill=col)
    bd.ellipse((ex - 16, ey - er * 0.5, ex + 16, ey + er * 0.5), fill=(2, 0, 2, 255))   # the slit
    bd.rectangle((ex - er - 4, ey - er * 0.9, ex + er + 4, ey - er * 0.12), fill=(0, 0, 0, 0))
    bd.pieslice((ex - er * 1.05, ey - er * 0.9, ex + er * 1.05, ey + er * 0.9), 180, 360, fill=(7, 4, 8, 255))  # the upper lid
    rd.arc((ex - er * 1.05, ey - er * 0.9, ex + er * 1.05, ey + er * 0.9), 180, 360, fill=(150, 36, 40, 160), width=3)
    big = big.filter(ImageFilter.GaussianBlur(1.6))
    rim = rim.filter(ImageFilter.GaussianBlur(1.0))
    # keep the huge things dim: seen, not lit
    ba = np.asarray(big, np.float32)
    ba[..., 3] *= 0.9
    arr = over(arr, Image.fromarray(ba.astype("uint8")))
    arr = over(arr, rim)

    # --- three layers of wall per side: far (dim, strata lit faintly), mid, near (ink) ---
    for L, (depth_k, tone, rimcol) in enumerate(((0.12, (16, 11, 20), None), (0.05, (7, 5, 11), (120, 26, 30)), (0.0, (1, 1, 3), (96, 20, 24)))):
        for side in ("l", "r"):
            lay = layer()
            dd = ImageDraw.Draw(lay)
            e = edge_poly(rng, side, depth_k)
            dd.polygon(wobble_poly(wall(side, e), 3, rng, 2), fill=tone + (255,))
            # strata: faint horizontal bedding lines inside the wall
            if L < 2:
                for _ in range(14):
                    y = rng.uniform(0, H)
                    xe = min(e, key=lambda p: abs(p[1] - y))[0]
                    xa = xe - rng.uniform(80, 360) if side == "l" else xe + rng.uniform(80, 360)
                    xb = xe - 8 if side == "l" else xe + 8
                    dd.line([(xa, y), (xb, y + rng.uniform(-6, 6))], fill=(46, 36, 52, 34), width=1)
            lay = lay.filter(ImageFilter.GaussianBlur(2.2 - 1.2 * (L / 2)))
            arr = over(arr, lay)
            if rimcol:
                rl = layer()
                dr = ImageDraw.Draw(rl)
                dr.line(e, fill=rimcol + (95 if L == 1 else 70,), width=3, joint="curve")
                arr = over(arr, rl.filter(ImageFilter.GaussianBlur(1.4)))

    # dull red eyes-of-nothing, in pairs, low in the gap
    pts = Image.new("L", (W, H), 0)
    dp = ImageDraw.Draw(pts)
    for (x, y) in ((0.46, 0.34), (0.74, 0.18), (0.30, 0.66), (0.66, 0.5)):
        for dx in (-14, 14):
            dp.ellipse((x * W + dx - 3, y * H - 2, x * W + dx + 3, y * H + 2), fill=200)
    arr = add_glow(arr, pts, (150, 22, 26), 0.55, 1.6)
    finish(arr, "zone-5-hadal.webp", 5, vign=1.1, q=84)


if __name__ == "__main__":
    OUT.mkdir(exist_ok=True)
    zone3()
    zone4()
    zone5()
