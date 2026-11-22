"""
Deep Sea Focus Journey - Zone Background Renderer
Generates five depth zone backgrounds following visual-style.md

All tunable values are at the top as constants.
Renders at 2x size then downscales to keep edges crisp.
Uses fixed random seed for reproducibility.
"""

import numpy as np
import math
import random
from PIL import Image, ImageDraw, ImageFilter

# ============================================================================
# TUNABLE CONSTANTS
# ============================================================================

# Random seed for reproducibility
RANDOM_SEED = 7

# Output dimensions (final)
OUTPUT_WIDTH = 1920
OUTPUT_HEIGHT = 1080

# Render scale (render at 2x, then downscale)
RENDER_SCALE = 2

# Marine snow particles
PARTICLE_COUNT = 1200  # number of particles
PARTICLE_SIZE_MIN = 0.6  # minimum radius
PARTICLE_SIZE_MAX = 2.2  # maximum radius
PARTICLE_ALPHA_MIN = 20  # minimum alpha
PARTICLE_ALPHA_MAX = 90  # maximum alpha
PARTICLE_BLUR = 1  # blur radius (scaled)

# Texture noise and grain
SEA_NOISE_SIGMA = 2.2  # gaussian noise added to sea gradient
FINAL_GRAIN_SIGMA = 2.0  # film grain added at the end

# Vignette
VIGNETTE_CENTER_X = 0.42  # fraction of width
VIGNETTE_CENTER_Y = 0.55  # fraction of height
VIGNETTE_INTENSITY = 1.6  # how strong the vignette is
VIGNETTE_BRIGHTNESS = 1.15  # center brightness multiplier
VIGNETTE_MIN = 0.15  # minimum brightness at edges

# Giant eye (optional, for twilight zone and deeper)
EYE_ENABLED = True
EYE_X = 0.80  # fraction of width
EYE_Y = 0.36  # fraction of height
EYE_WIDTH = 0.26  # fraction of width
EYE_HEIGHT = 0.12  # fraction of height
EYE_BLUR = 18  # blur radius (scaled)

# Zone color palettes (top_rgb, bottom_rgb, name)
# Colors must darken smoothly in sequence, no jumps
ZONES = [
    {
        "name": "zone-1-sunlit",
        "depth": "0-200m",
        "top": (45, 95, 115),      # bright teal - actually visible!
        "bottom": (18, 52, 68),    # medium teal
        "eye_alpha": 0,            # no eye in sunlit
        "particles_brightness": (200, 215, 220),
        "particles_alpha_mult": 1.5,
        "vignette_mult": 0.4,      # minimal vignette in bright zone
    },
    {
        "name": "zone-2-twilight",
        "depth": "200-1000m",
        "top": (22, 42, 68),       # indigo - noticeable drop
        "bottom": (8, 18, 38),     # dark indigo
        "eye_alpha": 80,           # faint eye starts here
        "particles_brightness": (160, 175, 185),
        "particles_alpha_mult": 1.0,
        "vignette_mult": 0.8,
    },
    {
        "name": "zone-3-midnight",
        "depth": "1000-4000m",
        "top": (12, 22, 42),       # blue-black - clear difference
        "bottom": (3, 8, 18),      # very dark blue
        "eye_alpha": 110,          # eye more visible
        "particles_brightness": (140, 155, 165),
        "particles_alpha_mult": 0.7,
        "vignette_mult": 1.1,
    },
    {
        "name": "zone-4-abyssal",
        "depth": "4000-6000m",
        "top": (8, 12, 24),        # ink black with violet hint
        "bottom": (2, 4, 10),      # near black
        "eye_alpha": 140,          # eye prominent
        "particles_brightness": (120, 130, 145),
        "particles_alpha_mult": 0.5,
        "vignette_mult": 1.3,
    },
    {
        "name": "zone-5-hadal",
        "depth": "6000m+",
        "top": (4, 6, 14),         # almost black with subtle hint
        "bottom": (1, 2, 5),       # pure darkness
        "eye_alpha": 170,          # eye most visible
        "particles_brightness": (100, 110, 125),
        "particles_alpha_mult": 0.3,
        "vignette_mult": 1.5,      # strongest vignette
    },
]

