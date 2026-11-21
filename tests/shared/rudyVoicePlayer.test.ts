import { describe, expect, it } from 'vitest';

import { createRudyVoicePlayer } from '../../src/shared/audio/rudyVoicePlayer';
import type {
  RudyAudioContextLike,
  RudyAudioSourceLike,
  RudyVoiceFetch,
} from '../../src/shared/audio/rudyVoicePlayer';

/**
 * Testy k #171 AC3 a AC5 pro přehrávač replik pandy Rudyho: délka
 * nahrávky pro okno, přehrání, zastavení a chyby jako ticho. Web Audio
 * i síť jsou napodobené.
 */

const URL_CS = 'voice/cs/menu/rudy-greeting.mp3';

interface FakeAudio extends RudyAudioContextLike {
  readonly sources: Array<RudyAudioSourceLike & { started: number; stopped: number }>;
}

function fakeAudio(durationSeconds = 3.3): FakeAudio {
  const sources: FakeAudio['sources'] = [];
  return {
    currentTime: 0,
    destination: { connect: () => undefined },
    sources,
    decodeAudioData: () => Promise.resolve({ duration: durationSeconds }),
    createBufferSource: () => {
      const source = {
        buffer: null,
        onended: null,
        started: 0,
        stopped: 0,
        connect: () => undefined,
        start() {
          source.started += 1;
        },
        stop() {
          source.stopped += 1;
        },
      };
      sources.push(source);
      return source;
    },
  };
}

const okFetch: RudyVoiceFetch = () =>
  Promise.resolve({ ok: true, arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)) });

describe('#171: přehrávač replik pandy', () => {
  it('stažená nahrávka vrátí svou délku v ms, okno ji dostane jako délku repliky', async () => {
    const player = createRudyVoicePlayer({ fetch: okFetch, context: () => fakeAudio(3.55) });
    await expect(player.load(URL_CS)).resolves.toBeCloseTo(3550);
  });

  it('stahuje nahrávku jen z adresy hry, kterou dostal', async () => {
    const urls: string[] = [];
    const player = createRudyVoicePlayer({
      fetch: (url) => {
        urls.push(url);
        return okFetch(url);
      },
      context: () => fakeAudio(),
    });
    await player.load(URL_CS);
    expect(urls).toEqual([URL_CS]);
  });

  it('připravená nahrávka po pokynu zazní od začátku', async () => {
    const audio = fakeAudio();
    const player = createRudyVoicePlayer({ fetch: okFetch, context: () => audio });
    await player.load(URL_CS);
    player.play(URL_CS);
    expect(audio.sources).toHaveLength(1);
    expect(audio.sources[0]?.started).toBe(1);
  });

  it('zastavení utne hrající repliku', async () => {
    const audio = fakeAudio();
    const player = createRudyVoicePlayer({ fetch: okFetch, context: () => audio });
    await player.load(URL_CS);
    player.play(URL_CS);
    player.stop();
    expect(audio.sources[0]?.stopped).toBe(1);
  });

  it('dvě repliky nehrají přes sebe: nová zastaví předchozí', async () => {
    const audio = fakeAudio();
    const player = createRudyVoicePlayer({ fetch: okFetch, context: () => audio });
    await player.load(URL_CS);
    player.play(URL_CS);
    player.play(URL_CS);
    expect(audio.sources[0]?.stopped).toBe(1);
    expect(audio.sources[1]?.started).toBe(1);
  });

  it('nestažená nahrávka je ticho a nic nevyhodí', () => {
    const audio = fakeAudio();
    const player = createRudyVoicePlayer({ fetch: okFetch, context: () => audio });
    expect(() => player.play(URL_CS)).not.toThrow();
    expect(audio.sources).toHaveLength(0);
  });

  it('chybějící nahrávka na serveru stažení zamítne (okno pak bez hlasu)', async () => {
    const player = createRudyVoicePlayer({
      fetch: () => Promise.resolve({ ok: false, arrayBuffer: () => Promise.reject(new Error()) }),
      context: () => fakeAudio(),
    });
    await expect(player.load(URL_CS)).rejects.toThrow();
  });

  it('prohlížeč bez Web Audio stažení zamítne a přehrání je ticho', async () => {
    const player = createRudyVoicePlayer({ fetch: okFetch, context: () => undefined });
    await expect(player.load(URL_CS)).rejects.toThrow();
    expect(() => player.play(URL_CS)).not.toThrow();
  });

  it('zastavení bez hrající repliky nic nevyhodí', () => {
    const player = createRudyVoicePlayer({ fetch: okFetch, context: () => fakeAudio() });
    expect(() => player.stop()).not.toThrow();
  });
});
