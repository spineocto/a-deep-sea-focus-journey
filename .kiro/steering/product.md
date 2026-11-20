# Product: Deep Sea Focus Journey

A Lovecraftian deep-sea Pomodoro web app for Kiroween 2026 (category: Costume Contest).
Focus pushes a small diving bell deeper toward the Mariana Trench (10,900 m). Finishing a round reveals a deep-sea creature card. Leaving the tab makes something in the dark notice you.

## Why it matters (Impact)
People who struggle to stay focused. The penalty for distraction is a story moment (a giant eye opening), not a scolding pop-up.

## Core loop
1. Pick 15 / 25 / 45 minutes → START DESCENT.
2. The bell sinks; depth grows with real focused time (timestamp-based, survives tab throttling).
3. Round complete → searchlight slowly reveals a creature → research-file card → added to the codex.
4. Short break (oxygen refills). Every 4th round → long break at a shipwreck.
5. Depth never resets; it accumulates across sessions until 10,900 m → ending.

## States (single state machine, no scattered booleans)
IDLE → FOCUSING → (DISTRACTED ↔ FOCUSING) → SHORT_BREAK / LONG_BREAK → FOCUSING … → ENDING → IDLE

## Fixed English lines — never reword or translate
- `START DESCENT`
- `WARNING: SOMETHING IS WATCHING YOU`
- `SIGNAL DETECTED BELOW THE KNOWN DEPTH.`

## Must-have (scope for Dec 4)
- Pomodoro + depth + persistence (localStorage)
- Main scene visuals + 5 depth zones with smooth transitions
- Distraction event (Page Visibility API) + low-key manual test trigger
- Completion reveal + codex (silhouette + "?" for locked cards)
- 10,900 m ending: searchlight finds supergiant amphipods (Hirondellea gigas), then the final signal. Snailfish is the hadal-zone card, not the ending (fish can't live that deep).
- Demo mode (×60) that does not pollute real progress

## Mechanic rules (decided 2026-11-19)
1. Codex reveal: a completed round reveals the card of the shallowest zone not yet unlocked, but never a zone deeper than the bell has reached. So round 1 is always the moon jellyfish. When every reached zone is unlocked → duplicate record.
2. Distraction: the tab must be hidden for more than 5 s to count. One hidden stretch = one event, however long it lasts.
3. No pause button. Abandon keeps the depth already gained but gives no card for that round.
4. Closing the page mid-focus = abandon (depth kept). Closing during a break = break finished.
5. After the 10,900 m ending: the timer still works (depth stays at the bottom), the codex is kept, and a low-key "dive again" option resets depth only.

## Nice-to-have (only if time)
Sound (muted by default), extra horror hints, more cards.
Dropped (2026-11-19): shipwreck interior scene. Long break = docked beside the wreck exterior only.

## Default parameters (keep as central config constants)
| Param | Default |
|---|---|
| Descent speed | 12 m per focused minute |
| Distraction rise | 20% of this round's descent per event, max 50% per round |
| Short break | 5 min (skippable) |
| Long break | 15 min (skippable), every 4 rounds |
| Companion | 1 small Dumbo octopus (Grimpoteuthis) |
| Codex | 6 real species, one per zone + ending card (see docs/codex.md). Facts must be real and sourced. |
| Duplicates | Zone full → duplicate record, no new slot |
| Oxygen | Drains slowly while focusing, refills on break; never forces a stop |

## Never
- Pop-ups/toasts/"you got distracted" text instead of the distraction sequence
- Jump scares, gore, full monster faces
- Hiding, deforming or scaring the companion
- Brightening deep zones "so you can see"
