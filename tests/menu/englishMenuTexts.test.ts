/// <reference types="vite/client" />
import { afterEach, describe, expect, it, vi } from 'vitest';

import { LANGUAGE_STORAGE_KEY } from '../../src/shared/texts/languages';
import { dictionariesByLanguage, findTextProblems } from '../shared/textChecks';
import { testMenu, watchedLocalStorage } from './menuFixtures';

/**
 * Testy k #137 pro menu: anglické texty menu podle tabulky v zadání (AC1).
 * Od #138 je angličtina v seznamu jazyků a nabídka ji ukazuje (místo
 * #137 AC4 „nabídka se zatím nezmění“).
 *
 * Rozhraní: `src/menu/texts/en.ts` (`export default { … } satisfies
 * MenuTexts`), od #138 i v `MENU_TEXTS` v `menuTexts.ts`.
 *
 * Kategorie „Sčítání a odčítání“: tabulka navrhuje „Adding and
 * subtracting“, ale zadání (otázka 2, platí doporučení) říká, že když se
 * v některém okně nevejde, použije se „Plus and minus“. Podle měření z AC2
 * se „Adding and subtracting“ do sloupce kategorií na iPadu ani na telefonu
 * nevejde (`menuTextsFit.test.ts`), proto test čeká zálohu.
 */

const MENU_FILES = dictionariesByLanguage(
  import.meta.glob('../../src/menu/texts/*.ts', { eager: true }),
);

const ENGLISH_MENU = {
  categories: {
    all: { title: 'All' },
    addingSubtracting: { title: 'Plus and minus' },
    drawing: { title: 'Drawing' },
  },
  profiles: {
    nicknameTitle: 'Nickname',
    colorTitle: 'Colour',
    deleteQuestion: 'Delete profile?',
    deleteConfirm: 'Delete',
    deleteCancel: 'Back',
  },
};

function englishMenu(): Record<string, unknown> {
  return MENU_FILES['en'] ?? {};
}

/** Jazyky zařízení po novém načtení stránky (moduly znovu, uložená volba se přečte). */
async function freshDeviceLanguages() {
  vi.resetModules();
  const { deviceLanguages } = await import('../../src/menu/logic/menuLanguages');
  return deviceLanguages();
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('#137 AC1: anglické texty menu', () => {
  it('menu má soubor anglických textů src/menu/texts/en.ts', () => {
    expect(Object.keys(MENU_FILES)).toContain('en');
  });

  it('kategorie jsou „All“, „Plus and minus“ a „Drawing“', () => {
    expect(englishMenu()['categories']).toEqual(ENGLISH_MENU.categories);
  });

  it('formulář profilu má nadpisy „Nickname“ a „Colour“', () => {
    const profiles = (englishMenu()['profiles'] ?? {}) as Record<string, unknown>;
    expect(profiles['nicknameTitle']).toBe('Nickname');
    expect(profiles['colorTitle']).toBe('Colour');
  });

  it('potvrzení smazání je „Delete profile?“ s tlačítky „Delete“ a „Back“', () => {
    const profiles = (englishMenu()['profiles'] ?? {}) as Record<string, unknown>;
    expect(profiles['deleteQuestion']).toBe('Delete profile?');
    expect(profiles['deleteConfirm']).toBe('Delete');
    expect(profiles['deleteCancel']).toBe('Back');
  });

  it('soubor neobsahuje nic jiného než texty z tabulky', () => {
    expect(englishMenu()).toEqual(ENGLISH_MENU);
  });

  it('angličtina má stejné texty jako čeština a žádný není prázdný', () => {
    expect(MENU_FILES['en'], 'soubor en.ts chybí').toBeDefined();
    expect(
      findTextProblems({
        language: 'en',
        part: 'menu',
        reference: MENU_FILES['cs'] ?? {},
        texts: englishMenu(),
      }),
    ).toEqual([]);
  });
});

/**
 * Úložiště zařízení v paměti: `watchedLocalStorage` a k tomu `window`, protože
 * volba jazyka čte úložiště prohlížeče přes `window.localStorage`.
 */
function deviceStorage(
  initial: Record<string, string> = {},
): ReturnType<typeof watchedLocalStorage> {
  const storage = watchedLocalStorage(initial);
  vi.stubGlobal('window', { localStorage: globalThis.localStorage });
  return storage;
}

// #138: angličtina je v seznamu jazyků. Testy #137 AC4 („nabídka zatím
// ukazuje jen češtinu“) nahrazuje nabídka se dvěma jazyky; podrobně
// v `englishMenu.test.ts`.
describe('#138: nabídka jazyků ukazuje češtinu i angličtinu', () => {
  it('v nabídce jsou „Čeština“ s ✓ a „English“, na tlačítku „CS“', async () => {
    deviceStorage();
    const test = testMenu({ languages: await freshDeviceLanguages() });
    test.menu.tapLanguageButton();
    expect(test.menu.languages()).toEqual([
      { code: 'cs', name: 'Čeština', selected: true },
      { code: 'en', name: 'English', selected: false },
    ]);
    expect(test.menu.languageButtonLabel()).toBe('CS');
  });

  it('s uloženým „en“ ukáže menu „EN“ a ✓ u „English“', async () => {
    deviceStorage({ [LANGUAGE_STORAGE_KEY]: 'en' });
    const languages = await freshDeviceLanguages();
    expect(languages.current()).toBe('en');
    const test = testMenu({ languages });
    test.menu.tapLanguageButton();
    expect(test.menu.languageButtonLabel()).toBe('EN');
    expect(test.menu.languages().filter((item) => item.selected)).toEqual([
      { code: 'en', name: 'English', selected: true },
    ]);
  });

  it('jazyky zařízení nabízejí češtinu a angličtinu', async () => {
    deviceStorage();
    const languages = await freshDeviceLanguages();
    expect(languages.supported).toEqual(['cs', 'en']);
  });

  it('výběr angličtiny jazyk změní a uloží jen klíč jazyka', async () => {
    const storage = deviceStorage();
    const languages = await freshDeviceLanguages();
    expect(languages.select('en')).toBe(true);
    expect(languages.current()).toBe('en');
    expect(storage.writes).toEqual([LANGUAGE_STORAGE_KEY]);
  });
});
