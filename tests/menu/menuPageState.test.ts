import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createMenu } from '../../src/menu/logic/menu';
import type { Menu, MenuFeedback } from '../../src/menu/logic/menu';
import type { GameEntry } from '../../src/shared/logic/gameRegistry';
import indexHtml from '../../index.html?raw';
import { TEST_CATEGORIES, TEST_GAMES, TEST_TEXTS_CS, translatorOf } from './menuFixtures';

/**
 * Testy k #67 AC1, AC2 a AC3: stránka bere název a kolečko nastavení
 * z logiky menu (`pageTitle()`, `canOpenSettings()`) ve chvíli, kdy menu
 * ohlásí, že hra naběhla (`onStarted`). Výběr nové kategorie dá tichý tón.
 */

interface StartedMenu {
  readonly menu: Menu;
  readonly started: Array<{ gameId: string; title: string; canOpenSettings: boolean }>;
  readonly feedback: MenuFeedback[];
}

function startedMenu(load: () => Promise<unknown>, failingStart = false): StartedMenu {
  const started: StartedMenu['started'] = [];
  const feedback: MenuFeedback[] = [];
  const games: GameEntry[] = TEST_GAMES.map((game) => ({ ...game, load }));
  const menu: Menu = createMenu({
    games,
    categories: TEST_CATEGORIES,
    translate: translatorOf({ ...TEST_TEXTS_CS, 'page.title': 'Matematika' }),
    start: () => {
      if (failingStart) {
        throw new Error('hra spadla');
      }
    },
    feedback: (event) => feedback.push(event),
    onStarted: (game) =>
      started.push({
        gameId: game.id,
        title: menu.pageTitle(),
        canOpenSettings: menu.canOpenSettings(),
      }),
  });
  return { menu, started, feedback };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('#67 AC1: kolečko nastavení je na stránce v menu skryté', () => {
  it('tlačítko kolečka má v index.html atribut hidden', () => {
    expect(/<button[^>]*id="settings-button"[^>]*>/.exec(indexHtml)?.[0]).toMatch(/\shidden[\s>]/);
  });
});

describe('#67 AC2: stránka se po naběhnutí hry jmenuje jako hra', () => {
  it('po naběhnutí hry menu ohlásí hru jednou, s jejím názvem a kolečkem', async () => {
    const test = startedMenu(() => Promise.resolve({}));
    test.menu.tapTile('zebra');
    test.menu.tapTile('zebra');
    await vi.advanceTimersByTimeAsync(0);
    expect(test.started).toEqual([{ gameId: 'zebra', title: 'Zebra', canOpenSettings: true }]);
  });

  it('když se hra nestáhne, menu nic neohlásí a stránka zůstane „Matematika“', async () => {
    const test = startedMenu(() => Promise.reject(new Error('síť nefunguje')));
    test.menu.tapTile('zebra');
    await vi.advanceTimersByTimeAsync(0);
    expect(test.started).toEqual([]);
    expect(test.menu.pageTitle()).toBe('Matematika');
    expect(test.menu.canOpenSettings()).toBe(false);
  });

  it('když hra při spuštění selže, menu nic neohlásí', async () => {
    const test = startedMenu(() => Promise.resolve({}), true);
    test.menu.tapTile('zebra');
    await vi.advanceTimersByTimeAsync(0);
    expect(test.started).toEqual([]);
  });
});

describe('#67 AC3: výběr nové kategorie dá tichý tón', () => {
  it('ťuknutí na novou kategorii ohlásí výběr', () => {
    const test = startedMenu(() => Promise.resolve({}));
    test.menu.tapCategory('adding');
    expect(test.feedback).toEqual([{ kind: 'select', categoryId: 'adding' }]);
  });

  it('ťuknutí na už vybranou kategorii výběr neohlásí, jen zhoupne', () => {
    const test = startedMenu(() => Promise.resolve({}));
    test.menu.tapCategory('all');
    expect(test.feedback.map((event) => event.kind)).toEqual(['wobble']);
  });
});
