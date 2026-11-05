import { afterEach, describe, expect, it, vi } from 'vitest';

import { ALL_CATEGORY } from '../../src/menu/logic/menuCategories';
import {
  TEST_CATEGORIES,
  TEST_GAMES,
  TEST_TEXTS_CS,
  TEST_TEXTS_XX,
  testMenu,
  translatorOf,
  watchedLocalStorage,
} from './menuFixtures';
import type { TestMenu } from './menuFixtures';

/**
 * Testy k #67 AC3 (kategorie a pořadí) a k chování zástupných tlačítek
 * z AC1. Menu (`createMenu`) dostane seznam her, seznam kategorií,
 * překlad klíčů a funkci, která hru spustí; odezvu (zhoupnutí, tichý zvuk)
 * hlásí jako `feedback`. Testy běží na zkušebním seznamu her a kategorií
 * z `menuFixtures.ts`, jehož abecední pořadí názvů je jiné než pořadí
 * v seznamech.
 */

const ALL = ALL_CATEGORY.id;

function categoryIds(test: TestMenu): string[] {
  return test.menu.categories().map((category) => category.id);
}

function tileIds(test: TestMenu): string[] {
  return test.menu.tiles().map((tile) => tile.gameId);
}

function selected(test: TestMenu): string[] {
  return test.menu
    .categories()
    .filter((category) => category.selected)
    .map((category) => category.id);
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('#67 AC3: menu ukáže „Vše“ a jen kategorie, ve kterých je hra', () => {
  it('první kategorie je „Vše“', () => {
    expect(categoryIds(testMenu())[0]).toBe(ALL);
    expect(testMenu().menu.categories()[0]?.title).toBe('Vše');
  });

  it('kategorie bez her se neukáže', () => {
    expect(categoryIds(testMenu())).not.toContain('empty');
  });

  it('kategorie jsou v pořadí seznamu kategorií, ne podle abecedy názvů', () => {
    expect(categoryIds(testMenu())).toEqual([ALL, 'shapes', 'adding', 'logic']);
  });

  it('názvy kategorií jsou z textů jazyka', () => {
    expect(
      testMenu()
        .menu.categories()
        .map((category) => category.title),
    ).toEqual(['Vše', 'Tvary', 'Sčítání', 'Logika']);
  });

  it('bez her se ukáže jen „Vše“ a prázdná mřížka, nic nespadne', () => {
    const test = testMenu({ games: [] });
    expect(categoryIds(test)).toEqual([ALL]);
    expect(tileIds(test)).toEqual([]);
  });

  it('hra s kategorií mimo seznam kategorií menu neshodí a kategorie navíc se neukáže', () => {
    const stray = {
      id: 'ztracena',
      titleKey: 'games.ztracena.title',
      categoryId: 'neznama',
      symbol: '?',
      load: () => Promise.resolve({}),
    };
    const test = testMenu({ games: [...TEST_GAMES, stray] });
    expect(categoryIds(test)).toEqual([ALL, 'shapes', 'adding', 'logic']);
  });
});

describe('#67 AC3: hry v mřížce v pořadí registru', () => {
  it('při otevření menu je vybraná „Vše“', () => {
    expect(selected(testMenu())).toEqual([ALL]);
  });

  it('„Vše“ ukáže všechny hry v pořadí registru, ne podle abecedy názvů', () => {
    expect(tileIds(testMenu())).toEqual(['zebra', 'auto', 'mic', 'kotva']);
  });

  it('dlaždice má symbol hry a název z textů jazyka', () => {
    expect(testMenu().menu.tiles()[0]).toEqual(
      expect.objectContaining({ gameId: 'zebra', symbol: '1+1', title: 'Zebra' }),
    );
  });

  it('ťuknutím na kategorii se vybere a zvýrazní jen ona', () => {
    const test = testMenu();
    test.menu.tapCategory('adding');
    expect(selected(test)).toEqual(['adding']);
  });

  it('vybraná kategorie ukáže jen své hry, dál v pořadí registru', () => {
    const test = testMenu();
    test.menu.tapCategory('adding');
    expect(tileIds(test)).toEqual(['zebra', 'kotva']);
  });

  it('kategorie s jedinou hrou ukáže právě ji', () => {
    const test = testMenu();
    test.menu.tapCategory('shapes');
    expect(tileIds(test)).toEqual(['mic']);
  });

  it('návrat na „Vše“ ukáže zase všechny hry v pořadí registru', () => {
    const test = testMenu();
    test.menu.tapCategory('logic');
    test.menu.tapCategory(ALL);
    expect(selected(test)).toEqual([ALL]);
    expect(tileIds(test)).toEqual(['zebra', 'auto', 'mic', 'kotva']);
  });

  it('ťuknutí na neznámou kategorii nic nezmění a nespadne', () => {
    const test = testMenu();
    expect(() => test.menu.tapCategory('empty')).not.toThrow();
    expect(() => test.menu.tapCategory('')).not.toThrow();
    expect(selected(test)).toEqual([ALL]);
    expect(tileIds(test)).toEqual(['zebra', 'auto', 'mic', 'kotva']);
  });
});

describe('#67 AC3: pořadí nezávisí na jazyce', () => {
  it('s umělým druhým jazykem je pořadí kategorií stejné', () => {
    const czech = testMenu();
    const other = testMenu({ translate: translatorOf(TEST_TEXTS_XX) });
    expect(categoryIds(other)).toEqual(categoryIds(czech));
  });

  it('s umělým druhým jazykem je pořadí her ve „Vše“ i ve vybrané kategorii stejné', () => {
    const czech = testMenu();
    const other = testMenu({ translate: translatorOf(TEST_TEXTS_XX) });
    expect(tileIds(other)).toEqual(tileIds(czech));
    czech.menu.tapCategory('adding');
    other.menu.tapCategory('adding');
    expect(tileIds(other)).toEqual(tileIds(czech));
  });

  it('s umělým druhým jazykem jsou názvy z druhého jazyka', () => {
    const other = testMenu({ translate: translatorOf(TEST_TEXTS_XX) });
    expect(other.menu.categories().map((category) => category.title)).toEqual([
      'Alle',
      'Arrows',
      'Zoo',
      'Moon',
    ]);
    expect(other.menu.tiles().map((tile) => tile.title)).toEqual(['Apple', 'Yak', 'Cat', 'Bird']);
  });

  it('zkušební seznam má opravdu jiné abecední pořadí než pořadí v seznamech', () => {
    const titles = TEST_CATEGORIES.map((category) => TEST_TEXTS_CS[category.titleKey] ?? '');
    expect([...titles].sort((a, b) => a.localeCompare(b, 'cs'))).not.toEqual(titles);
    const games = TEST_GAMES.map((game) => TEST_TEXTS_CS[game.titleKey] ?? '');
    expect([...games].sort((a, b) => a.localeCompare(b, 'cs'))).not.toEqual(games);
  });
});

describe('#67 AC3: druhé ťuknutí na vybranou kategorii', () => {
  it('nezmění výběr ani mřížku', () => {
    const test = testMenu();
    test.menu.tapCategory('adding');
    const before = { categories: test.menu.categories(), tiles: test.menu.tiles() };
    test.menu.tapCategory('adding');
    expect(test.menu.categories()).toEqual(before.categories);
    expect(test.menu.tiles()).toEqual(before.tiles);
  });

  it('ťuknutí na už vybranou „Vše“ po otevření menu nic nezmění', () => {
    const test = testMenu();
    const tiles = test.menu.tiles();
    test.menu.tapCategory(ALL);
    expect(selected(test)).toEqual([ALL]);
    expect(test.menu.tiles()).toEqual(tiles);
  });

  it('dá stejnou odezvu jako zástupné tlačítko: zhoupnutí a tichý zvuk', () => {
    const category = testMenu();
    category.menu.tapCategory(ALL);
    const placeholder = testMenu();
    placeholder.menu.tapPlaceholder(0);
    expect(category.kinds()).toEqual(['wobble']);
    expect(placeholder.kinds()).toEqual(['wobble']);
  });

  it('ťuknutí na novou kategorii se nehoupe jako zástupné tlačítko', () => {
    const test = testMenu();
    test.menu.tapCategory('logic');
    expect(test.kinds()).not.toContain('wobble');
  });
});

describe('#67 AC1: zástupná tlačítka „…“ jen odpovídají', () => {
  it('ťuknutí dá okamžitou odezvu (zhoupnutí a tichý zvuk)', () => {
    const test = testMenu();
    test.menu.tapPlaceholder(0);
    expect(test.kinds()).toEqual(['wobble']);
  });

  it('ťuknutí na druhé zástupné tlačítko také jen zhoupne', () => {
    const test = testMenu();
    test.menu.tapPlaceholder(1);
    expect(test.kinds()).toEqual(['wobble']);
  });

  it('ťuknutí nic neotevře: menu zůstane, kde bylo, výběr i mřížka beze změny', () => {
    const test = testMenu();
    test.menu.tapCategory('adding');
    const before = { categories: test.menu.categories(), tiles: test.menu.tiles() };
    test.menu.tapPlaceholder(0);
    expect(test.menu.categories()).toEqual(before.categories);
    expect(test.menu.tiles()).toEqual(before.tiles);
    expect(test.menu.runningGame()).toBeNull();
    expect(test.download.count).toBe(0);
    expect(test.game.started).toEqual([]);
  });

  it('ťuknutí nic neuloží', () => {
    const storage = watchedLocalStorage();
    const test = testMenu();
    test.menu.tapPlaceholder(0);
    test.menu.tapPlaceholder(1);
    expect(storage.writes).toEqual([]);
  });

  it('rychlé dvojí ťuknutí nic neshodí, každé dá svou odezvu', () => {
    const test = testMenu();
    expect(() => {
      test.menu.tapPlaceholder(0);
      test.menu.tapPlaceholder(0);
    }).not.toThrow();
    expect(test.kinds()).toEqual(['wobble', 'wobble']);
    expect(test.menu.runningGame()).toBeNull();
  });
});
