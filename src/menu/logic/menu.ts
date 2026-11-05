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
 *
 * Návrat z hry (#68): po odchodu domečkem menu žádnou hru nehraje
 * a vybraná kategorie zůstane, jak ji dítě nechalo.
 *
 * Jazyk (#70): tlačítko se zkratkou aktuálního jazyka otevře nabídku
 * jazyků. Ťuknutí na jazyk ho vybere a nabídku zavře, ťuknutí mimo nabídku
 * nebo znovu na tlačítko ji zavře beze změny. Dokud je nabídka otevřená,
 * dlaždice, kategorie ani zástupná tlačítka nereagují, ťuknutí na ně
 * nabídku jen zavře. Jazyk se mění jen v menu, ne během hry.
 *
 * Profil (#71): vlevo nahoře kolečko aktivního profilu v jeho barvě
 * s prvním písmenem přezdívky (bez přezdívky ★) a vedle přezdívka.
 * Ťuknutí na něj zatím dá jen zhoupnutí, výběr profilu přidá #72.
 */

import type { GameCategory, GameEntry } from '../../shared/logic/gameRegistry';
import { findGame } from '../../shared/logic/gameRegistry';
import { DEFAULT_PROFILE_COLOR, DEFAULT_PROFILE_ID } from '../../shared/logic/profiles';
import type { Profile, ProfileColor } from '../../shared/logic/profiles';
import { ALL_CATEGORY, gamesInCategory, visibleCategories } from './menuCategories';
import { deviceLanguages } from './menuLanguages';
import { PAGE_TITLE_KEY } from './menuTextKeys';

/** Po jak dlouhém stahování začne dlaždice pulzovat. */
export const SLOW_LOADING_MS = 300;

/** Stahování, které do té doby nedoběhne, je selhání. */
export const LOADING_TIMEOUT_MS = 15_000;

/** Symbol v kolečku profilu bez přezdívky (není to text jazyka). */
export const PROFILE_WITHOUT_NICKNAME_SYMBOL = '★';

/** Profil, když stránka menu žádný nedá: výchozí profil bez přezdívky. */
const FALLBACK_PROFILE: Profile = { id: DEFAULT_PROFILE_ID, color: DEFAULT_PROFILE_COLOR };

/** Co se zhouplo: zástupné tlačítko, už vybraná kategorie, nebo kolečko profilu. */
export type WobbleTarget =
  | { readonly kind: 'placeholder'; readonly index: number }
  | { readonly kind: 'profile' }
  | { readonly kind: 'category'; readonly categoryId: string };

/**
 * Odezva menu:
 * - `press` dlaždice se zmáčkne a zazní zvuk,
 * - `pulse` / `stopPulse` dlaždice pulzuje při pomalém stahování,
 * - `shake` dlaždice se jemně zatřese a zazní tichý zvuk jako u špatné odpovědi,
 * - `select` vybrala se jiná kategorie, zazní tichý tón,
 * - `wobble` zhoupnutí a tichý zvuk,
 * - `languageMenu` nabídka jazyků se otevřela nebo zavřela (#70),
 * - `language` vybral se jiný jazyk (#70).
 */
export type MenuFeedback =
  | { readonly kind: 'press'; readonly gameId: string }
  | { readonly kind: 'pulse'; readonly gameId: string }
  | { readonly kind: 'stopPulse'; readonly gameId: string }
  | { readonly kind: 'shake'; readonly gameId: string }
  | { readonly kind: 'select'; readonly categoryId: string }
  | { readonly kind: 'wobble'; readonly target: WobbleTarget }
  | { readonly kind: 'languageMenu'; readonly open: boolean }
  | { readonly kind: 'language'; readonly language: string };

/** Jazyky v nabídce (#70): seznam, aktuální jazyk, výběr a vlastní názvy. */
export interface MenuLanguageSource {
  /** Kódy jazyků v pořadí nabídky. */
  readonly supported: readonly string[];
  current(): string;
  /** Zvolí jazyk; `true`, jen když se jazyk změnil. */
  select(language: string): boolean;
  /** Vlastní název jazyka („Čeština“). */
  nameOf(language: string): string;
}

export interface MenuLanguageView {
  readonly code: string;
  readonly name: string;
  /** Aktuální jazyk má v nabídce ✓. */
  readonly selected: boolean;
}

/** Kolečko profilu (#71). */
export interface MenuProfileBadge {
  readonly color: ProfileColor;
  /** První písmeno přezdívky, bez přezdívky ★. */
  readonly symbol: string;
  /** Přezdívka vedle kolečka, `null` bez přezdívky. */
  readonly nickname: string | null;
}

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
  /**
   * Dítě odešlo z hry domečkem (#68): `runningGame()` je zase `null`,
   * `pageTitle()` název menu a `canGoHome()` i `canOpenSettings()` neplatí.
   * Stránka podle nich nastaví název, skryje kolečko i domeček a ukáže menu.
   */
  readonly onReturned?: () => void;
  /** Jazyky nabídky (#70); bez zadání jazyky celého zařízení. */
  readonly languages?: MenuLanguageSource | undefined;
  /**
   * Vybral se jiný jazyk (#70): stránka podle něj nastaví `lang` a název
   * a menu nakreslí v novém jazyce. Výběr stejného jazyka nic neohlásí.
   */
  readonly onLanguageChanged?: (() => void) | undefined;
  /** Aktivní profil (#71); čte se při každém kreslení. Bez něj výchozí profil. */
  readonly profile?: (() => Profile) | undefined;
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
  /** Domeček je vidět jen v běžící hře (#68); v menu ani při stahování ne. */
  canGoHome(): boolean;
  /** Hra skončila odchodem domečkem, menu se znovu ukáže (#68). Bez běžící hry nic. */
  returnFromGame(): void;
  /** Zkratka aktuálního jazyka velkými písmeny na tlačítku („CS“, #70). */
  languageButtonLabel(): string;
  /** Jazyky nabídky v jejím pořadí, aktuální s ✓ (#70). */
  languages(): MenuLanguageView[];
  isLanguageMenuOpen(): boolean;
  /** Ťuknutí na tlačítko jazyka: nabídku otevře, otevřenou zavře. */
  tapLanguageButton(): void;
  /** Ťuknutí na jazyk v otevřené nabídce: vybere ho a nabídku zavře. */
  tapLanguage(language: string): void;
  /** Ťuknutí mimo nabídku: zavře ji beze změny. */
  closeLanguageMenu(): void;
  /** Kolečko aktivního profilu (#71). */
  profileBadge(): MenuProfileBadge;
  /** Ťuknutí na profil: zatím jen zhoupnutí (#71). */
  tapProfile(): void;
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
  const languageSource = options.languages ?? deviceLanguages();
  const shownCategoryIds = visibleCategories(games, categories);
  let selectedCategoryId = ALL_CATEGORY.id;
  let launch: Launch | null = null;
  let running: GameEntry | null = null;
  let languageMenuOpen = false;

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

  function setLanguageMenuOpen(open: boolean): void {
    languageMenuOpen = open;
    emit({ kind: 'languageMenu', open });
  }

  /**
   * Ťuknutí na dlaždici, kategorii nebo zástupné tlačítko s otevřenou
   * nabídkou jazyků ji jen zavře. Vrátí `true`, když ťuknutí spotřebovala.
   */
  function closeLanguageMenuInstead(): boolean {
    if (!languageMenuOpen) {
      return false;
    }
    setLanguageMenuOpen(false);
    return true;
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
      if (
        running !== null ||
        closeLanguageMenuInstead() ||
        !shownCategoryIds.includes(categoryId)
      ) {
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
      if (running !== null || closeLanguageMenuInstead()) {
        return;
      }
      cancelDownload();
      emit({ kind: 'wobble', target: { kind: 'placeholder', index } });
    },

    tapTile(gameId: string): void {
      const game = findGame(games, gameId);
      if (running !== null || closeLanguageMenuInstead() || game === undefined) {
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

    canGoHome(): boolean {
      return running !== null;
    },

    returnFromGame(): void {
      if (running === null) {
        return;
      }
      // Vybraná kategorie zůstane, dítě je tam, odkud hru spustilo.
      running = null;
      options.onReturned?.();
    },

    languageButtonLabel(): string {
      return languageSource.current().toUpperCase();
    },

    languages(): MenuLanguageView[] {
      const current = languageSource.current();
      return languageSource.supported.map((code) => ({
        code,
        name: languageSource.nameOf(code),
        selected: code === current,
      }));
    },

    isLanguageMenuOpen(): boolean {
      return languageMenuOpen;
    },

    tapLanguageButton(): void {
      if (running !== null) {
        return;
      }
      cancelDownload();
      setLanguageMenuOpen(!languageMenuOpen);
    },

    tapLanguage(language: string): void {
      if (running !== null || !languageMenuOpen || !languageSource.supported.includes(language)) {
        return;
      }
      if (languageSource.select(language)) {
        options.onLanguageChanged?.();
        emit({ kind: 'language', language });
      }
      setLanguageMenuOpen(false);
    },

    closeLanguageMenu(): void {
      if (languageMenuOpen) {
        setLanguageMenuOpen(false);
      }
    },

    profileBadge(): MenuProfileBadge {
      const profile = options.profile?.() ?? FALLBACK_PROFILE;
      const nickname = profile.nickname ?? '';
      const firstLetter = [...nickname][0];
      return {
        color: profile.color,
        symbol: firstLetter ?? PROFILE_WITHOUT_NICKNAME_SYMBOL,
        nickname: firstLetter === undefined ? null : nickname,
      };
    },

    tapProfile(): void {
      if (running !== null || closeLanguageMenuInstead()) {
        return;
      }
      cancelDownload();
      emit({ kind: 'wobble', target: { kind: 'profile' } });
    },
  };
}
