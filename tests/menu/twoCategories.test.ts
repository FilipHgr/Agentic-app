import { afterEach, describe, expect, it, vi } from 'vitest';

import { GAMES } from '../../src/gameList';
import { createMenu } from '../../src/menu/logic/menu';
import type { Menu, MenuFeedback } from '../../src/menu/logic/menu';
import { ALL_CATEGORY } from '../../src/menu/logic/menuCategories';
import { menuText } from '../../src/menu/logic/menuTexts';
import { GAME_CATEGORIES, findGame } from '../../src/shared/logic/gameRegistry';
import type { Language } from '../../src/shared/texts/languages';
import { TestLanguages, watchedLocalStorage } from './menuFixtures';

/**
 * Testy k #199: v menu jsou jen dvě kategorie, Matematika (Počítání
 * a Znaménka) a Tvoření (Omalovánky), před nimi „Vše“. Staré kategorie
 * (Sčítání a odčítání, Kreslení, Čísla) zmizely i s texty a symboly.
 *
 * Výběr kategorie se dnes neukládá (menu si ho drží jen v paměti stránky
 * a po načtení začíná na „Vše“), takže stará hodnota nikde nezůstane.
 * Testy proto hlídají, že menu vždy začne na „Vše“ i s uloženými starými
 * daty v zařízení a že ťuknutí na starou kategorii nic nezmění.
 */

/** Id starých kategorií před #199. */
const OLD_CATEGORY_IDS = ['addingSubtracting', 'drawing', 'numbers'];

function czechMenu(feedback: MenuFeedback[] = []): Menu {
  return createMenu({
    games: GAMES,
    categories: GAME_CATEGORIES,
    translate: (key) => menuText(key, 'cs') ?? key,
    start: () => undefined,
    feedback: (event) => feedback.push(event),
    languages: new TestLanguages(),
  });
}

function categoryOf(gameId: string): string | undefined {
  return findGame(GAMES, gameId)?.categoryId;
}

function selectedIds(menu: Menu): string[] {
  return menu
    .categories()
    .filter((category) => category.selected)
    .map((category) => category.id);
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('#199 AC1: v menu jsou jen Matematika a Tvoření', () => {
  it('seznam kategorií má jen Matematiku (math) a Tvoření (create) v tomto pořadí', () => {
    expect(GAME_CATEGORIES.map((category) => category.id)).toEqual(['math', 'create']);
  });

  it('dítě v menu vidí „Vše“, „Matematika“ a „Tvoření“', () => {
    expect(
      czechMenu()
        .categories()
        .map((category) => category.title),
    ).toEqual(['Vše', 'Matematika', 'Tvoření']);
  });

  it('česky se kategorie jmenují „Matematika“ a „Tvoření“, anglicky „Math“ a „Create“', () => {
    const titles = (language: Language): Array<string | undefined> =>
      GAME_CATEGORIES.map((category) => menuText(category.titleKey, language));
    expect(titles('cs')).toEqual(['Matematika', 'Tvoření']);
    expect(titles('en')).toEqual(['Math', 'Create']);
  });

  it('Matematika má symbol „+ −“ a Tvoření ✎, „Vše“ dál ▦', () => {
    expect(
      czechMenu()
        .categories()
        .map((category) => category.symbol),
    ).toEqual(['▦', '+ −', '✎']);
  });
});

describe('#199 AC2: hry jsou v nových kategoriích', () => {
  it('Počítání a Znaménka najde dítě v Matematice', () => {
    expect(categoryOf('counting')).toBe('math');
    expect(categoryOf('compare')).toBe('math');
  });

  it('Omalovánky najde dítě v Tvoření', () => {
    expect(categoryOf('coloring')).toBe('create');
  });

  it('po ťuknutí na Matematiku jsou v mřížce Počítání a Znaménka, po ťuknutí na Tvoření Omalovánky', () => {
    const menu = czechMenu();
    menu.tapCategory('math');
    expect(menu.tiles().map((tile) => tile.gameId)).toEqual(['counting', 'compare']);
    menu.tapCategory('create');
    expect(menu.tiles().map((tile) => tile.gameId)).toEqual(['coloring']);
  });

  it('staré kategorie v menu nejsou a nemají žádnou hru', () => {
    const shown = czechMenu()
      .categories()
      .map((category) => category.id);
    for (const old of OLD_CATEGORY_IDS) {
      expect(shown, old).not.toContain(old);
      expect(
        GAMES.some((game) => game.categoryId === old),
        old,
      ).toBe(false);
    }
  });

  it('staré názvy kategorií zmizely z textů menu v češtině i angličtině', () => {
    for (const old of OLD_CATEGORY_IDS) {
      const key = `categories.${old}.title`;
      expect(menuText(key, 'cs'), key).toBeUndefined();
      expect(menuText(key, 'en'), key).toBeUndefined();
    }
  });
});

describe('#199 AC3: starý výběr kategorie se změní na „Vše“', () => {
  it('výběr kategorie se do zařízení neukládá, takže stará hodnota nikde nezůstane', () => {
    const storage = watchedLocalStorage();
    const menu = czechMenu();
    menu.tapCategory('math');
    menu.tapCategory('create');
    expect(storage.writes).toEqual([]);
  });

  it('po novém načtení stránky začne menu na „Vše“, i když předtím byla vybraná jiná kategorie', () => {
    watchedLocalStorage();
    czechMenu().tapCategory('create');
    const reloaded = czechMenu();
    expect(selectedIds(reloaded)).toEqual([ALL_CATEGORY.id]);
    expect(reloaded.categoryButton().title).toBe('Vše');
    expect(reloaded.tiles()).toHaveLength(GAMES.length);
  });

  it('ťuknutí na starou kategorii bez chyby nic nezmění a výběr zůstane na „Vše“', () => {
    const feedback: MenuFeedback[] = [];
    const menu = czechMenu(feedback);
    for (const old of OLD_CATEGORY_IDS) {
      expect(() => menu.tapCategory(old), old).not.toThrow();
    }
    expect(selectedIds(menu)).toEqual([ALL_CATEGORY.id]);
    expect(menu.tiles()).toHaveLength(GAMES.length);
    expect(feedback.filter((event) => event.kind === 'select')).toEqual([]);
  });
});