# Contact sheet settings
CONTACT_SHEET_THUMB_HEIGHT = 180
CONTACT_SHEET_SPACING = 20
CONTACT_SHEET_MARGIN = 40

# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def create_layer(width, height):
    """Create a transparent RGBA layer"""
    return Image.new("RGBA", (width, height), (0, 0, 0, 0))

def composite(base, layer, blur=0):
    """Composite layer onto base with optional blur"""
    if blur > 0:
        layer = layer.filter(ImageFilter.GaussianBlur(blur))
    return Image.alpha_composite(base.convert("RGBA"), layer)

def jitter_ellipse(cx, cy, rx, ry, n=160, amp=6):
    """Generate points for a jittered ellipse (hand-drawn look)"""
    pts = []
    for a in np.linspace(0, 2 * math.pi, n, endpoint=False):
        r = 1 + random.uniform(-amp, amp) / max(rx, 1)
        x = rx * r * math.cos(a)
        y = ry * r * math.sin(a)
        pts.append((cx + x, cy + y))
    return pts

# ============================================================================
# ZONE RENDERER
# ============================================================================

def render_zone(zone_config, width, height, scale):
    """Render a single zone background at the given dimensions"""
    
    # Working dimensions
    W, H = width * scale, height * scale
    S = scale
    
    # Initialize random seed
    random.seed(RANDOM_SEED)
    np.random.seed(RANDOM_SEED)
    
    # Create coordinate grids
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    
    # --- Sea gradient ---
    top = np.array(zone_config["top"], dtype=np.float32)
    bot = np.array(zone_config["bottom"], dtype=np.float32)
    t = (yy / H)[..., None]
    sea = top * (1 - t) + bot * t
    
    # --- Vignette (adjust intensity per zone) ---
    vignette_strength = VIGNETTE_INTENSITY * zone_config.get("vignette_mult", 1.0)
    cx0 = W * VIGNETTE_CENTER_X
    cy0 = H * VIGNETTE_CENTER_Y
    dist = np.sqrt(((xx - cx0) / W) ** 2 + ((yy - cy0) / H) ** 2)[..., None]
    sea *= np.clip(VIGNETTE_BRIGHTNESS - dist * vignette_strength, VIGNETTE_MIN, 1)
    
    # --- Add texture noise ---
    sea += np.random.normal(0, SEA_NOISE_SIGMA, sea.shape)
    
    # Create base image
    img = Image.fromarray(sea.clip(0, 255).astype('uint8'))
    img = img.convert("RGBA")
    
    # --- Giant eye (if enabled and visible in this zone) ---
    if EYE_ENABLED and zone_config["eye_alpha"] > 0:
        L = create_layer(W, H)
        d = ImageDraw.Draw(L)
        
        ex, ey = W * EYE_X, H * EYE_Y
        ew, eh = W * EYE_WIDTH, H * EYE_HEIGHT
        
        # Outer eye shape (organic, slightly asymmetric)
        eye_pts = []
        for a in np.linspace(0, 2 * math.pi, 200):
            factor = 1 if math.sin(a) > 0 else 1.15
            scale_y = abs(math.sin(a)) ** 0.6 * factor
            x = ex + ew * math.cos(a)
            y = ey + eh * math.sin(a) * scale_y
            eye_pts.append((x, y))
        
        d.polygon(eye_pts, fill=(40, 46, 34, zone_config["eye_alpha"]))
        
        # Iris
        iris_alpha = min(zone_config["eye_alpha"] + 20, 255)
        iris_r = H * 0.085
        d.ellipse(
            (ex - iris_r, ey - iris_r, ex + iris_r, ey + iris_r),
            fill=(90, 104, 60, iris_alpha)
        )
        
        # Pupil
        pupil_alpha = min(zone_config["eye_alpha"] + 90, 255)
        pupil_rx, pupil_ry = H * 0.018, H * 0.075
        d.ellipse(
            (ex - pupil_rx, ey - pupil_ry, ex + pupil_rx, ey + pupil_ry),
            fill=(4, 5, 4, pupil_alpha)
        )
        
        img = composite(img, L, blur=EYE_BLUR * S)
    
    # --- Marine snow particles ---
    L = create_layer(W, H)
    d = ImageDraw.Draw(L)
    
    pb = zone_config["particles_brightness"]
    pa_mult = zone_config["particles_alpha_mult"]
    
    for _ in range(PARTICLE_COUNT):
        x = random.uniform(0, W)
        y = random.uniform(0, H)
        r = random.uniform(PARTICLE_SIZE_MIN, PARTICLE_SIZE_MAX) * S
        alpha = int(random.randint(PARTICLE_ALPHA_MIN, PARTICLE_ALPHA_MAX) * pa_mult)
        alpha = max(0, min(255, alpha))
        d.ellipse(
            (x - r, y - r, x + r, y + r),
            fill=(pb[0], pb[1], pb[2], alpha)
        )
    
    img = composite(img, L, blur=PARTICLE_BLUR * S)
    
    # --- Final film grain ---
    a = np.array(img.convert("RGB")).astype(np.float32)
    a += np.random.normal(0, FINAL_GRAIN_SIGMA, a.shape)
    img = Image.fromarray(a.clip(0, 255).astype('uint8'))
    
    # --- Downscale to final size ---
    if scale > 1:
        img = img.resize((width, height), Image.Resampling.LANCZOS)
    
    return img

