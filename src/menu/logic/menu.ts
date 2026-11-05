/**
 * Menu s výběrem her (#67): vybraná kategorie, dlaždice v mřížce
 * a spuštění hry po ťuknutí na dlaždici. Čistý TypeScript bez Phaseru;
 * scéna menu jen kreslí a předává ťuknutí. Odezvu (zmáčknutí, pulzování,
 * zatřesení, zhoupnutí) menu hlásí přes `feedback`, scéna ji zahraje.
 *
 * Spuštění hry (AC5):
 * - ťuknutí na dlaždici hned dá odezvu a začne hru stahovat,
 * - stahování delší než `SLOW_LOADING_MS` rozpulzuje dlaždici,
 * - selhání stahování, stahování delší než `LOADING_TIMEOUT_MS` nebo
 *   selhání při spuštění nechá dítě v menu a dlaždice se zatřese,
 * - pozdě doběhnuté stahování hru nespustí, nový pokus jen po ťuknutí,
 * - ťuknutí jinam během stahování spuštění zruší bez zatřesení.
 * Žádná výjimka z menu neunikne.
 */

import type { GameCategory, GameEntry } from '../../shared/logic/gameRegistry';
import { findGame } from '../../shared/logic/gameRegistry';
import { ALL_CATEGORY, gamesInCategory, visibleCategories } from './menuCategories';
import { PAGE_TITLE_KEY } from './menuTextKeys';

/** Po jak dlouhém stahování začne dlaždice pulzovat. */
export const SLOW_LOADING_MS = 300;

/** Stahování, které do té doby nedoběhne, je selhání. */
export const LOADING_TIMEOUT_MS = 15_000;

/** Co se zhouplo: zástupné tlačítko, nebo už vybraná kategorie. */
export type WobbleTarget =
  | { readonly kind: 'placeholder'; readonly index: number }
  | { readonly kind: 'category'; readonly categoryId: string };

/**
 * Odezva menu:
 * - `press` dlaždice se zmáčkne a zazní zvuk,
 * - `pulse` / `stopPulse` dlaždice pulzuje při pomalém stahování,
 * - `shake` dlaždice se jemně zatřese a zazní tichý zvuk jako u špatné odpovědi,
 * - `select` vybrala se jiná kategorie, zazní tichý tón,
 * - `wobble` zhoupnutí a tichý zvuk.
 */
export type MenuFeedback =
  | { readonly kind: 'press'; readonly gameId: string }
  | { readonly kind: 'pulse'; readonly gameId: string }
  | { readonly kind: 'stopPulse'; readonly gameId: string }
  | { readonly kind: 'shake'; readonly gameId: string }
  | { readonly kind: 'select'; readonly categoryId: string }
  | { readonly kind: 'wobble'; readonly target: WobbleTarget };

export interface MenuCategoryView {
  readonly id: string;
  readonly title: string;
  readonly selected: boolean;
}

export interface MenuTileView {
  readonly gameId: string;
  readonly symbol: string;
  readonly title: string;
}

export interface MenuOptions {
  readonly games: readonly GameEntry[];
  readonly categories: readonly GameCategory[];
  /** Text podle klíče v jazyce menu. */
  readonly translate: (key: string) => string;
  /**
   * Spustí staženou hru. Jediné místo, kudy se hra spouští. Smí vyhodit
   * výjimku nebo vrátit zamítnutý slib, menu pak dítě nechá v menu.
   */
  readonly start: (game: GameEntry, loaded: unknown) => void | Promise<void>;
  readonly feedback: (event: MenuFeedback) => void;
  /**
   * Hra naběhla: `runningGame()`, `pageTitle()` a `canOpenSettings()`
   * už platí pro ni. Stránka podle nich nastaví název a kolečko.
   */
  readonly onStarted?: (game: GameEntry) => void;
}

export interface Menu {
  categories(): MenuCategoryView[];
  tiles(): MenuTileView[];
  tapCategory(categoryId: string): void;
  tapPlaceholder(index: number): void;
  tapTile(gameId: string): void;
  /** Hra, která naběhla, nebo `null` v menu. */
  runningGame(): GameEntry | null;
  /** Název stránky: v menu název menu, po spuštění název hry. */
  pageTitle(): string;
  /** Kolečko nastavení jde otevřít, až když hra naběhne. */
  canOpenSettings(): boolean;
}

/** Rozběhnuté stahování a spuštění jedné hry. */
interface Launch {
  readonly game: GameEntry;
  phase: 'downloading' | 'starting';
  pulsing: boolean;
  slowTimer: ReturnType<typeof setTimeout> | undefined;
  timeoutTimer: ReturnType<typeof setTimeout> | undefined;
}

