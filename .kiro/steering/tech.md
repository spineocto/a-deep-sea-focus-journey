# Tech

- Pure front-end static web app; no backend, no API keys. Deploy free (Vercel or Netlify).
- Stack: Vite + TypeScript (+ React only if it helps; keep it simple).
- Animation: requestAnimationFrame / Canvas / CSS. Time and depth always computed from timestamps, never by counting ticks.
- Distraction: Page Visibility API is the main trigger; window blur alone must not fire the full penalty.
- One central store for depth, rounds, codex, settings. Persist to localStorage. On reopen: IDLE, unfinished round counts as abandoned (depth kept, log entry).
- All tunable numbers live in one config file.
- Art pipeline: Python (Pillow + numpy) pre-renders the five zone backgrounds into `art/out/`; scripts live in `art/` with all tunable values (jitter, eye opacity/size, warm glow, stroke density, grain) as constants at the top. The web page only adds light, motion, fog and transitions (CSS/Canvas). The poster/cover is the only AI-generated image.
- Images: compressed modern formats; only load what the opening needs; lazy-load the rest.
- Tests: unit tests for timer, depth math, state machine, distraction deduction; property-based tests where useful.
- Terminal: the workspace root is already the project root. Run each command on its own (e.g. `npm test`, `npx vitest run`, `git status`). Never prefix with `cd` and never chain with `&&`, `;` or `|`, so the user can save an "Always allow" rule for it. Use `npx vitest run` (not watch mode) for tests.
