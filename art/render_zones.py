"""
Render the five deep-sea zone backgrounds for Deep Sea Focus Journey.

Extends art/scene_preview.py (same Pillow + numpy method, same jittered
rough-edge shapes and palette family) but renders BACKGROUNDS ONLY:
no diving bell, no octopus companion -- those are separate transparent
layers added later by the web page.

Usage:
    python3 art/render_zones.py

Outputs (1920x1080 each) into art/out/:
    zone-1-sunlit.png, zone-2-twilight.png, zone-3-midnight.png,
    zone-4-abyssal.png, zone-5-hadal.png, zones-contact-sheet.png

Rules followed (from .kiro/steering/visual-style.md + the request):
  * Colours darken smoothly in sequence, never jumping.
  * From twilight down, ~3/4 of the frame is dark sea.
  * Never a flat solid colour: gradient + paint-bleed mottling +
    vignette + film grain on every zone.
  * Render at 2x, then downscale. Edges stay rough / crisp, never
    rounded off. Only the light layer is blurred; everything else
    is drawn sharp.
  * Fixed seed, so every run produces identical files.
"""

import math
import random
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

# ---------------------------------------------------------------------------
# ALL TUNABLE VALUES -- change only here.
# ---------------------------------------------------------------------------

SEED = 7                    # fixed seed; same output on every run
SUPERSAMPLE = 2             # render at 2x, then downscale
OUT_W, OUT_H = 1920, 1080   # final output size

# Film grain (sigma of the gaussian noise added at the end, per zone).
# Thickens with depth, as in visual-style.md.
GRAIN_SIGMA = (2.0, 2.4, 2.8, 3.2, 3.6)

# Vignette: centre (fractions of W/H) and strength. Thickens with depth.
VIGNETTE_CENTER = (0.50, 0.55)
VIGNETTE_STRENGTH = (1.15, 1.35, 1.55, 1.75, 1.95)
VIGNETTE_FLOOR = 0.18      # darkest the vignette may make a corner

# Paint-bleed mottling: amplitude of the low-frequency sine mottling
# added to the sea gradient (keeps the sea from ever looking flat).
MOTTLING_AMP = (5.0, 5.0, 4.0, 4.0, 3.0)
MOTTLING_WAVES = 3          # number of sine waves summed per zone

# Dark sea: below DARK_SEA_START_Y (fraction of height) the sea is
# darkened by up to DARK_SEA_STRENGTH. From twilight down the dark
# sea starts at y ~= 0.25, i.e. ~3/4 of the frame is dark sea.
DARK_SEA_START_Y = (0.55, 0.25, 0.22, 0.18, 0.12)
DARK_SEA_STRENGTH = (0.25, 0.55, 0.70, 0.80, 0.85)

# Light shafts / top glow. Only this layer is ever blurred.
# (colour RGB, alpha, blur radius at 1x, shaft count)
LIGHT_SHAFT_ALPHA = (30, 20, 13, 9, 6)
LIGHT_BLUR = 30             # gaussian blur radius (x supersample)
LIGHT_SHAFT_COUNT = (5, 4, 3, 2, 1)

# Marine snow / particles: count, size range (x supersample), alpha range.
PARTICLE_COUNT = (520, 900, 700, 520, 320)
PARTICLE_R_MIN, PARTICLE_R_MAX = 0.6, 2.2
PARTICLE_ALPHA_MIN, PARTICLE_ALPHA_MAX = 20, 90

# Jitter for rough, hand-drawn edges (pixels at 1x, scaled by supersample).
EDGE_JITTER = 7.0
EDGE_JITTER_SMALL = 2.5

# Zone-specific extras.
FISH_COUNT = 14            # zone 1 only: small dark fish silhouettes
SHADOW_COUNT = 3           # zone 3 only: huge faint dark shadows
BIOLUM_COUNT = 80          # zone 4 only: faint bioluminescent dots
BIOLUM_GLOW_ALPHA = 26     # zone 4 only: blurred glow dots (light layer)
RED_DOT_COUNT = 42         # zone 5 only: dark-red accent dots
GLITCH_COUNT = 3           # zone 5 only: rare, small "wrong" UI glitches
RIDGE_HEIGHT = 0.10         # zone 4-5 only: dark seabed ridge, fraction of H

# Contact sheet: five thumbnails, light to dark, in one row.
SHEET_THUMB_W, SHEET_THUMB_H = 368, 207
SHEET_GAP, SHEET_MARGIN = 10, 20
SHEET_BG = (10, 12, 16)

