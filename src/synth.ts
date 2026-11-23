/**
 * Small procedural Web Audio helpers. No audio files: everything here is
 * built from oscillators and filtered noise. The AudioContext is created
 * lazily and only after a user gesture (the sound toggle or START DESCENT),
 * because browsers block it before that.
 */

type AudioContextCtor = typeof AudioContext;

export interface Synth {
  /** Create/resume the context. Call from a user gesture. Returns null if unsupported. */
  ensure(): AudioContext | null;
  /** The shared output bus (master gain), or null before ensure(). */
  output(): GainNode | null;
  /** A slow, quiet rope-and-timber creak of the cable, about 2 seconds. */
  creak(volume: number): void;
  /** Silence everything and release the context. */
  close(): void;
}

export function createSynth(): Synth {
  let ctx: AudioContext | null = null;
  let master: GainNode | null = null;

  function ensure(): AudioContext | null {
    if (ctx) {
      if (ctx.state === 'suspended') void ctx.resume();
      return ctx;
    }
    if (typeof window === 'undefined') return null;
    const Ctor: AudioContextCtor | undefined =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioContextCtor }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = 1;
    master.connect(ctx.destination);
    return ctx;
  }

  function creak(volume: number): void {
    const c = ensure();
    if (!c || !master) return;
    const t0 = c.currentTime + 0.02;
    const dur = 2.2;

    // A low sawtooth whose pitch wobbles unevenly, like a loaded rope.
    const osc = c.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(74, t0);
    osc.frequency.linearRampToValueAtTime(96, t0 + 0.5);
    osc.frequency.linearRampToValueAtTime(68, t0 + 1.1);
    osc.frequency.linearRampToValueAtTime(88, t0 + 1.6);
    osc.frequency.linearRampToValueAtTime(70, t0 + dur);

    // Narrow band-pass keeps it a creak rather than a buzz.
    const band = c.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.setValueAtTime(420, t0);
    band.frequency.linearRampToValueAtTime(780, t0 + 0.6);
    band.frequency.linearRampToValueAtTime(380, t0 + dur);
    band.Q.value = 9;

    // Stuttering amplitude: three soft strains, the way timber complains.
    const amp = c.createGain();
    amp.gain.setValueAtTime(0, t0);
    const strains: Array<[number, number]> = [
      [0.2, 1], [0.55, 0.15], [0.8, 0.8], [1.2, 0.1], [1.45, 0.6], [2.0, 0],
    ];
    for (const [t, k] of strains) amp.gain.linearRampToValueAtTime(volume * k, t0 + t);

    osc.connect(band).connect(amp).connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  return {
    ensure,
    output: () => master,
    creak,
    close(): void {
      if (ctx) void ctx.close();
      ctx = null;
      master = null;
    },
  };
}
