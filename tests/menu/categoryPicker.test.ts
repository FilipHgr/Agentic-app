import { afterEach, describe, expect, it, vi } from 'vitest';

import { ALL_CATEGORY } from '../../src/menu/logic/menuCategories';
import type { MenuFeedback } from '../../src/menu/logic/menu';
import { menuSoundFor } from '../../src/menu/logic/menuSounds';
import { menuText } from '../../src/menu/logic/menuTexts';
import { GAME_CATEGORIES } from '../../src/shared/logic/gameRegistry';
import type { GameCategory } from '../../src/shared/logic/gameRegistry';
import { LANGUAGES } from '../../src/shared/texts/languages';
import { MANY_CATEGORIES } from './manyGamesFixtures';
import { TEST_CATEGORIES, TEST_GAMES, TestLanguages, testMenu } from './menuFixtures';
import type { TestMenu } from './menuFixtures';

/**
 * Testy k #95 (rozbalovací výběr kategorií na telefonu na výšku), logika
 * menu bez rozložení a dotyků: zavřený a otevřený výběr, výběr kategorie
 * v seznamu, tóny, symboly kategorií a okrajové případy. Zkušební hry
 * a kategorie z `menuFixtures.ts` (jen v testech).
 *
 * Navržené rozhraní:
 * - `GameCategory.symbol` (`src/shared/logic/gameRegistry.ts`): symbol
 *   kategorie, není to text jazyka; „Vše“ má `ALL_CATEGORY.symbol` ▦,
 *   „Sčítání a odčítání“ „+ −“, „Kreslení“ ✎,
 * - `MenuCategoryView.symbol` v `menu.categories()`,
 * - `menu.categoryButton()`: `{ symbol, title, arrow }` vybrané kategorie,
 *   šipka ▾ u zavřeného a ▴ u otevřeného seznamu,
 * - `menu.isCategoryMenuOpen()`, `menu.tapCategoryButton()` (otevře,
 *   otevřený zavře), `menu.closeCategoryMenu()` (ťuknutí nebo tah mimo
 *   seznam), `menu.tapCategory(id)` s otevřeným seznamem kategorii vybere
 *   a seznam zavře,
 * - odezva `{ kind: 'categoryMenu', open }` a zhoupnutí bez houpání
 *   `{ kind: 'wobble', target: { kind: 'categoryMenu' } }` (jen tón),
 * - `menuSoundFor(event)` (`src/menu/logic/menuSounds.ts`): tón, který
 *   scéna k odezvě zahraje (`'select'`, `'wobble'`, …), nebo `undefined`.
 *   Testy počítají tóny přes ni, ne podle tvaru odezvy.
 */

afterEach(() => {
  vi.unstubAllGlobals();
});

const ALL = ALL_CATEGORY.id;
const CLOSED_ARROW = '▾';
const OPEN_ARROW = '▴';

function selectedIds(test: TestMenu): string[] {
  return test.menu
    .categories()
    .filter((category) => category.selected)
    .map((category) => category.id);
}

function openList(test: TestMenu): void {
  test.menu.tapCategoryButton();
  expect(test.menu.isCategoryMenuOpen()).toBe(true);
}

/** Tóny od chvíle `from` (počet odezev před akcí). */
function soundsSince(test: TestMenu, from: number): string[] {
  return test.feedback.slice(from).flatMap((event) => {
    const sound = menuSoundFor(event);
    return sound === undefined ? [] : [sound];
  });
}

async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('#95 AC1: zavřený výběr ukáže vybranou kategorii', () => {
  it('na začátku je vybraná „Vše“ se symbolem ▦ a šipkou ▾ a seznam je zavřený', () => {
    const test = testMenu();
    expect(test.menu.isCategoryMenuOpen()).toBe(false);
    expect(test.menu.categoryButton()).toEqual({ symbol: '▦', title: 'Vše', arrow: CLOSED_ARROW });
  });

  it('tlačítko ukazuje symbol a název kategorie z textů jazyka', () => {
    const test = testMenu();
    openList(test);
    test.menu.tapCategory('logic');
    expect(test.menu.categoryButton()).toEqual({
      symbol: '<>',
      title: 'Logika',
      arrow: CLOSED_ARROW,
    });
  });
});