# ---------------------------------------------------------------------------
# Zone palette. Top / bottom RGB of the sea gradient, light-shaft colour
# and particle colour. Luminance falls monotonically zone to zone.
#   1 sunlit   0-200 m    teal, light shafts, small fish, safe
#   2 twilight 200-1,000 m indigo, particles
#   3 midnight 1,000-4,000 m blue-black, huge shadows
#   4 abyssal  4,000-6,000 m ink black, cold violet, faint bioluminescence
#   5 hadal    6,000 m+    black, dark red accents, subtle glitches
# ---------------------------------------------------------------------------

ZONES = [
    {
        "name": "sunlit", "file": "zone-1-sunlit.png",
        "top": (52, 124, 134), "bottom": (18, 62, 74),
        "shaft": (180, 220, 210), "particle": (190, 215, 215),
    },
    {
        "name": "twilight", "file": "zone-2-twilight.png",
        "top": (30, 56, 98), "bottom": (11, 20, 42),
        "shaft": (120, 150, 190), "particle": (165, 180, 200),
    },
    {
        "name": "midnight", "file": "zone-3-midnight.png",
        "top": (17, 30, 60), "bottom": (6, 9, 20),
        "shaft": (70, 95, 140), "particle": (140, 155, 180),
    },
    {
        "name": "abyssal", "file": "zone-4-abyssal.png",
        "top": (13, 15, 34), "bottom": (4, 4, 11),
        "shaft": (60, 70, 130), "particle": (130, 135, 175),
    },
    {
        "name": "hadal", "file": "zone-5-hadal.png",
        "top": (9, 7, 12), "bottom": (2, 2, 4),
        "shaft": (50, 45, 70), "particle": (115, 110, 130),
    },
]

OUT_DIR = Path(__file__).resolve().parent / "out"


# ---------------------------------------------------------------------------
# Helpers -- same drawing method as scene_preview.py.
# ---------------------------------------------------------------------------

def jit(cx, cy, rx, ry, n=160, amp=6.0, rot=0.0):
    """Jittered ellipse outline: rough hand-drawn edge, never rounded off."""
    pts = []
    for a in np.linspace(0, 2 * math.pi, n, endpoint=False):
        r = 1 + random.uniform(-amp, amp) / max(rx, 1)
        x = rx * r * math.cos(a)
        y = ry * r * math.sin(a)
        pts.append((
            cx + x * math.cos(rot) - y * math.sin(rot),
            cy + x * math.sin(rot) + y * math.cos(rot),
        ))
    return pts


def layer(w, h):
    return Image.new("RGBA", (w, h), (0, 0, 0, 0))


def comp(base, lay, blur=0):
    """Composite a layer. Blur is ONLY ever used for the light layer."""
    if blur:
        lay = lay.filter(ImageFilter.GaussianBlur(blur))
    return Image.alpha_composite(base.convert("RGBA"), lay)


def shaft_polygon(x_top, w_top, x_bot, w_bot, h, jitter):
    """A light shaft: a quad with jittered long edges (rough, not smooth)."""
    left, right = [], []
    steps = 24
    for i in range(steps + 1):
        t = i / steps
        y = t * h
        xl = x_top - w_top / 2 + (x_bot - w_bot / 2 - (x_top - w_top / 2)) * t
        xr = x_top + w_top / 2 + (x_bot + w_bot / 2 - (x_top + w_top / 2)) * t
        left.append((xl + random.uniform(-jitter, jitter), y))
        right.append((xr + random.uniform(-jitter, jitter), y))
    return left + right[::-1]


# ---------------------------------------------------------------------------
# One zone.
# ---------------------------------------------------------------------------

