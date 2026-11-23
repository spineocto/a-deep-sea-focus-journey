# Audio

One file, the rest is synthesised.

| Source | Use | Origin | License |
| --- | --- | --- | --- |
| `public/audio/sonar-ping.mp3` | One-shot ping when a focus round ends / a codex card is revealed | https://opengameart.org/content/sonar-ping, by Spiceman | CC0 |
| `src/zone-ambience.ts` | Per-zone ambience, procedural Web Audio | this project | MIT |
| `src/synth.ts` | Shared AudioContext and the cable creak, procedural | this project | MIT |

The earlier looped rumble file was replaced by the procedural zone ambience.

## Zone ambience
All five layers exist while ambience plays; the zone only sets each layer's gain, and a zone change crossfades them (about 4 s).

| Zone | Layer |
| --- | --- |
| I Sunlit | water flow with a slow light swell (filtered noise) |
| II Twilight | a deeper drone |
| III Bathypelagic | sparse bioluminescent chimes (one every 3 to 8 s) |
| IV Abyssopelagic | a cold, empty low hum |
| V Hadal | the low hum plus a very faint, slow heartbeat (46 bpm) |

## Rules (match `.kiro/steering/product.md`)
- Sound is **muted by default**; the sound toggle turns it on.
- The AudioContext is created only after a click (the toggle, or START DESCENT with sound already on), because browsers block audio before a user gesture.
- Ambience volume ~0.25. The heartbeat and chimes stay well under the base layers. Ping volume ~0.5 and never overlaps itself. The cable creak is ~0.05.
- Ambience plays only while focusing, and follows the displayed depth (including the debug depth scrubber).
