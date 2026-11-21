/**
 * Kdy Rudy v menu pozdraví (#170 AC4), bez Phaseru. Pozdrav je při prvním
 * ukázání menu po načtení stránky (po výběru profilu, pokud se ukazuje)
 * a po návratu ze hry jen tehdy, když od posledního pozdravu na téže
 * stránce uběhlo aspoň 10 minut. Další ukázání menu (po změně profilu)
 * ani změna jazyka nepozdraví. Paměť je jen pro toto načtení stránky,
 * nic se neukládá. Čas (ms) dává volající.
 */

/** Po návratu ze hry pozdraví Rudy znovu až po takové době od posledního pozdravu. */
export const MENU_GREETING_PAUSE_MS = 10 * 60 * 1000;

/**
 * Proč se menu ukázalo: `shown` menu je vidět (start stránky, zavření
 * výběru profilu), `returnedFromGame` návrat ze hry domečkem.
 */
export type MenuShownReason = 'shown' | 'returnedFromGame';

export interface MenuGreeting {
  /** Menu se ukázalo; vrátí, jestli má Rudy pozdravit. */
  menuShown(reason: MenuShownReason, now: number): boolean;
  /** Okno s pozdravem se opravdu ukázalo v čase `now`. */
  greeted(now: number): void;
}

export function createMenuGreeting(): MenuGreeting {
  let firstShowDone = false;
  let lastGreetingAt: number | null = null;

  function pauseIsOver(now: number): boolean {
    if (lastGreetingAt === null) {
      return true;
    }
    const elapsed = now - lastGreetingAt;
    return Number.isFinite(elapsed) && elapsed >= MENU_GREETING_PAUSE_MS;
  }

  return {
    menuShown(reason: MenuShownReason, now: number): boolean {
      if (reason === 'returnedFromGame') {
        return pauseIsOver(now);
      }
      if (firstShowDone) {
        return false;
      }
      firstShowDone = true;
      return true;
    },

    greeted(now: number): void {
      lastGreetingAt = now;
    },
  };
}
