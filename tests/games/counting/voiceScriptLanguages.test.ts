/// <reference types="vite/client" />
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { GUIDE_SCRIPT, voiceSentences } from '../../../src/games/counting/logic/guideScript';
import type { CountingTexts } from '../../../src/games/counting/texts/countingTexts';
import czechTexts from '../../../src/games/counting/texts/cs';
import {
  API_KEY_ENV,
  MANIFEST_PATH,
  runVoiceCommand,
  voiceDir,
} from '../../../tools/voice/voiceCore';
import type { RunVoiceOptions, VoiceSentence } from '../../../tools/voice/voiceCore';
import makeVoiceScript from '../../../tools/voice/make_voice.mjs?raw';
import fingerprintsJson from '../../../tools/voice/fingerprints.json?raw';
import voiceConfigJson from '../../../tools/voice/voice.config.json?raw';
import claudeMd from '../../../CLAUDE.md?raw';
import { alwaysMp3, fakeMp3, fakeServer, looksCzech, memoryFiles } from './voiceFakes';
import type { FakeServer, MemoryFiles } from './voiceFakes';

/**
 * Testy k #66: skript na nahrávky průvodce po jazycích. Vlastník spustí
 * `npm run voice -- <jazyk>` a vzniknou nahrávky jen toho jazyka, jeho
 * hlasem. Server je napodobený, soubory jsou v paměti a skutečný `fetch`
 * je zakázaný. Druhý jazyk `xx` je jen umělý kód v testu.
 */

const KEY = 'sk_test_TAJNY_KLIC_66';

const CZECH_VOICE = {
  voiceId: '7JbZPqJGWUfXXBim0T8U',
  modelId: 'eleven_multilingual_v2',
  voiceSettings: { stability: 0.5, similarity_boost: 0.75, style: 0, use_speaker_boost: true },
};

const OTHER_VOICE = {
  voiceId: 'umelyHlasXX',
  modelId: 'umely_model_xx',
  voiceSettings: { stability: 0.3 },
};

/** Nastavení hlasů po jazycích, jak je ve `voice.config.json`. */
const VOICES = { cs: CZECH_VOICE, xx: OTHER_VOICE };

/** Soubory ve složce textů Počítání: cs, umělý xx a společný soubor typu. */
const TEXT_FILES = ['countingTexts.ts', 'cs.ts', 'xx.ts'];

const SENTENCES = {
  cs: [
    { id: 'maxNumber', text: 'Největší číslo v příkladech.' },
    { id: 'summary', text: 'Hotovo, můžete začít.' },
  ],
  xx: [
    { id: 'maxNumber', text: 'Xx biggest number.' },
    { id: 'summary', text: 'Xx done.' },
  ],
} satisfies Record<string, readonly VoiceSentence[]>;

/** Hodnoty otisků češtiny před #66 (z `tools/voice/fingerprints.json`). */
const CZECH_FINGERPRINTS_BEFORE = {
  answerInput: '80a8cf2c6dfb85e86c50dea47f64c30b88748b11933de8fdcb818acf873e0fd2',
  maxNumber: '3eaf10feb359c33d92e83f2ed847ebeb2f9bfcf478c6055b0206949690d9fd61',
  operations: '88ace491300fa1a794bfe78e7e7661d4b1fe76d46f1cf82965a76afc43eb80ab',
  summary: 'ce4d80206756a78ab54246ca610c924f27b840504fdf67c628febe9305f77690',
};

interface RunOutput {
  readonly result: Awaited<ReturnType<typeof runVoiceCommand>>;
  readonly log: string[];
  readonly loaded: string[];
}

/** Vlastník spustí `npm run voice -- <args>`. */
async function runCommand(
  args: readonly string[],
  files: MemoryFiles,
  server: FakeServer,
  overrides: Partial<RunVoiceOptions> = {},
): Promise<RunOutput> {
  const log: string[] = [];
  const loaded: string[] = [];
  const result = await runVoiceCommand({
    args,
    textFiles: TEXT_FILES,
    voices: VOICES,
    loadSentences: async (language) => {
      loaded.push(language);
      return language === 'cs' || language === 'xx' ? SENTENCES[language] : [];
    },
    env: { [API_KEY_ENV]: KEY },
    fetch: server.fetch,
    files,
    log: (line) => log.push(line),
    ...overrides,
  });
  return { result, log, loaded };
}

