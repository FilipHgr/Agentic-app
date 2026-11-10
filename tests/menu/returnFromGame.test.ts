import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createMenu } from '../../src/menu/logic/menu';
import type { Menu, MenuFeedback } from '../../src/menu/logic/menu';
import type { GameEntry } from '../../src/shared/logic/gameRegistry';
import indexHtml from '../../index.html?raw';
import { TEST_CATEGORIES, TEST_GAMES, TEST_TEXTS_CS, translatorOf } from './menuFixtures';

/**
 * Testy k #68 (domeček ve hře, podržením 1 s zpět do menu), část menu:
 * - AC1: v menu domeček není (tlačítko stránky je skryté, logika menu ho
 *   nepovolí),
 * - AC2: po odchodu z hry je dítě v menu na stejné vybrané kategorii
 *   a stránka se zase jmenuje „Matematika“,
 * - AC5: po 20 vstupech a odchodech se hra spouští pořád jedním ťuknutím.
 *
 * Navržené rozhraní (`src/menu/logic/menu.ts`):
 * - `menu.returnFromGame()`: hra skončila, menu se znovu ukáže. Bez běžící
 *   hry nic neudělá.
 * - `menu.canGoHome()`: domeček je vidět jen ve hře (jako `canOpenSettings`).
 * - volitelné `onReturned()` v `MenuOptions`: stránka podle něj nastaví
 *   název, skryje kolečko i domeček a znovu nakreslí menu.
 * Domeček na stránce je tlačítko `#home-button` v `index.html`.
 */

interface TestMenu {
  readonly menu: Menu;
  readonly feedback: MenuFeedback[];
  readonly starts: string[];
  readonly started: string[];
  readonly returned: Array<{ title: string; canGoHome: boolean; canOpenSettings: boolean }>;
}

function testMenu(): TestMenu {
  const feedback: MenuFeedback[] = [];
  const starts: string[] = [];
  const started: string[] = [];
  const returned: TestMenu['returned'] = [];
  const games: GameEntry[] = TEST_GAMES.map((game) => ({
    ...game,
    load: () => Promise.resolve({ kind: 'staženáHra' }),
  }));
  const menu: Menu = createMenu({
    games,
    categories: TEST_CATEGORIES,
    translate: translatorOf({ ...TEST_TEXTS_CS, 'page.title': 'Matematika' }),
    start: (game) => {
      starts.push(game.id);
    },
    feedback: (event) => feedback.push(event),
    onStarted: (game) => started.push(game.id),
    onReturned: () =>
      returned.push({
        title: menu.pageTitle(),
        canGoHome: menu.canGoHome(),
        canOpenSettings: menu.canOpenSettings(),
      }),
  });
  return { menu, feedback, starts, started, returned };
}

/** Ťukne na dlaždici a nechá stažení a spuštění doběhnout. */
async function playGame(test: TestMenu, gameId = 'zebra'): Promise<void> {
  test.menu.tapTile(gameId);
  await vi.advanceTimersByTimeAsync(0);
}

function selectedCategory(menu: Menu): string | undefined {
  return menu.categories().find((category) => category.selected)?.id;
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('AC1: v menu domeček není', () => {
  it('tlačítko domečku má v index.html atribut hidden', () => {
    const button = /<button[^>]*id="home-button"[^>]*>/.exec(indexHtml)?.[0];
    expect(button).toBeDefined();
    expect(button).toMatch(/\shidden[\s>]/);
  });

  it('v menu domeček nejde použít, po naběhnutí hry ano', async () => {
    const test = testMenu();
    expect(test.menu.canGoHome()).toBe(false);

    await playGame(test);

    expect(test.menu.canGoHome()).toBe(true);
  });

  it('během stahování hry domeček ještě není', () => {
    const test = testMenu();
    test.menu.tapTile('zebra');

    expect(test.menu.canGoHome()).toBe(false);
  });
});

describe('AC2: po odchodu z hry je dítě zpátky v menu', () => {
  it('po odchodu menu žádnou hru nehraje a stránka se jmenuje „Matematika“', async () => {
    const test = testMenu();
    await playGame(test);
    expect(test.menu.pageTitle()).toBe('Zebra');

    test.menu.returnFromGame();

    expect(test.menu.runningGame()).toBeNull();
    expect(test.menu.pageTitle()).toBe('Matematika');
  });

  it('po odchodu je domeček i kolečko nastavení zase skryté', async () => {
    const test = testMenu();
    await playGame(test);

    test.menu.returnFromGame();

    expect(test.menu.canGoHome()).toBe(false);
    expect(test.menu.canOpenSettings()).toBe(false);
  });

  it('menu odchod stránce ohlásí jednou, už s názvem „Matematika“ a bez domečku', async () => {
    const test = testMenu();
    await playGame(test);

    test.menu.returnFromGame();

    expect(test.returned).toEqual([
      { title: 'Matematika', canGoHome: false, canOpenSettings: false },
    ]);
  });

  it('dítě je na stejné vybrané kategorii, ve které hru spustilo', async () => {
    const test = testMenu();
    test.menu.tapCategory('adding');
    const tilesBefore = test.menu.tiles();
    await playGame(test, 'kotva');

    test.menu.returnFromGame();

    expect(selectedCategory(test.menu)).toBe('adding');
    expect(test.menu.tiles()).toEqual(tilesBefore);
  });

  it('po odchodu jde ťuknout na kategorii i na jinou hru', async () => {
    const test = testMenu();
    await playGame(test);
    test.menu.returnFromGame();
    test.feedback.length = 0;

    test.menu.tapCategory('logic');
    await playGame(test, 'auto');

    expect(test.feedback.map((event) => event.kind)).toEqual(['select', 'press']);
    expect(test.menu.runningGame()?.id).toBe('auto');
    expect(test.menu.pageTitle()).toBe('Auto');
  });

  it('odchod v menu bez běžící hry nic nezmění a nic neohlásí', () => {
    const test = testMenu();
    test.menu.tapCategory('adding');

    test.menu.returnFromGame();

    expect(selectedCategory(test.menu)).toBe('adding');
    expect(test.returned).toEqual([]);
    expect(test.menu.pageTitle()).toBe('Matematika');
  });

  it('dvojí odchod za sebou se ohlásí jen jednou', async () => {
    const test = testMenu();
    await playGame(test);

    test.menu.returnFromGame();
    test.menu.returnFromGame();

    expect(test.returned).toHaveLength(1);
  });
});

describe('AC5: po 20 vstupech a odchodech se hra spouští jako poprvé', () => {
  it('každé ťuknutí na dlaždici spustí hru právě jednou a každý odchod se ohlásí jednou', async () => {
    const test = testMenu();

    for (let entry = 1; entry <= 20; entry += 1) {
      await playGame(test);
      expect(test.starts, `vstup ${entry}`).toHaveLength(entry);
      expect(test.started, `vstup ${entry}`).toHaveLength(entry);
      test.menu.returnFromGame();
      expect(test.returned, `odchod ${entry}`).toHaveLength(entry);
    }

    await playGame(test);
    expect(test.starts).toHaveLength(21);
    expect(test.menu.pageTitle()).toBe('Zebra');
    expect(test.menu.canGoHome()).toBe(true);
  });

  it('po 20 vstupech a odchodech nezůstane v menu žádný časovač', async () => {
    const test = testMenu();
    for (let entry = 0; entry < 20; entry += 1) {
      await playGame(test);
      test.menu.returnFromGame();
    }

    expect(vi.getTimerCount()).toBe(0);
  });
});
