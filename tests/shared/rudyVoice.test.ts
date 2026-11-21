import { describe, expect, it } from 'vitest';

import { RUDY_WINDOW_TIMES, createRudyWindowModel } from '../../src/shared/logic/rudyWindow';
import { createRudyVoice, rudyVoiceOpening } from '../../src/shared/logic/rudyVoice';
import type { RudyVoicePlayer } from '../../src/shared/logic/rudyVoice';

/**
 * Testy k #171 AC3 a AC5: hlas pandy Rudyho v okně. Kdy se nahrávka
 * stáhne, kdy okno počká, jak dlouho je otevřené a kdy hlas zazní nebo
 * zmlkne. Přehrávač je napodobený, nic se nestahuje ani nehraje.
 */

const GREETING = 'voice/cs/counting/rudy-greeting.mp3';
const GREETING_EN = 'voice/en/counting/rudy-greeting.mp3';

interface FakePlayer extends RudyVoicePlayer {
  readonly loads: string[];
  readonly played: string[];
  stops: number;
  finish(url: string, durationMs: number): Promise<void>;
  fail(url: string): Promise<void>;
}

function fakePlayer(): FakePlayer {
  const waiting = new Map<string, { resolve: (ms: number) => void; reject: () => void }>();
  const player: FakePlayer = {
    loads: [],
    played: [],
    stops: 0,
    load(url) {
      player.loads.push(url);
      return new Promise<number>((resolve, reject) => {
        waiting.set(url, { resolve, reject: () => reject(new Error('nestaženo')) });
      });
    },
    play(url) {
      player.played.push(url);
    },
    stop() {
      player.stops += 1;
    },
    async finish(url, durationMs) {
      waiting.get(url)?.resolve(durationMs);
      await Promise.resolve();
    },
    async fail(url) {
      waiting.get(url)?.reject();
      await Promise.resolve();
      await Promise.resolve();
    },
  };
  return player;
}

function voiceWith(unlocked: { value: boolean } = { value: true }) {
  const player = fakePlayer();
  const voice = createRudyVoice({ player, isUnlocked: () => unlocked.value });
  return { player, voice, unlocked };
}

describe('#171 AC3: nahrávka začne s otevřením okna a okno má její délku', () => {
  it('s odemčeným zvukem se nahrávka repliky stáhne, už když hra o okno požádá', () => {
    const { player, voice } = voiceWith();
    voice.request(GREETING);
    expect(player.loads).toEqual([GREETING]);
  });

  it('dokud se nahrávka stahuje, okno čeká; po stažení se může otevřít', async () => {
    const { player, voice } = voiceWith();
    voice.request(GREETING);
    expect(voice.isSettled(GREETING)).toBe(false);
    await player.finish(GREETING, 3200);
    expect(voice.isSettled(GREETING)).toBe(true);
  });

  it('okno dostane délku nahrávky v ms', async () => {
    const { player, voice } = voiceWith();
    voice.request(GREETING);
    await player.finish(GREETING, 3552.6);
    expect(voice.lineFor(GREETING)).toEqual({ url: GREETING, lineMs: 3552.6 });
  });

  it('s otevřením okna zazní replika', async () => {
    const { player, voice } = voiceWith();
    voice.request(GREETING);
    await player.finish(GREETING, 3000);
    const line = voice.lineFor(GREETING);
    expect(line).not.toBeNull();
    if (line !== null) {
      voice.play(line);
    }
    expect(player.played).toEqual([GREETING]);
  });

  it('zavření okna (i ťuknutím) hlas zastaví', () => {
    const { player, voice } = voiceWith();
    voice.stop();
    expect(player.stops).toBe(1);
  });

  it('stažená nahrávka se pro další okno znovu nestahuje', async () => {
    const { player, voice } = voiceWith();
    voice.request(GREETING);
    await player.finish(GREETING, 3000);
    voice.request(GREETING);
    expect(player.loads).toEqual([GREETING]);
  });

  it('okno s délkou nahrávky se zavře nejvýš 0,3 s po jejím konci', () => {
    const lineMs = 3552;
    const model = createRudyWindowModel();
    model.use();
    model.loaded('idle');
    expect(model.open({ move: 'wave', lineMs }, 0).shown).toBe(true);
    expect(model.update(lineMs).closed).toBe(false);
    expect(model.update(lineMs + 300).closed).toBe(true);
    expect(RUDY_WINDOW_TIMES.closeAfterLineMs).toBeLessThanOrEqual(300);
  });
});

describe('#171 AC4: po změně jazyka další okno mluví novým jazykem', () => {
  it('další chvíle s anglickou adresou stáhne a pustí anglickou nahrávku', async () => {
    const { player, voice } = voiceWith();
    voice.request(GREETING);
    await player.finish(GREETING, 3000);
    voice.request(GREETING_EN);
    expect(player.loads).toEqual([GREETING, GREETING_EN]);
    expect(voice.lineFor(GREETING_EN)).toBeNull();
    await player.finish(GREETING_EN, 2600);
    expect(voice.lineFor(GREETING_EN)).toEqual({ url: GREETING_EN, lineMs: 2600 });
  });
});

