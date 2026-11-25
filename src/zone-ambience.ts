/**
 * Per-zone procedural ambience (Web Audio only, no audio files).
 *
 * Every zone keeps a continuous noise bed, so the ambience also works as
 * plain focus noise (like a Pomodoro white-noise track); the zone layers
 * on top give it character:
 *   zone 1  bright surf: wave swell + small bubbles
 *   zone 2  muffled deep water + a slow drone, a few bubbles
 *   zone 3  deep water + sparse bioluminescent chimes
 *   zone 4  deep water + a cold, empty low hum
 *   zone 5  deep water + a throbbing pressure tone, a slow heartbeat and
 *           now and then a distant groan from something very large
 *
 * All five layers run together while ambience plays; the zone only decides
 * each layer's gain, and changing zone crossfades those gains. The pure
 * tables and helpers up top are unit-tested; the engine below needs an
 * AudioContext (created after a user gesture by synth.ts).
 */
import type { Synth } from './synth.js';

export type LayerName =
  | 'flow' | 'deep' | 'bubbles' | 'drone' | 'chimes' | 'hum' | 'heart' | 'pressure' | 'groan';
export const LAYERS: readonly LayerName[] = [
  'flow', 'deep', 'bubbles', 'drone', 'chimes', 'hum', 'heart', 'pressure', 'groan',
];