# ============================================================================
# CONTACT SHEET GENERATOR
# ============================================================================

def create_contact_sheet(images, names):
    """Create a horizontal contact sheet of all zone thumbnails"""
    
    n = len(images)
    
    # Calculate thumb dimensions (maintain aspect ratio)
    thumb_h = CONTACT_SHEET_THUMB_HEIGHT
    thumb_w = int(thumb_h * OUTPUT_WIDTH / OUTPUT_HEIGHT)
    
    # Total width
    sheet_w = CONTACT_SHEET_MARGIN * 2 + thumb_w * n + CONTACT_SHEET_SPACING * (n - 1)
    sheet_h = CONTACT_SHEET_MARGIN * 2 + thumb_h
    
    # Create sheet with dark background
    sheet = Image.new("RGB", (sheet_w, sheet_h), (5, 8, 12))
    
    # Place each thumbnail
    x = CONTACT_SHEET_MARGIN
    for img, name in zip(images, names):
        thumb = img.resize((thumb_w, thumb_h), Image.Resampling.LANCZOS)
        sheet.paste(thumb, (x, CONTACT_SHEET_MARGIN))
        x += thumb_w + CONTACT_SHEET_SPACING
    
    return sheet

# ============================================================================
# MAIN
# ============================================================================

def main():
    """Generate all zone backgrounds and contact sheet"""
    
    import os
    
    # Ensure output directory exists
    os.makedirs("art/out", exist_ok=True)
    
    rendered_images = []
    rendered_names = []
    
    print(f"Rendering {len(ZONES)} zone backgrounds...")
    print(f"Output size: {OUTPUT_WIDTH}x{OUTPUT_HEIGHT}")
    print(f"Render scale: {RENDER_SCALE}x ({OUTPUT_WIDTH * RENDER_SCALE}x{OUTPUT_HEIGHT * RENDER_SCALE})")
    print(f"Random seed: {RANDOM_SEED}")
    print()
    
    for i, zone in enumerate(ZONES, 1):
        print(f"[{i}/{len(ZONES)}] Rendering {zone['name']} ({zone['depth']})...")
        
        img = render_zone(zone, OUTPUT_WIDTH, OUTPUT_HEIGHT, RENDER_SCALE)
        
        output_path = f"art/out/{zone['name']}.png"
        img.save(output_path, "PNG", optimize=False)
        
        rendered_images.append(img)
        rendered_names.append(zone['name'])
        
        print(f"    Saved to {output_path}")
    
    print()
    print("Creating contact sheet...")
    
    contact_sheet = create_contact_sheet(rendered_images, rendered_names)
    contact_path = "art/out/zones-contact-sheet.png"
    contact_sheet.save(contact_path, "PNG")
    
    print(f"    Saved to {contact_path}")
    print()
    print("✓ All zone backgrounds rendered successfully!")

if __name__ == "__main__":
    main()
