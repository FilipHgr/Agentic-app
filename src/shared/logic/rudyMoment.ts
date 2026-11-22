/**
 * Kdy se chvíle s pandou Rudym (#170: pozdrav, oslava) opravdu ukáže, bez
 * Phaseru. Okno potřebuje stažený klid (#169 AC5), pohyb repliky je lepší
 * mít taky. Hra nebo menu proto o chvíli požádá a okno se ukáže, až je
 * stažený klid i pohyb. Když se do `RUDY_WAIT_MS` stáhne aspoň klid, okno
 * se ukáže s klidem místo pohybu; bez klidu se chvíle vynechá a hra jde
 * dál, dítě nic nečeká. Oslava se stahuje dopředu, a tak čeká jen
 * `RUDY_CELEBRATION_WAIT_MS`. Odchod stránky na pozadí čekání zruší.
 * Čas (ms) dává volající.
 */

import type { RudyLineMove } from './rudy';

/** Nejdéle tak dlouho se čeká na stažení okna s pozdravem, než se chvíle vynechá. */
export const RUDY_WAIT_MS = 4000;

/** Oslava (stažená dopředu) čeká nejvýš tak dlouho, aby dítě po 10. hvězdičce nečekalo. */
export const RUDY_CELEBRATION_WAIT_MS = 1500;

/**
 * Čas (ms), podle kterého chvíle čeká: čas smyčky hry. Scéna bez načítání
 * (Porovnávání, #181) ale požádá o pozdrav ještě před prvním snímkem hry,
 * kdy je čas smyčky 0; pozdrav by pak při prvním snímku vypršel. Do té doby
 * platí čas stránky (`performance.now()`), ze stejných hodin jako snímky.
 */
export function rudyMomentTime(loopTime: number, pageTime: number): number {
  return loopTime > 0 ? loopTime : pageTime;
}

function waitMsFor(move: RudyLineMove): number {
  return move === 'celebrate' ? RUDY_CELEBRATION_WAIT_MS : RUDY_WAIT_MS;
}

/** Co má volající teď udělat: nic, čekat, ukázat okno, nebo chvíli vynechat. */
export type RudyMomentStep =
  | { readonly kind: 'none' }
  | { readonly kind: 'wait' }
  | { readonly kind: 'open'; readonly move: RudyLineMove }
  | { readonly kind: 'giveUp' };

/** Co je v okně stažené: klid a pohyb čekající repliky. */
export interface RudyLoaded {
  readonly idle: boolean;
  readonly move: boolean;
}

export interface RudyMomentGate {
  /**
   * Požádá o chvíli s pohybem `move` v čase `now`; nahradí čekající.
   * `waitMs` zkrátí čekání na stažení (zopakovaný pozdrav v menu, #173).
   */
  request(move: RudyLineMove, now: number, waitMs?: number): void;
  /** Čekající chvíle se neukáže. */
  cancel(): void;
  /**
   * Stránka odešla na pozadí: čekající chvíle se zruší. Vrátí `true`,
   * když nějaká čekala (volající ohlásí, že skončila bez okna).
   */
  pageHidden(): boolean;
  /** Pohyb čekající chvíle, `null` bez ní. */
  pending(): RudyLineMove | null;
  /** Posun času: rozhodne, jestli okno ukázat, čekat dál, nebo chvíli vynechat. */
  step(now: number, loaded: RudyLoaded): RudyMomentStep;
}

/** Ms od požádání; nesmyslný čas je 0 (limit neuplynul). */
function elapsedSince(requestedAt: number, now: number): number {
  const elapsed = now - requestedAt;
  return Number.isFinite(elapsed) && elapsed > 0 ? elapsed : 0;
}

export function createRudyMomentGate(): RudyMomentGate {
  let waiting: {
    readonly move: RudyLineMove;
    readonly requestedAt: number;
    readonly waitMs: number;
  } | null = null;

  return {
    request(move: RudyLineMove, now: number, waitMs?: number): void {
      const limit = waitMsFor(move);
      const shorter = waitMs !== undefined && Number.isFinite(waitMs) && waitMs < limit;
      waiting = { move, requestedAt: now, waitMs: shorter ? Math.max(0, waitMs) : limit };
    },

    cancel(): void {
      waiting = null;
    },

    pageHidden(): boolean {
      const wasWaiting = waiting !== null;
      waiting = null;
      return wasWaiting;
    },

    pending: () => waiting?.move ?? null,

    step(now: number, loaded: RudyLoaded): RudyMomentStep {
      if (waiting === null) {
        return { kind: 'none' };
      }
      const { move, requestedAt, waitMs } = waiting;
      const timedOut = elapsedSince(requestedAt, now) >= waitMs;
      if (loaded.idle && (loaded.move || timedOut)) {
        waiting = null;
        return { kind: 'open', move };
      }
      if (timedOut) {
        waiting = null;
        return { kind: 'giveUp' };
      }
      return { kind: 'wait' };
    },
  };
}