export function createMenu(options: MenuOptions): Menu {
  const { games, categories, translate } = options;
  const shownCategoryIds = visibleCategories(games, categories);
  let selectedCategoryId = ALL_CATEGORY.id;
  let launch: Launch | null = null;
  let running: GameEntry | null = null;

  function emit(event: MenuFeedback): void {
    options.feedback(event);
  }

  function categoryById(id: string): GameCategory | undefined {
    return [ALL_CATEGORY, ...categories].find((category) => category.id === id);
  }

  function stopTimers(current: Launch): void {
    clearTimeout(current.slowTimer);
    clearTimeout(current.timeoutTimer);
    current.slowTimer = undefined;
    current.timeoutTimer = undefined;
  }

  /** Ukončí rozběhnuté spuštění; pozdní výsledek stahování už nic neudělá. */
  function endLaunch(current: Launch): void {
    stopTimers(current);
    if (current.pulsing) {
      current.pulsing = false;
      emit({ kind: 'stopPulse', gameId: current.game.id });
    }
    if (launch === current) {
      launch = null;
    }
  }

  function fail(current: Launch): void {
    if (launch !== current) {
      return;
    }
    endLaunch(current);
    emit({ kind: 'shake', gameId: current.game.id });
  }

  /** Ťuknutí jinam během stahování: dítě chce něco jiného, hra se nespustí. */
  function cancelDownload(): void {
    if (launch !== null && launch.phase === 'downloading') {
      endLaunch(launch);
    }
  }

  function startGame(current: Launch, loaded: unknown): void {
    if (launch !== current) {
      return;
    }
    current.phase = 'starting';
    stopTimers(current);
    let started: Promise<void>;
    try {
      started = Promise.resolve(options.start(current.game, loaded));
    } catch (error) {
      started = Promise.reject(error);
    }
    started.then(
      () => {
        if (launch === current) {
          endLaunch(current);
          running = current.game;
          options.onStarted?.(current.game);
        }
      },
      () => fail(current),
    );
  }

  function download(game: GameEntry): void {
    const current: Launch = {
      game,
      phase: 'downloading',
      pulsing: false,
      slowTimer: undefined,
      timeoutTimer: undefined,
    };
    launch = current;
    current.slowTimer = setTimeout(() => {
      current.slowTimer = undefined;
      if (launch === current && current.phase === 'downloading') {
        current.pulsing = true;
        emit({ kind: 'pulse', gameId: game.id });
      }
    }, SLOW_LOADING_MS);
    current.timeoutTimer = setTimeout(() => fail(current), LOADING_TIMEOUT_MS);

    let loading: Promise<unknown>;
    try {
      loading = Promise.resolve(game.load());
    } catch (error) {
      loading = Promise.reject(error);
    }
    loading.then(
      (loaded) => startGame(current, loaded),
      () => fail(current),
    );
  }

  return {
    categories(): MenuCategoryView[] {
      return shownCategoryIds.map((id) => ({
        id,
        title: translate(categoryById(id)?.titleKey ?? ''),
        selected: id === selectedCategoryId,
      }));
    },

    tiles(): MenuTileView[] {
      return gamesInCategory(games, selectedCategoryId).map((game) => ({
        gameId: game.id,
        symbol: game.symbol,
        title: translate(game.titleKey),
      }));
    },

    tapCategory(categoryId: string): void {
      if (running !== null || !shownCategoryIds.includes(categoryId)) {
        return;
      }
      cancelDownload();
      if (categoryId === selectedCategoryId) {
        emit({ kind: 'wobble', target: { kind: 'category', categoryId } });
        return;
      }
      selectedCategoryId = categoryId;
      emit({ kind: 'select', categoryId });
    },

    tapPlaceholder(index: number): void {
      if (running !== null) {
        return;
      }
      cancelDownload();
      emit({ kind: 'wobble', target: { kind: 'placeholder', index } });
    },

    tapTile(gameId: string): void {
      const game = findGame(games, gameId);
      if (running !== null || game === undefined) {
        return;
      }
      emit({ kind: 'press', gameId: game.id });
      if (launch !== null && launch.game.id === game.id) {
        // Druhé ťuknutí během stahování: hra se nestahuje podruhé.
        return;
      }
      cancelDownload();
      if (launch === null) {
        download(game);
      }
    },

    runningGame(): GameEntry | null {
      return running;
    },

    pageTitle(): string {
      return translate(running?.titleKey ?? PAGE_TITLE_KEY);
    },

    canOpenSettings(): boolean {
      return running !== null;
    },
  };
}
