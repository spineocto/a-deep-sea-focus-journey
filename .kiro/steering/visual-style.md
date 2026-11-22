# Visual style — hard rules (not suggestions)

## CURRENT DIRECTION (2026-11-21, supersedes "Expressionism" below where they conflict)
**Hand-drawn illustration texture, beautiful but uncanny (手繪插畫質感，美中帶詭).** A dark picture book / gouache-and-ink storybook of the deep sea: gentle on the surface, something wrong underneath. Costume Contest goal: a polished, unforgettable, haunting UI where spooky elements *serve function*.
- **Texture:** paper grain + soft gouache/watercolour washes replace digital film grain. Edges slightly uneven and soft; SVG turbulence/displacement only on small static shapes, otherwise pre-rendered textures (small webp).
- **Line work:** bathysphere, octopus, creatures, eye, UI rings/rails drawn with wobbly ink strokes of varying width. Never perfect vector geometry.
- **Palette (muted, earthy-ink):** deep indigo, ink black, faded teal, bone/cream paper highlights, ONE warm amber lamp (the only warm colour besides the companion).
- **Zones:** painterly layered illustrations (silhouetted rock/kelp/abyss shapes, light shafts as soft brush washes), darker and stranger with depth; zone 5 hides huge, barely visible shapes in the dark. Webp, small.
- **Type:** one storybook display serif (self-hosted, OFL; IM Fell English) for titles, zone names (book-chapter headings) and the timer; a clean UI face for small text; a handwriting face (OFL) only for naturalist's notes.
- **Uncanny, functional:** distraction = ink bleeds in from the page edges; the far eye is drawn in the same ink style; codex cards are specimen drawings pinned in a naturalist's journal with handwritten notes; unlocking "inks in" the drawing.
- Motion stays slow; `prefers-reduced-motion` disables ink/bleed/flap animation; keep it light on the GPU.

## LEGACY direction (kept for composition, depth and "Never" rules)

Final direction: **Expressionism + minimal negative space.**

## Composition
- From the twilight zone down, ~3/4 of the frame is dark sea. Main view keeps only three things: dark, light, the diving bell.
- Background: black-blue that bleeds like paint in water. Never flat solid colour.
- Diving bell texture: expressionist — jittered, rough brush-stroke edges, bold strokes, heavy contrast. not photo-realistic metal. Rivets, bolts, seams and a few rust streaks are allowed, but drawn as rough hand-made strokes (see Approved reference); the companion inside stays soft, bright and cute.
- The bell is small and lonely. Its warm glow (with the companion inside) is the only warm colour on screen.
- A resident eye: small, faint, blurry, far away in the top-right. A hint, not a subject.

## Approved reference (2026-11-19) — match this look
- Images: `docs/reference/scene-v1.png` (full scene) and `docs/reference/bell-closeup-v1.png` (bell close-up).
- Generator: `art/scene_preview.py` (Python Pillow + numpy). Reuse and extend this script for all scene art; keep its shapes and palette so the look stays consistent.
- Feel: hand-drawn texture but refined. Jittered, fuzzy edges everywhere (bell, rim, companion). Not smooth vector shapes, not blurry: render at 2x and keep edges crisp; blur only light/glow layers.
- Diving bell (1930s bathysphere): dark iron sphere, a ring of 16 bolts around one big porthole, two riveted horizontal seams + one vertical seam, rust streaks running down, top hatch + lifting ring + wavy cable, oxygen tank strapped on the left, searchlight housing lower right that casts the light cone.
- Companion: small Dumbo octopus seen through the porthole. Fuzzy-edged peach-pink round mantle with a soft highlight, two darker ear-fins, a short, wide, vertically narrow webbed skirt below, two black dot eyes with white catchlights, pink blush. Same drawing in every state; states only change eye shape, fin angle and a small bob (normal / alert / sleeping).
- Giant eye hint: huge, very faint, blurred, in the dark to the right of the bell.

## Main page ≠ poster
- Poster/cover: still, empty, the one AI-generated image.
- Main page: same base but alive — big soft cold-white glowing timer, the warm glow, slow constant motion (swaying light cone, rising bubbles, sonar sweep, rare eye blink).
- UI almost disappears: depth / oxygen / sonar are faint single lines or rings floating on the sea. No brass panels, no card rows, no dashboard look.

## Zones (same method, only colour/light change; must darken smoothly in sequence)
0–200 m sunlit teal, light shafts, small fish, safe · 200–1,000 m indigo, particles · 1,000–4,000 m blue-black, huge shadows · 4,000–6,000 m ink black, cold violet, faint bioluminescence · 6,000 m+ black, dark red accents, subtle "wrong" UI glitches (rare, small).

## Always
Depth layers (far sea → particles → bell → foreground vignette/grain), volumetric soft light cone, vignette + paper grain + fog that thicken with depth, slow motion everywhere (fast only during anomalies).

## Never
Flat SVG illustration as main art (SVG only for icons, sonar, effects) · purple-blue gradient buttons · glassmorphism templates · emoji for creatures/warnings/companion · bright saturated colours in horror scenes · collage, pixel art, woodcut-carved UI.

## Acceptance
Screenshot with all text removed still reads as "a retro diving bell in the deep sea", not "a dark website".
