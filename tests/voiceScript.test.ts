import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { voiceSentences } from '../src/logic/guideScript';
import { API_KEY_ENV, makeVoice } from '../tools/voice/voiceCore';
import type { MakeVoiceOptions, VoiceConfig, VoiceSentence } from '../tools/voice/voiceCore';
import {
  MANIFEST_PATH,
  OUTPUT_DIR,
  alwaysMp3,
  fakeMp3,
  fakeServer,
  looksCzech,
  memoryFiles,
} from './voiceFakes';
import type { FakeReply, FakeServer, MemoryFiles } from './voiceFakes';

/**
 * Testy k #50 AC2–AC7: skript, kterým vlastník u sebe vytvoří nahrávky
 * průvodce přes ElevenLabs. Server je napodobený, soubory jsou v paměti
 * a skutečný `fetch` je v testech zakázaný, takže `npm test` nikdy nevolá
 * síť a nepotřebuje klíč. Hlavička mp3 je ve `voiceMp3.test.ts`, scénář
 * ve `guideScript.test.ts`.
 */

const KEY = 'sk_test_TAJNY_KLIC_7f3a9c51';
const VOICE_ID = 'klidnyCeskyHlas01';

const CONFIG: VoiceConfig = {
  voiceId: VOICE_ID,
  modelId: 'eleven_multilingual_v2',
  voiceSettings: { stability: 0.5, similarity_boost: 0.75 },
};

const SENTENCES: readonly VoiceSentence[] = [
  {
    id: 'question',
    text: 'Do které třídy dítě chodí? Podle odpovědi hru předvyplníme. Odpověď se neukládá.',
  },
  {
    id: 'maxNumber.preschool',
    text: 'Největší číslo, které se v příkladech objeví. Doporučujeme do pěti. Dítě to spočítá na prstech ruky.',
  },
  {
    id: 'summary',
    text: 'Hotovo. Volby můžete ještě změnit ťuknutím. Později je změníte podržením kolečka vpravo nahoře.',
  },
];

/** Limity ze zadání; testy se drží daleko od hranice, ať je KB 1000 nebo 1024 bajtů. */
const CLEARLY_UNDER_150_KB = 140_000;
const CLEARLY_OVER_150_KB = 200_000;

interface RunOutput {
  readonly result: Awaited<ReturnType<typeof makeVoice>>;
  readonly log: string[];
}

/** Vlastník spustí skript. Bez úprav s klíčem, zvoleným hlasem a scénářem `SENTENCES`. */
async function runScript(
  files: MemoryFiles,
  server: FakeServer,
  overrides: Partial<MakeVoiceOptions> = {},
): Promise<RunOutput> {
  const log: string[] = [];
  const result = await makeVoice({
    sentences: SENTENCES,
    config: CONFIG,
    env: { [API_KEY_ENV]: KEY },
    fetch: server.fetch,
    files,
    outputDir: OUTPUT_DIR,
    manifestPath: MANIFEST_PATH,
    log: (line) => log.push(line),
    ...overrides,
  });
  return { result, log };
}

/** Repozitář po dřívějším úspěšném běhu: nahrávky vyplněné bajtem `fill`. */
async function previousRun(
  sentences: readonly VoiceSentence[] = SENTENCES,
  fill = 1,
): Promise<MemoryFiles> {
  const files = memoryFiles();
  const { result } = await runScript(files, alwaysMp3(fakeMp3({ fill })), { sentences });
  expect(result.ok).toBe(true);
  return files;
}

function withText(
  sentences: readonly VoiceSentence[],
  id: string,
  text: string,
): readonly VoiceSentence[] {
  return sentences.map((sentence) => (sentence.id === id ? { id, text } : sentence));
}

function textOf(id: string, sentences: readonly VoiceSentence[] = SENTENCES): string {
  const sentence = sentences.find((candidate) => candidate.id === id);
  if (sentence === undefined) {
    throw new Error(`věta ${id} ve scénáři není`);
  }
  return sentence.text;
}

/** `count` vět s1, s2, … s krátkým textem. */
function numberedSentences(count: number, prefix = 's'): VoiceSentence[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `${prefix}${index + 1}`,
    text: `Věta ${prefix}${index + 1} pro průvodce.`,
  }));
}

