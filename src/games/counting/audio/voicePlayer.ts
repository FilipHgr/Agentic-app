/**
 * Přehrávač nahrávek průvodce nastavením (#51) přes Web Audio, stejnou cestou
 * jako tóny hry (`tonePlayer.ts`), takže se v tichém režimu chová stejně.
 * Kdy co stáhnout a přehrát, rozhoduje `src/games/counting/logic/guideVoice.ts`; přehrávač
 * jen poslouchá. Dvě věty nikdy nehrají přes sebe a každá chyba je ticho.
 */

import { guideVoiceUrl } from '../logic/guideVoice';
import type { GuideLineId } from '../logic/guideScript';
import { sharedAudioContext } from '../../../shared/audio/sharedAudio';
import type { AudioNodeLike } from '../../../shared/audio/tonePlayer';
import { currentLanguage } from '../../../shared/texts/languages';
import type { Language } from '../../../shared/texts/languages';

export interface AudioBufferLike {
  readonly duration: number;
}

export interface AudioBufferSourceLike extends AudioNodeLike {
  buffer: AudioBufferLike | null;
  onended: ((event: Event) => unknown) | null;
  start(when?: number, offset?: number): void;
  stop(when?: number): void;
}

export interface VoiceAudioContextLike {
  readonly currentTime: number;
  readonly destination: AudioNodeLike;
  readonly state: string;
  resume(): Promise<void>;
  decodeAudioData(data: ArrayBuffer): Promise<AudioBufferLike>;
  createBufferSource(): AudioBufferSourceLike;
  /** Uvolní zvuk prohlížeče; Safari má počet kontextů omezený. */
  close?(): Promise<void>;
}

export type VoiceFetch = (
  url: string,
) => Promise<{ readonly ok: boolean; arrayBuffer(): Promise<ArrayBuffer> }>;

export interface VoicePlayer {
  /** Zapne zvuk prohlížeče; volá se při prvním ťuknutí. */
  unlock(): void;
  /** Stáhne a připraví nahrávku; výsledek ohlásí přes `events`. */
  load(id: GuideLineId): void;
  /** Zastaví rozehranou větu a pustí tuto od začátku; nenačtená je ticho. */
  play(id: GuideLineId): void;
  stop(): void;
  /** Po zavření průvodce: zastaví hlas a uvolní zvuk prohlížeče. */
  dispose(): void;
}

export interface VoicePlayerOptions {
  readonly fetch: VoiceFetch;
  /** Vrátí zvukový kontext, nebo `undefined`, když ho prohlížeč nemá. Smí vyhodit výjimku. */
  readonly createContext: () => VoiceAudioContextLike | undefined;
  readonly events: {
    onLoaded(id: GuideLineId): void;
    onLoadFailed(id: GuideLineId): void;
  };
  /** Jazyk nahrávek (#65); bez zadání aktuální jazyk. Jiné jazyky se nestahují. */
  readonly language?: Language;
}

export function createVoicePlayer(options: VoicePlayerOptions): VoicePlayer {
  const language = options.language ?? currentLanguage();
  let context: VoiceAudioContextLike | undefined;
  let contextFailed = false;
  const buffers = new Map<GuideLineId, AudioBufferLike>();
  let playing: AudioBufferSourceLike | null = null;

  function getContext(): VoiceAudioContextLike | undefined {
    if (context === undefined && !contextFailed) {
      try {
        context = options.createContext();
      } catch {
        // Prohlížeč bez Web Audio: průvodce bude potichu.
        contextFailed = true;
      }
    }
    return context;
  }

  function resume(audio: VoiceAudioContextLike): void {
    if (audio.state === 'running') {
      return;
    }
    audio.resume().catch(() => {
      // Prohlížeč zvuk nepovolil: věty budou potichu, průvodce jde dál.
    });
  }

  function stopPlaying(): void {
    const source = playing;
    playing = null;
    if (source === null) {
      return;
    }
    try {
      source.stop();
    } catch {
      // Zdroj už skončil sám, není co zastavovat.
    }
  }

  async function download(id: GuideLineId): Promise<AudioBufferLike> {
    const audio = getContext();
    if (audio === undefined) {
      throw new Error('bez zvuku');
    }
    const response = await options.fetch(guideVoiceUrl(id, language));
    if (!response.ok) {
      throw new Error('nahrávka chybí');
    }
    return audio.decodeAudioData(await response.arrayBuffer());
  }

  return {
    unlock(): void {
      const audio = getContext();
      if (audio !== undefined) {
        resume(audio);
      }
    },

    load(id: GuideLineId): void {
      download(id).then(
        (buffer) => {
          buffers.set(id, buffer);
          options.events.onLoaded(id);
        },
        () => options.events.onLoadFailed(id),
      );
    },

    play(id: GuideLineId): void {
      stopPlaying();
      const audio = getContext();
      const buffer = buffers.get(id);
      if (audio === undefined || buffer === undefined) {
        return;
      }
      // Safari může po návratu z pozadí zvuk znovu pozastavit.
      resume(audio);
      try {
        const source = audio.createBufferSource();
        source.buffer = buffer;
        source.connect(audio.destination);
        source.onended = () => {
          if (playing === source) {
            playing = null;
          }
        };
        source.start(audio.currentTime, 0);
        playing = source;
      } catch {
        // Větu nešlo spustit: ticho, průvodce funguje dál.
        playing = null;
      }
    },

    stop(): void {
      stopPlaying();
    },

    dispose(): void {
      stopPlaying();
      buffers.clear();
      const audio = context;
      context = undefined;
      contextFailed = true;
      audio?.close?.().catch(() => {
        // Zvuk už je zavřený nebo ho prohlížeč neumí zavřít: nic se neděje.
      });
    },
  };
}

/**
 * Společný zvukový kontext stránky (#67 AC6), který odemklo už ťuknutí
 * v menu. Je bez `close`, aby zavření průvodce nevypnulo zvuk celé stránky.
 */
export function createSharedVoiceContext(): VoiceAudioContextLike | undefined {
  const audio = sharedAudioContext();
  if (audio === undefined) {
    return undefined;
  }
  return {
    get currentTime() {
      return audio.currentTime;
    },
    get destination() {
      return audio.destination;
    },
    get state() {
      return audio.state;
    },
    resume: () => audio.resume(),
    decodeAudioData: (data) => audio.decodeAudioData(data),
    createBufferSource: () => audio.createBufferSource(),
  };
}
