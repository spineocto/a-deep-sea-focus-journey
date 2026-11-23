# How Kiro was used

A short, honest account of how this project was built with Kiro: spec-driven
planning, steering files that pin the art direction, agent hooks that guard
quality on save, and plain vibe-coding for the parts that are easier to feel
than to specify. Examples are all from this repository.

## Specs

The core of the app was planned as a spec before any feature code, under
`.kiro/specs/focus-core/`:

- `requirements.md` — what a focus dive is, the states (idle, focusing,
  distracted, break, ending), the distraction rule, how depth accrues.
- `design.md` — the module split that the code still follows: a timer, a depth
  calculator, a state machine, a codex manager, one central store persisted to
  localStorage, and a thin DOM layer on top.
- `tasks.md` / `tasks.meta.json` — the task breakdown.

That spec is why the logic is testable in isolation. Time and depth are always
computed from timestamps, never by counting animation frames (a requirement in
the spec), so the timer survives a backgrounded tab. The round-5 additions kept
the same shape: the escalating eye and the focus goal live in a pure
`src/session.ts`, the logbook in a pure `src/dive-log.ts`, and the per-zone
sound mix in `src/zone-ambience.ts` — each with its own unit tests, each free
of DOM access.

## Steering

`.kiro/steering/` holds the rules Kiro reads on every task, so the look and
constraints stay consistent across many sessions:

- `visual-style.md` — the hard visual rules: hand-drawn storybook, "beautiful
  but uncanny", a muted earthy-ink palette with exactly one warm colour (the
  lamp), and a **Never** list (no purple-blue gradient buttons, no
  glassmorphism, no emoji for creatures or warnings, no flat SVG as main art).
- `tech.md` — stack and discipline: Vite + TypeScript, animation from
  timestamps, one config file for tunable numbers, Python + Pillow for the
  pre-rendered zone art, and a terminal rule (run each command alone, no `cd`,
  no chaining) so the user can set an "always allow".
- `product.md` and `language.md` — product intent and the fixed wording of the
  two system captions.

Concrete effect: when round 5 added a dive-log page, a storybook cover and the
return reaction, every new surface reused the `--font-*` and palette tokens from
`src/styles/tokens.css` and the existing paper texture, because the steering
forbids declaring a font or a raw colour anywhere else. The escalating-eye and
ambience both ship a `prefers-reduced-motion` fallback for the same reason.

## Hooks

`.kiro/hooks/` contains four agent hooks (standalone `*.kiro.hook` JSON; the
format may differ slightly by Kiro version, adjust in the Hook editor if so):

- **run-related-tests** — on save of `src/**/*.ts`, find and run only the
  covering test file with `npx vitest run <file>` and report failures. Keeps the
  pure modules honest the moment they change.
- **check-visual-rules** — on save of `src/styles/**/*.css`, check the file
  against `visual-style.md` and `tokens.css` and list violations (a font-family
  outside tokens, an emoji, a cyan/purple gradient or glass panel, hard-coded
  colours that should be tokens, an animation with no reduced-motion fallback).
- **art-script-reminder** — on save of `art/*.py`, remind to re-render the
  script's outputs and re-check the `art/out/*.webp` sizes against the budget,
  and to commit the script together with its regenerated art.
- **recapture-previews** — a manual hook that runs `npm run previews`
  (`scripts/capture-previews.mjs`) to regenerate the `docs/preview/round5-*.png`
  screenshots at 1440×900 from the `?debug=1` shortcuts, then confirms the files.

The first three are the guardrails the steering describes, enforced
automatically instead of by memory; the fourth removes the manual dance of
starting a dev server and clicking through debug states.

## Vibe-coding

Some of the work is not specifiable up front — it has to be seen. The
escalating eye (how close is "too close"?), the ink recede on return, the cover
swing, the heartbeat under the hadal hum: these were built by describing the
feeling, generating it, screenshotting it at 1440×900, looking, and adjusting.
That loop is why there are debug shortcuts for every round-5 surface
(`?debug=1&eye=1|2|3`, `&return=1`, `&cover=1`, `&log=1`), so a state that
normally needs a 25-minute dive and a tab switch can be seen in one URL. The
capture hook exists for the same reason: the visual check is part of the build,
not an afterthought.

The split in practice: anything with a correct answer (timer math, persistence
migration, the zone→sound mix) went through a spec and unit tests; anything with
only a *right feel* went through the vibe loop, fenced in by the steering rules
so it stayed on-style.
