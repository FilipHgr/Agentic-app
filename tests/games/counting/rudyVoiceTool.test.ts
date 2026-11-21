import { describe, expect, it } from 'vitest';

import {
  API_KEY_ENV,
  MANIFEST_PATH,
  characterFingerprintKey,
  characterLinesOf,
  characterRecordingPath,
  characterSection,
  characterVoiceOf,
  importCharacterVoice,
  makeVoice,
  voiceFingerprint,
} from '../../../tools/voice/voiceCore';
import type { CharacterLine, VoiceConfig } from '../../../tools/voice/voiceCore';
import { readMp3DurationMs } from '../../../tools/voice/mp3Header';
import voiceConfigJson from '../../../tools/voice/voice.config.json?raw';
import { alwaysMp3, fakeMp3, memoryFiles } from './voiceFakes';
import type { MemoryFiles } from './voiceFakes';

/**
 * Testy k #171 AC2: hlas postavičky (panda Rudy) je samostatný oddíl
 * `character:rudy` ve `voice.config.json`, jeden pro všechny jazyky, a nemění
 * se. Nástroj nahrávek umí kromě hlasu jazyka i hlas postavičky: uloží
 * převedené nahrávky replik Počítání i menu a zapíše jejich otisky.
 * Soubory jsou v paměti, síť se nevolá.
 */

/** Hlas pandy Rudyho (Peanut, ElevenLabs eleven_v3) se nikdy nemění. */
const RUDY_VOICE = { voiceId: 'rBkiq5ZQ43ogwd6i4uIQ', modelId: 'eleven_v3' };

/** Hlasy jazyků průvodce zůstávají beze změny (rozhodnutí 2026-11-12). */
const LANGUAGE_VOICES: Readonly<Record<string, { voiceId: string; modelId: string }>> = {
  cs: { voiceId: '7JbZPqJGWUfXXBim0T8U', modelId: 'eleven_multilingual_v2' },
  en: { voiceId: 'Xb7hH8MSUJpSbSDYk0k2', modelId: 'eleven_multilingual_v2' },
};

const VOICES = JSON.parse(voiceConfigJson) as Record<string, unknown>;

/** 64 kb/s 44,1 kHz: jeden rámec je asi 209 B a 26 ms, 20 KB je asi 2,5 s. */
const SHORT_MP3 = fakeMp3({ bytes: 20_000 });
const TOO_LONG_MP3 = fakeMp3({ bytes: 40_000 });

const LINES: readonly CharacterLine[] = [
  { place: 'counting', id: 'celebration', text: 'Hurá!' },
  { place: 'counting', id: 'greeting', text: 'Ahoj!' },
  { place: 'menu', id: 'greeting', text: 'Vyber si hru.' },
];

async function manifestOf(files: MemoryFiles): Promise<Record<string, unknown>> {
  const raw = await files.readFile(MANIFEST_PATH);
  return raw === null ? {} : (JSON.parse(new TextDecoder().decode(raw)) as Record<string, unknown>);
}

async function importLines(
  files: MemoryFiles,
  source: (line: CharacterLine) => Uint8Array | null = () => SHORT_MP3,
  language = 'cs',
) {
  const log: string[] = [];
  const result = await importCharacterVoice({
    character: 'rudy',
    language,
    lines: LINES,
    voices: VOICES,
    source: async (line) => source(line),
    files,
    log: (line) => log.push(line),
  });
  return { result, log };
}

describe('#171 AC2: hlas postavičky je samostatný oddíl configu a nemění se', () => {
  it('ve voice.config.json je oddíl character:rudy s hlasem Peanut a modelem eleven_v3', () => {
    expect(characterSection('rudy')).toBe('character:rudy');
    expect(characterVoiceOf(VOICES, 'rudy')).toMatchObject(RUDY_VOICE);
    expect(characterVoiceOf(VOICES, 'rudy')?.voiceSettings).toEqual(expect.any(Object));
  });

  it('hlas postavičky je jeden pro všechny jazyky (oddíl nemá pododdíly jazyků)', () => {
    const section = VOICES['character:rudy'] as Record<string, unknown>;
    expect(Object.keys(section).sort()).toEqual(['modelId', 'voiceId', 'voiceSettings']);
  });

  it('hlasy jazyků zůstaly beze změny a žádný jazyk nemluví hlasem postavičky', () => {
    for (const [language, voice] of Object.entries(LANGUAGE_VOICES)) {
      expect(VOICES[language], language).toMatchObject(voice);
    }
    const languageVoiceIds = Object.entries(VOICES)
      .filter(([key]) => /^[a-z]+$/.test(key))
      .map(([, voice]) => (voice as VoiceConfig).voiceId);
    expect(languageVoiceIds).not.toContain(RUDY_VOICE.voiceId);
  });

  it('oddíl postavičky se nikdy nesplete s kódem jazyka', () => {
    expect(characterSection('rudy')).not.toMatch(/^[a-z]+$/);
  });
});

