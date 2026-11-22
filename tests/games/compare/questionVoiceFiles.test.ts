/// <reference types="vite/client" />
import { afterEach, describe, expect, it } from 'vitest';

import {
  COMPARE_GUIDE_LINES,
  compareQuestionVoiceUrl,
  questionVoiceLine,
} from '../../../src/games/compare/logic/compareQuestion';
import { LANGUAGES, selectLanguage } from '../../../src/shared/texts/languages';
import { readMp3DurationMs, readMp3FrameInfo } from '../../../tools/voice/mp3Header';
import {
  MANIFEST_PATH,
  guideLinesOf,
  guideRecordingPath,
  guideSection,
  importGuideVoice,
  voiceFingerprint,
} from '../../../tools/voice/voiceCore';
import type { VoiceConfig, VoiceFiles } from '../../../tools/voice/voiceCore';
import fingerprintsJson from '../../../tools/voice/fingerprints.json?raw';
import voiceConfigJson from '../../../tools/voice/voice.config.json?raw';
import licenceText from '../../../public/licence.txt?raw';
import { dictionariesByLanguage } from '../../shared/textChecks';

/**
 * Testy k #182 AC3: otázku řekne dospělý hlas průvodce jazyka (ne Rudy).
 * Věty jsou v textech hry pod `guideLines`, nahrávky
 * `public/voice/<jazyk>/compare/guide/<věta>.mp3` jsou mono 64 kb/s
 * s otiskem hlasu jazyka z `voice.config.json` v oddílu `guide:compare`
 * a uložil je nástroj `npm run voice:guide` (`importGuideVoice`).
 */

const MAX_RECORDING_BYTES = 150 * 1024;
const MAX_LINE_MS = 4000;

const COMPARE_FILES = dictionariesByLanguage(
  import.meta.glob('../../../src/games/compare/texts/*.ts', { eager: true }),
);

/** Nahrávky průvodce Porovnávání jako bajty, podle cesty od kořene repa. */
const RECORDINGS: Record<string, Uint8Array> = Object.fromEntries(
  Object.entries(
    import.meta.glob<string>('../../../public/voice/*/compare/guide/*', {
      query: '?inline',
      import: 'default',
      eager: true,
    }),
  ).map(([path, dataUrl]) => [path.replace('../../../', ''), bytesOfDataUrl(dataUrl)]),
);

const FINGERPRINTS = JSON.parse(fingerprintsJson) as Record<string, unknown>;
const VOICES = JSON.parse(voiceConfigJson) as Record<string, VoiceConfig>;

/** Generace ElevenLabs nahrávek otázek: česky víc, míň, anglicky víc, míň. */
const GENERATIONS = [
  'ah6eqFQII2pTsELwp4gW',
  'Wo9nfeXLw8H4sQUWKOuM',
  'ApXWCx85yE0Ptblr4lP1',
  '2gAB1JFu9Sh1OM5CtPlP',
];

function bytesOfDataUrl(dataUrl: string): Uint8Array {
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
}

afterEach(() => {
  selectLanguage('cs');
});

describe('#182 AC3: věty otázky jsou v textech hry česky i anglicky', () => {
  it('otázky zní přesně jako nahrávky', () => {
    expect(COMPARE_FILES['cs']?.['guideLines']).toEqual({
      questionMore: 'Kde je víc?',
      questionLess: 'Kde je míň?',
    });
    expect(COMPARE_FILES['en']?.['guideLines']).toEqual({
      questionMore: 'Where are there more?',
      questionLess: 'Where are there fewer?',
    });
  });

  for (const language of LANGUAGES) {
    it(`jazyk ${language}: obě otázky jsou v textech a nejsou prázdné`, () => {
      const lines = guideLinesOf(COMPARE_FILES[language]);
      expect(lines.map((line) => line.id).sort()).toEqual([...COMPARE_GUIDE_LINES].sort());
      expect(lines.every((line) => line.text.trim() !== '')).toBe(true);
    });
  }
});

describe('#182 AC3: nahrávky otázek hlasem průvodce', () => {
  it('každá otázka má nahrávku v každém jazyce ze seznamu a ve složce nic navíc není', () => {
    const expected = LANGUAGES.flatMap((language) =>
      COMPARE_GUIDE_LINES.map((id) => guideRecordingPath('compare', language, id)),
    ).sort();
    expect(Object.keys(RECORDINGS).sort()).toEqual(expected);
  });

  for (const [path, bytes] of Object.entries(RECORDINGS)) {
    it(`${path} je mono, nejvýš 64 kb/s, 150 KB a krátká (nejvýš 4 s)`, () => {
      const info = readMp3FrameInfo(bytes);
      expect(info?.channels).toBe(1);
      expect(info?.bitrateKbps ?? Infinity).toBeLessThanOrEqual(64);
      expect(bytes.length).toBeLessThanOrEqual(MAX_RECORDING_BYTES);
      const durationMs = readMp3DurationMs(bytes) ?? Infinity;
      expect(durationMs).toBeGreaterThan(300);
      expect(durationMs).toBeLessThanOrEqual(MAX_LINE_MS);
    });
  }

  for (const language of LANGUAGES) {
    it(`jazyk ${language}: otisky odpovídají textům a hlasu průvodce jazyka`, async () => {
      const section = (FINGERPRINTS[guideSection('compare')] ?? {}) as Record<string, unknown>;
      const fingerprints = (section[language] ?? {}) as Record<string, unknown>;
      const voice = VOICES[language];
      expect(voice, language).toBeDefined();
      const lines = guideLinesOf(COMPARE_FILES[language]);
      expect(Object.keys(fingerprints).sort()).toEqual(lines.map((line) => line.id).sort());
      for (const line of lines) {
        expect(fingerprints[line.id], line.id).toBe(
          await voiceFingerprint(line.text, voice as VoiceConfig),
        );
      }
    });
  }

  it('public/licence.txt uvádí hlas průvodce i u otázek Porovnávání s generacemi', () => {
    const text = licenceText.replace(/\s+/g, ' ');
    expect(text).toContain('public/voice/<jazyk>/compare/guide/');
    for (const generation of GENERATIONS) {
      expect(text).toContain(generation);
    }
  });
});