def render_zone(idx, zone):
    S = SUPERSAMPLE
    W, H = OUT_W * S, OUT_H * S
    random.seed(SEED + idx)
    np.random.seed(SEED + idx)

    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    top = np.array(zone["top"], dtype=np.float32)
    bot = np.array(zone["bottom"], dtype=np.float32)
    t = (yy / H)[..., None]

    # Sea gradient + paint-bleed mottling (low-frequency sine waves:
    # organic variation with no blur and no flat patches).
    sea = top * (1 - t) + bot * t
    amp = MOTTLING_AMP[idx]
    for _ in range(MOTTLING_WAVES):
        fx = random.uniform(1.5, 4.0) / W
        fy = random.uniform(1.5, 4.0) / H
        ph = random.uniform(0, 2 * math.pi)
        wave = np.sin(xx * fx * 2 * math.pi + ph) * np.cos(yy * fy * 2 * math.pi + ph)
        sea += (amp * wave)[..., None]

    # Dark sea: from twilight down, ~3/4 of the frame goes dark.
    start = DARK_SEA_START_Y[idx]
    strength = DARK_SEA_STRENGTH[idx]
    dark_amount = np.clip((t[..., 0] - start) / max(1 - start, 0.01), 0, 1)
    sea *= (1 - dark_amount[..., None] * strength)

    # Vignette (same centre as scene_preview.py, stronger with depth).
    cx0, cy0 = W * VIGNETTE_CENTER[0], H * VIGNETTE_CENTER[1]
    dist = np.sqrt(((xx - cx0) / W) ** 2 + ((yy - cy0) / H) ** 2)[..., None]
    sea *= np.clip(1.15 - dist * VIGNETTE_STRENGTH[idx], VIGNETTE_FLOOR, 1)

    img = Image.fromarray(sea.clip(0, 255).astype("uint8"))

    # -- Light layer (the ONLY blurred layer): shafts + top glow. --------
    light = layer(W, H)
    d = ImageDraw.Draw(light)
    shaft_col = zone["shaft"]
    for _ in range(LIGHT_SHAFT_COUNT[idx]):
        x_top = random.uniform(W * 0.08, W * 0.85)
        drift = random.uniform(-W * 0.08, W * 0.12)
        poly = shaft_polygon(
            x_top, random.uniform(W * 0.02, W * 0.05),
            x_top + drift, random.uniform(W * 0.08, W * 0.16),
            H, EDGE_JITTER_SMALL * S,
        )
        d.polygon(poly, fill=shaft_col + (LIGHT_SHAFT_ALPHA[idx],))
    # soft glow across the top (strongest in sunlit, faintest in hadal)
    d.polygon(
        [(0, 0), (W, 0), (W, H * 0.18), (0, H * 0.10)],
        fill=shaft_col + (LIGHT_SHAFT_ALPHA[idx] // 2,),
    )
    img = comp(img, light, blur=LIGHT_BLUR * S)

    # -- Dark paint-bleed blobs: large, rough, sharp (no blur). -----------
    blobs = layer(W, H)
    d = ImageDraw.Draw(blobs)
    blob_col = tuple(max(0, c - 6) for c in zone["bottom"])
    # Keep these very faint and very rough: at higher alpha the jittered
    # ellipses read as flat UFO shapes instead of paint bleeding in water.
    for _ in range(4 + idx):
        bx, by = random.uniform(0, W), random.uniform(H * 0.25, H)
        pts = jit(bx, by, random.uniform(W * 0.08, W * 0.22),
                  random.uniform(H * 0.04, H * 0.10),
                  n=60, amp=EDGE_JITTER * 2.5 * S)
        d.polygon(pts, fill=blob_col + (random.randint(8, 20),))
    img = comp(img, blobs)

    # -- Zone extras (all sharp, no blur). --------------------------------
    extra = layer(W, H)
    d = ImageDraw.Draw(extra)
    pc = zone["particle"]

    if idx == 0:
        # Small fish silhouettes, dark teal, scattered in the upper half.
        for _ in range(FISH_COUNT):
            fx, fy = random.uniform(W * 0.05, W * 0.95), random.uniform(H * 0.12, H * 0.55)
            u = random.uniform(6, 11) * S
            body = jit(fx, fy, u * 1.6, u * 0.6, n=40, amp=EDGE_JITTER_SMALL * S)
            d.polygon(body, fill=(12, 42, 50, 200))
            d.polygon([(fx - u * 1.5, fy), (fx - u * 2.6, fy - u * 0.7),
                       (fx - u * 2.6, fy + u * 0.7)], fill=(12, 42, 50, 200))

    if idx == 2:
        # Huge faint shadows looming in the blue-black.
        for _ in range(SHADOW_COUNT):
            sx, sy = random.uniform(W * 0.15, W * 0.85), random.uniform(H * 0.30, H * 0.75)
            pts = jit(sx, sy, random.uniform(W * 0.14, W * 0.24),
                      random.uniform(H * 0.10, H * 0.20),
                      n=120, amp=EDGE_JITTER * S)
            d.polygon(pts, fill=(2, 3, 7, random.randint(30, 55)))

    if idx == 3:
        # Faint bioluminescence: tiny cold violet / cyan dots.
        for _ in range(BIOLUM_COUNT):
            x, y = random.uniform(0, W), random.uniform(H * 0.15, H)
            r = random.uniform(0.8, 2.6) * S
            col = random.choice([(120, 200, 220), (150, 140, 220), (110, 180, 200)])
            d.ellipse((x - r, y - r, x + r, y + r),
                      fill=col + (random.randint(90, 200),))
        # a few of the same dots on the (blurred) light layer, for glow
        glow = layer(W, H)
        gd = ImageDraw.Draw(glow)
        for _ in range(14):
            x, y = random.uniform(0, W), random.uniform(H * 0.2, H)
            r = random.uniform(2, 5) * S
            gd.ellipse((x - r, y - r, x + r, y + r),
                       fill=(120, 190, 220, BIOLUM_GLOW_ALPHA))
        img = comp(img, glow, blur=LIGHT_BLUR * S // 2)

    if idx >= 3:
        # Dark seabed ridge along the bottom, rough top edge, sharp.
        ridge = [(0, H), (W, H)]
        for i in range(33):
            x = W * i / 32
            y = H * (1 - RIDGE_HEIGHT) + random.uniform(-H * 0.02, H * 0.02) \
                + H * 0.03 * math.sin(i * 0.9)
            ridge.append((x, y))
        ridge.reverse()
        d.polygon(ridge, fill=tuple(max(0, c - 2) for c in zone["bottom"]) + (255,))

    if idx == 4:
        # Dark-red accents: tiny dots and thin streaks.
        for _ in range(RED_DOT_COUNT):
            x, y = random.uniform(0, W), random.uniform(H * 0.2, H)
            r = random.uniform(0.8, 2.4) * S
            d.ellipse((x - r, y - r, x + r, y + r),
                      fill=(180, 40, 30, random.randint(90, 190)))
        for _ in range(6):
            x, y = random.uniform(0, W), random.uniform(H * 0.3, H * 0.9)
            d.line([(x, y), (x + random.uniform(-30, 30) * S,
                              y + random.uniform(8, 26) * S)],
                   fill=(150, 32, 26, 130), width=max(1, S))
        # Rare, small "wrong" glitches: thin offset bars, sharp.
        for _ in range(GLITCH_COUNT):
            gx, gy = random.uniform(W * 0.1, W * 0.8), random.uniform(H * 0.2, H * 0.8)
            gw, gh = random.uniform(W * 0.02, W * 0.06), random.uniform(1, 3) * S
            d.rectangle((gx, gy, gx + gw, gy + gh), fill=(200, 50, 40, 70))
            d.rectangle((gx, gy + gh, gx + gw * 0.6, gy + gh * 2),
                        fill=(90, 100, 140, 60))

    img = comp(img, extra)

    # -- Marine snow / particles (sharp dots, no blur). --------------------
    snow = layer(W, H)
    d = ImageDraw.Draw(snow)
    for _ in range(PARTICLE_COUNT[idx]):
        x, y = random.uniform(0, W), random.uniform(0, H)
        r = random.uniform(PARTICLE_R_MIN, PARTICLE_R_MAX) * S
        d.ellipse((x - r, y - r, x + r, y + r),
                  fill=pc + (random.randint(PARTICLE_ALPHA_MIN, PARTICLE_ALPHA_MAX),))
    img = comp(img, snow)

    # -- Film grain (thicker with depth), then downscale from 2x. ---------
    arr = np.array(img.convert("RGB")).astype(np.float32)
    arr += np.random.normal(0, GRAIN_SIGMA[idx], arr.shape)
    img = Image.fromarray(arr.clip(0, 255).astype("uint8"))
    return img.resize((OUT_W, OUT_H), Image.LANCZOS)


def make_contact_sheet(paths):
    """Five thumbnails, light to dark, in one row."""
    thumb_w, thumb_h = SHEET_THUMB_W, SHEET_THUMB_H
    sheet_w = SHEET_MARGIN * 2 + thumb_w * 5 + SHEET_GAP * 4
    sheet_h = SHEET_MARGIN * 2 + thumb_h
    sheet = Image.new("RGB", (sheet_w, sheet_h), SHEET_BG)
    for i, p in enumerate(paths):
        thumb = Image.open(p).resize((thumb_w, thumb_h), Image.LANCZOS)
        x = SHEET_MARGIN + i * (thumb_w + SHEET_GAP)
        sheet.paste(thumb, (x, SHEET_MARGIN))
    return sheet


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    paths = []
    for idx, zone in enumerate(ZONES):
        img = render_zone(idx, zone)
        out_path = OUT_DIR / zone["file"]
        img.save(out_path)
        paths.append(out_path)
        print(f"wrote {out_path}  {img.size}")
    sheet = make_contact_sheet(paths)
    sheet_path = OUT_DIR / "zones-contact-sheet.png"
    sheet.save(sheet_path)
    print(f"wrote {sheet_path}  {sheet.size}")


if __name__ == "__main__":
    main()
