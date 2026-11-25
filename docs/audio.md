# Audio

One file, the rest is synthesised.

| Source | Use | Origin | License |
| --- | --- | --- | --- |
| `public/audio/sonar-ping.mp3` | One-shot ping when a focus round ends / a codex card is revealed | https://opengameart.org/content/sonar-ping, by Spiceman | CC0 |
| `src/zone-ambience.ts` | Per-zone ambience, procedural Web Audio | this project | MIT |
| `src/synth.ts` | Shared AudioContext and the cable creak, procedural | this project | MIT |

The earlier looped rumble file was replaced by the procedural zone ambience.

## Zone ambience
All layers exist while ambience plays; the zone only sets each layer's gain, and a zone change crossfades them (about 4 s).
Every zone keeps a continuous noise bed, so the ambience also works as plain focus noise during a Pomodoro, not only as horror. The bed gets darker with depth (spectral centroid measured in Chrome: about 490 Hz in zone I down to about 135 Hz in zone V).
The low layers (drone, hum, heartbeat) carry overtones above 100 Hz so they stay audible on laptop speakers, which barely play anything lower.

| Zone | Layer |
| --- | --- |
| I Sunlit | bright surf: wide-band noise with a slow wave swell (about 12 s), plus small bubble "bloops" every 1.5 to 4.5 s |
| II Twilight | muffled deep water (low-passed noise) + a slow drone, a few bubbles |
| III Bathypelagic | deep water + sparse bioluminescent chimes (one every 3 to 8 s) |
| IV Abyssopelagic | deep water + a cold, empty low hum |
| V Hadal | deep water + a throbbing pressure tone (147/207 Hz, two near-identical tones beating about every 3 s), a slow heartbeat (46 bpm) and a distant groan every 9 to 18 s; the abyss hum is almost gone, so V never sounds like IV |

## Rules (match `.kiro/steering/product.md`)
- Sound is **muted by default**; the sound toggle turns it on.
- The AudioContext is created only after a click (the toggle, or START DESCENT with sound already on), because browsers block audio before a user gesture.
- Ambience volume ~0.25. The heartbeat and chimes stay well under the base layers. Ping volume ~0.5 and never overlaps itself. The cable creak is ~0.05.
- Ambience plays while focusing, and also whenever a debug/preview depth override is set (scrubber, zone jumps, Preview 60s, `?zone=`), so each zone can be auditioned. It follows the displayed depth.
