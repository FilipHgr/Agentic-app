/// <reference types="vite/client" />
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { LANGUAGES } from '../../../src/shared/texts/languages';
import type { Language } from '../../../src/shared/texts/languages';
import { createVoicePlayer } from '../../../src/games/counting/audio/voicePlayer';
import type {
  AudioBufferLike,
  AudioBufferSourceLike,
  VoiceAudioContextLike,
  VoiceFetch,
} from '../../../src/games/counting/audio/voicePlayer';
import type { AudioNodeLike } from '../../../src/shared/audio/tonePlayer';
import { GUIDE_SCRIPT, voiceSentences } from '../../../src/games/counting/logic/guideScript';
import type { GuideLineId } from '../../../src/games/counting/logic/guideScript';
import {
  createGuideVoice,
  guideVoiceUrl,
  handleGuideVoice,
} from '../../../src/games/counting/logic/guideVoice';
import type {
  GuideVoiceCommand,
  GuideVoiceEvent,
  GuideVoiceState,
} from '../../../src/games/counting/logic/guideVoice';
import { readMp3FrameInfo } from '../../../tools/voice/mp3Header';
import { API_KEY_ENV, makeVoice } from '../../../tools/voice/voiceCore';
import type { VoiceConfig } from '../../../tools/voice/voiceCore';
import makeVoiceScript from '../../../tools/voice/make_voice.mjs?raw';
import fingerprintsJson from '../../../tools/voice/fingerprints.json?raw';
import voiceConfigJson from '../../../tools/voice/voice.config.json?raw';
import { MANIFEST_PATH, fakeServer, memoryFiles } from './voiceFakes';

/**
 * Testy k #65 AC6: nahrávky průvodce jsou po jazycích v
 * `public/voice/<jazyk>/counting/guide/<věta>.mp3`, průvodce stahuje jen
 * nahrávky aktuálního jazyka a postupné načítání z #51 se nemění.
 * Druhý jazyk je jen umělý kód v testu, žádné jeho nahrávky v repozitáři nejsou.
 * Síť i Web Audio jsou napodobené.
 */

/** Umělý druhý jazyk jen pro testy; v seznamu jazyků ani v repozitáři není. */
const OTHER_LANGUAGE = 'xx' as string as Language;

const ALL_IDS: readonly GuideLineId[] = GUIDE_SCRIPT.map((line) => line.id);

/** Nová složka nahrávek Počítání v češtině (od kořene repa). */
const CZECH_VOICE_DIR = 'public/voice/cs/counting/guide';

/** Všechny nahrávky v `public/voice/` jako bajty, podle cesty od kořene repa. */
const RECORDINGS: Record<string, Uint8Array> = Object.fromEntries(
  Object.entries(
    import.meta.glob<string>('../../../public/voice/**/*.mp3', {
      query: '?inline',
      import: 'default',
      eager: true,
    }),
  ).map(([path, dataUrl]) => [path.replace('../../../', ''), bytesOfDataUrl(dataUrl)]),
);

/** `sha256sum` nahrávek před přesunem ze staré složky bez jazyka (#65 AC6). */
const SHA256_BEFORE_MOVE: Record<GuideLineId, string> = {
  answerInput: '54524b3f28375dc65ad2b75ca5c88ff69be3b186caadd2680d426330f3ca4bc9',
  maxNumber: '8ecc54075d4714f46398c65d2e6d918456eda94cf1e8fb79aa969215b1845e30',
  operations: '981be916667aac69b2280d9190e57084c8ad424870c5d28d4b0c3192b7c0532c',
  summary: 'c0c3b383d4e3eccebf7c176f0de375f2ab17b0ca0b2645d8545c6b84052d449f',
};

/** Limity nahrávek z #50 AC5. */
const MAX_BITRATE_KBPS = 64;
const MAX_RECORDING_BYTES = 150 * 1024;
const MAX_TOTAL_BYTES = 1024 * 1024;

function bytesOfDataUrl(dataUrl: string): Uint8Array {
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
}

async function sha256(bytes: Uint8Array): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new Uint8Array(bytes)));
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function recordingPath(language: string, id: string): string {
  return `public/voice/${language}/counting/guide/${id}.mp3`;
}

// ---------------------------------------------------------------------------
// Napodobený zvuk a síť
// ---------------------------------------------------------------------------

class FakeSource implements AudioBufferSourceLike {
  buffer: AudioBufferLike | null = null;
  onended: ((event: Event) => unknown) | null = null;
  connect(destination: AudioNodeLike): AudioNodeLike {
    return destination;
  }
  start(): void {}
  stop(): void {}
}

