/// <reference types="vite/client" />
import { afterEach, describe, expect, it } from 'vitest';

import {
  COUNTING_RUDY_LINES,
  countingRudyLines,
  countingRudyVoiceUrl,
} from '../../../src/games/counting/logic/rudyLines';
import { CHARACTER_PLACES } from '../../../tools/voice/voiceCore';
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
 * Testy k #171 AC1 a AC4 pro Počítání: repliky pandy Rudyho (oslavy po
 * 10 hvězdičkách, pozdravy zrušil #186) jsou v textech hry, každá má
 * v každém jazyce ze seznamu nahrávku mono 64 kb/s nejvýš 4 s s otiskem
 * hlasu postavičky a hra stahuje nahrávku jazyka zvoleného v menu.
 * #186 AC5: součet všech replik Rudyho se po odebrání pozdravů a pochval
 * snížil na skutečný součet zaokrouhlený nahoru na 50 KB; #187 AC5 ho tak
 * snížil znovu po odebrání oslavy „kde je víc“ v Porovnávání.
 */

const MAX_LINE_MS = 4000;
/** Limit jedné nahrávky jako u nahrávek průvodce (#50) a všech replik Rudyho dohromady. */
const MAX_RECORDING_BYTES = 150 * 1024;
/**
 * #186 AC5: Rudy jen slaví po 10 hvězdičkách (Počítání a Porovnávání), limit
 * je skutečný součet zaokrouhlený nahoru na 50 KB (dřív 750 KB z #181,
 * po #186 300 KB). Po odebrání oslavy „kde je víc“ (#187 AC5) mají repliky
 * dohromady asi 210 KB, limit je 250 KB.
 */
const MAX_ALL_RUDY_BYTES = 250 * 1024;

/** Kolik replik Rudyho je v každém jazyce: 3 oslavy Počítání a 1 Porovnávání (#186, #187). */
const RUDY_LINES_PER_LANGUAGE = 4;

/** Velikosti všech replik Rudyho (všechny části a jazyky) podle cesty. */
const ALL_RUDY_SIZES: Record<string, number> = Object.fromEntries(
  Object.entries(
    import.meta.glob<string>('../../../public/voice/*/*/rudy-*.mp3', {
      query: '?inline',
      import: 'default',
      eager: true,
    }),
  ).map(([path, dataUrl]) => [path, bytesOfDataUrl(dataUrl).length]),
);

const COUNTING_FILES = dictionariesByLanguage(
  import.meta.glob('../../../src/games/counting/texts/*.ts', { eager: true }),
);

