/// <reference types="vite/client" />
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createMenu } from '../../src/menu/logic/menu';
import type { Menu, MenuFeedback } from '../../src/menu/logic/menu';
import { launchGame } from '../../src/menu/ui/launchGame';
import type { SubscriptionSource } from '../../src/shared/logic/gameAccess';
import type { GameEntry } from '../../src/shared/logic/gameRegistry';
import { runGame } from '../../src/shared/ui/gameRunner';
import { ACTIVE_SOURCE, NOT_ACTIVE_SOURCES, changingSource } from '../shared/subscriptionFixtures';
import { TEST_CATEGORIES, translatorOf, watchedLocalStorage } from './menuFixtures';

/**
 * Testy k #74 AC4: zamčenou hru nejde spustit žádnou cestou. Odemčení
 * ověřuje jediné místo, kudy se hra spouští (`launchGame`), pokaždé znovu.
 * Hraje se skutečné menu a skutečné `launchGame`, jen Phaser hra
 * (`runGame`) je nahrazená záznamem spuštění. Zkušební hra „v předplatném“
 * a zkušební hra zdarma jsou jen v testech.
 */

vi.mock('../../src/shared/ui/gameRunner', () => ({
  isGameModule: (value: unknown) =>
    typeof value === 'object' && value !== null && 'scenes' in value,
  runGame: vi.fn(),
}));

const LOADED_GAME = { scenes: ['ZkusebniScena'] };

function testGame(id: string, access: GameEntry['access']): GameEntry {
  return {
    id,
    titleKey: `games.${id}.title`,
    categoryId: 'adding',
    symbol: '1+1',
    access,
    load: () => Promise.resolve(LOADED_GAME),
  };
}

const PAID_GAME = testGame('placena', 'subscription');
const FREE_GAME = testGame('zdarma', 'free');

interface TestPage {
  readonly menu: Menu;
  readonly feedback: MenuFeedback[];
  readonly closedMenu: string[];
}

/** Stránka s menu a skutečným spouštěním her přes `launchGame`. */
function testPage(subscription: SubscriptionSource): TestPage {
  const feedback: MenuFeedback[] = [];
  const closedMenu: string[] = [];
  const menu: Menu = createMenu({
    games: [PAID_GAME, FREE_GAME],
    categories: TEST_CATEGORIES,
    translate: translatorOf({}),
    start: (game, loaded) =>
      launchGame(game, loaded, {
        closeMenu: () => closedMenu.push(game.id),
        returnToMenu: () => menu.returnFromGame(),
        subscription,
      }),
    feedback: (event) => feedback.push(event),
  });
  return { menu, feedback, closedMenu };
}

/** Ťukne na dlaždici a nechá doběhnout stažení i spuštění. */
async function tapTile(page: TestPage, gameId: string): Promise<void> {
  page.menu.tapTile(gameId);
  await vi.advanceTimersByTimeAsync(0);
}