describe('#171 AC5: bez odemčeného zvuku nebo nahrávky je okno bez hlasu', () => {
  it('bez odemčeného zvuku se nic nestahuje, okno nečeká a je bez hlasu (3,5 s)', () => {
    const { player, voice } = voiceWith({ value: false });
    voice.request(GREETING);
    expect(player.loads).toEqual([]);
    expect(voice.isSettled(GREETING)).toBe(true);
    expect(voice.lineFor(GREETING)).toBeNull();
    const model = createRudyWindowModel();
    model.use();
    model.loaded('idle');
    model.open({ move: 'wave' }, 0);
    expect(model.update(RUDY_WINDOW_TIMES.silentOpenMs - 1).closed).toBe(false);
    expect(model.update(RUDY_WINDOW_TIMES.silentOpenMs).closed).toBe(true);
    expect(RUDY_WINDOW_TIMES.silentOpenMs).toBe(3500);
  });

  it('zvuk zamčený při stahování, ale odemčený při otevření: okno nečeká a je bez hlasu', () => {
    const unlocked = { value: false };
    const { voice } = voiceWith(unlocked);
    voice.request(GREETING);
    unlocked.value = true;
    expect(voice.isSettled(GREETING)).toBe(true);
    expect(voice.lineFor(GREETING)).toBeNull();
  });

  it('nahrávka, která se nestáhne, okno nezdrží a okno je bez hlasu', async () => {
    const { player, voice } = voiceWith();
    voice.request(GREETING);
    await player.fail(GREETING);
    expect(voice.isSettled(GREETING)).toBe(true);
    expect(voice.lineFor(GREETING)).toBeNull();
  });

  it('nepovedená nahrávka se při další chvíli zkusí stáhnout znovu', async () => {
    const { player, voice } = voiceWith();
    voice.request(GREETING);
    await player.fail(GREETING);
    voice.request(GREETING);
    expect(player.loads).toEqual([GREETING, GREETING]);
  });

  it('nahrávka s nesmyslnou délkou je jako nestažená: okno bez hlasu', async () => {
    const { player, voice } = voiceWith();
    voice.request(GREETING);
    await player.finish(GREETING, Number.NaN);
    expect(voice.lineFor(GREETING)).toBeNull();
  });

  it('přehrávač, který při stahování vyhodí výjimku, hráč nepozná: okno je bez hlasu', () => {
    const player: RudyVoicePlayer = {
      load: () => {
        throw new Error('bez zvuku');
      },
      play: () => undefined,
      stop: () => undefined,
    };
    const voice = createRudyVoice({ player, isUnlocked: () => true });
    expect(() => voice.request(GREETING)).not.toThrow();
    expect(voice.isSettled(GREETING)).toBe(true);
    expect(voice.lineFor(GREETING)).toBeNull();
  });

  it('chvíle bez nahrávky (bez adresy) je bez hlasu a nečeká', () => {
    const { player, voice } = voiceWith();
    voice.request(undefined);
    expect(player.loads).toEqual([]);
    expect(voice.isSettled(undefined)).toBe(true);
    expect(voice.lineFor(undefined)).toBeNull();
  });
});

describe('#173: okno ohlásí, jestli zaznělo s hlasem, zopakovaný pozdrav jen s hlasem', () => {
  const LINE = { url: GREETING, lineMs: 2500 };

  it('s připravenou replikou se okno otevře s hlasem', () => {
    expect(rudyVoiceOpening(LINE, false)).toEqual({ kind: 'open', withVoice: true });
    expect(rudyVoiceOpening(LINE, true)).toEqual({ kind: 'open', withVoice: true });
  });

  it('bez repliky se běžná chvíle otevře bez hlasu', () => {
    expect(rudyVoiceOpening(null, false)).toEqual({ kind: 'open', withVoice: false });
  });

  it('bez repliky se chvíle, která musí mluvit, vůbec neukáže', () => {
    expect(rudyVoiceOpening(null, true)).toEqual({ kind: 'skip' });
  });

  it('se zamčeným zvukem je okno bez hlasu a zopakování se neukáže', () => {
    const { voice } = voiceWith({ value: false });
    voice.request(GREETING);
    expect(rudyVoiceOpening(voice.lineFor(GREETING), false)).toEqual({
      kind: 'open',
      withVoice: false,
    });
    expect(rudyVoiceOpening(voice.lineFor(GREETING), true)).toEqual({ kind: 'skip' });
  });

  it('když se nahrávka nestáhne, zopakování se neukáže', async () => {
    const { player, voice } = voiceWith();
    voice.request(GREETING);
    await player.fail(GREETING);
    expect(rudyVoiceOpening(voice.lineFor(GREETING), true)).toEqual({ kind: 'skip' });
  });
});
