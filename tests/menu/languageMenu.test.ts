import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createMenu } from '../../src/menu/logic/menu';
import type { Menu, MenuFeedback } from '../../src/menu/logic/menu';
import { MENU_STYLE } from '../../src/menu/logic/menuTheme';
import { contrastRatio } from '../../src/shared/logic/theme';
import {
  TEST_CATEGORIES,
  TEST_GAMES,
  TEST_TEXTS_CS,
  TEST_TEXTS_XX,
  TestLanguages,
  testMenu,
  translatorOf,
} from './menuFixtures';
import type { TestMenu } from './menuFixtures';

/**
 * Testy k #70 AC1 a AC3, logika menu: tlačítko jazyka a nabídka jazyků.
 * Jazyk „xx“ („Xxština“) je umělý, jen v testech.
 *
 * Navržené rozhraní (`src/menu/logic/menu.ts`):
 * - `createMenu({ …, languages, onLanguageChanged })`: `languages` jsou
 *   jazyky ze seznamu, aktuální jazyk, výběr a vlastní název jazyka;
 *   bez zadání jazyky celého zařízení ze sdílené části,
 * - `languageButtonLabel()` zkratka aktuálního jazyka velkými písmeny,
 * - `isLanguageMenuOpen()`, `languages()` (kód, název, ✓ u aktuálního),
 * - `tapLanguageButton()`, `tapLanguage(kód)`, `closeLanguageMenu()`
 *   (ťuknutí mimo nabídku).
 * Odezva: `{ kind: 'languageMenu', open }` po otevření a zavření nabídky,
 * `{ kind: 'language', language }` po výběru jazyka.
 */

function languageMenu(languages = new TestLanguages()): TestMenu & { languages: TestLanguages } {
  return { ...testMenu({ languages }), languages };
}

function languageEvents(feedback: readonly MenuFeedback[]): MenuFeedback[] {
  return feedback.filter((event) => event.kind === 'languageMenu' || event.kind === 'language');
}

