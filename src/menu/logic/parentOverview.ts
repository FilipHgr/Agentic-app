/**
 * Přehled pro rodiče v menu (#192): obrazovka za tlačítkem v liště menu,
 * které se otevře podržením 1 s. Ukazuje aktivní profil a má záložky her,
 * které přehled mají (`overview` v `meta.ts`: Počítání a Znaménka),
 * a u každé hry stránky 7 dní a Chyby. Zpět vrátí do menu.
 *
 * Záznamy se čtou při každém kreslení z úložiště hry aktivního profilu
 * (`gameStorage`) přes sdílenou logiku, menu nečte nic z kódu her. Čtení
 * nic nemění ani neukládá; poškozený záznam je prázdný přehled. Po
 * otevření je vybraná první hra a stránka 7 dní. Čistý TypeScript.
 */

import type { GameEntry } from '../../shared/logic/gameRegistry';
import type { GameOverviewSpec } from '../../shared/logic/overviewProblems';
import { readGameOverview } from '../../shared/storage/activityStorage';
import type { GameOverview } from '../../shared/storage/activityStorage';
import type { KeyValueStorage } from '../../shared/storage/keyValueStorage';

export type OverviewPage = 'week' | 'mistakes';

/** Hra s přehledem. */
export interface OverviewGame {
  readonly id: string;
  readonly titleKey: string;
  readonly spec: GameOverviewSpec;
}

/** Záložka hry, jak ji obrazovka nakreslí. */
export interface OverviewGameTab {
  readonly id: string;
  readonly title: string;
  readonly selected: boolean;
}

/**
 * Odezva přehledu: `select` vybrala se jiná záložka (tichý tón), `wobble`
 * záložka už byla vybraná (zhoupne se), `back` návrat do menu.
 */
export type OverviewFeedback =
  | { readonly kind: 'select' }
  | { readonly kind: 'wobble'; readonly target: 'game' | 'page'; readonly index: number }
  | { readonly kind: 'back' };

export interface ParentOverviewOptions {
  readonly games: readonly GameEntry[];
  /** Text podle klíče v jazyce menu (názvy her). */
  readonly translate: (key: string) => string;
  /** Úložiště hry pro aktivní profil; bez něj prázdný přehled. */
  readonly gameStorage?: ((gameId: string) => KeyValueStorage) | undefined;
  /** Dnešní datum podle kalendáře zařízení; bez něj hodiny zařízení. */
  readonly today?: (() => Date) | undefined;
  readonly feedback?: ((event: OverviewFeedback) => void) | undefined;
  /** Zpět: stránka ukáže menu. */
  readonly onClosed?: (() => void) | undefined;
}

export interface ParentOverview {
  isOpen(): boolean;
  /** Podržení tlačítka v liště menu: přehled první hry na stránce 7 dní. */
  open(): void;
  /** Hry s přehledem v pořadí menu, vybraná označená. */
  games(): OverviewGameTab[];
  page(): OverviewPage;
  /** Popis přehledu vybrané hry. */
  spec(): GameOverviewSpec;
  /** Záznamy vybrané hry za aktivní profil, přečtené teď. */
  data(): GameOverview;
  tapGame(index: number): void;
  tapPage(page: OverviewPage): void;
  tapBack(): void;
}

/** Hry, které přehled mají, v pořadí menu. */
export function overviewGames(games: readonly GameEntry[]): OverviewGame[] {
  return games.flatMap((game) =>
    game.overview === undefined
      ? []
      : [{ id: game.id, titleKey: game.titleKey, spec: game.overview }],
  );
}

/** Popis bez her s přehledem (seznam her bez přehledu): nic se nečte. */
const NO_SPEC: GameOverviewSpec = { maxNumber: 0, problemForms: [], operations: [], hints: false };

export function createParentOverview(options: ParentOverviewOptions): ParentOverview {
  const games = overviewGames(options.games);
  const today = options.today ?? (() => new Date());
  let open = false;
  let selected = 0;
  let page: OverviewPage = 'week';

  const emit = (event: OverviewFeedback): void => options.feedback?.(event);
  const selectedGame = (): OverviewGame | undefined => games[selected];

  return {
    isOpen: () => open,

    open(): void {
      open = true;
      selected = 0;
      page = 'week';
    },

    games: () =>
      games.map((game, index) => ({
        id: game.id,
        title: options.translate(game.titleKey),
        selected: index === selected,
      })),

    page: () => page,

    spec: () => selectedGame()?.spec ?? NO_SPEC,

    data(): GameOverview {
      const game = selectedGame();
      const spec = game?.spec ?? NO_SPEC;
      const storage = game === undefined ? undefined : options.gameStorage?.(game.id);
      return readGameOverview(storage, spec, today());
    },

    tapGame(index: number): void {
      if (!open || games[index] === undefined) {
        return;
      }
      if (index === selected) {
        emit({ kind: 'wobble', target: 'game', index });
        return;
      }
      selected = index;
      emit({ kind: 'select' });
    },

    tapPage(next: OverviewPage): void {
      if (!open) {
        return;
      }
      if (next === page) {
        emit({ kind: 'wobble', target: 'page', index: next === 'week' ? 0 : 1 });
        return;
      }
      page = next;
      emit({ kind: 'select' });
    },

    tapBack(): void {
      if (!open) {
        return;
      }
      open = false;
      emit({ kind: 'back' });
      options.onClosed?.();
    },
  };
}