class FakeVoiceContext implements VoiceAudioContextLike {
  readonly destination: AudioNodeLike = { connect: (node) => node };
  readonly currentTime = 0;
  state = 'suspended';
  resume(): Promise<void> {
    this.state = 'running';
    return Promise.resolve();
  }
  decodeAudioData(): Promise<AudioBufferLike> {
    return Promise.resolve({ duration: 4 });
  }
  createBufferSource(): AudioBufferSourceLike {
    return new FakeSource();
  }
}

interface VoiceOptions {
  readonly language?: Language;
  /** Adresy, na které síť odpoví 404. */
  readonly missing?: (url: string) => boolean;
}

interface VoiceHarness {
  readonly urls: string[];
  readonly loaded: GuideLineId[];
  readonly failed: GuideLineId[];
  readonly player: ReturnType<typeof createVoicePlayer>;
}

/** Přehrávač s napodobenou sítí; `onResult` dostane výsledek každého stahování. */
function voiceHarness(
  options: VoiceOptions = {},
  onResult: (event: GuideVoiceEvent) => void = () => {},
): VoiceHarness {
  const urls: string[] = [];
  const loaded: GuideLineId[] = [];
  const failed: GuideLineId[] = [];
  const fetch: VoiceFetch = (url) => {
    urls.push(url);
    if (options.missing?.(url) === true) {
      return Promise.resolve(new Response('Not Found', { status: 404 }));
    }
    return Promise.resolve(new Response(new Uint8Array(8), { status: 200 }));
  };
  const audio = new FakeVoiceContext();
  const player = createVoicePlayer({
    fetch,
    createContext: () => audio,
    events: {
      onLoaded: (id) => {
        loaded.push(id);
        onResult({ kind: 'loaded', id });
      },
      onLoadFailed: (id) => {
        failed.push(id);
        onResult({ kind: 'loadFailed', id });
      },
    },
    ...(options.language === undefined ? {} : { language: options.language }),
  });
  return { urls, loaded, failed, player };
}

async function settle(): Promise<void> {
  for (let round = 0; round < 5; round += 1) {
    await new Promise((done) => setTimeout(done, 0));
  }
}

/** Průvodce s hlasem: příkazy hlasu jdou do přehrávače, výsledky stahování zpět hlasu. */
class GuideWithVoice {
  state: GuideVoiceState = createGuideVoice();
  readonly harness: VoiceHarness;
  private readonly results: GuideVoiceEvent[] = [];

  constructor(options: VoiceOptions = {}) {
    this.harness = voiceHarness(options, (event) => this.results.push(event));
  }

  send(event: GuideVoiceEvent): void {
    const result = handleGuideVoice(this.state, event);
    this.state = result.state;
    result.commands.forEach((command) => this.run(command));
  }

  /** Nechá doběhnout stahování a doručí jeho výsledky hlasu průvodce. */
  async settle(): Promise<void> {
    await settle();
    let event = this.results.shift();
    while (event !== undefined) {
      this.send(event);
      await settle();
      event = this.results.shift();
    }
  }

  private run(command: GuideVoiceCommand): void {
    const { player } = this.harness;
    switch (command.kind) {
      case 'unlock':
        player.unlock();
        return;
      case 'load':
        player.load(command.id);
        return;
      case 'play':
        player.play(command.id);
        return;
      case 'stop':
        player.stop();
        return;
    }
  }
}

