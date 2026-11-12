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
import type { CountingTexts } from '../../../src/games/counting/texts/countingTexts';
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
import { API_KEY_ENV, makeVoice, voiceDir } from '../../../tools/voice/voiceCore';
import type { VoiceConfig } from '../../../tools/voice/voiceCore';
import fingerprintsJson from '../../../tools/voice/fingerprints.json?raw';
import voiceConfigJson from '../../../tools/voice/voice.config.json?raw';
import licenceText from '../../../public/licence.txt?raw';
import { dictionariesByLanguage } from '../../shared/textChecks';
import { MANIFEST_PATH, fakeServer, memoryFiles } from './voiceFakes';

/**
 * Testy k #138 AC4 a AC6 a k podmínce vlastníka z komentáře k #138
 * („každý jazyk má pořád stejný hlas“, hlas jazyka je pevně v
 * `tools/voice/voice.config.json`):
 * - průvodce v angličtině přehraje v každém ze 4 kroků anglickou nahrávku
 *   a nestáhne žádnou českou; nahrávky jsou skutečné soubory z repozitáře,
 * - každá anglická věta má nahrávku, žádná není navíc, limity z #50,
 * - když se nahrávka nestáhne, průvodce mlčí a funguje dál,
 * - nahrávky každého jazyka mají v otiscích hlas z konfigurace,
 * - seznam zdrojů třetích stran uvádí hlas každého jazyka.
 * Síť i Web Audio jsou napodobené, skutečná síť se nevolá.
 *
 * Rozhraní: žádné nové v `src/`. Implementace dodá
 * `public/voice/en/counting/guide/<věta>.mp3`, oddíl `en` ve
 * `voice.config.json` (hlas Alice `Xb7hH8MSUJpSbSDYk0k2`, model
 * `eleven_multilingual_v2`, nastavení hlasu, se kterým nahrávky opravdu
 * vznikly) a oddíl `en` ve `fingerprints.json` spočítaný stejně jako ve
 * `voiceCore.ts` (text věty, hlas, model, nastavení a formát mp3_44100_64).
 */

const ALL_IDS: readonly GuideLineId[] = GUIDE_SCRIPT.map((line) => line.id);

/** Pevné hlasy jazyků (rozhodnutí 2026-11-12): hlas jazyka se nikdy nemění. */
const FIXED_VOICES: Readonly<Record<string, { voiceId: string; modelId: string }>> = {
  cs: { voiceId: '7JbZPqJGWUfXXBim0T8U', modelId: 'eleven_multilingual_v2' },
  en: { voiceId: 'Xb7hH8MSUJpSbSDYk0k2', modelId: 'eleven_multilingual_v2' },
};

/** Limity nahrávek z #50 AC5. */
const MAX_BITRATE_KBPS = 64;
const MAX_RECORDING_BYTES = 150 * 1024;
const MAX_TOTAL_BYTES = 1024 * 1024;

/** Angličtina; dvojí převod jen dokud typ `Language` angličtinu nezná. */
const ENGLISH = 'en' as string as Language;

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

/** Texty Počítání každého jazyka se souborem textů. */
const COUNTING_FILES = dictionariesByLanguage(
  import.meta.glob('../../../src/games/counting/texts/*.ts', { eager: true }),
);

const VOICES = JSON.parse(voiceConfigJson) as Record<string, unknown>;
const FINGERPRINTS = JSON.parse(fingerprintsJson) as Record<string, unknown>;

function bytesOfDataUrl(dataUrl: string): Uint8Array {
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
}

function recordingPath(language: string, id: string): string {
  return `public/voice/${language}/counting/guide/${id}.mp3`;
}

function recordingsOf(language: string): Record<string, Uint8Array> {
  const prefix = `public/voice/${language}/`;
  return Object.fromEntries(Object.entries(RECORDINGS).filter(([path]) => path.startsWith(prefix)));
}

function voiceOf(language: string): VoiceConfig | undefined {
  return VOICES[language] as VoiceConfig | undefined;
}

function sentencesOf(language: string): { id: GuideLineId; text: string }[] {
  const texts = COUNTING_FILES[language];
  if (texts === undefined) {
    throw new Error(`jazyk ${language} nemá soubor textů Počítání`);
  }
  return voiceSentences(texts as unknown as CountingTexts);
}

// ---------------------------------------------------------------------------
// Napodobený zvuk a síť: síť odpovídá skutečnými soubory z public/
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
  state = 'running';
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

async function settle(): Promise<void> {
  for (let round = 0; round < 5; round += 1) {
    await new Promise((done) => setTimeout(done, 0));
  }
}

