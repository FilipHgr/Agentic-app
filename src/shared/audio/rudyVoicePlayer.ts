/**
 * Přehrávač replik pandy Rudyho (#171) přes Web Audio, ve společném
 * zvukovém kontextu stránky (`sharedAudio.ts`), který odemklo ťuknutí
 * v menu. Kdy co stáhnout a přehrát, rozhoduje `logic/rudyVoice.ts`.
 * Dvě repliky nikdy nehrají přes sebe a každá chyba je ticho.
 */

import type { RudyVoicePlayer } from '../logic/rudyVoice';
import { sharedAudioContext } from './sharedAudio';
import type { AudioNodeLike } from './tonePlayer';

export interface RudyAudioBufferLike {
  readonly duration: number;
}

export interface RudyAudioSourceLike extends AudioNodeLike {
  buffer: RudyAudioBufferLike | null;
  onended: ((event: Event) => unknown) | null;
  start(when?: number, offset?: number): void;
  stop(when?: number): void;
}

export interface RudyAudioContextLike {
  readonly currentTime: number;
  readonly destination: AudioNodeLike;
  decodeAudioData(data: ArrayBuffer): Promise<RudyAudioBufferLike>;
  createBufferSource(): RudyAudioSourceLike;
}

export type RudyVoiceFetch = (
  url: string,
) => Promise<{ readonly ok: boolean; arrayBuffer(): Promise<ArrayBuffer> }>;

export interface RudyVoicePlayerOptions {
  readonly fetch: RudyVoiceFetch;
  /** Zvukový kontext, nebo `undefined`, když ho prohlížeč nemá. */
  readonly context: () => RudyAudioContextLike | undefined;
}

export function createRudyVoicePlayer(options: RudyVoicePlayerOptions): RudyVoicePlayer {
  const buffers = new Map<string, RudyAudioBufferLike>();
  let playing: RudyAudioSourceLike | null = null;

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

  return {
    async load(url) {
      const audio = options.context();
      if (audio === undefined) {
        throw new Error('bez zvuku');
      }
      const response = await options.fetch(url);
      if (!response.ok) {
        throw new Error('nahrávka chybí');
      }
      const buffer = await audio.decodeAudioData(await response.arrayBuffer());
      buffers.set(url, buffer);
      return buffer.duration * 1000;
    },

    play(url) {
      stopPlaying();
      const audio = options.context();
      const buffer = buffers.get(url);
      if (audio === undefined || buffer === undefined) {
        return;
      }
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
        // Repliku nešlo spustit: okno je bez hlasu, hra jde dál.
        playing = null;
      }
    },

    stop() {
      stopPlaying();
    },
  };
}

/** Přehrávač replik ve společném kontextu stránky, nahrávky stahuje z vlastního serveru hry. */
export function createSharedRudyVoicePlayer(): RudyVoicePlayer {
  return createRudyVoicePlayer({
    fetch: (url) => window.fetch(url),
    context: () => sharedAudioContext(),
  });
}
