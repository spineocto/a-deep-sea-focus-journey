/**
 * Per-zone procedural ambience (Web Audio only, no audio files).
 *
 *   zone 1  water flow, a slow light swell
 *   zone 2  a deeper drone
 *   zone 3  sparse bioluminescent chimes
 *   zone 4  a cold, empty low hum
 *   zone 5  the low hum plus a very faint, slow heartbeat
 *
 * All five layers run together while ambience plays; the zone only decides
 * each layer's gain, and changing zone crossfades those gains. The pure
 * tables and helpers up top are unit-tested; the engine below needs an
 * AudioContext (created after a user gesture by synth.ts).
 */
import type { Synth } from './synth.js';

export type LayerName = 'flow' | 'drone' | 'chimes' | 'hum' | 'heart';
export const LAYERS: readonly LayerName[] = ['flow', 'drone', 'chimes', 'hum', 'heart'];

/** Layer gains (0..1) for zones 0..4 (chapters I..V). */
export const ZONE_MIX: ReadonlyArray<Readonly<Record<LayerName, number>>> = [
  { flow: 1.0, drone: 0.0, chimes: 0.0, hum: 0.0, heart: 0.0 },
  { flow: 0.3, drone: 1.0, chimes: 0.0, hum: 0.0, heart: 0.0 },
  { flow: 0.12, drone: 0.5, chimes: 1.0, hum: 0.0, heart: 0.0 },
  { flow: 0.0, drone: 0.0, chimes: 0.0, hum: 1.0, heart: 0.0 },
  { flow: 0.0, drone: 0.0, chimes: 0.0, hum: 0.85, heart: 0.45 },
];

export function clampZone(zone: number): number {
  if (!Number.isFinite(zone)) return 0;
  return Math.max(0, Math.min(ZONE_MIX.length - 1, Math.floor(zone)));
}

export function layerGains(zone: number): Readonly<Record<LayerName, number>> {
  return ZONE_MIX[clampZone(zone)] as Readonly<Record<LayerName, number>>;
}

/** Time constant (s) of the crossfade between zones; about 4 s to settle. */
export const CROSSFADE_TAU_S = 1.4;
/** Below this layer gain a scheduled event (chime, heartbeat) is skipped. */
export const AUDIBLE = 0.05;

export const HEARTBEAT_BPM = 46;
export function heartbeatIntervalMs(): number {
  return Math.round(60000 / HEARTBEAT_BPM);
}

/** A pentatonic set high enough to read as glassy sparks, never as a melody. */
export const CHIME_NOTES_HZ: readonly number[] = [880, 987.77, 1174.66, 1318.51, 1567.98, 1760];
export function pickChimeFreq(rand: number): number {
  const i = Math.min(CHIME_NOTES_HZ.length - 1, Math.floor(Math.max(0, rand) * CHIME_NOTES_HZ.length));
  return CHIME_NOTES_HZ[i] ?? 880;
}
/** Chimes are sparse: one every 3 to 8 seconds. */
export function nextChimeDelayMs(rand: number): number {
  return Math.round(3000 + Math.max(0, Math.min(1, rand)) * 5000);
}

// ---- Engine ----------------------------------------------------------------

export interface ZoneAmbience {
  /** Begin (or resume) the ambience in the given zone. Idempotent. */
  start(zone: number): void;
  /** Crossfade to another zone. No-op if not running. */
  setZone(zone: number): void;
  /** Fade out and release the nodes. Idempotent. */
  stop(immediate?: boolean): void;
  isRunning(): boolean;
}

interface Graph {
  bus: GainNode;
  layers: Record<LayerName, GainNode>;
  sources: AudioScheduledSourceNode[];
}

const FADE_IN_TAU = 0.6;
const FADE_OUT_TAU = 0.4;
const DISPOSE_AFTER_MS = 2200;

