/// <reference types="vite/client" />
import { afterEach, describe, expect, it, vi } from 'vitest';

import { LANGUAGE_STORAGE_KEY } from '../../src/shared/texts/languages';
import { dictionariesByLanguage, findTextProblems } from '../shared/textChecks';
import { testMenu, watchedLocalStorage } from './menuFixtures';

/**
 * Testy k #137 pro menu: anglické texty menu podle tabulky v zadání (AC1)
 * a nabídka jazyků se zatím nezmění (AC4).
 *
 * Navržené rozhraní: nový soubor `src/menu/texts/en.ts`, který jako
 * `export default { … } satisfies MenuTexts` vrací anglické texty menu.
 * Do `MENU_TEXTS` v `menuTexts.ts` se zatím nepřidává (angličtina není
 * v `LANGUAGES`), proto se tu čte jen ze souboru.
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

describe('#137 AC4: nabídka jazyků zatím ukazuje jen češtinu', () => {
  it('v nabídce jazyků je jen „Čeština“ s ✓ a na tlačítku „CS“', async () => {
    watchedLocalStorage();
    const test = testMenu({ languages: await freshDeviceLanguages() });
    test.menu.tapLanguageButton();
    expect(test.menu.languages()).toEqual([{ code: 'cs', name: 'Čeština', selected: true }]);
    expect(test.menu.languageButtonLabel()).toBe('CS');
  });

  it('s uloženým „en“ ukáže menu dál „CS“ a v nabídce jen „Čeština“', async () => {
    watchedLocalStorage({ [LANGUAGE_STORAGE_KEY]: 'en' });
    const languages = await freshDeviceLanguages();
    expect(languages.current()).toBe('cs');
    const test = testMenu({ languages });
    test.menu.tapLanguageButton();
    expect(test.menu.languageButtonLabel()).toBe('CS');
    expect(test.menu.languages()).toEqual([{ code: 'cs', name: 'Čeština', selected: true }]);
  });

  it('jazyky zařízení nabízejí jen češtinu, i když angličtina má soubory textů', async () => {
    watchedLocalStorage();
    const languages = await freshDeviceLanguages();
    expect(languages.supported).toEqual(['cs']);
  });

  it('pokus vybrat angličtinu jazyk nezmění ani neuloží', async () => {
    const storage = watchedLocalStorage();
    const languages = await freshDeviceLanguages();
    expect(languages.select('en')).toBe(false);
    expect(languages.current()).toBe('cs');
    expect(storage.writes).toEqual([]);
  });
});
