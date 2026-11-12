import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { GAMES } from '../../src/gameList';
import { GAME_CATEGORIES } from '../../src/shared/logic/gameRegistry';
import { LANGUAGE_STORAGE_KEY } from '../../src/shared/texts/languages';
import type { LanguagePage } from '../../src/menu/ui/pageLanguage';
import { testMenu, watchedLocalStorage } from './menuFixtures';
import type { TestMenu } from './menuFixtures';

/**
 * Testy k #138 AC1, AC2 a AC4 (část „jazyk se nezmění při otevřeném
 * průvodci“) pro menu: skutečné menu se skutečnými hrami, texty a jazyky
 * zařízení (čeština a angličtina). Stahování a hra jsou falešné, úložiště
 * zařízení je v paměti. Každý test je nové načtení stránky (moduly znovu),
 * aby se uložená volba opravdu přečetla.
 *
 * Tlačítko jazyka na výběru profilu kreslí `ProfileScene` z
 * `menu.languageButtonLabel()` stejného menu, proto „EN“ na výběru profilu
 * hlídá stejný test jako „EN“ v menu.
 *
 * Rozhraní: žádné nové. Angličtina v `LANGUAGES`, v `MENU_TEXTS`,
 * v `SHARED_TEXTS`, v textech her (`COUNTING_TEXTS`, `COLORING_TEXTS`)
 * a v `titles` každého `meta.ts`.
 */

/** Úložiště zařízení v paměti, jak ho čte volba jazyka (`window.localStorage`). */
function deviceStorage(
  initial: Record<string, string> = {},
): ReturnType<typeof watchedLocalStorage> {
  const storage = watchedLocalStorage(initial);
  vi.stubGlobal('window', { localStorage: globalThis.localStorage });
  return storage;
}

interface EnglishPage {
  readonly test: TestMenu;
  /** Aktuální jazyk stránky. */
  readonly language: () => string;
  /** Texty Počítání a Omalovánek, jak je dostane hra spuštěná teď. */
  readonly countingTitle: () => string;
  readonly countingStartButton: () => string;
  readonly coloringTitle: () => string;
  /** Jazyk a popis kolečka, jak je stránka nastaví po změně jazyka. */
  readonly page: LanguagePage & { readonly labels: Map<string, string> };
}

/** Nové načtení stránky se skutečným menu, hrami, texty a jazyky zařízení. */
async function englishPage(): Promise<EnglishPage> {
  vi.resetModules();
  const { deviceLanguages } = await import('../../src/menu/logic/menuLanguages');
  const { menuText } = await import('../../src/menu/logic/menuTexts');
  const { currentLanguage } = await import('../../src/shared/texts/languages');
  const { showPageLanguage } = await import('../../src/menu/ui/pageLanguage');
  const { countingTexts } = await import('../../src/games/counting/texts/countingTexts');
  const { coloringTexts } = await import('../../src/games/coloring/texts/coloringTexts');
  const labels = new Map<string, string>();
  const page = {
    labels,
    documentElement: { lang: '' },
    getElementById: (id: string) =>
      id === 'settings-button'
        ? { setAttribute: (name: string, value: string) => labels.set(name, value) }
        : null,
  };
  showPageLanguage(page, currentLanguage());
  const test = testMenu({
    games: GAMES,
    categories: GAME_CATEGORIES,
    translate: (key) => menuText(key, currentLanguage()) ?? key,
    languages: deviceLanguages(),
    onLanguageChanged: () => showPageLanguage(page, currentLanguage()),
  });
  return {
    test,
    language: () => currentLanguage(),
    countingTitle: () => countingTexts().title,
    countingStartButton: () => countingTexts().guideButtons.startPlaying,
    coloringTitle: () => coloringTexts().title,
    page,
  };
}

function chooseLanguage(test: TestMenu, language: string): void {
  test.menu.tapLanguageButton();
  test.menu.tapLanguage(language);
}

function tileTitles(test: TestMenu): Record<string, string> {
  return Object.fromEntries(test.menu.tiles().map((tile) => [tile.gameId, tile.title]));
}

function categoryTitles(test: TestMenu): Record<string, string> {
  return Object.fromEntries(
    test.menu.categories().map((category) => [category.id, category.title]),
  );
}