describe('#95 AC2: otevření a zavření tlačítkem', () => {
  it('ťuknutí na zavřené tlačítko seznam otevře a šipka se hned změní na ▴', () => {
    const test = testMenu();
    test.menu.tapCategoryButton();
    // Seznam i šipka se změní ve stejném kroku, bez čekání na další snímek.
    expect(test.menu.isCategoryMenuOpen()).toBe(true);
    expect(test.menu.categoryButton().arrow).toBe(OPEN_ARROW);
  });

  it('při otevření zazní „select“, stejný tón jako při otevření nabídky jazyků (#70)', () => {
    const categories = testMenu();
    categories.menu.tapCategoryButton();
    const languages = testMenu({ languages: new TestLanguages() });
    languages.menu.tapLanguageButton();
    expect(categories.sounds()).toEqual(['select']);
    expect(languages.sounds()).toEqual(['select']);
  });

  it('seznam má všechny viditelné kategorie v pořadí menu (#67 AC3), každou se symbolem a názvem', () => {
    const test = testMenu();
    openList(test);
    expect(test.menu.categories().map(({ id, symbol, title }) => ({ id, symbol, title }))).toEqual([
      { id: ALL, symbol: '▦', title: 'Vše' },
      { id: 'shapes', symbol: '△', title: 'Tvary' },
      { id: 'adding', symbol: '+', title: 'Sčítání' },
      { id: 'logic', symbol: '<>', title: 'Logika' },
    ]);
  });

  it('✓ má v seznamu jen vybraná kategorie', () => {
    const test = testMenu();
    openList(test);
    expect(selectedIds(test)).toEqual([ALL]);
    test.menu.tapCategory('adding');
    openList(test);
    expect(selectedIds(test)).toEqual(['adding']);
  });

  it('ťuknutí na tlačítko s otevřeným seznamem ho zavře, kategorie zůstane a zazní „select“', () => {
    const test = testMenu();
    openList(test);
    const before = test.feedback.length;
    test.menu.tapCategoryButton();
    expect(test.menu.isCategoryMenuOpen()).toBe(false);
    expect(test.menu.categoryButton().arrow).toBe(CLOSED_ARROW);
    expect(selectedIds(test)).toEqual([ALL]);
    expect(soundsSince(test, before)).toEqual(['select']);
  });

  it('dvojí ťuknutí na tlačítko seznam otevře a zavře, nic se nespustí a „select“ zazní dvakrát', () => {
    const test = testMenu();
    test.menu.tapCategoryButton();
    test.menu.tapCategoryButton();
    expect(test.menu.isCategoryMenuOpen()).toBe(false);
    expect(selectedIds(test)).toEqual([ALL]);
    expect(test.download.count).toBe(0);
    expect(test.sounds()).toEqual(['select', 'select']);
  });
});

describe('#95 AC3: výběr a zavření v seznamu', () => {
  it('ťuknutí na jinou kategorii ji vybere, seznam zavře a zazní jednou „select“', () => {
    const test = testMenu();
    openList(test);
    const before = test.feedback.length;
    test.menu.tapCategory('adding');
    expect(selectedIds(test)).toEqual(['adding']);
    expect(test.menu.isCategoryMenuOpen()).toBe(false);
    expect(soundsSince(test, before)).toEqual(['select']);
  });

  it('po výběru ukazuje mřížka jen hry vybrané kategorie v pořadí registru a tlačítko její symbol a název', () => {
    const test = testMenu();
    openList(test);
    test.menu.tapCategory('adding');
    expect(test.menu.tiles().map((tile) => tile.gameId)).toEqual(['zebra', 'kotva']);
    expect(test.menu.categoryButton()).toEqual({
      symbol: '+',
      title: 'Sčítání',
      arrow: CLOSED_ARROW,
    });
  });

  it('ťuknutí na už vybranou kategorii seznam zavře, nic nezmění a zazní jen „wobble“', () => {
    const test = testMenu();
    openList(test);
    const before = test.feedback.length;
    const tiles = test.menu.tiles();
    test.menu.tapCategory(ALL);
    expect(test.menu.isCategoryMenuOpen()).toBe(false);
    expect(selectedIds(test)).toEqual([ALL]);
    expect(test.menu.tiles()).toEqual(tiles);
    expect(soundsSince(test, before)).toEqual(['wobble']);
  });

  it('v seznamu se po ťuknutí na už vybranou kategorii nic nehoupe', () => {
    const test = testMenu();
    openList(test);
    test.menu.tapCategory(ALL);
    const swinging = test.feedback.filter(
      (event: MenuFeedback) =>
        event.kind === 'wobble' &&
        (event.target.kind === 'category' || event.target.kind === 'placeholder'),
    );
    expect(swinging).toEqual([]);
  });

  it('ťuknutí mimo seznam ho jen zavře beze změny kategorie a zazní „select“', () => {
    const test = testMenu();
    openList(test);
    const before = test.feedback.length;
    test.menu.closeCategoryMenu();
    expect(test.menu.isCategoryMenuOpen()).toBe(false);
    expect(selectedIds(test)).toEqual([ALL]);
    expect(soundsSince(test, before)).toEqual(['select']);
  });

  it('zavření už zavřeného seznamu nic neudělá a nic nezazní', () => {
    const test = testMenu();
    test.menu.closeCategoryMenu();
    expect(test.menu.isCategoryMenuOpen()).toBe(false);
    expect(test.sounds()).toEqual([]);
  });

  const outside: ReadonlyArray<[string, (test: TestMenu) => void]> = [
    ['dlaždici', (test) => test.menu.tapTile('zebra')],
    ['profil', (test) => test.menu.tapProfile()],
    ['tlačítko jazyka', (test) => test.menu.tapLanguageButton()],
    ['zástupné tlačítko „…“', (test) => test.menu.tapPlaceholder(0)],
  ];

  for (const [name, tap] of outside) {
    it(`ťuknutí na ${name} s otevřeným seznamem ho jen zavře, nic se nespustí ani neotevře a zazní „select“`, async () => {
      const test = testMenu({ languages: new TestLanguages() });
      openList(test);
      const before = test.feedback.length;
      tap(test);
      await settle();
      expect(test.menu.isCategoryMenuOpen()).toBe(false);
      expect(selectedIds(test)).toEqual([ALL]);
      expect(test.download.count).toBe(0);
      expect(test.game.started).toEqual([]);
      expect(test.profileOpened()).toBe(0);
      expect(test.menu.isLanguageMenuOpen()).toBe(false);
      expect(test.kinds().slice(before)).not.toContain('press');
      expect(test.kinds().slice(before)).not.toContain('profilePress');
      expect(soundsSince(test, before)).toEqual(['select']);
    });
  }
});

