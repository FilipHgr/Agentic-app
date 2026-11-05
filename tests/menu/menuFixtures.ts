import { vi } from 'vitest';

import { createMenu } from '../../src/menu/logic/menu';
import type { Menu, MenuFeedback } from '../../src/menu/logic/menu';
import type { GameCategory, GameEntry } from '../../src/shared/logic/gameRegistry';

/**
 * Pomůcky pro testy menu (#67): zkušební seznam her a kategorií jen pro
 * testy, falešné stahování, falešná hra a záznam odezvy menu.
 *
 * Abecední pořadí názvů je schválně jiné než pořadí v seznamech, aby test
 * poznal řazení podle abecedy:
 * - kategorie v seznamu: Tvary, Sčítání, Prázdná, Logika (abecedně Logika, Prázdná, Sčítání, Tvary),
 * - hry v registru: Zebra, Auto, Míč, Kotva (abecedně Auto, Kotva, Míč, Zebra).
 */

export const TEST_CATEGORIES: readonly GameCategory[] = [
  { id: 'shapes', titleKey: 'categories.shapes.title' },
  { id: 'adding', titleKey: 'categories.adding.title' },
  { id: 'empty', titleKey: 'categories.empty.title' },
  { id: 'logic', titleKey: 'categories.logic.title' },
];

/** Zkušební hra se stahováním, které test nahradí vlastním. */
function testGame(id: string, categoryId: string, symbol: string): GameEntry {
  return {
    id,
    titleKey: `games.${id}.title`,
    categoryId,
    symbol,
    load: () => Promise.resolve({}),
  };
}

export const TEST_GAMES: readonly GameEntry[] = [
  testGame('zebra', 'adding', '1+1'),
  testGame('auto', 'logic', '<>'),
  testGame('mic', 'shapes', '△'),
  testGame('kotva', 'adding', '2+2'),
];

/** Umělá čeština zkušebních her (jen v testech). */
export const TEST_TEXTS_CS: Readonly<Record<string, string>> = {
  'categories.all.title': 'Vše',
  'categories.shapes.title': 'Tvary',
  'categories.adding.title': 'Sčítání',
  'categories.empty.title': 'Prázdná',
  'categories.logic.title': 'Logika',
  'games.zebra.title': 'Zebra',
  'games.auto.title': 'Auto',
  'games.mic.title': 'Míč',
  'games.kotva.title': 'Kotva',
};

/** Umělý druhý jazyk (jen v testech), abecedně zase v jiném pořadí. */
export const TEST_TEXTS_XX: Readonly<Record<string, string>> = {
  'categories.all.title': 'Alle',
  'categories.shapes.title': 'Arrows',
  'categories.adding.title': 'Zoo',
  'categories.empty.title': 'Bees',
  'categories.logic.title': 'Moon',
  'games.zebra.title': 'Apple',
  'games.auto.title': 'Yak',
  'games.mic.title': 'Cat',
  'games.kotva.title': 'Bird',
};

/** Překlad klíče podle slovníku; neznámý klíč vrátí sám sebe. */
export function translatorOf(texts: Readonly<Record<string, string>>): (key: string) => string {
  return (key) => texts[key] ?? key;
}

interface Deferred {
  readonly promise: Promise<unknown>;
  resolve(value?: unknown): void;
  reject(reason?: unknown): void;
}

function deferred(): Deferred {
  let resolve: (value?: unknown) => void = () => undefined;
  let reject: (reason?: unknown) => void = () => undefined;
  const promise = new Promise<unknown>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

/** Falešné stahování: každý pokus čeká, dokud ho test nedokončí nebo neshodí. */
export class FakeDownload {
  readonly attempts: Deferred[] = [];

  readonly load = (): Promise<unknown> => {
    const attempt = deferred();
    this.attempts.push(attempt);
    return attempt.promise;
  };

  get count(): number {
    return this.attempts.length;
  }

  /** Dokončí poslední pokus, stažená hra je objekt `module`. */
  succeed(module: unknown = { kind: 'staženáHra' }): void {
    this.last().resolve(module);
  }

  fail(): void {
    this.last().reject(new Error('síť nefunguje'));
  }

  attempt(index: number): Deferred {
    const found = this.attempts[index];
    if (found === undefined) {
      throw new Error(`pokus o stažení ${index} neproběhl`);
    }
    return found;
  }

  private last(): Deferred {
    return this.attempt(this.attempts.length - 1);
  }
}

/** Falešná hra: zaznamená každé spuštění, na požádání při spuštění selže. */
export class FakeGame {
  readonly started: Array<{ gameId: string; loaded: unknown }> = [];
  failing = false;
  failingAsync = false;

  readonly start = (game: GameEntry, loaded: unknown): void | Promise<void> => {
    this.started.push({ gameId: game.id, loaded });
    if (this.failing) {
      throw new Error('hra při spuštění spadla');
    }
    if (this.failingAsync) {
      return Promise.reject(new Error('hra při spuštění spadla později'));
    }
    return undefined;
  };
}

export interface TestMenu {
  readonly menu: Menu;
  readonly download: FakeDownload;
  readonly game: FakeGame;
  readonly feedback: MenuFeedback[];
  /** Druhy odezvy v pořadí, jak přišly. */
  kinds(): string[];
}

export interface TestMenuOptions {
  readonly games?: readonly GameEntry[];
  readonly categories?: readonly GameCategory[];
  readonly translate?: (key: string) => string;
}

/** Menu nad zkušebními hrami; všechny hry se stahují falešným stahováním. */
export function testMenu(options: TestMenuOptions = {}): TestMenu {
  const download = new FakeDownload();
  const game = new FakeGame();
  const feedback: MenuFeedback[] = [];
  const games = (options.games ?? TEST_GAMES).map((entry) => ({ ...entry, load: download.load }));
  const menu = createMenu({
    games,
    categories: options.categories ?? TEST_CATEGORIES,
    translate: options.translate ?? translatorOf(TEST_TEXTS_CS),
    start: game.start,
    feedback: (event) => feedback.push(event),
  });
  return { menu, download, game, feedback, kinds: () => feedback.map((event) => event.kind) };
}

/** Úložiště v paměti místo `localStorage`, které si pamatuje každý zápis. */
export function watchedLocalStorage(initial: Record<string, string> = {}): {
  writes: string[];
  snapshot: () => Record<string, string>;
} {
  const data = new Map<string, string>(Object.entries(initial));
  const writes: string[] = [];
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      writes.push(key);
      data.set(key, value);
    },
    removeItem: (key: string) => {
      writes.push(key);
      data.delete(key);
    },
    clear: () => {
      writes.push('*');
      data.clear();
    },
    key: (index: number) => [...data.keys()][index] ?? null,
    get length() {
      return data.size;
    },
  });
  return { writes, snapshot: () => Object.fromEntries(data) };
}
