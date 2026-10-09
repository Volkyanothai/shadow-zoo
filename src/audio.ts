import type { AttackId, CombatEvent } from './types';

type SoundLane = 'music' | 'effect';
interface Voice {
  source: AudioScheduledSourceNode;
  nodes: AudioNode[];
  lane: SoundLane;
}

/** Original arcade sounds made entirely with Web Audio; no audio assets are fetched. */
export class ArcadeAudio {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private noise: AudioBuffer | null = null;
  private voices = new Set<Voice>();
  private lastEvents = new Map<string, number>();
  private muted = false;
  private unavailable = false;
  private destroyed = false;
  private fighting = false;
  private nextBeat = 0;
  private beat = 0;

  private readonly visibilityChanged = (): void => {
    if (!this.context || this.destroyed) return;
    if (document.hidden) {
      this.stopVoices();
      this.nextBeat = 0;
      void this.context.suspend().catch(() => undefined);
    } else if (!this.muted) {
      this.nextBeat = 0;
      void this.context.resume().catch(() => undefined);
    }
  };

  constructor() {
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.visibilityChanged);
    }
  }

  /** Call from a pointer/key gesture, before sending the first game event. */
  unlock(): void {
    if (this.destroyed || this.unavailable || typeof window === 'undefined') return;
    try {
      if (!this.context) {
        const AudioContextClass = window.AudioContext ??
          (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AudioContextClass) {
          this.unavailable = true;
          return;
        }
        const context = new AudioContextClass();
        const master = context.createGain();
        const compressor = context.createDynamicsCompressor();
        master.gain.value = this.muted ? 0 : 0.32;
        compressor.threshold.value = -18;
        compressor.knee.value = 18;
        compressor.ratio.value = 3;
        compressor.attack.value = 0.005;
        compressor.release.value = 0.16;
        master.connect(compressor);
        compressor.connect(context.destination);
        this.context = context;
        this.master = master;
        this.compressor = compressor;
        const noise = context.createBuffer(1, Math.ceil(context.sampleRate), context.sampleRate);
        const samples = noise.getChannelData(0);
        for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
        this.noise = noise;
      }
      if (!this.muted && !document.hidden) {
        void this.context.resume().catch(() => undefined);
      }
    } catch {
      // Sound is an enhancement: a missing or blocked audio backend cannot stop play.
      this.unavailable = true;
      void this.context?.close().catch(() => undefined);
      this.context = null;
      this.master = null;
      this.compressor = null;
      this.noise = null;
    }
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    this.nextBeat = 0;
    if (!this.context || !this.master || this.destroyed) return;
    const now = this.context.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setValueAtTime(muted ? 0 : 0.32, now);
    if (muted) {
      this.stopVoices();
    } else if (!document.hidden) {
      void this.context.resume().catch(() => undefined);
    }
  }

  play(event: CombatEvent): void {
    const context = this.context;
    if (!this.ready() || !context) return;
    const now = context.currentTime;
    const key = `${event.type}:${event.fighter}`;
    const minimumGap = event.type === 'hit' || event.type === 'block' ? 0.045 : 0.075;
    if (now - (this.lastEvents.get(key) ?? -Infinity) < minimumGap) return;
    this.lastEvents.set(key, now);
    const heavy = this.attackWeight(event.attack);
    const start = now + 0.005;

    switch (event.type) {
      case 'attack':
        this.noiseBurst(start, 0.045 + heavy * 0.014, 0.025, 1250, 'highpass');
        break;
      case 'hit': {
        const impact = Math.min(1.8, heavy + Math.max(0, (event.amount ?? 0) - 10) / 40);
        this.tone(start, 0.1 + impact * 0.035, 170 - impact * 20, 'triangle', 0.16, 45);
        this.noiseBurst(start, 0.09 + impact * 0.025, 0.13, 2200, 'lowpass');
        if (event.attack?.endsWith('k')) {
          this.tone(start, 0.085, 85, 'sine', 0.1, 35);
        }
        break;
      }
      case 'block':
        this.tone(start, 0.11, 930, 'square', 0.035, 580);
        this.tone(start, 0.075, 1420, 'triangle', 0.065, 1120);
        this.noiseBurst(start, 0.055, 0.045, 3000, 'highpass');
        break;
      case 'special':
        this.tone(start, 0.28, 190, 'sawtooth', 0.055, 820);
        this.tone(start + 0.045, 0.25, 390, 'triangle', 0.08, 1100);
        this.noiseBurst(start, 0.24, 0.045, 1100, 'bandpass');
        break;
      case 'super':
        [130.81, 196, 261.63, 392].forEach((note, index) => {
          this.tone(start + index * 0.065, 0.35, note, 'square', 0.055, note * 2);
        });
        this.tone(start, 0.55, 65, 'sine', 0.16, 38);
        this.noiseBurst(start + 0.19, 0.3, 0.09, 1600, 'lowpass');
        break;
      case 'round':
        this.tone(start, 0.12, 523.25, 'square', 0.055);
        this.tone(start + 0.14, 0.16, 659.25, 'triangle', 0.09);
        break;
      case 'start':
        [392, 523.25, 783.99].forEach((note, index) => {
          this.tone(start + index * 0.085, 0.2, note, 'square', 0.065);
        });
        this.tone(start + 0.17, 0.28, 130.81, 'triangle', 0.12);
        break;
      case 'ko':
        this.stopVoices('music');
        this.tone(start, 0.75, 190, 'triangle', 0.16, 34);
        this.noiseBurst(start, 0.45, 0.1, 650, 'lowpass');
        [392, 329.63, 261.63].forEach((note, index) => {
          this.tone(start + 0.22 + index * 0.14, 0.26, note, 'square', 0.045);
        });
        break;
    }
  }

  /** A quiet, original arcade groove, scheduled just ahead of the game loop. */
  tick(_frame: number, fighting: boolean): void {
    if (!fighting) {
      if (this.fighting) this.stopVoices('music');
      this.fighting = false;
      this.nextBeat = 0;
      return;
    }
    if (!this.fighting) {
      this.fighting = true;
      this.beat = 0;
      this.nextBeat = 0;
    }
    if (!this.ready() || !this.context) return;
    const now = this.context.currentTime;
    if (this.nextBeat < now) this.nextBeat = now + 0.025;
    while (this.nextBeat < now + 0.1) {
      this.musicBeat(this.nextBeat, this.beat++);
      this.nextBeat += 0.25;
    }
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.visibilityChanged);
    }
    this.stopVoices();
    this.master?.disconnect();
    this.compressor?.disconnect();
    void this.context?.close().catch(() => undefined);
    this.context = null;
    this.master = null;
    this.compressor = null;
    this.noise = null;
    this.lastEvents.clear();
  }

  private ready(): boolean {
    return !this.destroyed && !this.muted && !this.unavailable &&
      this.context?.state === 'running' && !document.hidden;
  }

  private attackWeight(attack?: AttackId): number {
    if (attack === 'super') return 1.6;
    if (attack === 'special1' || attack === 'special2') return 1.35;
    if (attack?.startsWith('h')) return 1.25;
    if (attack?.startsWith('m')) return 0.95;
    return 0.65;
  }

  private musicBeat(time: number, beat: number): void {
    const step = beat % 16;
    const bass = [73.42, 73.42, 87.31, 65.41][Math.floor(step / 4)];
    if (step % 2 === 0) {
      this.tone(time, 0.2, bass, 'triangle', 0.037, bass * 0.985, 'music');
      this.tone(time, 0.11, 110, 'sine', 0.055, 37, 'music');
    }
    this.noiseBurst(time, 0.035, 0.01, 6500, 'highpass', 'music');
    if (step % 4 === 2) this.noiseBurst(time, 0.095, 0.024, 1900, 'bandpass', 'music');
    const melody = [293.66, 349.23, 440, 349.23, 261.63, 293.66, 349.23, 261.63];
    if (step % 2 === 1) {
      this.tone(time, 0.13, melody[Math.floor(step / 2)], 'square', 0.013, undefined, 'music');
    }
  }

  private tone(time: number, duration: number, frequency: number, type: OscillatorType,
    volume: number, endFrequency?: number, lane: SoundLane = 'effect'): void {
    if (!this.context || !this.master || this.voices.size >= 64) return;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, time);
    if (endFrequency !== undefined) {
      oscillator.frequency.exponentialRampToValueAtTime(endFrequency, time + duration);
    }
    this.envelope(gain, time, duration, volume);
    oscillator.connect(gain);
    gain.connect(this.master);
    this.track(oscillator, [gain], lane);
    oscillator.start(time);
    oscillator.stop(time + duration + 0.015);
  }

  private noiseBurst(time: number, duration: number, volume: number, frequency: number,
    filterType: BiquadFilterType, lane: SoundLane = 'effect'): void {
    if (!this.context || !this.master || !this.noise || this.voices.size >= 64) return;
    const source = this.context.createBufferSource();
    const gain = this.context.createGain();
    const filter = this.context.createBiquadFilter();
    source.buffer = this.noise;
    filter.type = filterType;
    filter.frequency.value = frequency;
    filter.Q.value = 0.7;
    this.envelope(gain, time, duration, volume);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    this.track(source, [filter, gain], lane);
    source.start(time);
    source.stop(time + duration + 0.015);
  }

  private envelope(gain: GainNode, time: number, duration: number, volume: number): void {
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(volume, time + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
  }

  private track(source: AudioScheduledSourceNode, nodes: AudioNode[], lane: SoundLane): void {
    const voice: Voice = { source, nodes, lane };
    this.voices.add(voice);
    source.onended = () => this.release(voice);
  }

  private release(voice: Voice): void {
    if (!this.voices.delete(voice)) return;
    voice.source.disconnect();
    for (const node of voice.nodes) node.disconnect();
  }

  private stopVoices(lane?: SoundLane): void {
    for (const voice of this.voices) {
      if (lane !== undefined && voice.lane !== lane) continue;
      try { voice.source.stop(); } catch { /* Already stopped by its envelope. */ }
      this.release(voice);
    }
  }
}