function recordingsIn(files: MemoryFiles, language: string): Record<string, string> {
  const prefix = `${voiceDir(language)}/`;
  return Object.fromEntries(
    Object.entries(files.snapshot()).filter(([path]) => path.startsWith(prefix)),
  );
}

async function fingerprintsOf(files: MemoryFiles, language: string): Promise<unknown> {
  const raw = await files.readFile(MANIFEST_PATH);
  if (raw === null) {
    return undefined;
  }
  const parsed = JSON.parse(new TextDecoder().decode(raw)) as Record<string, unknown>;
  return parsed[language];
}

/** Repozitář, kde už jsou nahrávky češtiny i umělého jazyka xx. */
async function bothLanguagesRecorded(): Promise<MemoryFiles> {
  const files = memoryFiles();
  expect((await runCommand(['cs'], files, alwaysMp3(fakeMp3({ fill: 1 })))).result.ok).toBe(true);
  expect((await runCommand(['xx'], files, alwaysMp3(fakeMp3({ fill: 2 })))).result.ok).toBe(true);
  return files;
}

function serverThatMustNotBeCalled(): FakeServer {
  return fakeServer(() => {
    throw new Error('server se nemá volat');
  });
}

beforeEach(() => {
  vi.stubGlobal('fetch', () => {
    throw new Error('Skutečná síť se v testech nevolá.');
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('#66 AC1: zvolený jazyk', () => {
  it('npm run voice -- cs vytvoří české nahrávky do public/voice/cs/counting/guide', async () => {
    const files = memoryFiles();
    const { result } = await runCommand(['cs'], files, alwaysMp3());
    expect(result.ok).toBe(true);
    expect(voiceDir('cs')).toBe('public/voice/cs/counting/guide');
    expect(Object.keys(recordingsIn(files, 'cs')).sort()).toEqual([
      'public/voice/cs/counting/guide/maxNumber.mp3',
      'public/voice/cs/counting/guide/summary.mp3',
    ]);
  });

  it('s cs vzniknou jen české nahrávky, jiný jazyk nedostane nic', async () => {
    const files = memoryFiles();
    await runCommand(['cs'], files, alwaysMp3());
    const recordings = Object.keys(files.snapshot()).filter((path) => path.endsWith('.mp3'));
    expect(recordings.every((path) => path.startsWith('public/voice/cs/counting/guide/'))).toBe(
      true,
    );
  });

  it('serveru se pošlou věty z textů Počítání ve zvoleném jazyce', async () => {
    const server = alwaysMp3();
    const { loaded } = await runCommand(['xx'], memoryFiles(), server);
    expect(loaded).toEqual(['xx']);
    expect(server.texts().sort()).toEqual(SENTENCES.xx.map((sentence) => sentence.text).sort());
  });

  it('věty pro nahrávky se berou z textů zadaného jazyka', () => {
    const otherTexts: CountingTexts = {
      ...czechTexts,
      guideLines: {
        maxNumber: ['Xx jedna.', 'Xx dva.'],
        operations: ['Xx tři.', 'Xx čtyři.'],
        answerInput: ['Xx pět.', 'Xx šest.'],
        summary: ['Xx sedm.', 'Xx osm.'],
      },
    };
    const sentences = voiceSentences(otherTexts);
    expect(sentences.map((sentence) => sentence.id)).toEqual(GUIDE_SCRIPT.map((line) => line.id));
    expect(sentences.find((sentence) => sentence.id === 'summary')?.text).toBe('Xx sedm. Xx osm.');
  });

  it('bez zadaných textů jsou věty české jako dřív', () => {
    expect(voiceSentences()).toEqual(voiceSentences(czechTexts));
  });

  it('skript přijme jazyk se souborem textů, i když ještě není v seznamu jazyků hry', async () => {
    const files = memoryFiles();
    const { result } = await runCommand(['xx'], files, alwaysMp3());
    expect(result.ok).toBe(true);
    expect(Object.keys(recordingsIn(files, 'xx'))).toHaveLength(SENTENCES.xx.length);
  });

  it('skript na disku bere argument z příkazové řádky a věty z textů Počítání zvoleného jazyka', () => {
    expect(makeVoiceScript).toContain('process.argv.slice(2)');
    expect(makeVoiceScript).toContain('src/games/counting/texts');
    expect(makeVoiceScript).toContain('runVoiceCommand');
  });

  it('skript na disku zpracuje jen Počítání', () => {
    expect(voiceDir('xx')).toBe('public/voice/xx/counting/guide');
    expect(makeVoiceScript).not.toMatch(/src\/games\/(?!counting)/);
  });
});

describe('#66 AC2: hlas po jazycích', () => {
  it('ve voice.config.json má každý jazyk vlastní hlas, model a nastavení', () => {
    const config = JSON.parse(voiceConfigJson) as Record<string, unknown>;
    expect(Object.keys(config)).toContain('cs');
    for (const voice of Object.values(config)) {
      expect(voice).toMatchObject({
        voiceId: expect.any(String),
        modelId: expect.any(String),
        voiceSettings: expect.any(Object),
      });
    }
  });

  it('český hlas zůstane dnešní', () => {
    const config = JSON.parse(voiceConfigJson) as Record<string, unknown>;
    expect(config.cs).toEqual(CZECH_VOICE);
  });

  for (const [language, voice] of Object.entries(VOICES)) {
    it(`serveru se pro ${language} pošle hlas, model a nastavení jazyka ${language}`, async () => {
      const server = alwaysMp3();
      await runCommand([language], memoryFiles(), server);
      expect(server.calls.length).toBeGreaterThan(0);
      for (const call of server.calls) {
        expect(call.url.pathname).toBe(`/v1/text-to-speech/${voice.voiceId}`);
        expect(call.body.model_id).toBe(voice.modelId);
        expect(call.body.voice_settings).toEqual(voice.voiceSettings);
      }
    });
  }
});

describe('#66 AC3: nic se neplatí znovu', () => {
  it('otisky jsou ve fingerprints.json zvlášť pro každý jazyk a čeština má stejné hodnoty jako dřív', () => {
    const fingerprints = JSON.parse(fingerprintsJson) as Record<string, unknown>;
    expect(fingerprints.cs).toEqual(CZECH_FINGERPRINTS_BEFORE);
  });

  it('první spuštění s cs na skutečných souborech server nevolá a nic nezmění', async () => {
    const files = memoryFiles();
    await files.writeFile(MANIFEST_PATH, new TextEncoder().encode(fingerprintsJson));
    for (const [path, bytes] of Object.entries(REAL_RECORDINGS)) {
      await files.writeFile(path, bytes);
    }
    const before = files.snapshot();
    const server = serverThatMustNotBeCalled();

    const { result, log } = await runCommand(['cs'], files, server, {
      textFiles: REAL_TEXT_FILES,
      voices: JSON.parse(voiceConfigJson) as unknown,
      loadSentences: async (language) => voiceSentences(REAL_TEXTS[language]),
    });

    expect(log.join('\n')).toContain('přeskočeno 4');
    expect(server.calls).toHaveLength(0);
    expect(result.ok).toBe(true);
    expect(result.skipped).toHaveLength(GUIDE_SCRIPT.length);
    expect(files.snapshot()).toEqual(before);
  });

  it('opakované spuštění téhož jazyka server nevolá', async () => {
    const files = await bothLanguagesRecorded();
    const server = alwaysMp3();
    await runCommand(['xx'], files, server);
    await runCommand(['cs'], files, server);
    expect(server.calls).toHaveLength(0);
  });

  it('změna hlasu jednoho jazyka obnoví jen nahrávky toho jazyka', async () => {
    const files = await bothLanguagesRecorded();
    const voices = { ...VOICES, xx: { ...OTHER_VOICE, voiceId: 'novyHlasXX' } };

    const otherServer = alwaysMp3(fakeMp3({ fill: 3 }));
    await runCommand(['xx'], files, otherServer, { voices });
    expect(otherServer.calls).toHaveLength(SENTENCES.xx.length);

    const czechServer = alwaysMp3();
    await runCommand(['cs'], files, czechServer, { voices });
    expect(czechServer.calls).toHaveLength(0);
  });
});

describe('#66 AC4: jiný jazyk zůstane netknutý', () => {
  it('po spuštění pro cs mají nahrávky i otisky jazyka xx stejný obsah', async () => {
    const files = await bothLanguagesRecorded();
    const recordingsBefore = recordingsIn(files, 'xx');
    const fingerprintsBefore = await fingerprintsOf(files, 'xx');

    await runCommand(['cs'], files, alwaysMp3(fakeMp3({ fill: 9 })), {
      loadSentences: async () => [{ id: 'jinaVeta', text: 'Úplně jiná věta.' }],
    });

    expect(recordingsIn(files, 'xx')).toEqual(recordingsBefore);
    expect(await fingerprintsOf(files, 'xx')).toEqual(fingerprintsBefore);
    expect(fingerprintsBefore).toBeDefined();
  });

  it('nahrávky, které ve scénáři už nejsou, se mažou jen ve složce zvoleného jazyka', async () => {
    const files = await bothLanguagesRecorded();
    const { result } = await runCommand(['cs'], files, alwaysMp3(), {
      loadSentences: async () => SENTENCES.cs.slice(0, 1),
    });
    expect(result.deleted).toEqual(['summary']);
    expect(Object.keys(recordingsIn(files, 'cs'))).toEqual([
      'public/voice/cs/counting/guide/maxNumber.mp3',
    ]);
    expect(Object.keys(recordingsIn(files, 'xx'))).toHaveLength(2);
  });

  it('limit 1 MB platí pro každý jazyk zvlášť: velké nahrávky jiného jazyka se nepočítají', async () => {
    const files = memoryFiles();
    const big = fakeMp3({ bytes: 140_000 });
    const sixSentences = (prefix: string): VoiceSentence[] =>
      Array.from({ length: 6 }, (_, index) => ({
        id: `s${index + 1}`,
        text: `${prefix} věta ${index + 1}.`,
      }));
    // Každý jazyk má 6 × 140 kB = 840 kB, dohromady by to bylo přes 1 MB.
    const options = { loadSentences: async (language: string) => sixSentences(language) };
    expect((await runCommand(['xx'], files, alwaysMp3(big), options)).result.ok).toBe(true);
    const { result } = await runCommand(['cs'], files, alwaysMp3(big), options);
    expect(result.ok).toBe(true);
    expect(result.created).toHaveLength(6);
  });

  it('limit 1 MB dál hlídá nahrávky zvoleného jazyka', async () => {
    const files = memoryFiles();
    const big = fakeMp3({ bytes: 140_000 });
    const tenSentences = Array.from({ length: 10 }, (_, index) => ({
      id: `s${index + 1}`,
      text: `Věta ${index + 1}.`,
    }));
    const { result } = await runCommand(['cs'], files, alwaysMp3(big), {
      loadSentences: async () => tenSentences,
    });
    expect(result.ok).toBe(false);
    expect(Object.keys(files.snapshot())).toEqual([]);
  });
});

describe('#66 AC5: chybné spuštění nic nezmění', () => {
  const wrongRuns: readonly [string, readonly string[]][] = [
    ['bez jazyka', []],
    ['s víc argumenty', ['cs', 'xx']],
    ['s kódem bez souboru textů Počítání', ['de']],
    ['s kódem velkými písmeny (CS)', ['CS']],
    ['s kódem s oblastí (cs-CZ)', ['cs-CZ']],
    ['s cestou místo kódu (../x)', ['../x']],
    ['s názvem souboru místo kódu (cs.ts)', ['cs.ts']],
    ['se společným souborem textů místo jazyka (countingTexts)', ['countingTexts']],
    ['s mezerou kolem kódu', [' cs']],
    ['s jazykem bez nastaveného hlasu', ['yy']],
    ['s jazykem, který má prázdné ID hlasu', ['zz']],
  ];

  for (const [name, args] of wrongRuns) {
    describe(name, () => {
      async function wrongRun(): Promise<RunOutput & { before: Record<string, string> }> {
        const files = await bothLanguagesRecorded();
        await files.writeFile(`${voiceDir('cs')}/summary.mp3.tmp`, new Uint8Array([1]));
        const before = files.snapshot();
        const output = await runCommand(args, files, serverThatMustNotBeCalled(), {
          textFiles: [...TEXT_FILES, 'yy.ts', 'zz.ts'],
          voices: { ...VOICES, zz: { ...OTHER_VOICE, voiceId: '' } },
        });
        expect(files.snapshot()).toEqual(before);
        return { ...output, before };
      }

      it('server se nevolá, žádný soubor se nezmění a skript skončí neúspěchem', async () => {
        const { result, loaded } = await wrongRun();
        expect(result.ok).toBe(false);
        expect(loaded).toEqual([]);
      });

      it('vypíše jednu českou zprávu s jazyky a přesným příkazem', async () => {
        const { log } = await wrongRun();
        expect(log).toHaveLength(1);
        const message = log[0] ?? '';
        expect(looksCzech(message)).toBe(true);
        expect(message).toContain('npm run voice -- <jazyk>');
        expect(message).toMatch(/\bcs\b/);
        expect(message).toMatch(/\bxx\b/);
      });

      it('mezi jazyky, pro které jde skript spustit, nejsou jazyky bez hlasu', async () => {
        const { log } = await wrongRun();
        const languagesPart = (log[0] ?? '').split(':').pop() ?? '';
        expect(languagesPart).not.toMatch(/\byy\b|\bzz\b/);
      });
    });
  }

  it('bez nastavení hlasů vůbec skript vypíše českou zprávu a server nevolá', async () => {
    const files = memoryFiles();
    const { result, log } = await runCommand(['cs'], files, serverThatMustNotBeCalled(), {
      voices: null,
    });
    expect(result.ok).toBe(false);
    expect(log).toHaveLength(1);
    expect(log[0]).toContain('npm run voice -- <jazyk>');
    expect(files.snapshot()).toEqual({});
  });
});

describe('#66 AC6: bezpečnost a dokumentace', () => {
  it('klíč se čte z proměnné prostředí a nikam se nezapíše', async () => {
    const files = memoryFiles();
    const server = alwaysMp3();
    const { log } = await runCommand(['xx'], files, server);
    expect(server.calls.every((call) => call.apiKey === KEY)).toBe(true);
    for (const content of Object.values(files.snapshot())) {
      const text = new TextDecoder().decode(
        Uint8Array.from(content.match(/../g) ?? [], (byte) => parseInt(byte, 16)),
      );
      expect(text).not.toContain(KEY);
    }
    expect(log.join('\n')).not.toContain(KEY);
  });

  it('bez klíče se nic nestáhne ani nezmění', async () => {
    const files = memoryFiles();
    const { result } = await runCommand(['cs'], files, serverThatMustNotBeCalled(), { env: {} });
    expect(result.ok).toBe(false);
    expect(files.snapshot()).toEqual({});
  });

  it('skript připomene doplnit hlas zvoleného jazyka do public/licence.txt', async () => {
    const { log } = await runCommand(['xx'], memoryFiles(), alwaysMp3());
    const reminder = log.find((line) => line.includes('public/licence.txt'));
    expect(reminder).toBeDefined();
    expect(looksCzech(reminder ?? '')).toBe(true);
    expect(reminder).toMatch(/\bxx\b/);
  });

  it('CLAUDE.md v postupu přidání jazyka uvádí přesný příkaz a kam zapsat hlas jazyka', () => {
    expect(claudeMd).toContain('npm run voice -- <jazyk>');
    expect(claudeMd).toContain('tools/voice/voice.config.json');
    expect(claudeMd).not.toContain('až po úkolu');
  });
});

// ---------------------------------------------------------------------------
// Skutečné soubory repozitáře
// ---------------------------------------------------------------------------

/** Nahrávky Počítání v `public/voice/`, podle cesty od kořene repa. */
const REAL_RECORDINGS: Record<string, Uint8Array> = Object.fromEntries(
  Object.entries(
    import.meta.glob<string>('../../../public/voice/*/counting/guide/*.mp3', {
      query: '?inline',
      import: 'default',
      eager: true,
    }),
  ).map(([path, dataUrl]) => [path.replace('../../../', ''), bytesOfDataUrl(dataUrl)]),
);

const REAL_TEXT_MODULES = import.meta.glob<CountingTexts>(
  '../../../src/games/counting/texts/*.ts',
  {
    import: 'default',
    eager: true,
  },
);

/** Názvy souborů ve složce textů Počítání. */
const REAL_TEXT_FILES = Object.keys(REAL_TEXT_MODULES).map((path) => path.split('/').pop() ?? '');

/** Texty Počítání podle kódu jazyka (jen soubory jazyků). */
const REAL_TEXTS: Record<string, CountingTexts> = Object.fromEntries(
  Object.entries(REAL_TEXT_MODULES)
    .map(([path, texts]) => [(path.split('/').pop() ?? '').replace(/\.ts$/, ''), texts] as const)
    .filter(([language]) => /^[a-z]+$/.test(language)),
);

function bytesOfDataUrl(dataUrl: string): Uint8Array {
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
}