async function wait(): Promise<void> {
  await vi.advanceTimersByTimeAsync(0);
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('#138 AC1: nabídka jazyků ukazuje „Čeština“ a „English“', () => {
  it('v nabídce je každý jazyk svým vlastním názvem a ✓ je u češtiny', async () => {
    deviceStorage();
    const { test } = await englishPage();
    test.menu.tapLanguageButton();
    expect(test.menu.languages()).toEqual([
      { code: 'cs', name: 'Čeština', selected: true },
      { code: 'en', name: 'English', selected: false },
    ]);
  });

  it('po výběru angličtiny je ✓ u „English“ a názvy jazyků se nepřeloží', async () => {
    deviceStorage();
    const { test } = await englishPage();
    chooseLanguage(test, 'en');
    test.menu.tapLanguageButton();
    expect(test.menu.languages()).toEqual([
      { code: 'cs', name: 'Čeština', selected: false },
      { code: 'en', name: 'English', selected: true },
    ]);
  });

  it('po výběru angličtiny ukazuje tlačítko jazyka v menu i na výběru profilu „EN“', async () => {
    deviceStorage();
    const { test } = await englishPage();
    expect(test.menu.languageButtonLabel()).toBe('CS');
    chooseLanguage(test, 'en');
    expect(test.menu.languageButtonLabel()).toBe('EN');
  });

  it('po obnovení stránky s angličtinou je na tlačítku pořád „EN“', async () => {
    deviceStorage();
    chooseLanguage((await englishPage()).test, 'en');
    const { test } = await englishPage();
    expect(test.menu.languageButtonLabel()).toBe('EN');
  });

  it('výběr „Čeština“ vrátí na tlačítko „CS“ a ✓ k češtině', async () => {
    deviceStorage();
    const { test } = await englishPage();
    chooseLanguage(test, 'en');
    chooseLanguage(test, 'cs');
    expect(test.menu.languageButtonLabel()).toBe('CS');
    test.menu.tapLanguageButton();
    expect(
      test.menu
        .languages()
        .filter((item) => item.selected)
        .map((item) => item.code),
    ).toEqual(['cs']);
  });

  it('ťuknutí na už vybranou angličtinu nic nezmění a nabídku zavře', async () => {
    const storage = deviceStorage({ [LANGUAGE_STORAGE_KEY]: 'en' });
    const { test } = await englishPage();
    chooseLanguage(test, 'en');
    expect(test.menu.languageButtonLabel()).toBe('EN');
    expect(test.menu.isLanguageMenuOpen()).toBe(false);
    expect(storage.writes).toEqual([]);
    expect(test.feedback.filter((event) => event.kind === 'language')).toEqual([]);
  });
});

describe('#138 AC2: po výběru English je menu anglicky', () => {
  it('kategorie jsou „All“, „Plus and minus“ a „Drawing“', async () => {
    deviceStorage();
    const { test } = await englishPage();
    chooseLanguage(test, 'en');
    expect(categoryTitles(test)).toEqual({
      all: 'All',
      addingSubtracting: 'Plus and minus',
      drawing: 'Drawing',
    });
  });

  it('názvy her na dlaždicích jsou „Counting“ a „Colouring“', async () => {
    deviceStorage();
    const { test } = await englishPage();
    chooseLanguage(test, 'en');
    expect(tileTitles(test)).toEqual({ counting: 'Counting', coloring: 'Colouring' });
  });

  it('pořadí kategorií a dlaždic se po výběru angličtiny nezmění', async () => {
    deviceStorage();
    const { test } = await englishPage();
    const categoriesBefore = test.menu.categories().map((category) => category.id);
    const tilesBefore = test.menu.tiles().map((tile) => tile.gameId);
    chooseLanguage(test, 'en');
    expect(test.menu.categories().map((category) => category.id)).toEqual(categoriesBefore);
    expect(test.menu.tiles().map((tile) => tile.gameId)).toEqual(tilesBefore);
  });

  it('název stránky v menu je „Maths“', async () => {
    deviceStorage();
    const { test } = await englishPage();
    chooseLanguage(test, 'en');
    expect(test.menu.pageTitle()).toBe('Maths');
  });

  it('jazyk stránky je „en“ a kolečko má popis „Settings for parents“', async () => {
    deviceStorage();
    const { test, page } = await englishPage();
    expect(page.documentElement.lang).toBe('cs');
    chooseLanguage(test, 'en');
    expect(page.documentElement.lang).toBe('en');
    expect(page.labels.get('aria-label')).toBe('Settings for parents');
  });

  it('texty profilu jsou anglicky (přezdívka, barva a potvrzení smazání)', async () => {
    deviceStorage({ [LANGUAGE_STORAGE_KEY]: 'en' });
    vi.resetModules();
    const { menuText } = await import('../../src/menu/logic/menuTexts');
    const { currentLanguage } = await import('../../src/shared/texts/languages');
    const expected: Readonly<Record<string, string>> = {
      'profiles.nicknameTitle': 'Nickname',
      'profiles.colorTitle': 'Colour',
      'profiles.deleteQuestion': 'Delete profile?',
      'profiles.deleteConfirm': 'Delete',
      'profiles.deleteCancel': 'Back',
    };
    for (const [key, text] of Object.entries(expected)) {
      expect(menuText(key, currentLanguage()), key).toBe(text);
    }
  });

  it('Počítání spuštěné po výběru angličtiny má anglický název i texty', async () => {
    deviceStorage();
    const english = await englishPage();
    chooseLanguage(english.test, 'en');
    english.test.menu.tapTile('counting');
    english.test.download.succeed();
    await wait();
    expect(english.test.menu.runningGame()?.id).toBe('counting');
    expect(english.test.menu.pageTitle()).toBe('Counting');
    expect(english.countingTitle()).toBe('Counting');
    expect(english.countingStartButton()).toBe("Let's play");
  });

  it('Omalovánky spuštěné po výběru angličtiny mají anglický název', async () => {
    deviceStorage();
    const english = await englishPage();
    chooseLanguage(english.test, 'en');
    english.test.menu.tapTile('coloring');
    english.test.download.succeed();
    await wait();
    expect(english.test.menu.pageTitle()).toBe('Colouring');
    expect(english.coloringTitle()).toBe('Colouring');
  });

  it('výběr „Čeština“ vrátí do češtiny menu, stránku i hry', async () => {
    deviceStorage();
    const czech = await englishPage();
    const menuBefore = {
      categories: categoryTitles(czech.test),
      tiles: tileTitles(czech.test),
      title: czech.test.menu.pageTitle(),
    };
    chooseLanguage(czech.test, 'en');
    chooseLanguage(czech.test, 'cs');
    expect({
      categories: categoryTitles(czech.test),
      tiles: tileTitles(czech.test),
      title: czech.test.menu.pageTitle(),
    }).toEqual(menuBefore);
    expect(menuBefore.title).toBe('Matematika');
    expect(menuBefore.tiles).toEqual({ counting: 'Počítání', coloring: 'Omalovánky' });
    expect(czech.page.documentElement.lang).toBe('cs');
    expect(czech.page.labels.get('aria-label')).toBe('Nastavení pro rodiče');
    expect(czech.countingTitle()).toBe('Počítání');
    expect(czech.coloringTitle()).toBe('Omalovánky');
  });
});

describe('#138 AC4: při otevřeném průvodci (hra běží) se jazyk nezmění', () => {
  it('během Počítání tlačítko jazyka nabídku neotevře a jazyk zůstane', async () => {
    deviceStorage();
    const english = await englishPage();
    english.test.menu.tapTile('counting');
    english.test.download.succeed();
    await wait();
    english.test.menu.tapLanguageButton();
    expect(english.test.menu.isLanguageMenuOpen()).toBe(false);
    english.test.menu.tapLanguage('en');
    expect(english.language()).toBe('cs');
    expect(english.countingTitle()).toBe('Počítání');
  });

  it('v anglickém Počítání ťuknutí na tlačítko jazyka a na češtinu jazyk nezmění', async () => {
    const storage = deviceStorage({ [LANGUAGE_STORAGE_KEY]: 'en' });
    const english = await englishPage();
    english.test.menu.tapTile('counting');
    english.test.download.succeed();
    await wait();
    expect(english.test.menu.runningGame()?.id).toBe('counting');
    english.test.menu.tapLanguageButton();
    english.test.menu.tapLanguage('cs');
    expect(english.language()).toBe('en');
    expect(english.countingStartButton()).toBe("Let's play");
    expect(storage.writes).toEqual([]);
  });
});