/**
 * Průvodce s hlasem nad skutečnými nahrávkami: adresa `voice/…` se hledá
 * v `public/voice/…`, co tam není, dostane 404. Zvuk je odemčený ťuknutím
 * v menu (#67 AC6), takže průvodce mluví hned.
 */
class GuideWithVoice {
  state: GuideVoiceState = createGuideVoice({ audioUnlocked: true });
  readonly urls: string[] = [];
  readonly played: GuideLineId[] = [];
  readonly failed: GuideLineId[] = [];
  private readonly results: GuideVoiceEvent[] = [];
  private readonly player: ReturnType<typeof createVoicePlayer>;

  constructor(language: Language, missing: (url: string) => boolean = () => false) {
    const fetch: VoiceFetch = (url) => {
      this.urls.push(url);
      const bytes = RECORDINGS[`public/${url}`];
      if (bytes === undefined || missing(url)) {
        return Promise.resolve(new Response('Not Found', { status: 404 }));
      }
      return Promise.resolve(new Response(new Uint8Array(bytes), { status: 200 }));
    };
    this.player = createVoicePlayer({
      fetch,
      createContext: () => new FakeVoiceContext(),
      events: {
        onLoaded: (id) => this.results.push({ kind: 'loaded', id }),
        onLoadFailed: (id) => {
          this.failed.push(id);
          this.results.push({ kind: 'loadFailed', id });
        },
      },
      language,
    });
  }

  send(event: GuideVoiceEvent): void {
    const result = handleGuideVoice(this.state, event);
    this.state = result.state;
    result.commands.forEach((command) => this.run(command));
  }

  async settle(): Promise<void> {
    await settle();
    let event = this.results.shift();
    while (event !== undefined) {
      this.send(event);
      await settle();
      event = this.results.shift();
    }
  }

  /** Otevře průvodce a projde všechny 4 kroky tlačítkem „Další“. */
  async walkThrough(): Promise<void> {
    this.send({ kind: 'opened' });
    await this.settle();
    for (const step of [2, 3, 4] as const) {
      this.send({ kind: 'tapped', target: 'next', step });
      await this.settle();
    }
  }