async function wait(): Promise<void> {
  await vi.advanceTimersByTimeAsync(0);
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('#70 AC1: tlačítko jazyka ukazuje zkratku aktuálního jazyka', () => {
  it('s češtinou je na tlačítku „CS“', () => {
    expect(languageMenu().menu.languageButtonLabel()).toBe('CS');
  });

  it('po výběru jiného jazyka je na tlačítku jeho zkratka velkými písmeny', () => {
    const test = languageMenu();
    test.menu.tapLanguageButton();
    test.menu.tapLanguage('xx');
    expect(test.menu.languageButtonLabel()).toBe('XX');
  });

  // #138: jazyky zařízení jsou čeština a angličtina.
  it('bez zadaných jazyků menu použije jazyky zařízení: „CS“, „Čeština“ a „English“', () => {
    const test = testMenu();
    expect(test.menu.languageButtonLabel()).toBe('CS');
    expect(test.menu.languages()).toEqual([
      { code: 'cs', name: 'Čeština', selected: true },
      { code: 'en', name: 'English', selected: false },
    ]);
  });
});

describe('#70 AC1: ťuknutí na tlačítko otevře nabídku se všemi jazyky', () => {
  it('po startu je nabídka zavřená', () => {
    expect(languageMenu().menu.isLanguageMenuOpen()).toBe(false);
  });

  it('po ťuknutí na tlačítko je nabídka otevřená', () => {
    const test = languageMenu();
    test.menu.tapLanguageButton();
    expect(test.menu.isLanguageMenuOpen()).toBe(true);
  });

  it('v nabídce je každý jazyk ze seznamu svým vlastním názvem, ✓ má jen aktuální', () => {
    const test = languageMenu();
    test.menu.tapLanguageButton();
    expect(test.menu.languages()).toEqual([
      { code: 'cs', name: 'Čeština', selected: true },
      { code: 'xx', name: 'Xxština', selected: false },
    ]);
  });

  it('po výběru jiného jazyka má ✓ nový jazyk', () => {
    const test = languageMenu();
    test.menu.tapLanguageButton();
    test.menu.tapLanguage('xx');
    test.menu.tapLanguageButton();
    expect(test.menu.languages().filter((item) => item.selected)).toEqual([
      { code: 'xx', name: 'Xxština', selected: true },
    ]);
  });

  it('otevření nabídky dá okamžitou odezvu', () => {
    const test = languageMenu();
    test.menu.tapLanguageButton();
    expect(languageEvents(test.feedback)).toEqual([{ kind: 'languageMenu', open: true }]);
  });

  it('otevření nabídky nic nevybere ani nespustí', () => {
    const test = languageMenu();
    test.menu.tapLanguageButton();
    expect(test.languages.selections).toEqual([]);
    expect(test.download.count).toBe(0);
    expect(test.menu.categories().find((category) => category.selected)?.id).toBe('all');
  });
});

describe('#70 AC1: ťuknutí na jazyk ho vybere a nabídka se zavře', () => {
  it('po ťuknutí na jazyk je vybraný a nabídka zavřená', () => {
    const test = languageMenu();
    test.menu.tapLanguageButton();
    test.menu.tapLanguage('xx');
    expect(test.languages.current()).toBe('xx');
    expect(test.menu.isLanguageMenuOpen()).toBe(false);
  });

  it('výběr ohlásí nový jazyk a zavření nabídky', () => {
    const test = languageMenu();
    test.menu.tapLanguageButton();
    test.menu.tapLanguage('xx');
    expect(languageEvents(test.feedback)).toEqual([
      { kind: 'languageMenu', open: true },
      { kind: 'language', language: 'xx' },
      { kind: 'languageMenu', open: false },
    ]);
  });

  it('se zavřenou nabídkou ťuknutí na jazyk nic nevybere', () => {
    const test = languageMenu();
    test.menu.tapLanguage('xx');
    expect(test.languages.current()).toBe('cs');
    expect(test.languages.selections).toEqual([]);
  });

  it('jazyk, který v nabídce není, nic nevybere a nabídka zůstane otevřená', () => {
    const test = languageMenu();
    test.menu.tapLanguageButton();
    test.menu.tapLanguage('de');
    expect(test.languages.current()).toBe('cs');
    expect(test.menu.isLanguageMenuOpen()).toBe(true);
  });
});

describe('#70 AC1: ťuknutí mimo nabídku nebo znovu na tlačítko ji zavře beze změny', () => {
  it('druhé ťuknutí na tlačítko nabídku zavře a jazyk se nezmění', () => {
    const test = languageMenu();
    test.menu.tapLanguageButton();
    test.menu.tapLanguageButton();
    expect(test.menu.isLanguageMenuOpen()).toBe(false);
    expect(test.languages.selections).toEqual([]);
    expect(languageEvents(test.feedback)).toEqual([
      { kind: 'languageMenu', open: true },
      { kind: 'languageMenu', open: false },
    ]);
  });

  it('ťuknutí mimo nabídku ji zavře a jazyk se nezmění', () => {
    const test = languageMenu();
    test.menu.tapLanguageButton();
    test.menu.closeLanguageMenu();
    expect(test.menu.isLanguageMenuOpen()).toBe(false);
    expect(test.languages.selections).toEqual([]);
  });

  it('ťuknutí mimo zavřenou nabídku nic neohlásí', () => {
    const test = languageMenu();
    test.menu.closeLanguageMenu();
    expect(test.feedback).toEqual([]);
  });

  it('nabídka jde po zavření znovu otevřít', () => {
    const test = languageMenu();
    test.menu.tapLanguageButton();
    test.menu.closeLanguageMenu();
    test.menu.tapLanguageButton();
    expect(test.menu.isLanguageMenuOpen()).toBe(true);
  });
});

describe('#70 AC1: dokud je nabídka otevřená, dlaždice ani kategorie nereagují', () => {
  it('ťuknutí na dlaždici hru nestáhne ani nespustí, jen nabídku zavře', async () => {
    const test = languageMenu();
    test.menu.tapLanguageButton();
    test.menu.tapTile('zebra');
    await wait();
    expect(test.download.count).toBe(0);
    expect(test.game.started).toEqual([]);
    expect(test.kinds()).not.toContain('press');
    expect(test.menu.isLanguageMenuOpen()).toBe(false);
  });

  it('ťuknutí na kategorii ji nevybere, jen nabídku zavře', () => {
    const test = languageMenu();
    test.menu.tapLanguageButton();
    test.menu.tapCategory('adding');
    expect(test.menu.categories().find((category) => category.selected)?.id).toBe('all');
    expect(test.kinds()).not.toContain('select');
    expect(test.menu.isLanguageMenuOpen()).toBe(false);
  });

  it('ťuknutí na zástupné tlačítko ho nezhoupne, jen nabídku zavře', () => {
    const test = languageMenu();
    test.menu.tapLanguageButton();
    test.menu.tapPlaceholder(0);
    expect(test.kinds()).not.toContain('wobble');
    expect(test.menu.isLanguageMenuOpen()).toBe(false);
  });

  it('po zavření nabídky dlaždice zase spustí hru', async () => {
    const test = languageMenu();
    test.menu.tapLanguageButton();
    test.menu.closeLanguageMenu();
    test.menu.tapTile('zebra');
    test.download.succeed();
    await wait();
    expect(test.game.started.map((started) => started.gameId)).toEqual(['zebra']);
  });

  it('otevření nabídky zruší rozběhnuté stahování hry', async () => {
    const test = languageMenu();
    test.menu.tapTile('zebra');
    test.menu.tapLanguageButton();
    test.download.succeed();
    await wait();
    expect(test.game.started).toEqual([]);
  });
});

describe('#70 AC3: výběr stejného jazyka nic nezmění', () => {
  it('ťuknutí na aktuální jazyk nabídku zavře a nic neohlásí jako změnu', () => {
    const changed = vi.fn();
    const languages = new TestLanguages();
    const test = testMenu({ languages, onLanguageChanged: changed });
    test.menu.tapLanguageButton();
    test.menu.tapLanguage('cs');
    expect(languages.current()).toBe('cs');
    expect(changed).not.toHaveBeenCalled();
    expect(test.menu.isLanguageMenuOpen()).toBe(false);
    expect(languageEvents(test.feedback)).toEqual([
      { kind: 'languageMenu', open: true },
      { kind: 'languageMenu', open: false },
    ]);
  });

  it('výběr jiného jazyka stránce ohlásí změnu právě jednou', () => {
    const changed = vi.fn();
    const test = testMenu({ languages: new TestLanguages(), onLanguageChanged: changed });
    test.menu.tapLanguageButton();
    test.menu.tapLanguage('xx');
    expect(changed).toHaveBeenCalledTimes(1);
  });
});

describe('#70 AC3: po výběru je menu v novém jazyce', () => {
  function translatedMenu(languages: TestLanguages): Menu {
    const texts = { cs: TEST_TEXTS_CS, xx: TEST_TEXTS_XX } as Record<
      string,
      Record<string, string>
    >;
    return createMenu({
      games: TEST_GAMES,
      categories: TEST_CATEGORIES,
      translate: (key) => translatorOf(texts[languages.current()] ?? TEST_TEXTS_CS)(key),
      start: () => undefined,
      feedback: () => undefined,
      languages,
    });
  }

  it('kategorie a názvy her jsou po výběru v novém jazyce, pořadí se nezmění', () => {
    const languages = new TestLanguages();
    const menu = translatedMenu(languages);
    menu.tapLanguageButton();
    menu.tapLanguage('xx');
    expect(menu.categories().map((category) => category.title)).toEqual([
      'Alle',
      'Arrows',
      'Zoo',
      'Moon',
    ]);
    expect(menu.tiles().map((tile) => tile.title)).toEqual(['Apple', 'Yak', 'Cat', 'Bird']);
  });

  it('název stránky v menu je po výběru v novém jazyce', () => {
    const languages = new TestLanguages();
    const texts = { cs: 'Matematika', xx: 'Maths' } as Record<string, string>;
    const menu = createMenu({
      games: TEST_GAMES,
      categories: TEST_CATEGORIES,
      translate: (key) => (key === 'page.title' ? (texts[languages.current()] ?? '') : key),
      start: () => undefined,
      feedback: () => undefined,
      languages,
    });
    menu.tapLanguageButton();
    menu.tapLanguage('xx');
    expect(menu.pageTitle()).toBe('Maths');
  });
});

describe('#70 mimo rozsah: jazyk se mění jen v menu, ne během hry', () => {
  it('během rozehrané hry tlačítko jazyka nabídku neotevře', async () => {
    const test = languageMenu();
    test.menu.tapTile('zebra');
    test.download.succeed();
    await wait();
    expect(test.menu.runningGame()?.id).toBe('zebra');
    test.menu.tapLanguageButton();
    expect(test.menu.isLanguageMenuOpen()).toBe(false);
  });

  it('během rozehrané hry ťuknutí na jazyk jazyk nezmění', async () => {
    const test = languageMenu();
    test.menu.tapLanguageButton();
    test.menu.closeLanguageMenu();
    test.menu.tapTile('zebra');
    test.download.succeed();
    await wait();
    test.menu.tapLanguage('xx');
    expect(test.languages.current()).toBe('cs');
  });

  it('po návratu z hry je nabídka zavřená', async () => {
    const test = languageMenu();
    test.menu.tapTile('zebra');
    test.download.succeed();
    await wait();
    test.menu.returnFromGame();
    expect(test.menu.isLanguageMenuOpen()).toBe(false);
  });
});

describe('#70 AC1: tlačítko a nabídka jdou dobře přečíst', () => {
  /** WCAG: běžný text 4,5 : 1. */
  const TEXT_CONTRAST = 4.5;

  it('zkratka jazyka je na bílém tlačítku čitelná', () => {
    expect(
      contrastRatio(MENU_STYLE.languageButtonText, MENU_STYLE.languageButtonBackground),
    ).toBeGreaterThanOrEqual(TEXT_CONTRAST);
  });

  it('název jazyka je v panelu čitelný', () => {
    expect(
      contrastRatio(MENU_STYLE.languageText, MENU_STYLE.languagePanelBackground),
    ).toBeGreaterThanOrEqual(TEXT_CONTRAST);
  });

  it('aktuální jazyk s ✓ je na svém řádku čitelný', () => {
    expect(
      contrastRatio(MENU_STYLE.selectedLanguageText, MENU_STYLE.selectedLanguageBackground),
    ).toBeGreaterThanOrEqual(TEXT_CONTRAST);
  });
});