function startedGames(): string[] {
  return vi.mocked(runGame).mock.calls.map(([module]) => String(module.scenes[0]));
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.mocked(runGame).mockClear();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('#74 AC4: zamčenou hru nejde spustit žádnou cestou', () => {
  it('při aktivním předplatném se hra v předplatném spustí ťuknutím na dlaždici', async () => {
    const page = testPage(ACTIVE_SOURCE);
    await tapTile(page, PAID_GAME.id);
    expect(page.menu.runningGame()?.id).toBe(PAID_GAME.id);
    expect(startedGames()).toHaveLength(1);
  });

  describe.each(NOT_ACTIVE_SOURCES)('předplatné %s', (_name, source) => {
    it('hra v předplatném se ťuknutím na dlaždici nespustí a dítě zůstane v menu', async () => {
      const page = testPage(source);
      await tapTile(page, PAID_GAME.id);
      expect(runGame).not.toHaveBeenCalled();
      expect(page.menu.runningGame()).toBeNull();
      expect(page.closedMenu).toEqual([]);
      expect(page.menu.canOpenSettings()).toBe(false);
    });

    it('ve stejném menu se hra zdarma spustí', async () => {
      const page = testPage(source);
      await tapTile(page, PAID_GAME.id);
      await tapTile(page, FREE_GAME.id);
      expect(page.menu.runningGame()?.id).toBe(FREE_GAME.id);
      expect(page.closedMenu).toEqual([FREE_GAME.id]);
      expect(runGame).toHaveBeenCalledTimes(1);
    });

    it('ani opakované ťuknutí hru v předplatném nespustí', async () => {
      const page = testPage(source);
      for (let attempt = 0; attempt < 5; attempt += 1) {
        await tapTile(page, PAID_GAME.id);
      }
      expect(runGame).not.toHaveBeenCalled();
      expect(page.menu.runningGame()).toBeNull();
    });

    it('po obnovení stránky se hra v předplatném sama nespustí a dítě je v menu', async () => {
      const before = testPage(ACTIVE_SOURCE);
      await tapTile(before, PAID_GAME.id);
      vi.mocked(runGame).mockClear();

      const reloaded = testPage(source);
      await vi.advanceTimersByTimeAsync(0);
      expect(reloaded.menu.runningGame()).toBeNull();
      expect(runGame).not.toHaveBeenCalled();
    });

    it('přímé spuštění přes launchGame hru v předplatném nespustí a menu nezavře', () => {
      const closed: string[] = [];
      expect(() =>
        launchGame(PAID_GAME, LOADED_GAME, {
          closeMenu: () => closed.push('menu'),
          returnToMenu: () => undefined,
          subscription: source,
        }),
      ).toThrow();
      expect(runGame).not.toHaveBeenCalled();
      expect(closed).toEqual([]);
    });
  });

  it('odemčení se ověří při každém spuštění znovu, ne jen jednou', async () => {
    const source = changingSource('inactive');
    const page = testPage(source);
    await tapTile(page, PAID_GAME.id);
    expect(page.menu.runningGame()).toBeNull();

    source.set('active');
    await tapTile(page, PAID_GAME.id);
    expect(page.menu.runningGame()?.id).toBe(PAID_GAME.id);
  });

  it('když se předplatné během hraní změní na neaktivní, rozehraná hra se neukončí; zamčení platí až od dalšího spuštění', async () => {
    const source = changingSource('active');
    const page = testPage(source);
    await tapTile(page, PAID_GAME.id);
    expect(page.menu.runningGame()?.id).toBe(PAID_GAME.id);

    source.set('inactive');
    await vi.advanceTimersByTimeAsync(60_000);
    expect(page.menu.runningGame()?.id).toBe(PAID_GAME.id);
    expect(page.menu.canOpenSettings()).toBe(true);
    expect(page.menu.canGoHome()).toBe(true);

    page.menu.returnFromGame();
    await tapTile(page, PAID_GAME.id);
    expect(page.menu.runningGame()).toBeNull();
    expect(runGame).toHaveBeenCalledTimes(1);
  });

  it('postup a nastavení zamčené hry se nesmažou a po odemčení zůstanou stejné', async () => {
    const saved = {
      'placena.settings': '{"range":20}',
      'placena.progress': '{"stars":7}',
    };
    const storage = watchedLocalStorage(saved);
    const source = changingSource('inactive');
    const page = testPage(source);

    await tapTile(page, PAID_GAME.id);
    expect(page.menu.runningGame()).toBeNull();
    expect(storage.writes).toEqual([]);
    expect(storage.snapshot()).toEqual(saved);

    source.set('active');
    await tapTile(page, PAID_GAME.id);
    expect(page.menu.runningGame()?.id).toBe(PAID_GAME.id);
    expect(storage.writes).toEqual([]);
    expect(storage.snapshot()).toEqual(saved);
  });
});

/** Zdrojové texty všech `.ts` souborů v `src/`. */
const SOURCES = import.meta.glob<string>('../../src/**/*.ts', {
  query: '?raw',
  import: 'default',
  eager: true,
});

describe('#74 AC4: jiná cesta ke spuštění hry než launchGame neexistuje', () => {
  it('Phaser hru spouští (runGame) jen launchGame', () => {
    const callers = Object.entries(SOURCES)
      .filter(([path]) => !path.endsWith('/src/shared/ui/gameRunner.ts'))
      .filter(([, text]) => /\brunGame\b/.test(text))
      .map(([path]) => path.replace(/^.*\/src\//, 'src/'));
    expect(callers).toEqual(['src/menu/ui/launchGame.ts']);
  });

  it('launchGame je jediné místo, které menu volá ke spuštění hry', () => {
    const callers = Object.entries(SOURCES)
      .filter(([path]) => !path.endsWith('/src/menu/ui/launchGame.ts'))
      .filter(([, text]) => /\blaunchGame\b/.test(text))
      .map(([path]) => path.replace(/^.*\/src\//, 'src/'));
    expect(callers).toEqual(['src/menu/ui/menuPage.ts']);
  });

  it('stránka menu předává launchGame zdroj stavu z výběru zdroje, ne vlastní', () => {
    expect(SOURCES['../../src/menu/ui/menuPage.ts']).toMatch(/chooseSubscriptionSource\(\)/);
  });
});