describe('#95 AC5: symboly kategorií', () => {
  /** Problémy se symboly: chybějící a stejné. Prázdný seznam = v pořádku. */
  function symbolProblems(categories: readonly GameCategory[]): string[] {
    const problems: string[] = [];
    const seen = new Map<string, string>();
    for (const category of categories) {
      const symbol = (category.symbol ?? '').trim();
      if (symbol === '') {
        problems.push(`${category.id} nemá symbol`);
        continue;
      }
      const other = seen.get(symbol);
      if (other !== undefined) {
        problems.push(`${category.id} má stejný symbol „${symbol}“ jako ${other}`);
      }
      seen.set(symbol, category.id);
    }
    return problems;
  }

  const ALL_MENU_CATEGORIES: readonly GameCategory[] = [ALL_CATEGORY, ...GAME_CATEGORIES];

  it('každá kategorie má svůj symbol, i „Vše“, a symboly se navzájem liší', () => {
    expect(symbolProblems(ALL_MENU_CATEGORIES)).toEqual([]);
  });

  it('kontrola symbolů selže, když přibude kategorie bez symbolu nebo se stejným symbolem', () => {
    const withoutSymbol = { id: 'new', titleKey: 'categories.new.title' } as GameCategory;
    const sameSymbol: GameCategory = {
      id: 'copy',
      titleKey: 'categories.copy.title',
      symbol: ALL_CATEGORY.symbol,
    };
    expect(symbolProblems([...ALL_MENU_CATEGORIES, withoutSymbol])).toEqual(['new nemá symbol']);
    expect(symbolProblems([...ALL_MENU_CATEGORIES, sameSymbol])).toHaveLength(1);
  });

  it('dnešní kategorie mají schválené symboly: „Vše“ ▦, „Sčítání a odčítání“ + −, „Kreslení“ ✎', () => {
    expect(
      Object.fromEntries(ALL_MENU_CATEGORIES.map((category) => [category.id, category.symbol])),
    ).toEqual({ all: '▦', addingSubtracting: '+ −', drawing: '✎' });
  });

  it('zkušební kategorie v testech mají také různé symboly', () => {
    expect(symbolProblems([ALL_CATEGORY, ...MANY_CATEGORIES])).toEqual([]);
    expect(symbolProblems([ALL_CATEGORY, ...TEST_CATEGORIES])).toEqual([]);
  });

  it('symboly nejsou texty jazyka: nejsou v textech menu a nemění se s jazykem', () => {
    for (const language of LANGUAGES) {
      for (const category of ALL_MENU_CATEGORIES) {
        expect(menuText(`categories.${category.id}.symbol`, language), language).toBeUndefined();
        expect(menuText(category.titleKey, language), language).not.toBe(category.symbol);
      }
    }
    const czech = testMenu();
    const other = testMenu({ translate: (key) => `xx ${key}` });
    expect(other.menu.categories().map((category) => category.symbol)).toEqual(
      czech.menu.categories().map((category) => category.symbol),
    );
  });

  it('symboly nemají barevnou emoji podobu (žádný emoji znak ani výběr emoji varianty)', () => {
    // Ruční kontrola na iPhonu a Samsungu zůstává (AC5), tohle hlídá jen znaky.
    for (const category of ALL_MENU_CATEGORIES) {
      const emoji = [...category.symbol].filter(
        (character) => character === '\uFE0F' || (/\p{Emoji}/u.test(character) && character > '~'),
      );
      expect(emoji, category.id).toEqual([]);
    }
  });
});