  private run(command: GuideVoiceCommand): void {
    switch (command.kind) {
      case 'unlock':
        this.player.unlock();
        return;
      case 'load':
        this.player.load(command.id);
        return;
      case 'play':
        this.played.push(command.id);
        this.player.play(command.id);
        return;
      case 'stop':
        this.player.stop();
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
// AC4: průvodce mluví anglicky
// ---------------------------------------------------------------------------

describe('#138 AC4: v angličtině průvodce v každém kroku přehraje anglickou nahrávku', () => {
  it('angličtina je v seznamu jazyků, takže ji průvodce může dostat', () => {
    expect(LANGUAGES).toContain('en');
  });

  it('v každém ze 4 kroků zazní věta toho kroku, každá právě jednou a v pořadí kroků', async () => {
    const guide = new GuideWithVoice(ENGLISH);
    await guide.walkThrough();
    expect(guide.played).toEqual(['maxNumber', 'operations', 'answerInput', 'summary']);
    expect(guide.failed).toEqual([]);
  });

  it('každá přehraná věta se stáhla z anglické složky', async () => {
    const guide = new GuideWithVoice(ENGLISH);
    await guide.walkThrough();
    expect(guide.played).toHaveLength(ALL_IDS.length);
    for (const id of guide.played) {
      expect(guide.urls, id).toContain(`voice/en/counting/guide/${id}.mp3`);
    }
  });

  it('celý průchod tam a zpět nestáhne žádnou českou nahrávku', async () => {
    const guide = new GuideWithVoice(ENGLISH);
    await guide.walkThrough();
    guide.send({ kind: 'tapped', target: 'back', step: 3 });
    await guide.settle();
    guide.send({ kind: 'tapped', target: 'speaker', step: 3 });
    await guide.settle();
    expect(guide.urls.length).toBeGreaterThan(0);
    expect(guide.urls.filter((url) => !url.startsWith('voice/en/counting/guide/'))).toEqual([]);
  });

  it('adresa každé anglické věty vede na soubor, který v repozitáři je', () => {
    for (const id of ALL_IDS) {
      const url = guideVoiceUrl(id, ENGLISH);
      expect(url, id).toBe(`voice/en/counting/guide/${id}.mp3`);
      expect(RECORDINGS[`public/${url}`], url).toBeDefined();
    }
  });
});

describe('#138 AC4: každá anglická věta má nahrávku a žádná není navíc', () => {
  it('anglický scénář má stejné 4 věty jako český', () => {
    expect(sentencesOf('en').map((sentence) => sentence.id)).toEqual([...ALL_IDS]);
  });

  it('ve složce public/voice/en/counting/guide/ je nahrávka každé věty a nic navíc', () => {
    expect(voiceDir('en')).toBe('public/voice/en/counting/guide');
    expect(Object.keys(recordingsOf('en')).sort()).toEqual(
      ALL_IDS.map((id) => recordingPath('en', id)).sort(),
    );
  });

  it('anglická nahrávka žádné věty není kopie české', () => {
    const same = ALL_IDS.filter((id) => {
      const english = RECORDINGS[recordingPath('en', id)];
      const czech = RECORDINGS[recordingPath('cs', id)];
      return (
        english !== undefined &&
        czech !== undefined &&
        english.length === czech.length &&
        english.every((byte, index) => byte === czech[index])
      );
    });
    expect(same).toEqual([]);
  });
});

describe('#138 AC4: anglické nahrávky splní limity z #50', () => {
  it('každá anglická nahrávka je mono mp3 s nejvýš 64 kb/s a nejvýš 150 KB', () => {
    const problems = ALL_IDS.flatMap((id) => {
      const path = recordingPath('en', id);
      const bytes = RECORDINGS[path];
      if (bytes === undefined) {
        return [`${path} chybí`];
      }
      const info = readMp3FrameInfo(bytes);
      const found: string[] = [];
      if (info === null) {
        found.push(`${path} není platná mp3`);
      } else {
        if (info.channels !== 1) found.push(`${path} není mono`);
        if (info.bitrateKbps > MAX_BITRATE_KBPS) found.push(`${path} má ${info.bitrateKbps} kb/s`);
      }
      if (bytes.byteLength > MAX_RECORDING_BYTES) found.push(`${path} má ${bytes.byteLength} B`);
      return found;
    });
    expect(problems).toEqual([]);
  });

  it('anglické nahrávky mají dohromady nejvýš 1 MB', () => {
    const total = Object.values(recordingsOf('en')).reduce((sum, bytes) => sum + bytes.length, 0);
    expect(total).toBeGreaterThan(0);
    expect(total).toBeLessThanOrEqual(MAX_TOTAL_BYTES);
  });
});

describe('#138 AC4: když se anglická nahrávka nestáhne, průvodce mlčí a funguje dál', () => {
  it('bez jediné anglické nahrávky projde průvodce všemi 4 kroky a nic nezazní', async () => {
    const guide = new GuideWithVoice(ENGLISH, () => true);
    await guide.walkThrough();
    guide.send({ kind: 'tapped', target: 'speaker', step: 4 });
    await guide.settle();
    expect(guide.state.step).toBe(4);
    expect(guide.played).toEqual([]);
    expect(guide.failed.length).toBeGreaterThan(0);
    expect(() => guide.send({ kind: 'closed' })).not.toThrow();
  });

  it('když chybí jen věta 2. kroku, zazní ostatní kroky a 2. krok mlčí', async () => {
    const guide = new GuideWithVoice(ENGLISH, (url) => url.endsWith('/operations.mp3'));
    await guide.walkThrough();
    expect(guide.played).toEqual(['maxNumber', 'answerInput', 'summary']);
    expect(guide.failed).toContain('operations');
  });

  it('ani při výpadku se místo anglické nestáhne česká nahrávka', async () => {
    const guide = new GuideWithVoice(ENGLISH, () => true);
    await guide.walkThrough();
    expect(guide.urls.some((url) => url.includes('/cs/'))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Podmínka vlastníka: každý jazyk má pořád stejný hlas
// ---------------------------------------------------------------------------

describe('#138: každý jazyk ze seznamu má pevný hlas v tools/voice/voice.config.json', () => {
  it('každý jazyk ze seznamu má v konfiguraci hlas, model a nastavení hlasu', () => {
    for (const language of LANGUAGES) {
      const voice = voiceOf(language);
      expect(voice, `jazyk ${language} nemá hlas`).toBeDefined();
      expect(typeof voice?.voiceId === 'string' && voice.voiceId.trim() !== '', language).toBe(
        true,
      );
      expect(typeof voice?.modelId === 'string' && voice.modelId.trim() !== '', language).toBe(
        true,
      );
      expect(typeof voice?.voiceSettings, language).toBe('object');
    }
  });

  it('hlas každého jazyka je ten schválený a nezměnil se (čeština dnešní, angličtina Alice)', () => {
    for (const language of LANGUAGES) {
      const fixed = FIXED_VOICES[language];
      expect(fixed, `jazyk ${language} nemá v testu schválený hlas`).toBeDefined();
      expect(
        { voiceId: voiceOf(language)?.voiceId, modelId: voiceOf(language)?.modelId },
        language,
      ).toEqual(fixed);
    }
  });
});

describe('#138: nahrávky každého jazyka mají v otiscích hlas z konfigurace', () => {
  it('každý jazyk ze seznamu má v otiscích oddíl s právě jeho větami', () => {
    for (const language of LANGUAGES) {
      const section = FINGERPRINTS[language] as Record<string, unknown> | undefined;
      expect(section, `jazyk ${language} nemá otisky`).toBeDefined();
      expect(Object.keys(section ?? {}).sort(), language).toEqual([...ALL_IDS].sort());
    }
  });

  /** Spustí skript nahrávek nad skutečnými soubory a otisky; server je napodobený. */
  async function runOnRepository(language: string, config: VoiceConfig) {
    const files = memoryFiles();
    await files.writeFile(MANIFEST_PATH, new TextEncoder().encode(fingerprintsJson));
    for (const [path, bytes] of Object.entries(recordingsOf(language))) {
      await files.writeFile(path, bytes);
    }
    const before = files.snapshot();
    const server = fakeServer(() => {
      throw new Error('server se nemá volat');
    });
    const result = await makeVoice({
      sentences: sentencesOf(language),
      config,
      env: { [API_KEY_ENV]: 'sk_test_jen_pro_test' },
      fetch: server.fetch,
      files,
      language,
      log: () => {},
    });
    return { result, calls: server.calls.length, before, after: files.snapshot() };
  }

  it('skript s hlasem z konfigurace každou nahrávku jen přeskočí: otisk sedí na text i hlas', async () => {
    for (const language of LANGUAGES) {
      const config = voiceOf(language);
      expect(config, `jazyk ${language} nemá hlas`).toBeDefined();
      const run = await runOnRepository(language, config as VoiceConfig);
      expect(run.calls, `jazyk ${language}: server by se volal`).toBe(0);
      expect([...run.result.skipped].sort(), `jazyk ${language}`).toEqual([...ALL_IDS].sort());
      expect(run.after, `jazyk ${language}: soubory se změnily`).toEqual(run.before);
    }
  });

  it('s jiným hlasem by otisky neseděly: skript by chtěl nahrávky vytvořit znovu', async () => {
    for (const language of LANGUAGES) {
      const config = voiceOf(language);
      expect(config, `jazyk ${language} nemá hlas`).toBeDefined();
      const otherVoice = { ...(config as VoiceConfig), voiceId: 'jiny-hlas-jen-pro-test' };
      const run = await runOnRepository(language, otherVoice);
      expect(run.result.skipped, `jazyk ${language}`).toEqual([]);
      expect(run.calls, `jazyk ${language}`).toBe(ALL_IDS.length);
    }
  });
});

// ---------------------------------------------------------------------------
// AC6: seznam zdrojů třetích stran
// ---------------------------------------------------------------------------

/** Odstavce `public/licence.txt` (oddělené prázdným řádkem). */
const LICENCE_PARAGRAPHS: readonly string[] = licenceText
  .split(/\n\s*\n/)
  .map((paragraph) => paragraph.replace(/\s+/g, ' '));

describe('#138 AC6: seznam zdrojů uvádí hlas každého jazyka a cestu k jeho nahrávkám', () => {
  it('každý jazyk ze seznamu má v licence.txt odstavec s cestou ke svým nahrávkám', () => {
    for (const language of LANGUAGES) {
      const path = `public/voice/${language}/counting/guide/`;
      expect(
        LICENCE_PARAGRAPHS.filter((paragraph) => paragraph.includes(path)),
        `jazyk ${language}: v licence.txt chybí ${path}`,
      ).toHaveLength(1);
    }
  });

  it('odstavec jazyka uvádí službu ElevenLabs, ID hlasu a model z konfigurace', () => {
    for (const language of LANGUAGES) {
      const path = `public/voice/${language}/counting/guide/`;
      const paragraph = LICENCE_PARAGRAPHS.find((candidate) => candidate.includes(path)) ?? '';
      const voice = voiceOf(language);
      expect(paragraph, language).toContain('ElevenLabs');
      expect(paragraph, language).toContain(voice?.voiceId ?? '?');
      expect(paragraph, language).toContain(voice?.modelId ?? '?');
    }
  });

  it('hlas jednoho jazyka není v odstavci jiného jazyka', () => {
    for (const language of LANGUAGES) {
      const path = `public/voice/${language}/counting/guide/`;
      const paragraph = LICENCE_PARAGRAPHS.find((candidate) => candidate.includes(path)) ?? '';
      for (const other of LANGUAGES.filter((candidate) => candidate !== language)) {
        const otherPath = `public/voice/${other}/counting/guide/`;
        if (!paragraph.includes(otherPath)) {
          expect(paragraph, `${language} obsahuje hlas ${other}`).not.toContain(
            voiceOf(other)?.voiceId ?? '?',
          );
        }
      }
    }
  });
});