beforeEach(() => {
  vi.stubGlobal('fetch', () => {
    throw new Error('Skutečná síť se v testech nevolá.');
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ---------------------------------------------------------------------------
// Soubory nahrávek
// ---------------------------------------------------------------------------

describe('#65 AC6: nahrávky jsou po jazycích ve vlastní složce hry', () => {
  it('každá věta průvodce má v každém jazyce ze seznamu nahrávku a žádná není navíc', () => {
    const expected = LANGUAGES.flatMap((language) =>
      ALL_IDS.map((id) => recordingPath(language, id)),
    ).sort();
    expect(Object.keys(RECORDINGS).sort()).toEqual(expected);
  });

  for (const id of ALL_IDS) {
    it(`česká nahrávka „${id}“ leží v ${CZECH_VOICE_DIR}/${id}.mp3`, () => {
      expect(RECORDINGS[recordingPath('cs', id)]).toBeDefined();
    });
  }

  it('ve staré složce public/voice/guide/ nezůstala žádná nahrávka', () => {
    expect(
      Object.keys(RECORDINGS).filter((path) => path.startsWith('public/voice/guide/')),
    ).toEqual([]);
  });

  for (const id of ALL_IDS) {
    it(`česká nahrávka „${id}“ je po přesunu bajt po bajtu stejná (sha256sum)`, async () => {
      const bytes = RECORDINGS[recordingPath('cs', id)];
      expect(bytes).toBeDefined();
      expect(await sha256(bytes ?? new Uint8Array())).toBe(SHA256_BEFORE_MOVE[id]);
    });
  }
});

describe('#65 AC6: kontroly mp3 z #50 platí pro nahrávky všech jazyků', () => {
  for (const [path, bytes] of Object.entries(RECORDINGS)) {
    it(`${path} je mono mp3 s datovým tokem nejvýš 64 kbps a pod 150 KB`, () => {
      const info = readMp3FrameInfo(bytes);
      expect(info).not.toBeNull();
      expect(info?.channels).toBe(1);
      expect(info?.bitrateKbps ?? Infinity).toBeLessThanOrEqual(MAX_BITRATE_KBPS);
      expect(bytes.byteLength).toBeLessThanOrEqual(MAX_RECORDING_BYTES);
    });
  }

  for (const language of LANGUAGES) {
    it(`nahrávky jazyka ${language} mají dohromady nejvýš 1 MB`, () => {
      const total = Object.entries(RECORDINGS)
        .filter(([path]) => path.startsWith(`public/voice/${language}/`))
        .reduce((sum, [, bytes]) => sum + bytes.byteLength, 0);
      expect(total).toBeGreaterThan(0);
      expect(total).toBeLessThanOrEqual(MAX_TOTAL_BYTES);
    });
  }
});

// ---------------------------------------------------------------------------
// Adresy a stahování
// ---------------------------------------------------------------------------

describe('#65 AC6: průvodce stahuje jen nahrávky aktuálního jazyka', () => {
  for (const id of ALL_IDS) {
    it(`bez zadaného jazyka se „${id}“ stahuje z české složky voice/cs/counting/guide/`, () => {
      expect(guideVoiceUrl(id)).toBe(`voice/cs/counting/guide/${id}.mp3`);
    });
  }

  it('adresa nahrávky jiného jazyka vede do složky toho jazyka', () => {
    expect(guideVoiceUrl('summary', OTHER_LANGUAGE)).toBe('voice/xx/counting/guide/summary.mp3');
  });

  it('česká adresa každé věty ukazuje na soubor, který v repozitáři je', () => {
    for (const id of ALL_IDS) {
      expect(RECORDINGS[`public/${guideVoiceUrl(id, 'cs')}`], id).toBeDefined();
    }
  });

  it('přehrávač bez zadaného jazyka stahuje české nahrávky', async () => {
    const setup = voiceHarness();
    setup.player.load('maxNumber');
    await settle();
    expect(setup.urls).toEqual(['voice/cs/counting/guide/maxNumber.mp3']);
  });

  it('přehrávač s jiným jazykem nestáhne žádnou nahrávku jiného jazyka', async () => {
    const setup = voiceHarness({ language: OTHER_LANGUAGE });
    setup.player.unlock();
    for (const id of ALL_IDS) {
      setup.player.load(id);
    }
    await settle();
    expect(setup.urls).toHaveLength(ALL_IDS.length);
    expect(setup.urls.every((url) => url.startsWith('voice/xx/counting/guide/'))).toBe(true);
    expect(setup.urls.some((url) => url.includes('/cs/'))).toBe(false);
  });

  it('celý průchod průvodcem v jiném jazyce nestáhne nic z češtiny', async () => {
    const guide = new GuideWithVoice({ language: OTHER_LANGUAGE });
    guide.send({ kind: 'opened' });
    await guide.settle();
    for (const step of [2, 3, 4] as const) {
      guide.send({ kind: 'tapped', target: 'next', step });
      await guide.settle();
    }
    guide.send({ kind: 'tapped', target: 'back', step: 3 });
    await guide.settle();
    expect(guide.harness.urls.length).toBeGreaterThan(0);
    expect(guide.harness.urls.filter((url) => !url.startsWith('voice/xx/'))).toEqual([]);
  });
});

describe('#65 AC6: postupné načítání zůstává jako v #51', () => {
  it('při startu hry (vytvoření přehrávače) se nestáhne nic', async () => {
    const setup = voiceHarness({ language: OTHER_LANGUAGE });
    await settle();
    expect(setup.urls).toEqual([]);
  });

  it('po otevření průvodce se stáhne věta 1. kroku a přednačte věta 2. kroku, nic víc', async () => {
    const guide = new GuideWithVoice({ language: OTHER_LANGUAGE });
    guide.send({ kind: 'opened' });
    await guide.settle();
    expect([...guide.harness.urls].sort()).toEqual(
      [
        guideVoiceUrl('maxNumber', OTHER_LANGUAGE),
        guideVoiceUrl('operations', OTHER_LANGUAGE),
      ].sort(),
    );
  });

  it('po „Další“ na 2. krok se přednačte jen věta 3. kroku, stažená věta se znovu nestahuje', async () => {
    const guide = new GuideWithVoice({ language: OTHER_LANGUAGE });
    guide.send({ kind: 'opened' });
    await guide.settle();
    guide.send({ kind: 'tapped', target: 'next', step: 2 });
    await guide.settle();
    expect(guide.harness.urls).toHaveLength(3);
    expect(guide.harness.urls[2]).toBe(guideVoiceUrl('answerInput', OTHER_LANGUAGE));
  });

  it('návrat zpět na stažený krok nic znovu nestáhne', async () => {
    const guide = new GuideWithVoice();
    guide.send({ kind: 'opened' });
    await guide.settle();
    guide.send({ kind: 'tapped', target: 'next', step: 2 });
    await guide.settle();
    const before = guide.harness.urls.length;
    guide.send({ kind: 'tapped', target: 'back', step: 1 });
    await guide.settle();
    expect(guide.harness.urls).toHaveLength(before);
    expect(new Set(guide.harness.urls).size).toBe(guide.harness.urls.length);
  });
});

describe('#65 AC6: nahrávka, která se za běhu nestáhne', () => {
  it('chybějící nahrávka se ohlásí jako nepovedené načtení, ne jako chyba', async () => {
    const setup = voiceHarness({ missing: () => true });
    expect(() => setup.player.load('summary')).not.toThrow();
    await settle();
    expect(setup.failed).toEqual(['summary']);
    expect(setup.loaded).toEqual([]);
  });

  it('když chybí nahrávky celého jazyka, průvodce mlčí a jde dál až na shrnutí', async () => {
    const guide = new GuideWithVoice({ language: OTHER_LANGUAGE, missing: () => true });
    guide.send({ kind: 'opened' });
    await guide.settle();
    for (const step of [2, 3, 4] as const) {
      expect(() => guide.send({ kind: 'tapped', target: 'next', step })).not.toThrow();
      await guide.settle();
    }
    guide.send({ kind: 'tapped', target: 'speaker', step: 4 });
    await guide.settle();
    expect(guide.state.step).toBe(4);
    expect(guide.harness.loaded).toEqual([]);
    expect(guide.harness.failed.length).toBeGreaterThan(0);
    expect(() => guide.send({ kind: 'closed' })).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Skript na nahrávky
// ---------------------------------------------------------------------------

describe('#65 AC6: npm run voice dál funguje pro češtinu a ukládá do nové složky', () => {
  it('skript ukládá nahrávky do public/voice/cs/counting/guide', () => {
    expect(makeVoiceScript).toContain(`'${CZECH_VOICE_DIR}'`);
  });

  it('skript už neodkazuje na starou složku public/voice/guide', () => {
    expect(makeVoiceScript).not.toContain('public/voice/guide');
  });

  it('hned po přesunu se server nevolá: skutečné nahrávky a otisky se jen přeskočí', async () => {
    const files = memoryFiles();
    await files.writeFile(MANIFEST_PATH, new TextEncoder().encode(fingerprintsJson));
    for (const id of ALL_IDS) {
      const bytes = RECORDINGS[recordingPath('cs', id)];
      expect(bytes, id).toBeDefined();
      await files.writeFile(`${CZECH_VOICE_DIR}/${id}.mp3`, bytes ?? new Uint8Array());
    }
    const snapshotBefore = files.snapshot();
    const server = fakeServer(() => {
      throw new Error('server se nemá volat');
    });

    const result = await makeVoice({
      sentences: voiceSentences(),
      config: JSON.parse(voiceConfigJson) as VoiceConfig,
      env: { [API_KEY_ENV]: 'sk_test_jen_pro_test' },
      fetch: server.fetch,
      files,
      outputDir: CZECH_VOICE_DIR,
      manifestPath: MANIFEST_PATH,
      log: () => {},
    });

    expect(server.calls).toHaveLength(0);
    expect(result.ok).toBe(true);
    expect([...result.skipped].sort()).toEqual([...ALL_IDS].sort());
    expect(result.created).toEqual([]);
    expect(result.deleted).toEqual([]);
    expect(files.snapshot()).toEqual(snapshotBefore);
  });
});
