/**
 * Listování po stránkách (#149 v albu, #150 na výběru omalovánky), čistá
 * logika bez Phaseru. Album i výběr listují stejně:
 * - šipky ◀ ▶ nalistují předchozí nebo další stránku; na krajní stránce se
 *   šipka zhoupne s tónem domečku, při jediné stránce šipky nejsou,
 * - tah prstem (aspoň 48 CSS px vodorovně a víc než svisle) doleva ukáže
 *   další stránku a doprava předchozí; na kraji a při jediné stránce se
 *   náhledy zhoupnou s tónem domečku,
 * - kratší posun je ťuknutí na místo náhledu, kde prst začal,
 * - po nalistování se do `pageShown` ťuknutí ani další listování nepočítá,
 *   ani dotyk začatý během listování,
 * - jeden tah nalistuje jen o jednu stránku, i když se dotýkají dva prsty.
 *
 * Stránku drží ten, kdo listování používá (`page`, `showPage`); listování
 * drží jen prsty a to, jestli se právě listuje.
 */

import type { Tone } from '../../../shared/audio/tonePlayer';
import { HOME_WOBBLE_TONES } from '../../../shared/logic/homeButton';

/** Kam se listuje: na další (▶, tah doleva), nebo předchozí stránku (◀, tah doprava). */
export type AlbumDirection = 'next' | 'previous';

/** Bod dotyku v CSS px okna (#149). */
export interface AlbumPoint {
  readonly x: number;
  readonly y: number;
}

/** Co udělá šipka nebo tah (#149 AC1, #150 AC1). */
export type AlbumTurn =
  /** Nalistuje stránku `page` s tónem ťuknutí; scéna ji ukáže a zavolá „stránka je vidět“. */
  | {
      readonly kind: 'turned';
      readonly page: number;
      readonly direction: AlbumDirection;
      readonly tones: readonly Tone[];
    }
  /** Na krajní stránce se zhoupne šipka (`arrow`), nebo náhledy po tahu (`previews`). */
  | {
      readonly kind: 'edge';
      readonly wobble: 'arrow' | 'previews';
      readonly tones: readonly Tone[];
    }
  /** Mimo stránky, při jediné stránce (šipky) nebo během listování nic. */
  | { readonly kind: 'ignored' };

/** Nejmenší vodorovný posun prstu v CSS px, který je tah, ne ťuknutí (#149 AC1). */
export const ALBUM_SWIPE_MIN_CSS = 48;

/** Počet stránek pro `itemCount` položek po `pageSize` (bez položek žádná). */
export function pageCountOf(itemCount: number, pageSize: number): number {
  return Math.ceil(Math.max(0, itemCount) / pageSize);
}

/** Položky stránky `page` (0 je 1. stránka) po `pageSize`. */
export function pageItemsOf<T>(items: readonly T[], page: number, pageSize: number): readonly T[] {
  return items.slice(page * pageSize, (page + 1) * pageSize);
}

export interface PageTurnerOptions {
  /** Jsou stránky vidět (album, nebo výběr)? Jinak listování nic nedělá. */
  readonly isActive: () => boolean;
  readonly pageCount: () => number;
  /** Stránka, která je vidět (0 je 1. stránka). */
  readonly page: () => number;
  /** Nalistovaná stránka, kterou má držitel stránky ukázat. */
  readonly showPage: (page: number) => void;
  /** Tón nalistování. */
  readonly turnTones: readonly Tone[];
}

