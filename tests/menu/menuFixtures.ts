import { vi } from 'vitest';

import { createMenu } from '../../src/menu/logic/menu';
import type { Menu, MenuFeedback, MenuLanguageSource } from '../../src/menu/logic/menu';
import { menuSoundFor } from '../../src/menu/logic/menuSounds';
import type { MenuSoundName } from '../../src/menu/logic/menuSounds';
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
  { id: 'shapes', titleKey: 'categories.shapes.title', symbol: '△' },
  { id: 'adding', titleKey: 'categories.adding.title', symbol: '+' },
  { id: 'empty', titleKey: 'categories.empty.title', symbol: '∅' },
  { id: 'logic', titleKey: 'categories.logic.title', symbol: '<>' },
];

/** Zkušební hra se stahováním, které test nahradí vlastním. */
function testGame(id: string, categoryId: string, symbol: string): GameEntry {
  return {
    id,
    titleKey: `games.${id}.title`,
    categoryId,
    symbol,
    access: 'free',
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
  /** Tóny, které by scéna k odezvě zahrála, v pořadí (#95). */
  sounds(): MenuSoundName[];
  /** Kolikrát menu požádalo o výběr profilu (#72). */
  profileOpened(): number;
}

/** Tóny k odezvě menu v pořadí, jak by je scéna zahrála (#95). */
export function soundsOf(feedback: readonly MenuFeedback[]): MenuSoundName[] {
  return feedback.flatMap((event) => {
    const sound = menuSoundFor(event);
    return sound === undefined ? [] : [sound];
  });
}

export interface TestMenuOptions {
  readonly games?: readonly GameEntry[];
  readonly categories?: readonly GameCategory[];
  readonly translate?: (key: string) => string;
  readonly languages?: MenuLanguageSource;
  readonly onLanguageChanged?: () => void;
}

/** Umělé jazyky menu jen pro testy (#70): kód a vlastní název jazyka. */
export const TEST_LANGUAGE_NAMES: Readonly<Record<string, string>> = {
  cs: 'Čeština',
  xx: 'Xxština',
};

/**
 * Zkušební jazyky menu (#70), jen v testech: pamatují si zvolený jazyk
 * a každý výběr. Úložiště tu není, to testuje sdílená volba jazyka.
 */
export class TestLanguages implements MenuLanguageSource {
  readonly supported: readonly string[];
  readonly selections: string[] = [];
  private chosen: string;

  constructor(
    private readonly names: Readonly<Record<string, string>> = TEST_LANGUAGE_NAMES,
    initial = 'cs',
  ) {
    this.supported = Object.keys(names);
    this.chosen = initial;
  }

  current(): string {
    return this.chosen;
  }

  select(language: string): boolean {
    this.selections.push(language);
    if (language === this.chosen || !this.supported.includes(language)) {
      return false;
    }
    this.chosen = language;
    return true;
  }

  nameOf(language: string): string {
    return this.names[language] ?? language;
  }
}

/** Menu nad zkušebními hrami; všechny hry se stahují falešným stahováním. */
export function testMenu(options: TestMenuOptions = {}): TestMenu {
  const download = new FakeDownload();
  const game = new FakeGame();
  const feedback: MenuFeedback[] = [];
  let profileOpened = 0;
  const games = (options.games ?? TEST_GAMES).map((entry) => ({ ...entry, load: download.load }));
  const menu = createMenu({
    games,
    categories: options.categories ?? TEST_CATEGORIES,
    translate: options.translate ?? translatorOf(TEST_TEXTS_CS),
    start: game.start,
    feedback: (event) => feedback.push(event),
    languages: options.languages,
    onLanguageChanged: options.onLanguageChanged,
    onOpenProfilePicker: () => {
      profileOpened += 1;
    },
  });
  return {
    menu,
    download,
    game,
    feedback,
    kinds: () => feedback.map((event) => event.kind),
    sounds: () => soundsOf(feedback),
    profileOpened: () => profileOpened,
  };
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
