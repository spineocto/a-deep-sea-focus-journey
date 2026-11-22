/**
 * Audio: a looped deep-sea rumble during focus and a one-shot sonar ping
 * when a round completes or a card is revealed.
 *
 * Rules (docs/audio.md + .kiro/steering/product.md):
 * - Muted by default; a toggle turns it on.
 * - Browsers block autoplay until a user gesture, so playback only starts
 *   after the toggle (or START DESCENT) is clicked.
 * - Ambience is quiet (~0.25) and fades in/out over ~1.5 s.
 * - The ping is ~0.5 and never overlaps itself.
 *
 * Both files are CC0. Vite serves public/ at the site root.
 */

const RUMBLE_URL = '/audio/deep-rumble.mp3';
const PING_URL = '/audio/sonar-ping.mp3';
const STORAGE_KEY = 'audio-enabled';
const AMBIENCE_VOLUME = 0.25;
const PING_VOLUME = 0.5;
const FADE_MS = 1500;

export interface AudioController {
  isEnabled(): boolean;
  /** Toggle sound on/off. Returns the new state. Must be called from a click. */
  setEnabled(enabled: boolean): boolean;
  /** Start the looped ambience (no-op if muted or already playing). */
  startAmbience(): void;
  /** Fade the ambience out and stop it. */
  stopAmbience(): void;
  /** Play the sonar ping once (no-op if muted). */
  ping(): void;
}

export function createAudioController(): AudioController {
  let enabled =
    typeof localStorage !== 'undefined' &&
    localStorage.getItem(STORAGE_KEY) === 'on';

  let rumble: HTMLAudioElement | null = null;
  let ping: HTMLAudioElement | null = null;
  let fadeTimer: number | null = null;
  let ambienceWanted = false;

  function ensureElements(): void {
    if (typeof Audio === 'undefined') return;
    if (!rumble) {
      rumble = new Audio(RUMBLE_URL);
      rumble.loop = true;
      rumble.volume = 0;
      rumble.preload = 'auto';
    }
    if (!ping) {
      ping = new Audio(PING_URL);
      ping.volume = PING_VOLUME;
      ping.preload = 'auto';
    }
  }

  function clearFade(): void {
    if (fadeTimer !== null) {
      clearInterval(fadeTimer);
      fadeTimer = null;
    }
  }

  function fadeTo(target: number, onDone?: () => void): void {
    if (!rumble) return;
    clearFade();
    const start = rumble.volume;
    const t0 = Date.now();
    fadeTimer = setInterval(() => {
      if (!rumble) return clearFade();
      const k = Math.min(1, (Date.now() - t0) / FADE_MS);
      rumble.volume = start + (target - start) * k;
      if (k >= 1) {
        clearFade();
        onDone?.();
      }
    }, 50) as unknown as number;
  }

  function startAmbience(): void {
    ambienceWanted = true;
    if (!enabled) return;
    ensureElements();
    if (!rumble) return;
    rumble.play().catch(() => {
      /* Autoplay still blocked: it will start on the next gesture. */
    });
    fadeTo(AMBIENCE_VOLUME);
  }

  function stopAmbience(): void {
    ambienceWanted = false;
    if (!rumble) return;
    fadeTo(0, () => rumble?.pause());
  }

  return {
    isEnabled: () => enabled,
    setEnabled(next: boolean): boolean {
      enabled = next;
      try {
        localStorage.setItem(STORAGE_KEY, next ? 'on' : 'off');
      } catch {
        /* Private mode: the toggle still works for this session. */
      }
      if (next) {
        ensureElements();
        if (ambienceWanted) startAmbience();
      } else {
        if (rumble) {
          clearFade();
          rumble.pause();
          rumble.volume = 0;
        }
      }
      return enabled;
    },
    startAmbience,
    stopAmbience,
    ping(): void {
      if (!enabled) return;
      ensureElements();
      if (!ping) return;
      ping.currentTime = 0;
      ping.play().catch(() => {});
    },
  };
}
