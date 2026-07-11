export type SoundEffect = 'tap' | 'dig' | 'find' | 'rock' | 'cook' | 'win';

type AudioContextConstructor = typeof AudioContext;

interface AudioWindow extends Window {
  webkitAudioContext?: AudioContextConstructor;
}

/**
 * Small asset-free Web Audio sound service.
 *
 * Browsers require an interaction before AudioContext playback, so `play` is
 * intentionally tolerant of unlock failures. The game remains fully usable
 * when audio is unavailable or disabled.
 */
export class Soundscape {
  #context: AudioContext | null = null;

  public constructor(private enabled = true) {}

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  public async unlock(): Promise<void> {
    if (!this.enabled || typeof window === 'undefined') return;

    const audioWindow = window as AudioWindow;
    const AudioContextClass = window.AudioContext ?? audioWindow.webkitAudioContext;
    if (!AudioContextClass) return;

    this.#context ??= new AudioContextClass();
    if (this.#context.state === 'suspended') {
      await this.#context.resume();
    }
  }

  public play(effect: SoundEffect): void {
    if (!this.enabled) return;

    void this.unlock()
      .then(() => {
        if (!this.#context) return;
        const now = this.#context.currentTime;

        switch (effect) {
          case 'tap':
            this.#tone(420, 0.045, 'sine', 0.045, now);
            break;
          case 'dig':
            this.#noise(0.095, 0.12, now, 800);
            this.#tone(158, 0.075, 'triangle', 0.075, now);
            break;
          case 'find':
            this.#tone(680, 0.07, 'sine', 0.07, now);
            this.#tone(980, 0.14, 'sine', 0.06, now + 0.075);
            break;
          case 'rock':
            this.#noise(0.065, 0.08, now, 2300);
            this.#tone(110, 0.09, 'square', 0.055, now);
            break;
          case 'cook':
            this.#noise(0.18, 0.08, now, 1450);
            this.#tone(310, 0.1, 'triangle', 0.045, now + 0.04);
            this.#tone(430, 0.12, 'triangle', 0.04, now + 0.13);
            break;
          case 'win':
            [523, 659, 784, 1047].forEach((frequency, index) => {
              this.#tone(frequency, 0.15, 'sine', 0.06, now + index * 0.085);
            });
            break;
        }
      })
      .catch(() => {
        // Autoplay restrictions and unavailable hardware should not disrupt play.
      });
  }

  #tone(
    frequency: number,
    duration: number,
    type: OscillatorType,
    volume: number,
    start: number,
  ): void {
    if (!this.#context) return;

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

  #noise(duration: number, volume: number, start: number, cutoff: number): void {
    if (!this.#context) return;

    const frameCount = Math.max(1, Math.floor(this.#context.sampleRate * duration));
    const buffer = this.#context.createBuffer(1, frameCount, this.#context.sampleRate);
    const channel = buffer.getChannelData(0);
    for (let index = 0; index < frameCount; index += 1) {
      channel[index] = (Math.random() * 2 - 1) * (1 - index / frameCount);
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
