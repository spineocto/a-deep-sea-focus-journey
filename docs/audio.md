# Audio assets

Both files are **CC0 (public domain)** — free for any use, including the Kiroween submission. No attribution required (credited here anyway as a courtesy).

| File | Use | Source | Author | License |
| --- | --- | --- | --- | --- |
| `public/audio/sonar-ping.mp3` | One-shot "ping" when a focus round ends / a codex card is revealed | https://opengameart.org/content/sonar-ping | Spiceman ("Please do not credit me, just make an awesome game!") | CC0 |
| `public/audio/deep-rumble.mp3` | Low deep-sea ambience, looped quietly during focus | https://opengameart.org/content/underwater-or-space-engine-rumble | gmason | CC0 |

## Rules (match `.kiro/steering/product.md`)
- Sound is a stretch feature and **muted by default**; a sound toggle turns it on. Browsers block autoplay until the user interacts, so only start audio after a click (e.g. START DESCENT).
- Ambience loops at low volume (~0.2–0.3) and fades in/out over ~1–2 s. MP3 can leave a tiny gap at the loop seam; if noticeable, crossfade two copies with the Web Audio API.
- Ping volume ~0.5, never overlapping itself.
- Vite serves `public/` at the site root: use `/audio/sonar-ping.mp3` and `/audio/deep-rumble.mp3`.
