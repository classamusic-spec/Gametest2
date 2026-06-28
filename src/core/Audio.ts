/**
 * Procedural WebAudio sound effects — no asset files.
 * Everything is synthesized from oscillators + noise so the whole game
 * stays self-contained. Call resume() from a user gesture before playing.
 */
export class SfxManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  enabled = true;

  /** Must be called from a user gesture (button click) to unlock audio. */
  resume() {
    if (!this.ctx) {
      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.35;
      this.master.connect(this.ctx.destination);
      this.noiseBuffer = this.makeNoise();
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
  }

  private makeNoise(): AudioBuffer {
    const ctx = this.ctx!;
    const len = ctx.sampleRate * 1.0;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  private get t(): number {
    return this.ctx!.currentTime;
  }

  /** A pitched oscillator blip with an exponential gain envelope. */
  private tone(
    type: OscillatorType,
    freq: number,
    dur: number,
    gain: number,
    freqEnd?: number,
    dest?: AudioNode,
  ) {
    if (!this.ctx || !this.enabled) return;
    const t = this.t;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (freqEnd !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), t + dur);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g);
    g.connect(dest ?? this.master!);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  /** A filtered noise burst (for shots, explosions, hits). */
  private noise(dur: number, gain: number, filterType: BiquadFilterType, freq: number, q = 1) {
    if (!this.ctx || !this.enabled || !this.noiseBuffer) return;
    const t = this.t;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.value = freq;
    filter.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(this.master!);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  // ---------- Game sounds ----------
  shoot() {
    // Punchy plasma "pew": noise crack + downward tonal zap.
    this.noise(0.08, 0.5, "bandpass", 1800, 1.2);
    this.tone("sawtooth", 880, 0.12, 0.25, 180);
    this.tone("square", 440, 0.07, 0.12, 120);
  }

  enemyShoot() {
    this.tone("square", 320, 0.18, 0.18, 90);
    this.noise(0.1, 0.15, "bandpass", 900, 1.5);
  }

  hit() {
    this.tone("triangle", 1400, 0.05, 0.18, 900);
  }

  kill() {
    this.tone("sawtooth", 520, 0.18, 0.22, 110);
    this.noise(0.18, 0.25, "lowpass", 1200);
  }

  explosion() {
    this.noise(0.55, 0.6, "lowpass", 700);
    this.tone("sine", 120, 0.5, 0.4, 40);
  }

  hurt() {
    this.tone("sine", 180, 0.22, 0.35, 70);
    this.noise(0.16, 0.2, "lowpass", 500);
  }

  reload() {
    this.tone("square", 220, 0.04, 0.12);
    window.setTimeout(() => this.tone("square", 320, 0.05, 0.12), 220);
    window.setTimeout(() => this.tone("square", 180, 0.05, 0.14), 520);
  }

  uiClick() {
    this.tone("square", 660, 0.06, 0.14, 880);
  }

  levelStart() {
    const notes = [392, 523, 659, 784];
    notes.forEach((f, i) => window.setTimeout(() => this.tone("triangle", f, 0.22, 0.2), i * 90));
  }

  victory() {
    const notes = [523, 659, 784, 1046, 1318];
    notes.forEach((f, i) => window.setTimeout(() => this.tone("triangle", f, 0.35, 0.22), i * 130));
  }

  bossRoar() {
    if (!this.ctx || !this.enabled) return;
    // Low growl with vibrato + noise rumble.
    const t = this.t;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    const lfo = this.ctx.createOscillator();
    const lfoGain = this.ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(90, t);
    osc.frequency.exponentialRampToValueAtTime(60, t + 1.2);
    lfo.frequency.value = 18;
    lfoGain.gain.value = 22;
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);
    g.gain.setValueAtTime(0.5, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.3);
    osc.connect(g);
    g.connect(this.master!);
    osc.start(t);
    lfo.start(t);
    osc.stop(t + 1.35);
    lfo.stop(t + 1.35);
    this.noise(1.0, 0.4, "lowpass", 400);
  }
}