describe('#95 AC6: okrajové případy', () => {
  it('s „Vše“ a jednou kategorií má seznam dvě řádky a výběr funguje stejně', () => {
    const games = TEST_GAMES.filter((game) => game.categoryId === 'adding');
    const test = testMenu({ games });
    openList(test);
    expect(test.menu.categories().map((category) => category.id)).toEqual([ALL, 'adding']);
    test.menu.tapCategory('adding');
    expect(test.menu.isCategoryMenuOpen()).toBe(false);
    expect(test.menu.categoryButton().title).toBe('Sčítání');
    expect(test.sounds()).toEqual(['select', 'select']);
  });

  it('ťuknutí na tlačítko výběru s otevřenou nabídkou jazyků jen zavře nabídku, seznam se neotevře', () => {
    const test = testMenu({ languages: new TestLanguages() });
    test.menu.tapLanguageButton();
    test.menu.tapCategoryButton();
    expect(test.menu.isLanguageMenuOpen()).toBe(false);
    expect(test.menu.isCategoryMenuOpen()).toBe(false);
  });

  it('ťuknutí na tlačítko jazyka s otevřeným seznamem jen zavře seznam, nabídka se neotevře', () => {
    const test = testMenu({ languages: new TestLanguages() });
    test.menu.tapCategoryButton();
    test.menu.tapLanguageButton();
    expect(test.menu.isCategoryMenuOpen()).toBe(false);
    expect(test.menu.isLanguageMenuOpen()).toBe(false);
  });

  it('seznam kategorií a nabídka jazyků nikdy nejsou otevřené současně (všechny řady tří ťuknutí)', () => {
    const actions: ReadonlyArray<[string, (test: TestMenu) => void]> = [
      ['tlačítko výběru', (test) => test.menu.tapCategoryButton()],
      ['tlačítko jazyka', (test) => test.menu.tapLanguageButton()],
      ['kategorie', (test) => test.menu.tapCategory('adding')],
      ['jazyk', (test) => test.menu.tapLanguage('xx')],
      ['mimo seznam', (test) => test.menu.closeCategoryMenu()],
      ['mimo nabídku', (test) => test.menu.closeLanguageMenu()],
    ];
    for (const first of actions) {
      for (const second of actions) {
        for (const third of actions) {
          const test = testMenu({ languages: new TestLanguages() });
          const path = [first, second, third].map(([name]) => name).join(' → ');
          for (const [, act] of [first, second, third]) {
            act(test);
            expect(test.menu.isCategoryMenuOpen() && test.menu.isLanguageMenuOpen(), path).toBe(
              false,
            );
          }
        }
      }
    }
  });

  it('po návratu ze hry je seznam zavřený a tlačítko ukazuje kategorii z doby před spuštěním', async () => {
    const test = testMenu();
    openList(test);
    test.menu.tapCategory('adding');
    test.menu.tapTile('zebra');
    test.download.succeed();
    await settle();
    expect(test.menu.runningGame()?.id).toBe('zebra');
    test.menu.returnFromGame();
    expect(test.menu.isCategoryMenuOpen()).toBe(false);
    expect(test.menu.categoryButton()).toEqual({
      symbol: '+',
      title: 'Sčítání',
      arrow: CLOSED_ARROW,
    });
  });

  it('během hry tlačítko výběru seznam neotevře', async () => {
    const test = testMenu();
    test.menu.tapTile('zebra');
    test.download.succeed();
    await settle();
    test.menu.tapCategoryButton();
    expect(test.menu.isCategoryMenuOpen()).toBe(false);
  });

  it('po obnovení stránky je vybraná „Vše“ a seznam je zavřený', () => {
    const before = testMenu();
    openList(before);
    before.menu.tapCategory('logic');
    openList(before);
    const reloaded = testMenu();
    expect(reloaded.menu.isCategoryMenuOpen()).toBe(false);
    expect(reloaded.menu.categoryButton()).toEqual({
      symbol: '▦',
      title: 'Vše',
      arrow: CLOSED_ARROW,
    });
  });
});
