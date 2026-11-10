import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { GAMES } from '../../src/gameList';
import { GAME_CATEGORIES, findGame } from '../../src/shared/logic/gameRegistry';
import { LOADING_TIMEOUT_MS, SLOW_LOADING_MS, createMenu } from '../../src/menu/logic/menu';
import type { MenuFeedback } from '../../src/menu/logic/menu';
import { ALL_CATEGORY } from '../../src/menu/logic/menuCategories';
import { menuText } from '../../src/menu/logic/menuTexts';
import { sharedTexts } from '../../src/shared/texts/sharedTexts';
import type { GameEntry } from '../../src/shared/logic/gameRegistry';
import { testMenu, watchedLocalStorage } from './menuFixtures';
import type { TestMenu } from './menuFixtures';

/**
 * Testy k #67 AC5 (spuštění hry s odezvou, načítáním a výpadkem), AC2
 * (název stránky) a k části AC1 (stránka začíná v menu, kolečko v menu
 * není). Hra se stahuje falešným stahováním, spouští falešnou hrou a čas
 * běží na falešných hodinách Vitestu. Odezvu menu hlásí jako `feedback`:
 * - `press` dlaždice se zmáčkne a zazní zvuk,
 * - `pulse` / `stopPulse` dlaždice pulzuje při stahování delším než 300 ms,
 * - `shake` dlaždice se jemně zatřese a zazní tichý zvuk jako u špatné odpovědi,
 * - `wobble` zhoupnutí a tichý zvuk (zástupné tlačítko, vybraná kategorie).
 */

const COUNTING = findGame(GAMES, 'counting') as GameEntry;

/** Menu se skutečným Počítáním a skutečnými texty, stahování a hra jsou falešné. */
function countingMenu(): TestMenu {
  return testMenu({
    games: [COUNTING],
    categories: GAME_CATEGORIES,
    translate: (key) => menuText(key, 'cs') ?? key,
  });
}

/** Nechá doběhnout sliby (stažení, spuštění) a posune hodiny o `ms`. */
async function wait(ms = 0): Promise<void> {
  await vi.advanceTimersByTimeAsync(ms);
}

