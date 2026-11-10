/**
 * Přehrávání tónů přes Web Audio. Prohlížečové API je schované za malá
 * rozhraní, aby šlo chování ověřit v testech s napodobeným přehrávačem.
 */

/** Jeden tón zvuku. Časy jsou v sekundách od chvíle ťuknutí. */
export interface Tone {
  readonly frequencyHz: number;
  readonly startSeconds: number;
  readonly durationSeconds: number;
  /** Hlasitost od 0 do 1. */
  readonly volume: number;
}

/** Nejtišší hlasitost, na kterou tón doznívá (exponenciální náběh nesmí na 0). */
const SILENT_VOLUME = 0.0001;

/** Krátký náběh hlasitosti, aby tón nelupl. */
const FADE_IN_SECONDS = 0.01;

export interface AudioParamLike {
  setValueAtTime(value: number, time: number): unknown;
  linearRampToValueAtTime(value: number, time: number): unknown;
  exponentialRampToValueAtTime(value: number, time: number): unknown;
}

export interface AudioNodeLike {
  connect(destination: AudioNodeLike): unknown;
}

export interface OscillatorLike extends AudioNodeLike {
  readonly frequency: AudioParamLike;
  onended: ((event: Event) => unknown) | null;
  start(time: number): void;
  stop(time?: number): void;
}

export interface GainLike extends AudioNodeLike {
  readonly gain: AudioParamLike;
}

export interface AudioContextLike {
  readonly currentTime: number;
  readonly destination: AudioNodeLike;
  readonly state: string;
  resume(): Promise<void>;
  createOscillator(): OscillatorLike;
  createGain(): GainLike;
}

export interface TonePlayer {
  /** Zahraje tóny hned teď. Nikdy nevyhodí výjimku. */
  play(tones: readonly Tone[]): void;
  /** Hned ztiší všechno, co hraje (odchod z hry, #68). Nikdy nevyhodí výjimku. */
  stopAll(): void;
}

/**
 * Vytvoří přehrávač. Kontext se vytvoří až při prvním přehrání, protože
 * Safari povolí zvuk jen v reakci na dotyk hráče.
 *
 * @param createContext Vrátí zvukový kontext, nebo `undefined`, když ho
 *   prohlížeč nemá. Smí i vyhodit výjimku.
 */
export function createTonePlayer(createContext: () => AudioContextLike | undefined): TonePlayer {
  let context: AudioContextLike | undefined;
  let soundIsBroken = false;
  let playingOscillators: OscillatorLike[] = [];

  function getContext(): AudioContextLike | undefined {
    context ??= createContext();
    return context;
  }

  function stopPlayingSound(): void {
    for (const oscillator of playingOscillators) {
      oscillator.stop();
    }
    playingOscillators = [];
  }

  function stopAll(): void {
    try {
      stopPlayingSound();
    } catch {
      // Tón už skončil nebo prohlížeč zastavení odmítl: je ticho tak jako tak.
      playingOscillators = [];
    }
  }

  function scheduleTone(audio: AudioContextLike, tone: Tone, now: number): void {
    const start = now + tone.startSeconds;
    const end = start + tone.durationSeconds;

    const oscillator = audio.createOscillator();
    const gain = audio.createGain();

    oscillator.frequency.setValueAtTime(tone.frequencyHz, start);
    gain.gain.setValueAtTime(SILENT_VOLUME, start);
    gain.gain.linearRampToValueAtTime(tone.volume, start + FADE_IN_SECONDS);
    gain.gain.exponentialRampToValueAtTime(SILENT_VOLUME, end);

    oscillator.connect(gain);
    gain.connect(audio.destination);

    oscillator.onended = () => {
      playingOscillators = playingOscillators.filter((playing) => playing !== oscillator);
    };
    playingOscillators.push(oscillator);

    oscillator.start(start);
    oscillator.stop(end);
  }

  function play(tones: readonly Tone[]): void {
    if (soundIsBroken) {
      return;
    }

    try {
      const audio = getContext();
      if (!audio) {
        return;
      }

      if (audio.state === 'suspended') {
        audio.resume().catch(() => {
          soundIsBroken = true;
        });
      }

      // Nový zvuk přeruší předchozí, aby se při rychlém ťukání nevrstvily.
      stopPlayingSound();

      const now = audio.currentTime;
      for (const tone of tones) {
        scheduleTone(audio, tone, now);
      }
    } catch {
      // Zvuk je jen doplněk. Když prohlížeč selže, hra pokračuje potichu
      // a už se o zvuk nepokouší, aby hráč nikdy neviděl chybu.
      soundIsBroken = true;
    }
  }

  return { play, stopAll };
}

/** Zvukový kontext prohlížeče, nebo `undefined`, když ho prohlížeč nemá. */
export function createBrowserAudioContext(): AudioContextLike | undefined {
  if (typeof window === 'undefined' || typeof window.AudioContext !== 'function') {
    return undefined;
  }

  return new window.AudioContext();
}
