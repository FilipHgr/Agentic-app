/// <reference types="vite/client" />
import { afterEach, describe, expect, it } from 'vitest';

import {
  COLORING_RUDY_LINES,
  coloringRudyVoiceUrl,
} from '../../../src/games/coloring/logic/rudyLines';
import { LANGUAGES, currentLanguage, selectLanguage } from '../../../src/shared/texts/languages';
import { readMp3DurationMs, readMp3FrameInfo } from '../../../tools/voice/mp3Header';
import {
  characterLinesOf,
  characterVoiceOf,
  voiceFingerprint,
} from '../../../tools/voice/voiceCore';
import type { VoiceConfig } from '../../../tools/voice/voiceCore';
import fingerprintsJson from '../../../tools/voice/fingerprints.json?raw';
import voiceConfigJson from '../../../tools/voice/voice.config.json?raw';
import licenceText from '../../../public/licence.txt?raw';
import { dictionariesByLanguage } from '../../shared/textChecks';

/**
 * Testy k #175 AC3: repliky pandy Rudyho v Omalovánkách (pozdrav a dvě
 * pochvaly) jsou v textech hry pod `rudyLines`, každá má v každém jazyce
 * ze seznamu nahrávku mono 64 kb/s nejvýš 4 s a 150 KB s otiskem hlasu
 * postavičky a hra stahuje nahrávku jazyka zvoleného v menu. Součet všech
 * replik Rudyho hlídá `tests/games/counting/rudyVoiceFiles.test.ts`.
 */

const MAX_LINE_MS = 4000;
const MAX_RECORDING_BYTES = 150 * 1024;

const COLORING_FILES = dictionariesByLanguage(
  import.meta.glob('../../../src/games/coloring/texts/*.ts', { eager: true }),
);

/** Repliky Rudyho v Omalovánkách jako bajty, podle cesty od kořene repa. */
const RECORDINGS: Record<string, Uint8Array> = Object.fromEntries(
  Object.entries(
    import.meta.glob<string>('../../../public/voice/*/coloring/*.mp3', {
      query: '?inline',
      import: 'default',
      eager: true,
    }),
  ).map(([path, dataUrl]) => [path.replace('../../../', ''), bytesOfDataUrl(dataUrl)]),
);

const FINGERPRINTS = JSON.parse(fingerprintsJson) as Record<string, unknown>;
const RUDY_VOICE = characterVoiceOf(JSON.parse(voiceConfigJson), 'rudy') as VoiceConfig;

function bytesOfDataUrl(dataUrl: string): Uint8Array {
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
}

function recordingPath(language: string, line: string): string {
  return `public/voice/${language}/coloring/rudy-${line}.mp3`;
}

afterEach(() => {
  selectLanguage('cs');
});

describe('#175 AC3: repliky Rudyho v Omalovánkách mají nahrávky', () => {
  for (const language of LANGUAGES) {
    it(`jazyk ${language}: pozdrav a obě pochvaly jsou v textech Omalovánek`, () => {
      const lines = characterLinesOf('coloring', COLORING_FILES[language]);
      expect(lines.map((line) => line.id).sort()).toEqual([...COLORING_RUDY_LINES].sort());
      expect(lines.every((line) => line.text.trim() !== '')).toBe(true);
    });
  }

  it('repliky zní přesně podle zadání', () => {
    expect(COLORING_FILES['cs']?.['rudyLines']).toEqual({
      greeting: 'Ahoj, já jsem Rudy! Pojďme spolu malovat.',
      praiseBeautiful: 'Ten je ale krásný! Dám ho do alba.',
      praiseColors: 'Krásné barvičky! Ukládám do alba.',
    });
    expect(COLORING_FILES['en']?.['rudyLines']).toEqual({
      greeting: "Hi, I'm Rudy! Let's paint together.",
      praiseBeautiful: 'So beautiful! It goes in the album.',
      praiseColors: 'Lovely colors! Saving it to the album.',
    });
  });

  it('každá replika má nahrávku v každém jazyce ze seznamu a v složce nic navíc není', () => {
    const expected = LANGUAGES.flatMap((language) =>
      COLORING_RUDY_LINES.map((line) => recordingPath(language, line)),
    ).sort();
    expect(Object.keys(RECORDINGS).sort()).toEqual(expected);
  });

  for (const [path, bytes] of Object.entries(RECORDINGS)) {
    it(`${path} má nejvýš 150 KB`, () => {
      expect(bytes.length).toBeLessThanOrEqual(MAX_RECORDING_BYTES);
    });

    it(`${path} je mono, nejvýš 64 kb/s a trvá nejvýš 4 s`, () => {
      const info = readMp3FrameInfo(bytes);
      expect(info?.channels).toBe(1);
      expect(info?.bitrateKbps).toBeLessThanOrEqual(64);
      const durationMs = readMp3DurationMs(bytes);
      expect(durationMs).not.toBeNull();
      expect(durationMs ?? Infinity).toBeGreaterThan(500);
      expect(durationMs ?? Infinity).toBeLessThanOrEqual(MAX_LINE_MS);
    });
  }

  for (const language of LANGUAGES) {
    it(`jazyk ${language}: otisky replik odpovídají textům a hlasu postavičky`, async () => {
      const section = (FINGERPRINTS['character:rudy'] ?? {}) as Record<string, unknown>;
      const fingerprints = (section[language] ?? {}) as Record<string, unknown>;
      for (const line of characterLinesOf('coloring', COLORING_FILES[language])) {
        expect(fingerprints[`coloring/${line.id}`], line.id).toBe(
          await voiceFingerprint(line.text, RUDY_VOICE),
        );
      }
    });
  }

  it('public/licence.txt uvádí hlas Rudyho i u nahrávek Omalovánek', () => {
    expect(licenceText).toContain('public/voice/<jazyk>/coloring/rudy-*.mp3');
  });
});

describe('#175: Rudy v Omalovánkách mluví jazykem zvoleným v menu', () => {
  it('česky hra stahuje českou nahrávku pozdravu', () => {
    expect(currentLanguage()).toBe('cs');
    expect(coloringRudyVoiceUrl('greeting')).toBe('voice/cs/coloring/rudy-greeting.mp3');
  });

  it('po změně jazyka na angličtinu další okno stahuje anglickou pochvalu', () => {
    selectLanguage('en');
    expect(coloringRudyVoiceUrl('praiseColors')).toBe('voice/en/coloring/rudy-praiseColors.mp3');
  });

  it('adresa nahrávky vede na soubor, který v repozitáři opravdu je', () => {
    for (const language of LANGUAGES) {
      for (const line of COLORING_RUDY_LINES) {
        expect(RECORDINGS[`public/${coloringRudyVoiceUrl(line, language)}`]).toBeDefined();
      }
    }
  });
});