/** Ťukne na zkušební hru „zebra“ a nechá stahování dojít do konce. */
async function tapAndLoad(test: TestMenu, gameId = 'zebra'): Promise<void> {
  test.menu.tapTile(gameId);
  test.download.succeed();
  await wait();
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('#67 AC1: stránka začíná v menu', () => {
  it('po otevření je vidět menu, žádná hra neběží ani se nestahuje', () => {
    const test = testMenu();
    expect(test.menu.runningGame()).toBeNull();
    expect(test.download.count).toBe(0);
    expect(test.game.started).toEqual([]);
  });

  it('po obnovení stránky je zase menu, i když dítě předtím hrálo (menu si hru nepamatuje)', async () => {
    const storage = watchedLocalStorage();
    const before = testMenu();
    await tapAndLoad(before);
    expect(before.menu.runningGame()?.id).toBe('zebra');

    const reloaded = testMenu();
    expect(reloaded.menu.runningGame()).toBeNull();
    expect(reloaded.download.count).toBe(0);
    expect(storage.writes).toEqual([]);
  });

  it('kolečko nastavení v menu nejde otevřít', () => {
    expect(testMenu().menu.canOpenSettings()).toBe(false);
  });
});

describe('#67 AC2: název stránky', () => {
  it('v menu je název „Matematika“', () => {
    expect(countingMenu().menu.pageTitle()).toBe('Matematika');
  });

  it('sdílený text názvu stránky je „Matematika“', () => {
    expect(sharedTexts('cs').pageTitle).toBe('Matematika');
  });

  it('po spuštění Počítání je název „Počítání“ z textů hry', async () => {
    const test = countingMenu();
    await tapAndLoad(test, 'counting');
    expect(test.menu.pageTitle()).toBe('Počítání');
  });

  it('během stahování zůstává „Matematika“', async () => {
    const test = countingMenu();
    test.menu.tapTile('counting');
    await wait(1000);
    expect(test.menu.pageTitle()).toBe('Matematika');
  });

  it('když se hra nestáhne, zůstane „Matematika“', async () => {
    const test = countingMenu();
    test.menu.tapTile('counting');
    test.download.fail();
    await wait();
    expect(test.menu.pageTitle()).toBe('Matematika');
  });

  it('když se hra nestáhne do 15 s, zůstane „Matematika“', async () => {
    const test = countingMenu();
    test.menu.tapTile('counting');
    await wait(LOADING_TIMEOUT_MS + 1);
    expect(test.menu.pageTitle()).toBe('Matematika');
  });

  it('když stažená hra při spuštění selže, zůstane „Matematika“', async () => {
    const test = countingMenu();
    test.game.failing = true;
    await tapAndLoad(test, 'counting');
    expect(test.menu.pageTitle()).toBe('Matematika');
  });
});

describe('#67 AC5: ťuknutí na dlaždici a stahování', () => {
  it('ťuknutí dá hned odezvu: dlaždice se zmáčkne a zazní zvuk', () => {
    const test = testMenu();
    test.menu.tapTile('zebra');
    expect(test.feedback[0]).toEqual(expect.objectContaining({ kind: 'press', gameId: 'zebra' }));
  });

  it('hra se začne stahovat až po ťuknutí na její dlaždici', () => {
    const test = testMenu();
    expect(test.download.count).toBe(0);
    test.menu.tapTile('zebra');
    expect(test.download.count).toBe(1);
  });

  it('po stažení hra naběhne se staženým souborem hry', async () => {
    const test = testMenu();
    test.menu.tapTile('zebra');
    test.download.succeed({ jsem: 'zebra' });
    await wait();
    expect(test.game.started).toEqual([{ gameId: 'zebra', loaded: { jsem: 'zebra' } }]);
    expect(test.menu.runningGame()?.id).toBe('zebra');
  });

  it('rychlé stažení (do 300 ms) dlaždici nerozpulzuje', async () => {
    const test = testMenu();
    test.menu.tapTile('zebra');
    await wait(100);
    test.download.succeed();
    await wait(1000);
    expect(test.kinds()).not.toContain('pulse');
  });

  it('stahování 299 ms dlaždici ještě nerozpulzuje', async () => {
    const test = testMenu();
    test.menu.tapTile('zebra');
    await wait(SLOW_LOADING_MS - 1);
    expect(test.kinds()).not.toContain('pulse');
  });

  it('stahování delší než 300 ms rozpulzuje dlaždici', async () => {
    const test = testMenu();
    test.menu.tapTile('zebra');
    await wait(SLOW_LOADING_MS + 1);
    expect(test.feedback).toContainEqual(
      expect.objectContaining({ kind: 'pulse', gameId: 'zebra' }),
    );
  });

  it('dlaždice pulzuje, dokud hra nenaběhne, pak pulzovat přestane', async () => {
    const test = testMenu();
    test.menu.tapTile('zebra');
    await wait(5000);
    expect(test.kinds()).not.toContain('stopPulse');
    test.download.succeed();
    await wait();
    expect(test.kinds()).toContain('stopPulse');
    expect(test.game.started).toHaveLength(1);
  });

  it('během stahování ani po spuštění se nezatřese', async () => {
    const test = testMenu();
    test.menu.tapTile('zebra');
    await wait(5000);
    test.download.succeed();
    await wait();
    expect(test.kinds()).not.toContain('shake');
  });

  it('ťuknutí na neznámou hru nic nestáhne a nespadne', () => {
    const test = testMenu();
    expect(() => test.menu.tapTile('xx')).not.toThrow();
    expect(() => test.menu.tapTile('')).not.toThrow();
    expect(test.download.count).toBe(0);
  });
});

describe('#67 AC5: dvojí ťuknutí spustí hru jednou', () => {
  it('druhé ťuknutí během stahování hru nestáhne podruhé', () => {
    const test = testMenu();
    test.menu.tapTile('zebra');
    test.menu.tapTile('zebra');
    expect(test.download.count).toBe(1);
  });

  it('dvojí ťuknutí spustí hru jednou', async () => {
    const test = testMenu();
    test.menu.tapTile('zebra');
    test.menu.tapTile('zebra');
    test.download.succeed();
    await wait(1000);
    expect(test.game.started).toHaveLength(1);
  });

  it('dvojí ťuknutí při pomalém stahování spustí hru jednou', async () => {
    const test = testMenu();
    test.menu.tapTile('zebra');
    await wait(2000);
    test.menu.tapTile('zebra');
    test.download.succeed();
    await wait(1000);
    expect(test.download.count).toBe(1);
    expect(test.game.started).toHaveLength(1);
  });
});

describe('#67 AC5: hra se nestáhne', () => {
  it('dítě zůstane v menu, dlaždice se zatřese, žádná hra neběží', async () => {
    const test = testMenu();
    test.menu.tapTile('zebra');
    test.download.fail();
    await wait();
    expect(test.menu.runningGame()).toBeNull();
    expect(test.game.started).toEqual([]);
    expect(test.feedback).toContainEqual(
      expect.objectContaining({ kind: 'shake', gameId: 'zebra' }),
    );
  });

  it('pulzující dlaždice po selhání přestane pulzovat', async () => {
    const test = testMenu();
    test.menu.tapTile('zebra');
    await wait(1000);
    test.download.fail();
    await wait();
    expect(test.kinds()).toContain('stopPulse');
  });

  it('po jednom selhání a úspěšném dalším pokusu hra naběhne', async () => {
    const test = testMenu();
    test.menu.tapTile('zebra');
    test.download.fail();
    await wait();
    await tapAndLoad(test);
    expect(test.download.count).toBe(2);
    expect(test.game.started).toHaveLength(1);
    expect(test.menu.runningGame()?.id).toBe('zebra');
  });

  it('nový pokus přijde jen po ťuknutí, sám se ve smyčce nezkouší', async () => {
    const test = testMenu();
    test.menu.tapTile('zebra');
    test.download.fail();
    await wait(10 * LOADING_TIMEOUT_MS);
    expect(test.download.count).toBe(1);
    test.menu.tapTile('zebra');
    expect(test.download.count).toBe(2);
  });

  it('při opakovaném selhání neunikne výjimka a dítě zůstane v menu', async () => {
    const test = testMenu();
    for (let attempt = 0; attempt < 5; attempt += 1) {
      expect(() => test.menu.tapTile('zebra')).not.toThrow();
      test.download.fail();
      await wait();
    }
    expect(test.download.count).toBe(5);
    expect(test.kinds().filter((kind) => kind === 'shake')).toHaveLength(5);
    expect(test.menu.runningGame()).toBeNull();
  });

  it('stahování, které spadne hned při zavolání, menu neshodí a dlaždice se zatřese', async () => {
    const feedback: MenuFeedback[] = [];
    const menu = createMenu({
      games: [
        {
          ...COUNTING,
          load: () => {
            throw new Error('stahování spadlo hned');
          },
        },
      ],
      categories: GAME_CATEGORIES,
      translate: (key) => menuText(key, 'cs') ?? key,
      start: () => undefined,
      feedback: (event) => feedback.push(event),
    });
    expect(() => menu.tapTile('counting')).not.toThrow();
    await wait();
    expect(menu.runningGame()).toBeNull();
    expect(feedback.map((event) => event.kind)).toContain('shake');
  });
});

describe('#67 AC5: stahování delší než 15 s je selhání', () => {
  it('po 14,9 s menu ještě čeká: žádné zatřesení a hra po doběhnutí naběhne', async () => {
    const test = testMenu();
    test.menu.tapTile('zebra');
    await wait(14_900);
    expect(test.kinds()).not.toContain('shake');
    test.download.succeed();
    await wait();
    expect(test.game.started).toHaveLength(1);
  });

  it('po 15 s se dlaždice zatřese a přestane pulzovat', async () => {
    const test = testMenu();
    test.menu.tapTile('zebra');
    await wait(LOADING_TIMEOUT_MS + 1);
    expect(test.feedback).toContainEqual(
      expect.objectContaining({ kind: 'shake', gameId: 'zebra' }),
    );
    expect(test.kinds()).toContain('stopPulse');
    expect(test.menu.runningGame()).toBeNull();
  });

  it('stahování, které doběhne až po 15 s, hru samo nespustí', async () => {
    const test = testMenu();
    test.menu.tapTile('zebra');
    await wait(LOADING_TIMEOUT_MS + 1);
    test.download.succeed();
    await wait(1000);
    expect(test.game.started).toEqual([]);
    expect(test.menu.runningGame()).toBeNull();
  });

  it('pozdě selhané stahování po 15 s už nezatřese podruhé', async () => {
    const test = testMenu();
    test.menu.tapTile('zebra');
    await wait(LOADING_TIMEOUT_MS + 1);
    test.download.fail();
    await wait();
    expect(test.kinds().filter((kind) => kind === 'shake')).toHaveLength(1);
  });

  it('po vypršení další ťuknutí hru spustí', async () => {
    const test = testMenu();
    test.menu.tapTile('zebra');
    await wait(LOADING_TIMEOUT_MS + 1);
    test.menu.tapTile('zebra');
    // Doběhne pokus, který menu po ťuknutí čeká; starý pokus může doběhnout také.
    for (const attempt of test.download.attempts) {
      attempt.resolve({});
    }
    await wait();
    expect(test.game.started).toHaveLength(1);
    expect(test.menu.runningGame()?.id).toBe('zebra');
  });
});

describe('#67 AC5: stažená hra selže při spuštění', () => {
  it('dítě zůstane v menu a dlaždice se zatřese jako po výpadku stahování', async () => {
    const test = testMenu();
    test.game.failing = true;
    await tapAndLoad(test);
    expect(test.game.started).toHaveLength(1);
    expect(test.menu.runningGame()).toBeNull();
    expect(test.feedback).toContainEqual(
      expect.objectContaining({ kind: 'shake', gameId: 'zebra' }),
    );
  });

  it('hra, která selže až později (zamítnutý slib), nechá dítě v menu se zatřesením', async () => {
    const test = testMenu();
    test.game.failingAsync = true;
    await tapAndLoad(test);
    expect(test.menu.runningGame()).toBeNull();
    expect(test.kinds()).toContain('shake');
  });

  it('výjimka ze spuštění neunikne ven', async () => {
    const test = testMenu();
    test.game.failing = true;
    expect(() => test.menu.tapTile('zebra')).not.toThrow();
    test.download.succeed();
    await expect(wait()).resolves.toBeUndefined();
  });

  it('další ťuknutí zkusí hru spustit znovu a hra naběhne', async () => {
    const test = testMenu();
    test.game.failing = true;
    await tapAndLoad(test);
    test.game.failing = false;
    test.menu.tapTile('zebra');
    for (const attempt of test.download.attempts) {
      attempt.resolve({});
    }
    await wait();
    expect(test.game.started).toHaveLength(2);
    expect(test.menu.runningGame()?.id).toBe('zebra');
  });

  it('po selhání spuštění se sama znovu nespouští', async () => {
    const test = testMenu();
    test.game.failing = true;
    await tapAndLoad(test);
    await wait(10 * LOADING_TIMEOUT_MS);
    expect(test.game.started).toHaveLength(1);
  });
});

describe('#67 AC5: jiné ťuknutí během stahování hru zruší', () => {
  it.each([
    ['na kategorii', (test: TestMenu) => test.menu.tapCategory('logic')],
    ['na už vybranou „Vše“', (test: TestMenu) => test.menu.tapCategory(ALL_CATEGORY.id)],
    ['na zástupné tlačítko', (test: TestMenu) => test.menu.tapPlaceholder(0)],
  ])('ťuknutí %s: hra se po doběhnutí nespustí', async (_where, tapElsewhere) => {
    const test = testMenu();
    test.menu.tapTile('zebra');
    await wait(1000);
    tapElsewhere(test);
    test.download.succeed();
    await wait(1000);
    expect(test.game.started).toEqual([]);
    expect(test.menu.runningGame()).toBeNull();
  });

  it.each([
    ['na kategorii', (test: TestMenu) => test.menu.tapCategory('logic')],
    ['na zástupné tlačítko', (test: TestMenu) => test.menu.tapPlaceholder(0)],
  ])('ťuknutí %s: dlaždice přestane pulzovat bez zatřesení', async (_where, tapElsewhere) => {
    const test = testMenu();
    test.menu.tapTile('zebra');
    await wait(1000);
    tapElsewhere(test);
    expect(test.kinds()).toContain('stopPulse');
    await wait(LOADING_TIMEOUT_MS * 2);
    expect(test.kinds()).not.toContain('shake');
  });

  it('ťuknutí na kategorii se chová jako obvykle: kategorie se vybere', async () => {
    const test = testMenu();
    test.menu.tapTile('zebra');
    await wait(1000);
    test.menu.tapCategory('logic');
    expect(
      test.menu
        .categories()
        .filter((category) => category.selected)
        .map((category) => category.id),
    ).toEqual(['logic']);
  });

  it('ťuknutí na zástupné tlačítko se chová jako obvykle: zhoupne se', async () => {
    const test = testMenu();
    test.menu.tapTile('zebra');
    await wait(1000);
    test.menu.tapPlaceholder(0);
    expect(test.kinds()).toContain('wobble');
  });

  it.each([
    ['na kategorii', (test: TestMenu) => test.menu.tapCategory('adding')],
    ['na zástupné tlačítko', (test: TestMenu) => test.menu.tapPlaceholder(0)],
  ])('po ťuknutí %s další ťuknutí na dlaždici hru spustí', async (_where, tapElsewhere) => {
    const test = testMenu();
    test.menu.tapTile('zebra');
    await wait(1000);
    tapElsewhere(test);
    test.menu.tapTile('zebra');
    for (const attempt of test.download.attempts) {
      attempt.resolve({});
    }
    await wait();
    expect(test.game.started).toHaveLength(1);
    expect(test.menu.runningGame()?.id).toBe('zebra');
  });

  it('zrušené stahování, které pak selže, dlaždici nezatřese', async () => {
    const test = testMenu();
    test.menu.tapTile('zebra');
    await wait(1000);
    test.menu.tapPlaceholder(0);
    test.download.fail();
    await wait();
    expect(test.kinds()).not.toContain('shake');
  });
});

describe('#67 AC5: kolečko nastavení až po naběhnutí hry', () => {
  it('během stahování kolečko nejde otevřít', async () => {
    const test = testMenu();
    test.menu.tapTile('zebra');
    await wait(1000);
    expect(test.menu.canOpenSettings()).toBe(false);
  });

  it('po výpadku stahování kolečko nejde otevřít', async () => {
    const test = testMenu();
    test.menu.tapTile('zebra');
    test.download.fail();
    await wait();
    expect(test.menu.canOpenSettings()).toBe(false);
  });

  it('když stažená hra při spuštění selže, kolečko nejde otevřít', async () => {
    const test = testMenu();
    test.game.failing = true;
    await tapAndLoad(test);
    expect(test.menu.canOpenSettings()).toBe(false);
  });

  it('kolečko jde otevřít, až když hra naběhne', async () => {
    const test = testMenu();
    await tapAndLoad(test);
    expect(test.menu.canOpenSettings()).toBe(true);
  });
});
