/**
 * Kdy panda v menu co dělá (#168). Čistý TypeScript bez Phaseru; scéna
 * hlásí, proč se menu ukázalo, jestli má panda místo a jaké pohyby jsou
 * stažené, a pohyb pandě přehraje sdílenou pandou (#166).
 *
 * - Po otevření menu a po návratu ze hry panda jednou zamává, pak je
 *   v klidu (klid hraje sdílená panda sama). Po změně profilu nebo jazyka
 *   nezamává (AC3).
 * - Pozdrav čeká, až je panda vidět (stažený klid). Když se pozdrav do
 *   2 s od té chvíle nestáhne, vynechá se, aby panda nemávala pozdě.
 * - Ťuknutí na pandu zahraje radost; během radosti se pohyb nepřeruší
 *   ani nezačne znovu, zazní jen tón (AC4). Ťuknutí během pozdravu ho
 *   ukončí radostí.
 * - Když místo pro pandu zmizí (otočení, víc her), pozdrav se vynechá
 *   a v paměti zůstane jen klid, aby se panda po otočení zpět hned ukázala.
 */

import type { MascotMove } from '../../shared/logic/mascot';

/** Proč se menu ukázalo. */
export type MenuShownReason = 'opened' | 'returnedFromGame' | 'profileChosen' | 'languageChanged';

/** Jak dlouho smí pozdrav čekat na stažení od ukázání pandy (ms). */
export const MENU_GREETING_WAIT_MS = 2000;

/** Které pohyby jsou stažené (klid je potřeba, aby panda byla vidět). */
export interface MenuMascotReady {
  readonly idle: boolean;
  readonly wave: boolean;
}

export interface MenuMascotCues {
  /** Menu je vidět: po otevření a po návratu ze hry panda zamává. */
  menuShown(reason: MenuShownReason, now: number): void;
  /** Pro pandu není místo (nebo menu zmizelo): rozběhnutý pozdrav se vynechá. */
  placeLost(): void;
  /** Ťuknutí na pandu, která právě hraje `current`: pohyb, který začne, nebo `null`. */
  tapped(current: MascotMove, now: number): MascotMove | null;
  /** Každý snímek: `wave`, když má teď začít pozdrav, jinak `null`. */
  step(now: number, ready: MenuMascotReady): MascotMove | null;
  /**
   * Pohyby, které mají být v paměti: s místem klid, radost a čekající
   * pozdrav, bez místa jen klid. Ostatní se uvolní.
   */
  preparedMoves(placed: boolean): MascotMove[];
}

const WAVING_REASONS: readonly MenuShownReason[] = ['opened', 'returnedFromGame'];

/** Pozdrav: žádný, čeká na ukázání pandy, čeká na stažení od `since`. */
type Greeting =
  | { readonly phase: 'none' }
  | { readonly phase: 'hidden' }
  | { readonly phase: 'waiting'; readonly since: number };

const NO_GREETING: Greeting = { phase: 'none' };

export function createMenuMascotCues(): MenuMascotCues {
  let greeting: Greeting = NO_GREETING;

  return {
    menuShown(reason) {
      if (WAVING_REASONS.includes(reason)) {
        greeting = { phase: 'hidden' };
      }
    },

    placeLost() {
      greeting = NO_GREETING;
    },

    tapped(current) {
      greeting = NO_GREETING;
      return current === 'joy' ? null : 'joy';
    },

    step(now, ready) {
      if (greeting.phase === 'none') {
        return null;
      }
      if (!ready.idle) {
        // Panda ještě není vidět; 2 s se počítají až od jejího ukázání.
        greeting = { phase: 'hidden' };
        return null;
      }
      if (greeting.phase === 'hidden') {
        greeting = { phase: 'waiting', since: now };
      }
      if (ready.wave) {
        greeting = NO_GREETING;
        return 'wave';
      }
      if (now - greeting.since > MENU_GREETING_WAIT_MS) {
        greeting = NO_GREETING;
      }
      return null;
    },

    preparedMoves(placed) {
      if (!placed) {
        return ['idle'];
      }
      return greeting.phase === 'none' ? ['idle', 'joy'] : ['idle', 'wave', 'joy'];
    },
  };
}
