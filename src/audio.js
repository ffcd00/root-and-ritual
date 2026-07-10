/**
 * A tiny, asset-free sound layer. Sounds are synthesized in Web Audio so the
 * game works offline and does not need to fetch media files.
 */
export class Soundscape {
  #context = null;

  constructor() {
    this.enabled = true;
  }

  setEnabled(enabled) {
    this.enabled = Boolean(enabled);
  }

  async unlock() {
    if (!this.enabled || typeof window === 'undefined') return;

    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;

    if (!this.#context) this.#context = new AudioContext();
    if (this.#context.state === 'suspended') await this.#context.resume();
  }

  play(effect) {
    if (!this.enabled) return;

    this.unlock().then(() => {
      if (!this.#context) return;
      const now = this.#context.currentTime;
      const sounds = {
        tap: () => this.#tone(420, 0.045, 'sine', 0.045, now),
        dig: () => {
          this.#noise(0.095, 0.12, now, 800);
          this.#tone(158, 0.075, 'triangle', 0.075, now);
        },
        find: () => {
          this.#tone(680, 0.07, 'sine', 0.07, now);
          this.#tone(980, 0.14, 'sine', 0.06, now + 0.075);
        },
        rock: () => {
          this.#noise(0.065, 0.08, now, 2300);
          this.#tone(110, 0.09, 'square', 0.055, now);
        },
        cook: () => {
          this.#noise(0.18, 0.08, now, 1450);
          this.#tone(310, 0.1, 'triangle', 0.045, now + 0.04);
          this.#tone(430, 0.12, 'triangle', 0.04, now + 0.13);
        },
        win: () => [523, 659, 784, 1047].forEach((frequency, index) => {
          this.#tone(frequency, 0.15, 'sine', 0.06, now + index * 0.085);
        }),
      };

      sounds[effect]?.();
    }).catch(() => {
      // Browsers may block audio until a user gesture; the game remains usable.
    });
  }

  #tone(frequency, duration, type, volume, start) {
    const oscillator = this.#context.createOscillator();
    const gain = this.#context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain).connect(this.#context.destination);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.02);
  }

  #noise(duration, volume, start, cutoff) {
    const frames = Math.max(1, Math.floor(this.#context.sampleRate * duration));
    const buffer = this.#context.createBuffer(1, frames, this.#context.sampleRate);
    const channel = buffer.getChannelData(0);
    for (let index = 0; index < frames; index += 1) {
      channel[index] = (Math.random() * 2 - 1) * (1 - index / frames);
    }

    const source = this.#context.createBufferSource();
    const filter = this.#context.createBiquadFilter();
    const gain = this.#context.createGain();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(cutoff, start);
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    source.buffer = buffer;
    source.connect(filter).connect(gain).connect(this.#context.destination);
    source.start(start);
  }
}