/** Layer gains (0..1) for zones 0..4 (chapters I..V). */
export const ZONE_MIX: ReadonlyArray<Readonly<Record<LayerName, number>>> = [
  { flow: 1.0, deep: 0.0, bubbles: 1.0, drone: 0.0, chimes: 0.0, hum: 0.0, heart: 0.0, pressure: 0.0, groan: 0.0 },
  { flow: 0.15, deep: 1.0, bubbles: 0.35, drone: 0.75, chimes: 0.0, hum: 0.0, heart: 0.0, pressure: 0.0, groan: 0.0 },
  { flow: 0.0, deep: 0.85, bubbles: 0.0, drone: 0.2, chimes: 1.0, hum: 0.0, heart: 0.0, pressure: 0.0, groan: 0.0 },
  { flow: 0.0, deep: 0.7, bubbles: 0.0, drone: 0.0, chimes: 0.0, hum: 1.0, heart: 0.0, pressure: 0.0, groan: 0.0 },
  { flow: 0.0, deep: 0.6, bubbles: 0.0, drone: 0.0, chimes: 0.0, hum: 0.12, heart: 0.55, pressure: 0.85, groan: 1.0 },
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
/** The hadal groan is rare: one every 9 to 18 seconds. */
export function nextGroanDelayMs(rand: number): number {
  return Math.round(9000 + Math.max(0, Math.min(1, rand)) * 9000);
}
/** Bubbles: a small cluster every 1.5 to 4.5 seconds. */
export function nextBubbleDelayMs(rand: number): number {
  return Math.round(1500 + Math.max(0, Math.min(1, rand)) * 3000);
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
  let bubbleTimer: number | null = null;
  let groanTimer: number | null = null;
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
    band.frequency.value = 700;
    band.Q.value = 0.7;
    band.Q.value = 0.45; // wide band: a soft surf rather than a hiss
    const swell = c.createGain();
    swell.gain.value = 1.0;
    const swellLfo = c.createOscillator();
    swellLfo.frequency.value = 0.085; // one wave about every 12 s
    const swellDepth = c.createGain();
    swellDepth.gain.value = 0.7;
    swellLfo.connect(swellDepth).connect(swell.gain);
    // the band opens a little as each wave rises, so it breathes
    const swellTone = c.createGain();
    swellTone.gain.value = 260;
    swellLfo.connect(swellTone).connect(band.frequency);
    noise.connect(band).connect(swell).connect(layers.flow);
    sources.push(noise, swellLfo);

    // deep: the same noise, muffled under a low-pass, like water heard
    // through the hull. The continuous bed for zones 2-5.
    const deepSrc = c.createBufferSource();
    deepSrc.buffer = buf;
    deepSrc.loop = true;
    deepSrc.playbackRate.value = 0.83; // decorrelate from the flow layer
    const deepLp = c.createBiquadFilter();
    deepLp.type = 'lowpass';
    deepLp.frequency.value = 420;
    deepLp.Q.value = 0.5;
    const deepOut = c.createGain();
    deepOut.gain.value = 0.42;
    const deepLfo = c.createOscillator();
    deepLfo.frequency.value = 0.05;
    const deepLfoDepth = c.createGain();
    deepLfoDepth.gain.value = 0.09;
    deepLfo.connect(deepLfoDepth).connect(deepOut.gain);
    deepSrc.connect(deepLp).connect(deepOut).connect(layers.deep);
    sources.push(deepSrc, deepLfo);

    // drone: three low partials under a low-pass.
    const droneLp = c.createBiquadFilter();
    droneLp.type = 'lowpass';
    // Upper partials (165, 220 Hz) and a higher cutoff keep the drone audible
    // on laptop speakers, which barely reproduce anything under ~100 Hz.
    droneLp.frequency.value = 650;
    const droneOut = c.createGain();
    droneOut.gain.value = 0.7;
    droneLp.connect(droneOut).connect(layers.drone);
    const droneParts: Array<[OscillatorType, number, number, number]> = [
      ['sine', 55, 0, 0.6], ['triangle', 82.5, 7, 0.35], ['sine', 110.2, -5, 0.3],
      ['triangle', 165, 3, 0.3], ['sine', 220.4, -4, 0.22],
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
    humLp.frequency.value = 340; // lets the overtones through for small speakers
    const humDrift = c.createGain();
    humDrift.gain.value = 0.2; // four partials now, so a lower level keeps it quiet
    const humLfo = c.createOscillator();
    humLfo.frequency.value = 0.045;
    const humLfoDepth = c.createGain();
    humLfoDepth.gain.value = 0.13;
    humLfo.connect(humLfoDepth).connect(humDrift.gain);
    humLp.connect(humDrift).connect(layers.hum);
    // 38/57 Hz is felt more than heard; 114.6/172 Hz overtones carry it on laptops.
    for (const [f, detune] of [[38, 0], [57.3, 4], [114.6, 6], [172, -3]] as const) {
      const o = c.createOscillator();
      o.type = 'sine';
      o.frequency.value = f;
      o.detune.value = detune;
      o.connect(humLp);
      sources.push(o);
    }
    sources.push(humLfo);

    // pressure (hadal): two close, slightly sour tones that beat against each
    // other about every 3 s, so the water itself seems to throb.
    const presLp = c.createBiquadFilter();
    presLp.type = 'lowpass';
    presLp.frequency.value = 900;
    const presOut = c.createGain();
    presOut.gain.value = 0.22;
    presLp.connect(presOut).connect(layers.pressure);
    for (const [type, f] of [['triangle', 146.8], ['triangle', 147.15], ['sine', 207.6]] as const) {
      const o = c.createOscillator();
      o.type = type;
      o.frequency.value = f;
      o.connect(presLp);
      sources.push(o);
    }

    for (const s of sources) s.start();
    return { bus, layers, sources };
  }

  function playChime(c: AudioContext, g: Graph): void {
    const t0 = c.currentTime + 0.02;
    const f = pickChimeFreq(Math.random());
    const env = c.createGain();
    env.gain.setValueAtTime(0, t0);
    env.gain.linearRampToValueAtTime(0.24, t0 + 0.02);
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
    // A soft overtone an octave up so the beat is audible on laptop speakers.
    const o2 = c.createOscillator();
    o2.type = 'sine';
    o2.frequency.setValueAtTime(128, t);
    o2.frequency.exponentialRampToValueAtTime(72, t + 0.2);
    const a2 = c.createGain();
    a2.gain.value = 0.45;
    o2.connect(a2).connect(env);
    o2.start(t);
    o2.stop(t + 0.35);
  }

  /** One soft bubble: a short sine that glides upward, like a bloop. */
  function bubble(c: AudioContext, g: Graph, t: number, f0: number, amp: number): void {
    const o = c.createOscillator();
    o.type = 'sine';
    const dur = 0.07 + Math.random() * 0.07;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f0 * 2.3, t + dur);
    const env = c.createGain();
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(amp, t + 0.006);
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.08);
    o.connect(env).connect(g.layers.bubbles);
    o.start(t);
    o.stop(t + dur + 0.1);
  }
  function scheduleBubbles(): void {
    const c = synth.ensure();
    if (running && graph && c && layerGains(zone).bubbles > AUDIBLE) {
      const n = 1 + Math.floor(Math.random() * 3);
      let t = c.currentTime + 0.02;
      for (let i = 0; i < n; i++) {
        bubble(c, graph, t, 320 + Math.random() * 420, 0.1 + Math.random() * 0.08);
        t += 0.06 + Math.random() * 0.14;
      }
    }
    bubbleTimer = window.setTimeout(scheduleBubbles, nextBubbleDelayMs(Math.random()));
  }

  /** A distant groan: a low, rough tone that sags in pitch over ~3.5 s. */
  function groan(c: AudioContext, g: Graph): void {
    const t0 = c.currentTime + 0.05;
    const dur = 3.2 + Math.random() * 1.2;
    const f0 = 62 + Math.random() * 14;
    const o = c.createOscillator();
    o.type = 'sawtooth'; // rich harmonics, so it is heard on small speakers
    o.frequency.setValueAtTime(f0, t0);
    o.frequency.linearRampToValueAtTime(f0 * 1.12, t0 + dur * 0.35);
    o.frequency.exponentialRampToValueAtTime(f0 * 0.7, t0 + dur);
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.Q.value = 4;
    lp.frequency.setValueAtTime(180, t0);
    lp.frequency.linearRampToValueAtTime(460, t0 + dur * 0.4);
    lp.frequency.linearRampToValueAtTime(160, t0 + dur);
    const env = c.createGain();
    env.gain.setValueAtTime(0, t0);
    env.gain.linearRampToValueAtTime(0.3, t0 + dur * 0.3);
    env.gain.linearRampToValueAtTime(0.0, t0 + dur);
    o.connect(lp).connect(env).connect(g.layers.groan);
    o.start(t0);
    o.stop(t0 + dur + 0.1);
  }
  function scheduleGroan(): void {
    const c = synth.ensure();
    if (running && graph && c && layerGains(zone).groan > AUDIBLE) groan(c, graph);
    groanTimer = window.setTimeout(scheduleGroan, nextGroanDelayMs(Math.random()));
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
    if (bubbleTimer !== null) clearTimeout(bubbleTimer);
    if (groanTimer !== null) clearTimeout(groanTimer);
    chimeTimer = heartTimer = bubbleTimer = groanTimer = null;
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
      if (bubbleTimer === null) bubbleTimer = window.setTimeout(scheduleBubbles, 1200);
      if (groanTimer === null) groanTimer = window.setTimeout(scheduleGroan, 2500);
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