export interface PageTurner {
  /** Ťuknutí na šipku ◀ (`previous`), nebo ▶ (`next`). */
  arrow(direction: AlbumDirection): AlbumTurn;
  /** Prst `pointerId` se dotkl v bodě `point` (CSS px) na místě náhledu `place`, nebo mimo (`null`). */
  pointerDown(pointerId: number, point: AlbumPoint, place: number | null): void;
  /**
   * Prst `pointerId` se zvedl v bodě `point` (CSS px): tah nalistuje,
   * ťuknutí na místo náhledu předá `tapPlace`.
   */
  pointerUp<Tap>(
    pointerId: number,
    point: AlbumPoint,
    tapPlace: (place: number) => Tap,
  ): AlbumTurn | Tap;
  /**
   * Prohlížeč dotyk zrušil (pointercancel, touchcancel, odchod z okna):
   * prst `pointerId` se zapomene, bez čísla všechny. Zvednutí se pak nepočítá.
   */
  pointerCancel(pointerId?: number): void;
  /** Scéna ukázala nalistovanou stránku. */
  pageShown(): void;
  /** Listuje se (nová stránka ještě není vidět)? */
  isTurning(): boolean;
  /** Zapomene prsty, které se dotkly (otevřel se náhled). */
  forgetPointers(): void;
  /** Stránky se ukazují znovu: neprobíhá listování a žádný prst se nepočítá. */
  reset(): void;
}

/** Je posun prstu o `dx`, `dy` CSS px tah (aspoň 48 px vodorovně a víc než svisle)? */
function isSwipe(dx: number, dy: number): boolean {
  return Math.abs(dx) >= ALBUM_SWIPE_MIN_CSS && Math.abs(dx) > Math.abs(dy);
}

export function createPageTurner(options: PageTurnerOptions): PageTurner {
  let turning = false;
  /** Prsty, které se dotkly a ještě se nezvedly: kde začaly a na kterém místě náhledu. */
  const pointers = new Map<number, { readonly point: AlbumPoint; readonly place: number | null }>();

  /**
   * Nalistuje směrem `direction`. Na kraji se zhoupne šipka nebo náhledy
   * (`wobble`) s tónem domečku. Šipky při jediné stránce nejsou; tah při
   * jediné stránce zhoupne náhledy.
   */
  const turn = (direction: AlbumDirection, wobble: 'arrow' | 'previews'): AlbumTurn => {
    if (!options.isActive() || turning) {
      return { kind: 'ignored' };
    }
    const pageCount = options.pageCount();
    if (wobble === 'arrow' && pageCount <= 1) {
      return { kind: 'ignored' };
    }
    // Po tahu i šipce se zvednutí ostatních prstů už nepočítá: dva prsty nalistují jen jednou.
    pointers.clear();
    const page = options.page() + (direction === 'next' ? 1 : -1);
    if (page < 0 || page >= pageCount) {
      return { kind: 'edge', wobble, tones: HOME_WOBBLE_TONES };
    }
    options.showPage(page);
    turning = true;
    return { kind: 'turned', page, direction, tones: options.turnTones };
  };

  return {
    arrow: (direction) => turn(direction, 'arrow'),
    pointerDown: (pointerId, point, place) => {
      // Dotyk začatý během listování se nepočítá ani po dolistování (#149 AC5).
      if (options.isActive() && !turning) {
        pointers.set(pointerId, { point, place });
      }
    },
    pointerUp: (pointerId, point, tapPlace) => {
      const start = pointers.get(pointerId);
      pointers.delete(pointerId);
      if (start === undefined || !options.isActive()) {
        return { kind: 'ignored' };
      }
      const dx = point.x - start.point.x;
      const dy = point.y - start.point.y;
      if (isSwipe(dx, dy)) {
        // Tah doleva ukáže další stránku, tah doprava předchozí.
        return turn(dx < 0 ? 'next' : 'previous', 'previews');
      }
      if (start.place === null) {
        return { kind: 'ignored' };
      }
      return tapPlace(start.place);
    },
    pointerCancel: (pointerId) => {
      if (pointerId === undefined) {
        pointers.clear();
        return;
      }
      pointers.delete(pointerId);
    },
    pageShown: () => {
      turning = false;
    },
    isTurning: () => turning,
    forgetPointers: () => pointers.clear(),
    reset: () => {
      turning = false;
      pointers.clear();
    },
  };
}
