/// <reference types="vite/client" />
import { afterEach, describe, expect, it, vi } from 'vitest';

import { LANGUAGES, LANGUAGE_STORAGE_KEY } from '../../src/shared/texts/languages';
import { dictionariesByLanguage, findTextProblems } from './textChecks';

/**
 * Testy k #137 pro sdílenou část: anglické texty stránky přesně podle
 * tabulky v zadání (AC1) a hra se zatím nezmění, protože angličtina není
 * v seznamu jazyků (AC4).
 *
 * Navržené rozhraní: nový soubor `src/shared/texts/en.ts`, který jako
 * `export default { … } satisfies SharedTexts` vrací anglické sdílené
 * texty. Seznam `LANGUAGES` v `languages.ts` zůstává `['cs']`, proto se
 * anglický slovník zatím nedostane do `SHARED_TEXTS` (typ `Language` ho
 * nepustí) a čte se tu jen ze souboru.
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
  vi.stubGlobal('localStorage', {
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
  });
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

describe('#137 AC4: hra se zatím nezmění, angličtina není zapnutá', () => {
  it('v seznamu jazyků je dál jen čeština, i když angličtina má soubor textů', () => {
    expect(LANGUAGES).toEqual(['cs']);
  });

  it('po načtení stránky s uloženým „en“ je jazyk čeština', async () => {
    storedLocalStorage({ [LANGUAGE_STORAGE_KEY]: 'en' });
    const languages = await freshLanguages();
    expect(languages.currentLanguage()).toBe('cs');
  });

  it('s uloženým „en“ jsou texty stránky česky: „Matematika“ a „Čeština“', async () => {
    storedLocalStorage({ [LANGUAGE_STORAGE_KEY]: 'en' });
    const shared = await freshSharedTexts();
    expect(shared.sharedTexts().pageTitle).toBe('Matematika');
    expect(shared.sharedTexts().languageName).toBe('Čeština');
  });

  it('výběr angličtiny nic nezmění ani neuloží, jazyk zůstane čeština', async () => {
    const storage = storedLocalStorage({});
    const languages = await freshLanguages();
    expect(languages.selectLanguage('en')).toBe(false);
    expect(languages.currentLanguage()).toBe('cs');
    expect(storage.writes).toEqual([]);
  });

  it('požadavek na „en“ dá dál češtinu', async () => {
    storedLocalStorage({});
    const languages = await freshLanguages();
    expect(languages.currentLanguage('en')).toBe('cs');
  });
});
