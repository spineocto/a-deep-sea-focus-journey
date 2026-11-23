/**
 * Audio: procedural per-zone ambience while focusing (Web Audio, see
 * zone-ambience.ts), a one-shot sonar ping when a round completes or a card
 * is revealed, and a quiet cable creak on the return reaction.
 *
 * Rules (docs/audio.md + .kiro/steering/product.md):
 * - Muted by default; a toggle turns it on.
 * - Browsers block audio until a user gesture, so the AudioContext is only
 *   created after the toggle (or START DESCENT) has been clicked.
 * - Ambience is quiet (~0.25) and crossfades between zones.
 * - The ping is ~0.5 and never overlaps itself.
 *
 * Only the ping is a file (CC0). Everything else is synthesised.
 */
import { createSynth } from './synth.js';
import { createZoneAmbience } from './zone-ambience.js';

const PING_URL = '/audio/sonar-ping.mp3';
const STORAGE_KEY = 'audio-enabled';
const AMBIENCE_VOLUME = 0.25;
const PING_VOLUME = 0.5;
const CREAK_VOLUME = 0.05;

export interface AudioController {
  isEnabled(): boolean;
  /** Toggle sound on/off. Returns the new state. Must be called from a click. */
  setEnabled(enabled: boolean): boolean;
  /** Start the zone ambience (no-op if muted or already playing). */
  startAmbience(): void;
  /** Crossfade the ambience to the character of another zone (0..4). */
  setZone(zone: number): void;
  /** Fade the ambience out and stop it. */
  stopAmbience(): void;
  /** Play the sonar ping once (no-op if muted). */
  ping(): void;
  /** A quiet cable creak for the return reaction (no-op if muted). */
  creak(): void;
}

export function createAudioController(): AudioController {
  let enabled =
    typeof localStorage !== 'undefined' &&
    localStorage.getItem(STORAGE_KEY) === 'on';

  const synth = createSynth();
  const ambience = createZoneAmbience(synth, AMBIENCE_VOLUME);
  let ping: HTMLAudioElement | null = null;
  let ambienceWanted = false;
  let zone = 0;

  function ensurePing(): void {
    if (typeof Audio === 'undefined' || ping) return;
    ping = new Audio(PING_URL);
    ping.volume = PING_VOLUME;
    ping.preload = 'auto';
  }

  function startAmbience(): void {
    ambienceWanted = true;
    if (!enabled) return;
    ambience.start(zone);
  }

  function stopAmbience(): void {
    ambienceWanted = false;
    ambience.stop();
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
        synth.ensure(); // created inside the click, so the browser allows it
        ensurePing();
        if (ambienceWanted) startAmbience();
      } else {
        ambience.stop(true);
      }
      return enabled;
    },
    startAmbience,
    setZone(z: number): void {
      zone = z;
      if (enabled) ambience.setZone(z);
    },
    stopAmbience,
    creak(): void {
      if (!enabled) return;
      synth.creak(CREAK_VOLUME);
    },
    ping(): void {
      if (!enabled) return;
      ensurePing();
      if (!ping) return;
      ping.currentTime = 0;
      ping.play().catch(() => {});
    },
  };
}