/** Repliky Rudyho v Počítání jako bajty, podle cesty od kořene repa. */
const RECORDINGS: Record<string, Uint8Array> = Object.fromEntries(
  Object.entries(
    import.meta.glob<string>('../../../public/voice/*/counting/rudy-*.mp3', {
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
  return `public/voice/${language}/counting/rudy-${line}.mp3`;
}

afterEach(() => {
  selectLanguage('cs');
});

describe('#171 AC1: repliky Rudyho v Počítání mají nahrávky', () => {
  for (const language of LANGUAGES) {
    it(`jazyk ${language}: oslavy jsou v textech Počítání, pozdravy ne (#186)`, () => {
      const lines = characterLinesOf('counting', COUNTING_FILES[language]);
      expect(lines.map((line) => line.id).sort()).toEqual([...COUNTING_RUDY_LINES].sort());
      expect(lines.every((line) => line.text.trim() !== '')).toBe(true);
    });
  }

  it('každá replika má nahrávku v každém jazyce ze seznamu a žádná není navíc', () => {
    const expected = LANGUAGES.flatMap((language) =>
      COUNTING_RUDY_LINES.map((line) => recordingPath(language, line)),
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
      for (const line of characterLinesOf('counting', COUNTING_FILES[language])) {
        expect(fingerprints[`counting/${line.id}`], line.id).toBe(
          await voiceFingerprint(line.text, RUDY_VOICE),
        );
      }
    });
  }
});

describe('#171, #176, #181, #186: velikost replik Rudyho', () => {
  it('všechny repliky Rudyho (oslavy Počítání a Porovnávání, všechny jazyky) mají dohromady nejvýš 250 KB', () => {
    const sizes = Object.values(ALL_RUDY_SIZES);
    expect(sizes.length).toBe(LANGUAGES.length * RUDY_LINES_PER_LANGUAGE);
    for (const language of LANGUAGES) {
      for (const part of ['counting', 'compare']) {
        const inPart = Object.keys(ALL_RUDY_SIZES).filter((path) =>
          path.includes(`/voice/${language}/${part}/rudy-`),
        );
        expect(inPart.length, `${language}/${part} je v součtu`).toBeGreaterThan(0);
      }
    }
    expect(sizes.reduce((sum, size) => sum + size, 0)).toBeLessThanOrEqual(MAX_ALL_RUDY_BYTES);
  });

  it('#186 AC1: Rudy mluví jen v Počítání a Porovnávání, nahrávky menu a Omalovánek nejsou', () => {
    expect([...CHARACTER_PLACES]).toEqual(['counting', 'compare']);
    const elsewhere = Object.keys(ALL_RUDY_SIZES).filter(
      (path) => !/\/voice\/[a-z]+\/(counting|compare)\/rudy-celebration[a-zA-Z]*\.mp3$/.test(path),
    );
    expect(elsewhere).toEqual([]);
  });

  it('#186 AC1, #187 AC5: v otiscích hlasu Rudyho nejsou pozdravy, pochvaly ani oslava „kde je víc“', () => {
    const section = (FINGERPRINTS['character:rudy'] ?? {}) as Record<string, unknown>;
    for (const language of Object.keys(section)) {
      const keys = Object.keys((section[language] ?? {}) as Record<string, unknown>);
      expect(keys.sort(), language).toEqual(
        [...COUNTING_RUDY_LINES.map((line) => `counting/${line}`), 'compare/celebration'].sort(),
      );
    }
  });
});

describe('#176 AC3: nové repliky Rudyho v Počítání', () => {
  it('česky a anglicky mají oslavy texty ze zadání', () => {
    expect(COUNTING_FILES['cs']?.['rudyLines']).toMatchObject({
      celebrationStars: 'Paráda! Máš všech deset hvězdiček!',
      celebrationStar: 'Jupí! Jsi počítací hvězda!',
    });
    expect(COUNTING_FILES['en']?.['rudyLines']).toMatchObject({
      celebrationStars: 'Awesome! You got all ten stars!',
      celebrationStar: "Yippee! You're a counting star!",
    });
  });
});

describe('#171 AC4: Rudy v Počítání mluví jazykem zvoleným v menu', () => {
  it('oslava má první repliku oslavy', () => {
    expect(countingRudyLines(undefined).upcoming()).toBe('celebration');
  });

  it('česky hra stahuje českou nahrávku oslavy', () => {
    expect(currentLanguage()).toBe('cs');
    expect(countingRudyVoiceUrl('celebrationStar')).toBe(
      'voice/cs/counting/rudy-celebrationStar.mp3',
    );
  });

  it('po změně jazyka na angličtinu další Rudy stahuje anglickou nahrávku', () => {
    selectLanguage('en');
    expect(countingRudyVoiceUrl('celebration')).toBe('voice/en/counting/rudy-celebration.mp3');
  });

  it('adresa nahrávky vede na soubor, který v repozitáři opravdu je', () => {
    for (const language of LANGUAGES) {
      for (const line of COUNTING_RUDY_LINES) {
        expect(RECORDINGS[`public/${countingRudyVoiceUrl(line, language)}`]).toBeDefined();
      }
    }
  });
});

describe('#171: původ hlasu postavičky', () => {
  it('public/licence.txt uvádí hlas Peanut z ElevenLabs s ID a modelem z configu', () => {
    expect(licenceText).toContain('Peanut');
    expect(licenceText).toContain(RUDY_VOICE.voiceId);
    expect(licenceText).toContain(RUDY_VOICE.modelId);
  });
});
