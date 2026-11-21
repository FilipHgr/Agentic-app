/**
 * Okno s pandou Rudym (#169) bez Phaseru: co je v okně v daném čase vidět,
 * kdy se okno samo zavře, kdy ho zavře ťuknutí a které pohyby se kdy
 * stáhnou a uvolní z paměti.
 *
 * Průběh okna (AC3): panda přehraje pohyb repliky (pozdrav nebo oslava,
 * asi 3,1 s), pak mluví (pohyb „mluví“ dokola), dokud nevyprší délka
 * repliky, a okno se zavře 0,2 s po jejím konci, nejpozději 6 s od
 * otevření. Bez délky repliky (zatím bez hlasu) panda po pohybu stojí
 * v klidu a okno je otevřené 3,5 s.
 *
 * Paměť (AC5): klid je v paměti stále, vedle něj nejvýš jeden další pohyb.
 * Nový pohyb vystřídá ten předchozí (stažený se uvolní hned, stahovaný po
 * dočtení). Nestažený pohyb panda nahradí klidem a okno nečeká; bez
 * staženého klidu se okno vůbec neukáže.
 *
 * Stahování řídí model příkazy (`RudyCommand`), pohled je jen vykoná
 * a zpátky ohlásí dočtení (`loaded`) nebo chybu (`failed`). Čas (ms) dává
 * volající, model sám čas nečte.
 */

import { loopFrameAt, onceFrameAt, rudyMoveDurationMs } from './rudy';
import type { RudyFrame, RudyLineMove, RudyMove } from './rudy';

/** Časy okna v ms (AC3, AC4). */
export const RUDY_WINDOW_TIMES = {
  /** Tak dlouho od otevření ťuknutí okno nezavře, aby ho dítě nezavřelo omylem. */
  tapLockMs: 1000,
  /** Nejdéle otevřené okno. */
  maxOpenMs: 6000,
  /** Okno bez délky repliky (bez hlasu). */
  silentOpenMs: 3500,
  /** Okno se zavře tak dlouho po konci repliky (nejvýš 0,3 s). */
  closeAfterLineMs: 200,
} as const;

/** Co má okno ukázat: pohyb repliky a volitelně délku repliky (nahrávky) v ms. */
export interface RudyWindowRequest {
  readonly move: RudyLineMove;
  readonly lineMs?: number;
}

/** Co ťuknutí do okna udělalo. */
export type RudyTapResult = 'closed' | 'tooEarly' | 'none';

/** Co má pohled udělat: stáhnout pohyb, nebo uvolnit jeho texturu. */
export interface RudyCommand {
  readonly type: 'download' | 'release';
  readonly move: RudyMove;
}

export interface RudyWindowModel {
  /** Okno vzniklo: stáhne se klid, pokud ještě není. */
  use(): RudyCommand[];
  /** Pohyb se stáhne dopředu a vystřídá v paměti předchozí pohyb kromě klidu. */
  prepare(move: RudyMove): RudyCommand[];
  /**
   * Otevře okno v čase `now`. Neukáže se (`shown: false`), když není
   * stažený klid nebo je okno už otevřené. Nestažený pohyb repliky se stáhne.
   */
  open(request: RudyWindowRequest, now: number): { shown: boolean; commands: RudyCommand[] };
  /**
   * Ťuknutí do okna: po 1 s ho zavře (`closed`), dřív ho nezavře
   * (`tooEarly`, karta se jen zhoupne); bez okna `none`.
   */
  tap(now: number): RudyTapResult;
  /** Zavření zvenku (třeba odchod stránky na pozadí); `true`, když bylo otevřené. */
  close(): boolean;
  /** Posun času: po pohybu repliky se stáhne mluvení, po čase se okno zavře. */
  update(now: number): { closed: boolean; commands: RudyCommand[] };
  isOpen(): boolean;
  /** Je stažený klid (okno se může ukázat)? */
  isReady(): boolean;
  /** Je pohyb stažený a dekódovaný? */
  isLoaded(move: RudyMove): boolean;
  /** Snímek pandy v čase `now`, `null` když okno není otevřené. */
  frame(now: number): RudyFrame | null;
  /** Pohled ohlásil, že je pohyb stažený a dekódovaný. */
  loaded(move: RudyMove): RudyCommand[];
  /** Pohled ohlásil chybu stažení; příští vyžádání stažení zkusí znovu. */
  failed(move: RudyMove): void;
  /** Konec okna: uvolní všechno, co je v paměti. */
  dispose(): RudyCommand[];
}

type LoadState = 'none' | 'loading' | 'loaded';

interface OpenWindow {
  readonly openedAt: number;
  readonly move: RudyLineMove;
  /** Hraje se pohyb repliky? Jen když byl při otevření stažený (okno nečeká). */
  readonly playsMove: boolean;
  /** Kdy (ms od otevření) končí replika, `null` bez hlasu. */
  readonly lineEndMs: number | null;
  readonly closeAtMs: number;
}

const IDLE: RudyMove = 'idle';
const TALK: RudyMove = 'talk';

function download(move: RudyMove): RudyCommand {
  return { type: 'download', move };
}

function release(move: RudyMove): RudyCommand {
  return { type: 'release', move };
}

/** Délka repliky, jen když dává smysl (kladné číslo), jinak `null` (bez hlasu). */
function validLineMs(lineMs: number | undefined): number | null {
  if (lineMs === undefined || Number.isNaN(lineMs) || lineMs <= 0) {
    return null;
  }
  return lineMs;
}

/** Kdy se okno zavře (ms od otevření): po replice, nejpozději po 6 s. */
function closeAtFor(lineEndMs: number | null): number {
  if (lineEndMs === null) {
    return RUDY_WINDOW_TIMES.silentOpenMs;
  }
  return Math.min(lineEndMs + RUDY_WINDOW_TIMES.closeAfterLineMs, RUDY_WINDOW_TIMES.maxOpenMs);
}