describe('#182 AC3: hra stahuje otázku v jazyce zvoleném v menu', () => {
  it('česky „míň“ a po změně jazyka anglické „víc“', () => {
    expect(compareQuestionVoiceUrl('less')).toBe('voice/cs/compare/guide/questionLess.mp3');
    selectLanguage('en');
    expect(compareQuestionVoiceUrl('more')).toBe('voice/en/compare/guide/questionMore.mp3');
  });

  it('adresa každé otázky vede na nahrávku, která v repozitáři opravdu je', () => {
    for (const language of LANGUAGES) {
      for (const question of ['more', 'less'] as const) {
        expect(questionVoiceLine(question)).toMatch(/^question/);
        expect(RECORDINGS[`public/${compareQuestionVoiceUrl(question, language)}`]).toBeDefined();
      }
    }
  });
});

/** Soubory v paměti pro nástroj nahrávek. */
function memoryFiles(initial: Record<string, Uint8Array> = {}): VoiceFiles & {
  snapshot(): Record<string, Uint8Array>;
} {
  const data = new Map(Object.entries(initial));
  return {
    readFile: (path) => Promise.resolve(data.get(path) ?? null),
    writeFile: (path, bytes) => {
      data.set(path, bytes);
      return Promise.resolve();
    },
    deleteFile: (path) => {
      data.delete(path);
      return Promise.resolve();
    },
    listFiles: (dir) =>
      Promise.resolve(
        [...data.keys()]
          .filter((path) => path.startsWith(`${dir}/`) && !path.slice(dir.length + 1).includes('/'))
          .map((path) => path.slice(dir.length + 1)),
      ),
    snapshot: () => Object.fromEntries(data),
  };
}

describe('#182: nástroj uloží nahrávky průvodce hry a zapíše otisky', () => {
  const czechLines = guideLinesOf(COMPARE_FILES['cs']);
  const sample = RECORDINGS[guideRecordingPath('compare', 'cs', 'questionMore')] as Uint8Array;

  it('uloží nahrávky do složky hry a otisky do oddílu hry, ostatní oddíly nechá', async () => {
    const otherSections = {
      cs: { summary: 'a' },
      'character:rudy': { cs: { 'menu/greeting': 'b' } },
    };
    const files = memoryFiles({
      [MANIFEST_PATH]: new TextEncoder().encode(JSON.stringify(otherSections)),
    });
    const log: string[] = [];
    const result = await importGuideVoice({
      game: 'compare',
      language: 'cs',
      lines: czechLines,
      voices: VOICES,
      source: () => Promise.resolve(sample),
      files,
      log: (line) => log.push(line),
    });
    expect(result.ok).toBe(true);
    const written = files.snapshot();
    for (const line of czechLines) {
      expect(written[guideRecordingPath('compare', 'cs', line.id)]).toEqual(sample);
    }
    const manifest = JSON.parse(new TextDecoder().decode(written[MANIFEST_PATH])) as Record<
      string,
      unknown
    >;
    expect(manifest['cs']).toEqual(otherSections.cs);
    expect(manifest['character:rudy']).toEqual(otherSections['character:rudy']);
    const section = manifest[guideSection('compare')] as Record<string, Record<string, string>>;
    for (const line of czechLines) {
      expect(section['cs']?.[line.id]).toBe(
        await voiceFingerprint(line.text, VOICES['cs'] as VoiceConfig),
      );
    }
  });

  it('nahrávka, která není mp3 mono 64 kb/s, nebo chybí, nic nezmění', async () => {
    for (const bad of [new Uint8Array([1, 2, 3, 4]), null]) {
      const files = memoryFiles();
      const result = await importGuideVoice({
        game: 'compare',
        language: 'cs',
        lines: czechLines,
        voices: VOICES,
        source: () => Promise.resolve(bad),
        files,
        log: () => undefined,
      });
      expect(result.ok).toBe(false);
      expect(files.snapshot()).toEqual({});
    }
  });

  it('jazyk bez hlasu v voice.config.json nebo bez vět nic nezmění', async () => {
    for (const [language, lines] of [
      ['xx', czechLines],
      ['cs', []],
    ] as const) {
      const files = memoryFiles();
      const result = await importGuideVoice({
        game: 'compare',
        language,
        lines,
        voices: VOICES,
        source: () => Promise.resolve(sample),
        files,
        log: () => undefined,
      });
      expect(result.ok, language).toBe(false);
      expect(files.snapshot()).toEqual({});
    }
  });
});
