/// <reference types="vite/client" />
import { afterEach, describe, expect, it, vi } from 'vitest';

import { LANGUAGES, LANGUAGE_STORAGE_KEY } from '../../src/shared/texts/languages';
import { dictionariesByLanguage, findTextProblems } from './textChecks';

/**
 * Testy k #137 pro sdílenou část: anglické texty stránky přesně podle
 * tabulky v zadání (AC1). Od #138 je angličtina v seznamu jazyků, proto
 * testy #137 AC4 („hra se zatím nezmění“) nahradilo chování po zapnutí.
 *
 * Rozhraní: `src/shared/texts/en.ts` (`export default { … } satisfies
 * SharedTexts`), od #138 i v `SHARED_TEXTS` a `LANGUAGES = ['cs', 'en']`.
 */

/** Sdílené texty každého jazyka, který má soubor `src/shared/texts/<jazyk>.ts`. */
const SHARED_FILES = dictionariesByLanguage(
  import.meta.glob('../../src/shared/texts/*.ts', { eager: true }),
);

/** Tabulka z #137, řádek „stránka“; angličtina nemá jednopísmenné předložky. */
const ENGLISH_SHARED = {
  pageTitle: 'Maths',
  settingsButtonLabel: 'Settings for parents',
  languageName: 'English',
  oneLetterPrepositions: [],
};

/** Úložiště v paměti místo `localStorage` s uloženými hodnotami a záznamem zápisů. */
function storedLocalStorage(initial: Record<string, string>): { writes: string[] } {
  const data = new Map<string, string>(Object.entries(initial));
  const writes: string[] = [];
  const storage = {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      writes.push(key);
      data.set(key, value);
    },
    removeItem: (key: string) => {
      data.delete(key);
    },
    clear: () => data.clear(),
    key: (index: number) => [...data.keys()][index] ?? null,
    get length() {
      return data.size;
    },
  };
  // Úložiště prohlížeče se čte přes `window.localStorage`, proto obojí.
  vi.stubGlobal('localStorage', storage);
  vi.stubGlobal('window', { localStorage: storage });
  return { writes };
}

/** Nové načtení stránky: modul jazyků znovu, aby se uložená volba opravdu přečetla. */
async function freshLanguages() {
  vi.resetModules();
  return import('../../src/shared/texts/languages');
}

/** Sdílené texty po novém načtení stránky (s čerstvým modulem jazyků). */
async function freshSharedTexts() {
  vi.resetModules();
  return import('../../src/shared/texts/sharedTexts');
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('#137 AC1: anglické texty stránky', () => {
  it('sdílená část má soubor anglických textů src/shared/texts/en.ts', () => {
    expect(Object.keys(SHARED_FILES)).toContain('en');
  });

  it('stránka se anglicky jmenuje „Maths“, kolečko je „Settings for parents“ a jazyk „English“', () => {
    expect(SHARED_FILES['en']).toEqual(ENGLISH_SHARED);
  });

  it('angličtina má stejné texty jako čeština a žádný není prázdný', () => {
    expect(SHARED_FILES['en'], 'soubor en.ts chybí').toBeDefined();
    expect(
      findTextProblems({
        language: 'en',
        part: 'sdílená část',
        reference: SHARED_FILES['cs'] ?? {},
        texts: SHARED_FILES['en'] ?? {},
        mayBeEmptyList: (key) => key === 'oneLetterPrepositions',
      }),
    ).toEqual([]);
  });

  it('anglická sazba nedrží žádné jednopísmenné předložky u dalšího slova', () => {
    expect(SHARED_FILES['en']?.['oneLetterPrepositions']).toEqual([]);
  });
});

// #138: angličtina je v seznamu jazyků. Testy #137 AC4 („hra se zatím
// nezmění“) nahrazuje chování po zapnutí jazyka; podrobně je volba jazyka
// v `englishLanguageChoice.test.ts`.
describe('#138: angličtina je zapnutá, stránka ji po výběru použije', () => {
  it('v seznamu jazyků je čeština a angličtina, čeština první', () => {
    expect(LANGUAGES).toEqual(['cs', 'en']);
  });

  it('po načtení stránky s uloženým „en“ je jazyk angličtina', async () => {
    storedLocalStorage({ [LANGUAGE_STORAGE_KEY]: 'en' });
    const languages = await freshLanguages();
    expect(languages.currentLanguage()).toBe('en');
  });

  it('s uloženým „en“ jsou texty stránky anglicky: „Maths“ a „English“', async () => {
    storedLocalStorage({ [LANGUAGE_STORAGE_KEY]: 'en' });
    const shared = await freshSharedTexts();
    expect(shared.sharedTexts().pageTitle).toBe('Maths');
    expect(shared.sharedTexts().languageName).toBe('English');
  });

  it('výběr angličtiny jazyk změní a uloží jen kód jazyka', async () => {
    const storage = storedLocalStorage({});
    const languages = await freshLanguages();
    expect(languages.selectLanguage('en')).toBe(true);
    expect(languages.currentLanguage()).toBe('en');
    expect(storage.writes).toEqual([LANGUAGE_STORAGE_KEY]);
  });

  it('požadavek na „en“ dá angličtinu', async () => {
    storedLocalStorage({});
    const languages = await freshLanguages();
    expect(languages.currentLanguage('en')).toBe('en');
  });
});