/** Ms od otevření okna; nesmyslný nebo záporný čas je 0. */
function elapsedSince(openedAt: number, now: number): number {
  const elapsed = now - openedAt;
  return Number.isFinite(elapsed) && elapsed > 0 ? elapsed : 0;
}

export function createRudyWindowModel(): RudyWindowModel {
  let idleState: LoadState = 'none';
  /** Jediný další pohyb v paměti vedle klidu (stažený nebo stahovaný). */
  let other: { readonly move: RudyMove; state: LoadState } | null = null;
  /** Vystřídané pohyby, které se ještě stahují: po dočtení se hned uvolní. */
  const discarded = new Set<RudyMove>();
  let shown: OpenWindow | null = null;
  let disposed = false;

  const isLoaded = (move: RudyMove): boolean => {
    if (disposed) {
      return false;
    }
    if (move === IDLE) {
      return idleState === 'loaded';
    }
    return other?.move === move && other.state === 'loaded';
  };

  function downloadIdle(): RudyCommand[] {
    if (disposed || idleState !== 'none') {
      return [];
    }
    idleState = 'loading';
    return [download(IDLE)];
  }

  /** Udělá z `move` jediný další pohyb v paměti; předchozí se uvolní. */
  function makeOther(move: RudyMove): RudyCommand[] {
    if (other?.move === move && other.state !== 'none') {
      return [];
    }
    const commands: RudyCommand[] = [];
    if (other !== null && other.move !== move) {
      if (other.state === 'loaded') {
        commands.push(release(other.move));
      } else if (other.state === 'loading') {
        discarded.add(other.move);
      }
    }
    if (discarded.delete(move)) {
      // Pohyb se ještě stahuje z dřívějška: nestahuje se podruhé.
      other = { move, state: 'loading' };
      return commands;
    }
    other = { move, state: 'loading' };
    commands.push(download(move));
    return commands;
  }

  function prepare(move: RudyMove): RudyCommand[] {
    if (disposed) {
      return [];
    }
    return move === IDLE ? downloadIdle() : makeOther(move);
  }

  /** Má se teď stáhnout mluvení? Po pohybu repliky, dokud replika běží. */
  function needsTalk(window: OpenWindow, elapsed: number): boolean {
    return (
      window.lineEndMs !== null &&
      elapsed >= rudyMoveDurationMs() &&
      elapsed < window.lineEndMs &&
      other?.move !== TALK
    );
  }

  function frameIn(window: OpenWindow, now: number): RudyFrame {
    const elapsed = elapsedSince(window.openedAt, now);
    const moveMs = rudyMoveDurationMs();
    if (elapsed < moveMs && window.playsMove && isLoaded(window.move)) {
      return { move: window.move, frame: onceFrameAt(elapsed) };
    }
    const talking = window.lineEndMs !== null && elapsed >= moveMs && elapsed < window.lineEndMs;
    if (talking && isLoaded(TALK)) {
      return { move: TALK, frame: loopFrameAt(elapsed - moveMs) };
    }
    return { move: IDLE, frame: loopFrameAt(elapsed) };
  }

  return {
    use: () => downloadIdle(),

    prepare,

    open(request, now) {
      if (disposed || shown !== null) {
        return { shown: false, commands: [] };
      }
      if (!isLoaded(IDLE)) {
        return { shown: false, commands: downloadIdle() };
      }
      const lineEndMs = validLineMs(request.lineMs);
      const playsMove = isLoaded(request.move);
      shown = {
        openedAt: now,
        move: request.move,
        playsMove,
        lineEndMs,
        closeAtMs: closeAtFor(lineEndMs),
      };
      return { shown: true, commands: playsMove ? [] : makeOther(request.move) };
    },

    tap(now) {
      if (shown === null) {
        return 'none';
      }
      if (elapsedSince(shown.openedAt, now) < RUDY_WINDOW_TIMES.tapLockMs) {
        return 'tooEarly';
      }
      shown = null;
      return 'closed';
    },

    close() {
      const wasOpen = shown !== null;
      shown = null;
      return wasOpen;
    },

    update(now) {
      if (shown === null || disposed) {
        return { closed: false, commands: [] };
      }
      const elapsed = elapsedSince(shown.openedAt, now);
      if (elapsed >= shown.closeAtMs) {
        shown = null;
        return { closed: true, commands: [] };
      }
      return { closed: false, commands: needsTalk(shown, elapsed) ? makeOther(TALK) : [] };
    },

    isOpen: () => shown !== null,

    isReady: () => isLoaded(IDLE),

    isLoaded,

    frame(now) {
      if (shown === null || !isLoaded(IDLE)) {
        return null;
      }
      return frameIn(shown, now);
    },

    loaded(move) {
      if (disposed) {
        return [release(move)];
      }
      if (move === IDLE) {
        idleState = 'loaded';
        return [];
      }
      if (other?.move === move && other.state === 'loading') {
        other.state = 'loaded';
        return [];
      }
      discarded.delete(move);
      return [release(move)];
    },

    failed(move) {
      if (move === IDLE) {
        idleState = idleState === 'loaded' ? 'loaded' : 'none';
        return;
      }
      discarded.delete(move);
      if (other?.move === move && other.state === 'loading') {
        other = null;
      }
    },

    dispose() {
      const commands: RudyCommand[] = [];
      if (idleState === 'loaded') {
        commands.push(release(IDLE));
      }
      if (other?.state === 'loaded') {
        commands.push(release(other.move));
      }
      idleState = 'none';
      other = null;
      shown = null;
      disposed = true;
      return commands;
    },
  };
}