export function createZoneAmbience(synth: Synth, volume: number): ZoneAmbience {
  let graph: Graph | null = null;
  let running = false;
  let zone = 0;
  let chimeTimer: number | null = null;
  let heartTimer: number | null = null;
  let disposeTimer: number | null = null;

  function build(c: AudioContext, out: AudioNode): Graph {
    const bus = c.createGain();
    bus.gain.value = 0;
    bus.connect(out);
    const layers = {} as Record<LayerName, GainNode>;
    for (const name of LAYERS) {
      const g = c.createGain();
      g.gain.value = 0;
      g.connect(bus);
      layers[name] = g;
    }
    const sources: AudioScheduledSourceNode[] = [];

    // flow: looped noise through a band-pass, with a slow swell.
    const len = c.sampleRate * 3;
    const buf = c.createBuffer(1, len, c.sampleRate);
    const data = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      last = last * 0.97 + (Math.random() * 2 - 1) * 0.3; // brownish noise
      data[i] = last;
    }
    const noise = c.createBufferSource();
    noise.buffer = buf;
    noise.loop = true;
    const band = c.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = 520;
    band.Q.value = 0.7;
    const swell = c.createGain();
    swell.gain.value = 0.55;
    const swellLfo = c.createOscillator();
    swellLfo.frequency.value = 0.11;
    const swellDepth = c.createGain();
    swellDepth.gain.value = 0.3;
    swellLfo.connect(swellDepth).connect(swell.gain);
    noise.connect(band).connect(swell).connect(layers.flow);
    sources.push(noise, swellLfo);

    // drone: three low partials under a low-pass.
    const droneLp = c.createBiquadFilter();
    droneLp.type = 'lowpass';
    droneLp.frequency.value = 260;
    const droneOut = c.createGain();
    droneOut.gain.value = 0.7;
    droneLp.connect(droneOut).connect(layers.drone);
    const droneParts: Array<[OscillatorType, number, number, number]> = [
      ['sine', 55, 0, 0.6], ['triangle', 82.5, 7, 0.35], ['sine', 110.2, -5, 0.2],
    ];
    for (const [type, f, detune, amp] of droneParts) {
      const o = c.createOscillator();
      o.type = type;
      o.frequency.value = f;
      o.detune.value = detune;
      const g = c.createGain();
      g.gain.value = amp;
      o.connect(g).connect(droneLp);
      sources.push(o);
    }

    // hum: two very low sines, thin and cold, drifting in level.
    const humLp = c.createBiquadFilter();
    humLp.type = 'lowpass';
    humLp.frequency.value = 160;
    const humDrift = c.createGain();
    humDrift.gain.value = 0.36;
    const humLfo = c.createOscillator();
    humLfo.frequency.value = 0.045;
    const humLfoDepth = c.createGain();
    humLfoDepth.gain.value = 0.13;
    humLfo.connect(humLfoDepth).connect(humDrift.gain);
    humLp.connect(humDrift).connect(layers.hum);
    for (const [f, detune] of [[38, 0], [57.3, 4]] as const) {
      const o = c.createOscillator();
      o.type = 'sine';
      o.frequency.value = f;
      o.detune.value = detune;
      o.connect(humLp);
      sources.push(o);
    }
    sources.push(humLfo);

    for (const s of sources) s.start();
    return { bus, layers, sources };
  }

  function playChime(c: AudioContext, g: Graph): void {
    const t0 = c.currentTime + 0.02;
    const f = pickChimeFreq(Math.random());
    const env = c.createGain();
    env.gain.setValueAtTime(0, t0);
    env.gain.linearRampToValueAtTime(0.14, t0 + 0.02);
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + 3.4);
    env.connect(g.layers.chimes);
    for (const [mult, amp] of [[1, 1], [2.01, 0.25]] as const) {
      const o = c.createOscillator();
      o.type = 'sine';
      o.frequency.value = f * mult;
      const a = c.createGain();
      a.gain.value = amp;
      o.connect(a).connect(env);
      o.start(t0);
      o.stop(t0 + 3.5);
    }
  }

  function thump(c: AudioContext, g: Graph, t: number, amp: number): void {
    const o = c.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(64, t);
    o.frequency.exponentialRampToValueAtTime(36, t + 0.2);
    const env = c.createGain();
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(amp, t + 0.02);
    env.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    o.connect(env).connect(g.layers.heart);
    o.start(t);
    o.stop(t + 0.35);
  }

  function scheduleChime(): void {
    const c = synth.ensure();
    if (running && graph && c && layerGains(zone).chimes > AUDIBLE) playChime(c, graph);
    chimeTimer = window.setTimeout(scheduleChime, nextChimeDelayMs(Math.random()));
  }
  function scheduleHeart(): void {
    const c = synth.ensure();
    if (running && graph && c && layerGains(zone).heart > AUDIBLE) {
      const t = c.currentTime + 0.02;
      thump(c, graph, t, 0.9); // lub
      thump(c, graph, t + 0.26, 0.6); // dub
    }
    heartTimer = window.setTimeout(scheduleHeart, heartbeatIntervalMs());
  }

  function applyGains(g: Graph, z: number, tau: number): void {
    const c = synth.ensure();
    if (!c) return;
    const gains = layerGains(z);
    for (const name of LAYERS) g.layers[name].gain.setTargetAtTime(gains[name], c.currentTime, tau);
  }

  function clearTimers(): void {
    if (chimeTimer !== null) clearTimeout(chimeTimer);
    if (heartTimer !== null) clearTimeout(heartTimer);
    chimeTimer = heartTimer = null;
  }

  function dispose(): void {
    clearTimers();
    if (disposeTimer !== null) clearTimeout(disposeTimer);
    disposeTimer = null;
    if (!graph) return;
    for (const s of graph.sources) {
      try { s.stop(); } catch { /* already stopped */ }
    }
    graph.bus.disconnect();
    graph = null;
  }

  return {
    start(z: number): void {
      zone = clampZone(z);
      if (running) return;
      const c = synth.ensure();
      const out = synth.output();
      if (!c || !out) return;
      if (disposeTimer !== null) {
        clearTimeout(disposeTimer);
        disposeTimer = null;
      }
      if (!graph) graph = build(c, out);
      running = true;
      applyGains(graph, zone, 0.05);
      graph.bus.gain.setTargetAtTime(volume, c.currentTime, FADE_IN_TAU);
      if (chimeTimer === null) chimeTimer = window.setTimeout(scheduleChime, 1500);
      if (heartTimer === null) heartTimer = window.setTimeout(scheduleHeart, 800);
    },
    setZone(z: number): void {
      const next = clampZone(z);
      if (next === zone) return;
      zone = next;
      if (running && graph) applyGains(graph, zone, CROSSFADE_TAU_S);
    },
    stop(immediate = false): void {
      if (!running && !graph) return;
      running = false;
      if (immediate || !graph) {
        dispose();
        return;
      }
      const c = synth.ensure();
      if (c) graph.bus.gain.setTargetAtTime(0, c.currentTime, FADE_OUT_TAU);
      if (disposeTimer === null) disposeTimer = window.setTimeout(dispose, DISPOSE_AFTER_MS);
    },
    isRunning: () => running,
  };
}
