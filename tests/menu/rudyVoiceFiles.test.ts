/// <reference types="vite/client" />
import { afterEach, describe, expect, it } from 'vitest';

import { MENU_RUDY_LINES, menuRudyVoiceUrl } from '../../src/menu/logic/menuRudyVoice';
import { LANGUAGES, currentLanguage, selectLanguage } from '../../src/shared/texts/languages';
import { readMp3DurationMs, readMp3FrameInfo } from '../../tools/voice/mp3Header';
import { characterLinesOf, characterVoiceOf, voiceFingerprint } from '../../tools/voice/voiceCore';
import type { VoiceConfig } from '../../tools/voice/voiceCore';
import fingerprintsJson from '../../tools/voice/fingerprints.json?raw';
import voiceConfigJson from '../../tools/voice/voice.config.json?raw';
import { dictionariesByLanguage } from '../shared/textChecks';

/**
 * Testy k #171 AC1 a AC4 pro menu: pozdrav pandy Rudyho je v textech
 * menu, má v každém jazyce ze seznamu nahrávku mono 64 kb/s nejvýš 4 s
 * s otiskem hlasu postavičky a menu stahuje nahrávku zvoleného jazyka.
 */

const MAX_LINE_MS = 4000;
/** Limit jedné nahrávky jako u nahrávek průvodce (#50) a všech replik Rudyho dohromady. */
const MAX_RECORDING_BYTES = 150 * 1024;
/** Od #176 i s dalšími variantami replik (dnes asi 517 KB, limit 550 KB). */
const MAX_ALL_RUDY_BYTES = 550 * 1024;

/** Velikosti všech replik Rudyho (Počítání, menu i Omalovánky, všechny jazyky) podle cesty. */
const ALL_RUDY_SIZES: Record<string, number> = Object.fromEntries(
  Object.entries(
    import.meta.glob<string>('../../public/voice/*/*/rudy-*.mp3', {
      query: '?inline',
      import: 'default',
      eager: true,
    }),
  ).map(([path, dataUrl]) => [path, bytesOfDataUrl(dataUrl).length]),
);

const MENU_FILES = dictionariesByLanguage(
  import.meta.glob('../../src/menu/texts/*.ts', { eager: true }),
);

const RECORDINGS: Record<string, Uint8Array> = Object.fromEntries(
  Object.entries(
    import.meta.glob<string>('../../public/voice/*/menu/*.mp3', {
      query: '?inline',
      import: 'default',
      eager: true,
    }),
  ).map(([path, dataUrl]) => [path.replace('../../', ''), bytesOfDataUrl(dataUrl)]),
);

const FINGERPRINTS = JSON.parse(fingerprintsJson) as Record<string, unknown>;
const RUDY_VOICE = characterVoiceOf(JSON.parse(voiceConfigJson), 'rudy') as VoiceConfig;

function bytesOfDataUrl(dataUrl: string): Uint8Array {
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
}

afterEach(() => {
  selectLanguage('cs');
});

describe('#171 AC1: pozdrav Rudyho v menu má nahrávky', () => {
  for (const language of LANGUAGES) {
    it(`jazyk ${language}: pozdravy jsou v textech menu`, () => {
      const lines = characterLinesOf('menu', MENU_FILES[language]);
      expect(lines.map((line) => line.id)).toEqual([...MENU_RUDY_LINES]);
      expect(lines.every((line) => line.text.trim() !== '')).toBe(true);
    });
  }

  it('každá replika menu má nahrávku v každém jazyce ze seznamu a žádná není navíc', () => {
    const expected = LANGUAGES.flatMap((language) =>
      MENU_RUDY_LINES.map((line) => `public/voice/${language}/menu/rudy-${line}.mp3`),
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
      expect(durationMs ?? Infinity).toBeGreaterThan(500);
      expect(durationMs ?? Infinity).toBeLessThanOrEqual(MAX_LINE_MS);
    });
  }

  for (const language of LANGUAGES) {
    it(`jazyk ${language}: otisk pozdravu odpovídá textu a hlasu postavičky`, async () => {
      const section = (FINGERPRINTS['character:rudy'] ?? {}) as Record<string, unknown>;
      const fingerprints = (section[language] ?? {}) as Record<string, unknown>;
      for (const line of characterLinesOf('menu', MENU_FILES[language])) {
        expect(fingerprints[`menu/${line.id}`], line.id).toBe(
          await voiceFingerprint(line.text, RUDY_VOICE),
        );
      }
    });
  }
});

describe('#171, #175, #176: velikost replik Rudyho', () => {
  it('všechny repliky Rudyho (Počítání, menu i Omalovánky, všechny jazyky) mají dohromady nejvýš 550 KB', () => {
    const sizes = Object.values(ALL_RUDY_SIZES);
    expect(sizes.length).toBeGreaterThanOrEqual(LANGUAGES.length * 10);
    expect(sizes.reduce((sum, size) => sum + size, 0)).toBeLessThanOrEqual(MAX_ALL_RUDY_BYTES);
  });
});

describe('#176 AC3: nový pozdrav Rudyho v menu', () => {
  it('česky a anglicky má druhý pozdrav text ze zadání', () => {
    expect(MENU_FILES['cs']?.['rudyLines']).toMatchObject({
      greetingWhat: 'Ahoj! Na co máš dneska chuť?',
    });
    expect(MENU_FILES['en']?.['rudyLines']).toMatchObject({
      greetingWhat: 'Hi! What do you feel like playing today?',
    });
  });

  it('adresa druhého pozdravu vede na nahrávku v repozitáři', () => {
    for (const language of LANGUAGES) {
      for (const line of MENU_RUDY_LINES) {
        expect(RECORDINGS[`public/${menuRudyVoiceUrl(line, language)}`]).toBeDefined();
      }
    }
  });
});

describe('#171 AC4: Rudy v menu mluví zvoleným jazykem', () => {
  it('česky menu stahuje český pozdrav', () => {
    expect(currentLanguage()).toBe('cs');
    expect(menuRudyVoiceUrl('greeting')).toBe('voice/cs/menu/rudy-greeting.mp3');
  });

  it('po změně jazyka na angličtinu další pozdrav stahuje anglickou nahrávku', () => {
    selectLanguage('en');
    expect(menuRudyVoiceUrl('greeting')).toBe('voice/en/menu/rudy-greeting.mp3');
  });
});