/** Řádek souhrnu: obsahuje všechny čtyři počty. */
function summaryLine(log: readonly string[]): string {
  const line = log.find(
    (candidate) =>
      /vytvořen/i.test(candidate) &&
      /přeskočen/i.test(candidate) &&
      /smazán/i.test(candidate) &&
      /selhal/i.test(candidate),
  );
  if (line === undefined) {
    throw new Error(`souhrn ve výpisu chybí:\n${log.join('\n')}`);
  }
  return line;
}

/** Číslo, které v souhrnu stojí hned za slovem `word`. */
function countAfter(line: string, word: string): number {
  const match = new RegExp(`${word}\\D*(\\d+)`, 'i').exec(line);
  return Number(match?.[1]);
}

beforeEach(() => {
  // AC7: kdyby skript sáhl na skutečnou síť místo předaného fetch, test spadne.
  vi.stubGlobal('fetch', () => {
    throw new Error('Skutečná síť se v testech nevolá.');
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('jeden příkaz vytvoří nahrávky přes ElevenLabs (#50 AC2)', () => {
  it('vlastník spustí skript a pro každou větu vznikne nahrávka <id>.mp3', async () => {
    const files = memoryFiles();
    const { result } = await runScript(files, alwaysMp3());
    expect(result.ok).toBe(true);
    expect(files.recordings()).toEqual(
      ['maxNumber.preschool.mp3', 'question.mp3', 'summary.mp3'].sort(),
    );
  });

  it('nahrávka ve složce je přesně to, co poslal server', async () => {
    const files = memoryFiles();
    const bytes = fakeMp3({ fill: 7 });
    await runScript(files, alwaysMp3(bytes));
    expect(files.recording('question')).toEqual(bytes);
  });

  it('každá věta se pošle serveru celá, zvoleným hlasem a modelem z nastavení skriptu', async () => {
    const files = memoryFiles();
    const server = alwaysMp3();
    await runScript(files, server);
    expect(server.texts().sort()).toEqual(SENTENCES.map((sentence) => sentence.text).sort());
    for (const call of server.calls) {
      expect(call.url.hostname).toBe('api.elevenlabs.io');
      expect(call.url.pathname).toBe(`/v1/text-to-speech/${VOICE_ID}`);
      expect(call.body.model_id).toBe(CONFIG.modelId);
      expect(call.body.voice_settings).toEqual(CONFIG.voiceSettings);
    }
  });

  it('klíč pošle serveru z proměnné prostředí ELEVENLABS_API_KEY', async () => {
    expect(API_KEY_ENV).toBe('ELEVENLABS_API_KEY');
    const server = alwaysMp3();
    await runScript(memoryFiles(), server);
    expect(server.calls.length).toBeGreaterThan(0);
    for (const call of server.calls) {
      expect(call.apiKey).toBe(KEY);
    }
  });

  it('se scénářem průvodce vytvoří 11 nahrávek, jednu na každou větu', async () => {
    const files = memoryFiles();
    const server = alwaysMp3();
    const sentences = voiceSentences();
    const { result } = await runScript(files, server, { sentences });
    expect(result.ok).toBe(true);
    expect(files.recordings()).toEqual(sentences.map((sentence) => `${sentence.id}.mp3`).sort());
    expect(server.calls).toHaveLength(11);
  });

  describe('bez klíče skript vypíše českou zprávu a nic nezmění', () => {
    const missingKeys: readonly [string, Record<string, string | undefined>][] = [
      ['proměnná chybí', {}],
      ['proměnná je prázdná', { [API_KEY_ENV]: '' }],
      ['proměnná obsahuje jen mezery', { [API_KEY_ENV]: '   ' }],
    ];
    for (const [name, env] of missingKeys) {
      it(`${name}: server se nevolá, nahrávky ani otisky se nezmění`, async () => {
        const files = await previousRun();
        const before = files.snapshot();
        const server = alwaysMp3(fakeMp3({ fill: 2 }));
        const { result, log } = await runScript(files, server, {
          env,
          sentences: withText(SENTENCES, 'question', 'Úplně nová otázka.'),
        });
        expect(result.ok).toBe(false);
        expect(server.calls).toHaveLength(0);
        expect(files.snapshot()).toEqual(before);
        expect(log.length).toBeGreaterThan(0);
        expect(log.some(looksCzech)).toBe(true);
        expect(log.join('\n')).toContain(API_KEY_ENV);
      });
    }

    it('klíč jinde než v proměnné prostředí (třeba v nastavení skriptu) se nepoužije', async () => {
      const server = alwaysMp3();
      const configWithKey = { ...CONFIG, apiKey: KEY } as VoiceConfig;
      const files = memoryFiles();
      const { result } = await runScript(files, server, { env: {}, config: configWithKey });
      expect(result.ok).toBe(false);
      expect(server.calls).toHaveLength(0);
      expect(files.recordings()).toEqual([]);
    });
  });

  for (const [name, voiceId] of [
    ['prázdné', ''],
    ['jen z mezer', '  '],
  ] as const) {
    it(`bez zvoleného ID hlasu (${name}) skript vypíše českou zprávu, nic nezmění a server nevolá`, async () => {
      const files = await previousRun();
      const before = files.snapshot();
      const server = alwaysMp3(fakeMp3({ fill: 2 }));
      const { result, log } = await runScript(files, server, {
        config: { ...CONFIG, voiceId },
        sentences: withText(SENTENCES, 'question', 'Úplně nová otázka.'),
      });
      expect(result.ok).toBe(false);
      expect(server.calls).toHaveLength(0);
      expect(files.snapshot()).toEqual(before);
      expect(log.some(looksCzech)).toBe(true);
    });
  }

  it('když server odmítne klíč, skript vypíše jednu českou zprávu, nic nezmění a dál to nezkouší', async () => {
    const files = await previousRun();
    const before = files.snapshot();
    const server = fakeServer(() => ({ kind: 'status', status: 401 }));
    const { result, log } = await runScript(files, server, {
      sentences: [
        ...withText(SENTENCES, 'question', 'Úplně nová otázka.'),
        ...numberedSentences(3),
      ],
    });
    expect(result.ok).toBe(false);
    expect(log).toHaveLength(1);
    expect(looksCzech(log[0] ?? '')).toBe(true);
    expect(server.calls).toHaveLength(1);
    expect(files.snapshot()).toEqual(before);
  });

  it('když server odmítne klíč až u druhé věty, nic se neuloží ani nesmaže', async () => {
    const files = await previousRun();
    const before = files.snapshot();
    let calls = 0;
    const server = fakeServer(() => {
      calls += 1;
      return calls === 1
        ? { kind: 'mp3', bytes: fakeMp3({ fill: 3 }) }
        : { kind: 'status', status: 401 };
    });
    const { result, log } = await runScript(files, server, {
      sentences: [
        { id: 'question', text: 'Nová otázka.' },
        { id: 'summary', text: 'Nové shrnutí.' },
      ],
    });
    expect(result.ok).toBe(false);
    expect(log).toHaveLength(1);
    expect(files.snapshot()).toEqual(before);
  });

  describe('klíč se nikde nezapisuje ani nevypisuje', () => {
    const replies: readonly [string, FakeReply][] = [
      ['po úspěšném běhu', { kind: 'mp3', bytes: fakeMp3() }],
      [
        'když server klíč odmítne a v odpovědi ho zopakuje',
        { kind: 'status', status: 401, body: `{"detail":"Invalid API key: ${KEY}"}` },
      ],
      [
        'když server vrátí chybu s klíčem v odpovědi',
        { kind: 'status', status: 500, body: `Internal error for key ${KEY}` },
      ],
      [
        'když spadne síť a chybová zpráva klíč obsahuje',
        { kind: 'networkError', message: `fetch failed (xi-api-key: ${KEY})` },
      ],
    ];
    for (const [name, reply] of replies) {
      it(name, async () => {
        const files = memoryFiles();
        const { result, log } = await runScript(
          files,
          fakeServer(() => reply),
        );
        expect(log.join('\n')).not.toContain(KEY);
        expect(JSON.stringify(result)).not.toContain(KEY);
        const keyAsHex = Array.from(new TextEncoder().encode(KEY), (byte) =>
          byte.toString(16).padStart(2, '0'),
        ).join('');
        for (const [path, content] of Object.entries(files.snapshot())) {
          expect(content, path).not.toContain(keyAsHex);
        }
      });
    }
  });
});

describe('neplatit dvakrát (#50 AC3)', () => {
  it('při druhém spuštění se stejným scénářem a hlasem se server nevolá', async () => {
    const files = await previousRun();
    const before = files.snapshot();
    const server = alwaysMp3(fakeMp3({ fill: 2 }));
    const { result } = await runScript(files, server);
    expect(result.ok).toBe(true);
    expect(server.calls).toHaveLength(0);
    expect(result.skipped.slice().sort()).toEqual(SENTENCES.map((s) => s.id).sort());
    expect(files.snapshot()).toEqual(before);
  });

  it('ke každé nahrávce se uloží otisk, takže i po čase se znovu neplatí', async () => {
    const files = await previousRun();
    for (let run = 0; run < 3; run += 1) {
      const server = alwaysMp3();
      await runScript(files, server);
      expect(server.calls, `běh ${run + 2}`).toHaveLength(0);
    }
  });

  it('změněný text jedné věty vytvoří znovu jen tuto větu', async () => {
    const files = await previousRun();
    const changed = withText(SENTENCES, 'summary', 'Hotovo. Volby změníte ťuknutím.');
    const bytes = fakeMp3({ fill: 9 });
    const server = alwaysMp3(bytes);
    const { result } = await runScript(files, server, { sentences: changed });
    expect(server.texts()).toEqual(['Hotovo. Volby změníte ťuknutím.']);
    expect(result.created).toEqual(['summary']);
    expect(files.recording('summary')).toEqual(bytes);
    expect(files.recording('question')).toEqual(fakeMp3({ fill: 1 }));
  });

  it('nová věta ve scénáři se vytvoří, ostatní se přeskočí', async () => {
    const files = await previousRun();
    const server = alwaysMp3();
    const { result } = await runScript(files, server, {
      sentences: [...SENTENCES, { id: 'answerInput.firstGrade', text: 'Nová věta.' }],
    });
    expect(server.texts()).toEqual(['Nová věta.']);
    expect(result.created).toEqual(['answerInput.firstGrade']);
    expect(files.recordings()).toContain('answerInput.firstGrade.mp3');
  });

  const voiceChanges: readonly [string, VoiceConfig][] = [
    ['jiný hlas', { ...CONFIG, voiceId: 'jinyHlas02' }],
    ['jiný model', { ...CONFIG, modelId: 'eleven_turbo_v2_5' }],
    [
      'jiná stabilita hlasu',
      { ...CONFIG, voiceSettings: { ...CONFIG.voiceSettings, stability: 0.6 } },
    ],
    [
      'nové nastavení hlasu navíc',
      { ...CONFIG, voiceSettings: { ...CONFIG.voiceSettings, use_speaker_boost: true } },
    ],
  ];
  for (const [name, config] of voiceChanges) {
    it(`${name} znamená, že se všechny nahrávky vytvoří znovu`, async () => {
      const files = await previousRun();
      const server = alwaysMp3(fakeMp3({ fill: 4 }));
      const { result } = await runScript(files, server, { config });
      expect(result.ok).toBe(true);
      expect(server.calls).toHaveLength(SENTENCES.length);
      expect(files.recording('question')).toEqual(fakeMp3({ fill: 4 }));
    });
  }

  it('po návratu k původnímu nastavení hlasu se nahrávky vytvoří znovu (otisk patří k poslední nahrávce)', async () => {
    const files = await previousRun();
    await runScript(files, alwaysMp3(), { config: { ...CONFIG, voiceId: 'jinyHlas02' } });
    const server = alwaysMp3();
    await runScript(files, server);
    expect(server.calls).toHaveLength(SENTENCES.length);
  });

  it('nahrávku věty, která ve scénáři už není, skript smaže a vypíše to', async () => {
    const files = await previousRun();
    const server = alwaysMp3();
    const remaining = SENTENCES.filter((sentence) => sentence.id !== 'maxNumber.preschool');
    const { result, log } = await runScript(files, server, { sentences: remaining });
    expect(result.ok).toBe(true);
    expect(result.deleted).toEqual(['maxNumber.preschool']);
    expect(files.recordings()).not.toContain('maxNumber.preschool.mp3');
    expect(log.some((line) => line.includes('maxNumber.preschool') && looksCzech(line))).toBe(true);
    expect(server.calls).toHaveLength(0);
  });

  it('se smazanou nahrávkou se smaže i otisk: když se věta vrátí, vytvoří se znovu', async () => {
    const files = await previousRun();
    const remaining = SENTENCES.filter((sentence) => sentence.id !== 'maxNumber.preschool');
    await runScript(files, alwaysMp3(), { sentences: remaining });
    const server = alwaysMp3();
    const { result } = await runScript(files, server);
    expect(server.texts()).toEqual([textOf('maxNumber.preschool')]);
    expect(result.created).toEqual(['maxNumber.preschool']);
  });

  it('jiné soubory než mp3 ve složce s nahrávkami skript nemaže', async () => {
    const files = await previousRun();
    await files.writeFile(`${OUTPUT_DIR}/README.txt`, new TextEncoder().encode('poznámka'));
    await runScript(files, alwaysMp3(), { sentences: SENTENCES.slice(0, 1) });
    expect(Object.keys(files.snapshot())).toContain(`${OUTPUT_DIR}/README.txt`);
  });

  it('když výpadek sítě přeruší stahování, zůstane u věty stará nahrávka i otisk', async () => {
    const files = await previousRun();
    const newText = 'Do které třídy chodí vaše dítě?';
    const server = fakeServer((text) =>
      text === newText
        ? { kind: 'cutOff', bytes: fakeMp3({ fill: 5 }) }
        : { kind: 'mp3', bytes: fakeMp3({ fill: 6 }) },
    );
    const { result } = await runScript(files, server, {
      sentences: withText(SENTENCES, 'question', newText),
    });
    expect(result.ok).toBe(false);
    expect(result.failed).toEqual(['question']);
    expect(files.recording('question')).toEqual(fakeMp3({ fill: 1 }));

    // Starý otisk zůstal: s původním textem se věta znovu neplatí.
    const again = alwaysMp3();
    await runScript(files, again);
    expect(again.calls).toHaveLength(0);
  });

  it('po přerušení (Ctrl+C) uprostřed stahování zůstane stará nahrávka i otisk', async () => {
    const files = await previousRun();
    const before = files.snapshot();
    const interrupt = new AbortController();
    const server = fakeServer(() => ({
      kind: 'stall',
      bytes: fakeMp3({ fill: 5 }),
      onStarted: () => interrupt.abort(),
    }));
    const { result } = await runScript(files, server, {
      sentences: SENTENCES.map((sentence) => ({ ...sentence, text: `${sentence.text} Znovu.` })),
      signal: interrupt.signal,
    });
    expect(result.ok).toBe(false);
    expect(files.snapshot()).toEqual(before);

    const again = alwaysMp3();
    await runScript(files, again);
    expect(again.calls).toHaveLength(0);
  });

  it('přerušení před začátkem nic nezmění a server se nevolá', async () => {
    const files = await previousRun();
    const before = files.snapshot();
    const interrupt = new AbortController();
    interrupt.abort();
    const server = alwaysMp3();
    const { result } = await runScript(files, server, {
      sentences: withText(SENTENCES, 'question', 'Nová otázka.'),
      signal: interrupt.signal,
    });
    expect(result.ok).toBe(false);
    expect(server.calls).toHaveLength(0);
    expect(files.snapshot()).toEqual(before);
  });
});

describe('chyba u jedné věty (#50 AC4)', () => {
  const NEW_QUESTION = 'Do které třídy chodí vaše dítě?';
  const NEW_SUMMARY = 'Hotovo. Volby můžete změnit ťuknutím.';

  const badReplies: readonly [string, FakeReply][] = [
    ['server vrátí chybu 500', { kind: 'status', status: 500 }],
    ['server vrátí chybu 429 (překročený limit)', { kind: 'status', status: 429 }],
    ['spadne síť', { kind: 'networkError' }],
    [
      'nahrávka má víc než 150 KB',
      { kind: 'mp3', bytes: fakeMp3({ bytes: CLEARLY_OVER_150_KB, fill: 5 }) },
    ],
    ['nahrávka je stereo', { kind: 'mp3', bytes: fakeMp3({ channelMode: 'stereo', fill: 5 }) }],
    [
      'nahrávka je joint stereo',
      { kind: 'mp3', bytes: fakeMp3({ channelMode: 'jointStereo', fill: 5 }) },
    ],
    ['nahrávka má 80 kbps', { kind: 'mp3', bytes: fakeMp3({ bitrateKbps: 80, fill: 5 }) }],
    ['nahrávka má 128 kbps', { kind: 'mp3', bytes: fakeMp3({ bitrateKbps: 128, fill: 5 }) }],
    [
      'odpověď vůbec není mp3',
      { kind: 'mp3', bytes: new TextEncoder().encode('<html>chyba</html>') },
    ],
    ['odpověď je prázdná', { kind: 'mp3', bytes: new Uint8Array() }],
  ];

  for (const [name, badReply] of badReplies) {
    describe(`když ${name}`, () => {
      async function runWithOneBadSentence(): Promise<{ files: MemoryFiles; output: RunOutput }> {
        const files = await previousRun();
        const server = fakeServer((text) =>
          text === NEW_QUESTION ? badReply : { kind: 'mp3', bytes: fakeMp3({ fill: 6 }) },
        );
        const sentences = withText(
          withText(SENTENCES, 'question', NEW_QUESTION),
          'summary',
          NEW_SUMMARY,
        );
        const output = await runScript(files, server, { sentences });
        return { files, output };
      }

      it('u té věty zůstane stará nahrávka', async () => {
        const { files } = await runWithOneBadSentence();
        expect(files.recording('question')).toEqual(fakeMp3({ fill: 1 }));
      });

      it('u té věty zůstane starý otisk', async () => {
        const { files } = await runWithOneBadSentence();
        const again = alwaysMp3();
        await runScript(files, again, { sentences: withText(SENTENCES, 'summary', NEW_SUMMARY) });
        expect(again.calls).toHaveLength(0);
      });

      it('ostatní věty se dokončí', async () => {
        const { files, output } = await runWithOneBadSentence();
        expect(files.recording('summary')).toEqual(fakeMp3({ fill: 6 }));
        expect(output.result.created).toEqual(['summary']);
        expect(output.result.skipped).toEqual(['maxNumber.preschool']);
      });

      it('skript chybnou větu česky vypíše a skončí neúspěchem', async () => {
        const { output } = await runWithOneBadSentence();
        expect(output.result.ok).toBe(false);
        expect(output.result.failed).toEqual(['question']);
        expect(output.log.some((line) => line.includes('question') && looksCzech(line))).toBe(true);
      });
    });
  }

  it('nová věta, která selže, nenechá ve složce žádnou nahrávku ani otisk', async () => {
    const files = await previousRun();
    const server = fakeServer((text) =>
      text === 'Nová věta.' ? { kind: 'status', status: 500 } : { kind: 'mp3', bytes: fakeMp3() },
    );
    await runScript(files, server, {
      sentences: [...SENTENCES, { id: 'answerInput.preschool', text: 'Nová věta.' }],
    });
    expect(files.recordings()).not.toContain('answerInput.preschool.mp3');

    const again = alwaysMp3();
    await runScript(files, again, {
      sentences: [...SENTENCES, { id: 'answerInput.preschool', text: 'Nová věta.' }],
    });
    expect(again.texts()).toEqual(['Nová věta.']);
  });

  it('když selže víc vět, vypíše všechny', async () => {
    const files = memoryFiles();
    const server = fakeServer((text) =>
      text === textOf('summary')
        ? { kind: 'mp3', bytes: fakeMp3() }
        : { kind: 'status', status: 500 },
    );
    const { result, log } = await runScript(files, server);
    expect(result.ok).toBe(false);
    expect(result.failed.slice().sort()).toEqual(['maxNumber.preschool', 'question']);
    const output = log.join('\n');
    expect(output).toContain('question');
    expect(output).toContain('maxNumber.preschool');
    expect(files.recordings()).toEqual(['summary.mp3']);
  });

  it('nahrávka těsně pod 150 KB, mono a 64 kbps se přijme', async () => {
    const files = memoryFiles();
    const bytes = fakeMp3({ bytes: CLEARLY_UNDER_150_KB, bitrateKbps: 64 });
    const { result } = await runScript(files, alwaysMp3(bytes), {
      sentences: SENTENCES.slice(0, 1),
    });
    expect(result.ok).toBe(true);
    expect(files.recording('question')).toEqual(bytes);
  });
});

describe('malé soubory (#50 AC5)', () => {
  it('skript si od serveru vyžádá mp3 s datovým tokem nejvýš 64 kbps', async () => {
    const server = alwaysMp3();
    await runScript(memoryFiles(), server);
    expect(server.calls.length).toBeGreaterThan(0);
    for (const call of server.calls) {
      const format = call.url.searchParams.get('output_format') ?? '';
      const match = /^mp3_(\d+)_(\d+)$/.exec(format);
      expect(match, format).not.toBeNull();
      expect(Number(match?.[2])).toBeLessThanOrEqual(64);
    }
  });

  for (const [name, bytes] of [
    ['mono 32 kbps při 22,05 kHz', fakeMp3({ bitrateKbps: 32, sampleRateHz: 22050 })],
    ['mono 64 kbps při 44,1 kHz', fakeMp3({ bitrateKbps: 64, sampleRateHz: 44100 })],
    ['mono 48 kbps se značkou ID3', fakeMp3({ bitrateKbps: 48, id3TagBytes: 200 })],
  ] as const) {
    it(`nahrávku ${name} přijme`, async () => {
      const files = memoryFiles();
      const { result } = await runScript(files, alwaysMp3(bytes));
      expect(result.ok).toBe(true);
      expect(result.failed).toEqual([]);
    });
  }

  it('nahrávku stereo 64 kbps odmítne jako chybnou', async () => {
    const files = memoryFiles();
    const { result } = await runScript(files, alwaysMp3(fakeMp3({ channelMode: 'stereo' })), {
      sentences: SENTENCES.slice(0, 1),
    });
    expect(result.failed).toEqual(['question']);
    expect(files.recordings()).toEqual([]);
  });

  it('když všechny nahrávky dohromady přesáhnou 1 MB už při prvním běhu, nic se neuloží', async () => {
    const files = memoryFiles();
    const before = files.snapshot();
    const server = alwaysMp3(fakeMp3({ bytes: 100_000 }));
    const { result, log } = await runScript(files, server, { sentences: numberedSentences(11) });
    expect(result.ok).toBe(false);
    expect(files.snapshot()).toEqual(before);
    expect(log.some((line) => looksCzech(line) && /MB/.test(line))).toBe(true);
  });

  it('do celku se počítají i nahrávky z dřívějška, které zůstanou: nic se neuloží ani nesmaže', async () => {
    const files = memoryFiles();
    const old = numberedSentences(10);
    await runScript(files, alwaysMp3(fakeMp3({ bytes: 90_000, fill: 1 })), { sentences: old });
    expect(files.recordings()).toHaveLength(10);
    const before = files.snapshot();

    // 10 starých po 90 KB zůstává, 2 nové po 90 KB přibydou: 1,08 MB.
    // Navíc se změní text jedné staré a jedna stará ze scénáře zmizí.
    const sentences = [
      ...withText(old.slice(0, 9), 's1', 'Změněná věta.'),
      ...numberedSentences(3, 'n'),
    ];
    const { result, log } = await runScript(files, alwaysMp3(fakeMp3({ bytes: 90_000, fill: 2 })), {
      sentences,
    });
    expect(result.ok).toBe(false);
    expect(files.snapshot()).toEqual(before);
    expect(log.some(looksCzech)).toBe(true);
  });

  it('po překročení 1 MB zůstanou otisky jako před spuštěním, takže další běh nic nepřeskočí navíc', async () => {
    const files = memoryFiles();
    const old = numberedSentences(10);
    await runScript(files, alwaysMp3(fakeMp3({ bytes: 90_000 })), { sentences: old });
    await runScript(files, alwaysMp3(fakeMp3({ bytes: 90_000 })), {
      sentences: [...old, ...numberedSentences(2, 'n')],
    });
    // S menšími nahrávkami se nové věty vytvoří, staré se přeskočí.
    const server = alwaysMp3(fakeMp3({ bytes: 10_000 }));
    const { result } = await runScript(files, server, {
      sentences: [...old, ...numberedSentences(2, 'n')],
    });
    expect(result.ok).toBe(true);
    expect(server.texts().sort()).toEqual(
      numberedSentences(2, 'n')
        .map((s) => s.text)
        .sort(),
    );
  });

  it('nahrávky, které skript smaže, se do celku nepočítají', async () => {
    const files = memoryFiles();
    const old = numberedSentences(10);
    await runScript(files, alwaysMp3(fakeMp3({ bytes: 90_000 })), { sentences: old });

    // 7 starých zůstane, 2 nové přibydou: 9 × 90 KB = 810 KB.
    const sentences = [...old.slice(0, 7), ...numberedSentences(2, 'n')];
    const { result } = await runScript(files, alwaysMp3(fakeMp3({ bytes: 90_000 })), {
      sentences,
    });
    expect(result.ok).toBe(true);
    expect(files.recordings()).toHaveLength(9);
    expect(result.deleted.slice().sort()).toEqual(['s10', 's8', 's9']);
  });

  it('nahrávka, která se vytváří znovu, se do celku počítá jen jednou (nová místo staré)', async () => {
    const files = memoryFiles();
    const old = numberedSentences(10);
    await runScript(files, alwaysMp3(fakeMp3({ bytes: 90_000 })), { sentences: old });

    // Všech 10 se vytvoří znovu: 10 × 90 KB = 900 KB, ne 1,8 MB.
    const changed = old.map((sentence) => ({ ...sentence, text: `${sentence.text} Znovu.` }));
    const { result } = await runScript(files, alwaysMp3(fakeMp3({ bytes: 90_000, fill: 3 })), {
      sentences: changed,
    });
    expect(result.ok).toBe(true);
    expect(result.created).toHaveLength(10);
  });
});

describe('souhrn na konci (#50 AC6)', () => {
  it('vypíše, kolik vět vytvořil, přeskočil, smazal a kolik selhalo', async () => {
    const files = memoryFiles();
    const old = numberedSentences(9);
    await runScript(files, alwaysMp3(), { sentences: old });

    // s1, s2 změněné (2 vytvořené), s3–s5 stejné (3 přeskočené),
    // s6–s9 pryč (4 smazané), nová n1 selže (1 chybná).
    const sentences = [
      { id: 's1', text: 'Změněná první věta.' },
      { id: 's2', text: 'Změněná druhá věta.' },
      ...old.slice(2, 5),
      { id: 'n1', text: 'Nová věta, která selže.' },
    ];
    const server = fakeServer((text) =>
      text === 'Nová věta, která selže.'
        ? { kind: 'status', status: 500 }
        : { kind: 'mp3', bytes: fakeMp3() },
    );
    const { result, log } = await runScript(files, server, { sentences });

    expect(result.created.slice().sort()).toEqual(['s1', 's2']);
    expect(result.skipped.slice().sort()).toEqual(['s3', 's4', 's5']);
    expect(result.deleted.slice().sort()).toEqual(['s6', 's7', 's8', 's9']);
    expect(result.failed).toEqual(['n1']);

    const line = summaryLine(log);
    expect(countAfter(line, 'vytvořen')).toBe(2);
    expect(countAfter(line, 'přeskočen')).toBe(3);
    expect(countAfter(line, 'smazán')).toBe(4);
    expect(countAfter(line, 'selhal')).toBe(1);
  });

  it('po úspěšném běhu ukáže souhrn s nulou chyb', async () => {
    const { log } = await runScript(memoryFiles(), alwaysMp3());
    const line = summaryLine(log);
    expect(countAfter(line, 'vytvořen')).toBe(3);
    expect(countAfter(line, 'přeskočen')).toBe(0);
    expect(countAfter(line, 'smazán')).toBe(0);
    expect(countAfter(line, 'selhal')).toBe(0);
  });

  it('i když není co vytvářet, souhrn ukáže všechny věty jako přeskočené', async () => {
    const files = await previousRun();
    const { log } = await runScript(files, alwaysMp3());
    expect(countAfter(summaryLine(log), 'přeskočen')).toBe(3);
  });

  it('po úspěšném běhu připomene doplnit původ hlasu do public/licence.txt', async () => {
    const { log } = await runScript(memoryFiles(), alwaysMp3());
    expect(log.some((line) => line.includes('public/licence.txt') && looksCzech(line))).toBe(true);
  });

  it('i po běhu s chybnou větou připomene licenci', async () => {
    const server = fakeServer((text) =>
      text === textOf('question')
        ? { kind: 'status', status: 500 }
        : { kind: 'mp3', bytes: fakeMp3() },
    );
    const { log } = await runScript(memoryFiles(), server);
    expect(log.some((line) => line.includes('public/licence.txt'))).toBe(true);
  });

  it('skript sám soubor s licencí nemění', async () => {
    const files = memoryFiles();
    await runScript(files, alwaysMp3());
    expect(Object.keys(files.snapshot()).some((path) => path.includes('licence'))).toBe(false);
  });
});

describe('bez sítě v testech (#50 AC7)', () => {
  it('skript volá jen předaný server, nikdy skutečný fetch', async () => {
    // Skutečný fetch je v beforeEach nahrazený funkcí, která vyhodí chybu.
    const server = alwaysMp3();
    const { result } = await runScript(memoryFiles(), server);
    expect(result.ok).toBe(true);
    expect(server.calls).toHaveLength(SENTENCES.length);
  });
});