describe('#171 AC2: nástroj nahrávek umí hlas postavičky', () => {
  it('repliky čte z textů části pod klíčem rudyLines', () => {
    const texts = { title: 'Počítání', rudyLines: { greeting: 'Ahoj!', celebration: 'Hurá!' } };
    expect(characterLinesOf('counting', texts)).toEqual([
      { place: 'counting', id: 'celebration', text: 'Hurá!' },
      { place: 'counting', id: 'greeting', text: 'Ahoj!' },
    ]);
    expect(characterLinesOf('menu', { categories: {} })).toEqual([]);
  });

  it('nahrávky replik jdou do složky jazyka a části: Počítání i menu', () => {
    expect(characterRecordingPath('rudy', 'cs', { place: 'counting', id: 'greeting' })).toBe(
      'public/voice/cs/counting/rudy-greeting.mp3',
    );
    expect(characterRecordingPath('rudy', 'en', { place: 'menu', id: 'greeting' })).toBe(
      'public/voice/en/menu/rudy-greeting.mp3',
    );
  });

  it('do cesty nahrávky nepustí nic jiného než kód jazyka a id repliky', () => {
    expect(() =>
      characterRecordingPath('rudy', '../x', { place: 'menu', id: 'greeting' }),
    ).toThrow();
    expect(() => characterRecordingPath('rudy', 'cs', { place: 'menu', id: '../a' })).toThrow();
  });

  it('uloží nahrávky všech replik a zapíše otisky do oddílu postavičky podle jazyka', async () => {
    const files = memoryFiles();
    const { result } = await importLines(files);
    expect(result.ok).toBe(true);
    for (const line of LINES) {
      expect(await files.readFile(characterRecordingPath('rudy', 'cs', line))).toEqual(SHORT_MP3);
    }
    const config = characterVoiceOf(VOICES, 'rudy') as VoiceConfig;
    const expected = Object.fromEntries(
      await Promise.all(
        LINES.map(async (line) => [
          characterFingerprintKey(line),
          await voiceFingerprint(line.text, config),
        ]),
      ),
    );
    expect((await manifestOf(files))['character:rudy']).toEqual({ cs: expected });
  });

  it('otisk postavičky se liší od otisku stejné věty hlasem jazyka', async () => {
    const rudy = characterVoiceOf(VOICES, 'rudy') as VoiceConfig;
    const czech = VOICES.cs as VoiceConfig;
    expect(await voiceFingerprint('Ahoj!', rudy)).not.toBe(await voiceFingerprint('Ahoj!', czech));
  });

  it('druhý jazyk přidá vlastní oddíl a otisky prvního jazyka i průvodce zůstanou', async () => {
    const files = memoryFiles();
    const guide = { cs: { summary: 'abc' } };
    await files.writeFile(MANIFEST_PATH, new TextEncoder().encode(JSON.stringify(guide)));
    await importLines(files, () => SHORT_MP3, 'cs');
    const afterCzech = await manifestOf(files);
    await importLines(files, () => SHORT_MP3, 'en');
    const afterEnglish = await manifestOf(files);
    expect(afterEnglish.cs).toEqual(guide.cs);
    const section = afterEnglish['character:rudy'] as Record<string, unknown>;
    expect(Object.keys(section).sort()).toEqual(['cs', 'en']);
    expect(section.cs).toEqual((afterCzech['character:rudy'] as Record<string, unknown>).cs);
  });

  it('replika delší než 4 s se neuloží a nic se nezmění', async () => {
    const files = memoryFiles();
    const before = files.snapshot();
    const { result, log } = await importLines(files, (line) =>
      line.place === 'menu' ? TOO_LONG_MP3 : SHORT_MP3,
    );
    expect(result.ok).toBe(false);
    expect(log.join('\n')).toContain('4 s');
    expect(files.snapshot()).toEqual(before);
  });

  it('nahrávka, která není mono, se neuloží a nic se nezmění', async () => {
    const files = memoryFiles();
    const { result } = await importLines(files, () => fakeMp3({ channelMode: 'stereo' }));
    expect(result.ok).toBe(false);
    expect(files.snapshot()).toEqual({});
  });

  it('nahrávka s víc než 64 kb/s se neuloží a nic se nezmění', async () => {
    const files = memoryFiles();
    const { result } = await importLines(files, () => fakeMp3({ bitrateKbps: 128 }));
    expect(result.ok).toBe(false);
    expect(files.snapshot()).toEqual({});
  });

  it('chybějící nahrávka repliky zastaví uložení a zpráva ji jmenuje', async () => {
    const files = memoryFiles();
    const { result, log } = await importLines(files, (line) =>
      line.place === 'menu' ? null : SHORT_MP3,
    );
    expect(result.ok).toBe(false);
    expect(log.join('\n')).toContain('menu/greeting');
    expect(files.snapshot()).toEqual({});
  });

  it('bez hlasu postavičky v configu nic neuloží', async () => {
    const files = memoryFiles();
    const result = await importCharacterVoice({
      character: 'rudy',
      language: 'cs',
      lines: LINES,
      voices: { cs: VOICES.cs },
      source: async () => SHORT_MP3,
      files,
      log: () => undefined,
    });
    expect(result.ok).toBe(false);
    expect(files.snapshot()).toEqual({});
  });

  it('skript nahrávek průvodce otisky postavičky nesmaže', async () => {
    const files = memoryFiles();
    await importLines(files);
    const rudyBefore = (await manifestOf(files))['character:rudy'];
    const result = await makeVoice({
      language: 'cs',
      sentences: [{ id: 'summary', text: 'Hotovo.' }],
      config: VOICES.cs as VoiceConfig,
      env: { [API_KEY_ENV]: 'sk_test_jen_pro_test' },
      fetch: alwaysMp3().fetch,
      files,
      log: () => undefined,
    });
    expect(result.ok).toBe(true);
    expect((await manifestOf(files))['character:rudy']).toEqual(rudyBefore);
  });
});

describe('#171 AC1: délka nahrávky', () => {
  it('délka mp3 se spočítá z rámců (64 kb/s, 44,1 kHz, 20 KB je asi 2,5 s)', () => {
    const durationMs = readMp3DurationMs(SHORT_MP3) ?? 0;
    expect(durationMs).toBeGreaterThan(2300);
    expect(durationMs).toBeLessThan(2700);
  });

  it('data, která nejsou mp3, délku nemají', () => {
    expect(readMp3DurationMs(new Uint8Array([1, 2, 3, 4, 5]))).toBeNull();
  });
});
