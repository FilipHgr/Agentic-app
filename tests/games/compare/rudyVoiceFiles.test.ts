/// <reference types="vite/client" />
import { afterEach, describe, expect, it } from 'vitest';

import {
  COMPARE_RUDY_LINES,
  compareRudyVoiceUrl,
} from '../../../src/games/compare/logic/rudyLines';
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
 * Testy k #181 AC3 a AC5: repliky pandy Rudyho v Porovnávání (2 oslavy,
 * pozdravy zrušil #186) jsou v textech hry pod `rudyLines`, každá má
 * v každém jazyce ze seznamu nahrávku mono 64 kb/s nejvýš 4 s a 150 KB
 * s otiskem hlasu postavičky `character:rudy` a hra stahuje nahrávku
 * jazyka zvoleného v menu. Součet všech replik Rudyho hlídá
 * `tests/games/counting/rudyVoiceFiles.test.ts`.
 */

const MAX_LINE_MS = 4000;
const MAX_RECORDING_BYTES = 150 * 1024;

const COMPARE_FILES = dictionariesByLanguage(
  import.meta.glob('../../../src/games/compare/texts/*.ts', { eager: true }),
);

/** Nahrávky Porovnávání jako bajty, podle cesty od kořene repa. */
const RECORDINGS: Record<string, Uint8Array> = Object.fromEntries(
  Object.entries(
    import.meta.glob<string>('../../../public/voice/*/compare/*.mp3', {
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
  return `public/voice/${language}/compare/rudy-${line}.mp3`;
}

afterEach(() => {
  selectLanguage('cs');
});

describe('#181 AC3: repliky Rudyho v Porovnávání jsou česky i anglicky', () => {
  for (const language of LANGUAGES) {
    it(`jazyk ${language}: oslavy jsou v textech Porovnávání, pozdravy ne (#186)`, () => {
      const lines = characterLinesOf('compare', COMPARE_FILES[language]);
      expect(lines.map((line) => line.id).sort()).toEqual([...COMPARE_RUDY_LINES].sort());
      expect(lines.every((line) => line.text.trim() !== '')).toBe(true);
    });
  }

  it('repliky zní přesně podle zadání', () => {
    expect(COMPARE_FILES['cs']?.['rudyLines']).toEqual({
      celebration: 'Hurá! Máš deset hvězdiček!',
      celebrationMore: 'Výborně! Vždycky poznáš, kde je víc!',
    });
    expect(COMPARE_FILES['en']?.['rudyLines']).toEqual({
      celebration: 'Hooray! You got ten stars!',
      celebrationMore: 'Great job! You always know where there are more!',
    });
  });
});

describe('#181 AC5: nahrávky Rudyho v Porovnávání', () => {
  it('každá replika má nahrávku v každém jazyce ze seznamu a ve složce nic navíc není', () => {
    const expected = LANGUAGES.flatMap((language) =>
      COMPARE_RUDY_LINES.map((line) => recordingPath(language, line)),
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
      const lines = characterLinesOf('compare', COMPARE_FILES[language]);
      expect(lines.length).toBe(COMPARE_RUDY_LINES.length);
      for (const line of lines) {
        expect(fingerprints[`compare/${line.id}`], line.id).toBe(
          await voiceFingerprint(line.text, RUDY_VOICE),
        );
      }
    });
  }

  it('public/licence.txt uvádí hlas Rudyho i u nahrávek Porovnávání', () => {
    expect(licenceText).toContain('public/voice/<jazyk>/compare/rudy-*.mp3');
    for (const generation of [
      'rF7IE0q4TRjzwTgJPWOw',
      'GrhiDApR1rXIhuT0pMTL',
      'fDAy3gXDLEVibHOzDat6',
      '44t26lD1T6WbDQDLJehe',
      'LiV77eRiu4dN8uc2l3PE',
      'ohA4iuLYYNBcVSfhZZfM',
      'WU96Oe4M4SURJ0nVgAk0',
      '8xznZNviI33ToRKUdPG2',
    ]) {
      expect(licenceText.replace(/\s+/g, ' ')).toContain(generation);
    }
  });
});

describe('#181: Rudy v Porovnávání mluví jazykem zvoleným v menu', () => {
  it('česky hra stahuje českou nahrávku oslavy', () => {
    expect(currentLanguage()).toBe('cs');
    expect(compareRudyVoiceUrl('celebrationMore')).toBe(
      'voice/cs/compare/rudy-celebrationMore.mp3',
    );
  });

  it('po změně jazyka na angličtinu další Rudy stahuje anglickou oslavu', () => {
    selectLanguage('en');
    expect(compareRudyVoiceUrl('celebration')).toBe('voice/en/compare/rudy-celebration.mp3');
  });

  it('adresa nahrávky vede na soubor, který v repozitáři opravdu je', () => {
    for (const language of LANGUAGES) {
      for (const line of COMPARE_RUDY_LINES) {
        expect(RECORDINGS[`public/${compareRudyVoiceUrl(line, language)}`]).toBeDefined();
      }
    }
  });
});
