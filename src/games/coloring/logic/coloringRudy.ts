/**
 * Kdy panda Rudy v Omalovánkách přijde (#175), bez Phaseru. Okno, stažení
 * a hlas řeší sdílené `RudyMoments`; tady se jen rozhoduje, o kterou chvíli
 * hra požádá:
 *
 * - Pozdrav (mávání) jednou po otevření Omalovánek, na výběru obrázku.
 * - Pochvala (oslava) po uložení obrázku do alba fotoaparátem. Zarezervuje
 *   se už při cvaku (`reservePraise`) a čeká na uložení a doběhnutí odletu
 *   fotky; jakýkoli dotyk od cvaku do otevření okna ji vynechá, aby okno
 *   nevyskočilo uprostřed tahu. Dvě repliky se střídají a pochvala přijde
 *   nejvýš jednou za `RUDY_PRAISE_INTERVAL_MS`.
 *   Počítá se od chvíle, kdy se okno opravdu ukázalo; vynechaná pochvala
 *   (nestažené okno, dítě začalo malovat) se nepočítá a příště přijde tatáž.
 * - Když se dítě dotkne hry dřív, než se čekající okno stáhne (začne
 *   malovat nebo vybírat), chvíle se vynechá, aby okno nevyskočilo
 *   uprostřed hraní (jako v Počítání, #170).
 * - Najednou čeká nebo je otevřená nejvýš jedna chvíle.
 *
 * Čas (ms) dává volající. Stav platí pro jedno otevření Omalovánek
 * (výběr i všechna malování z něj).
 */

import type { RudyLineMove } from '../../../shared/logic/rudy';
import { COLORING_RUDY_PRAISES } from './rudyLines';
import type { ColoringRudyLine } from './rudyLines';

/** Pochvala obrázku v albu přijde nejvýš jednou za 2 minuty. */
export const RUDY_PRAISE_INTERVAL_MS = 2 * 60 * 1000;

/** O jakou chvíli hra požádá: pohyb okna a replika. */
export interface ColoringRudyMoment {
  readonly kind: 'greeting' | 'praise';
  readonly move: RudyLineMove;
  readonly line: ColoringRudyLine;
}

export interface ColoringRudy {
  /** Výběr obrázku se ukázal: pozdrav jen poprvé, pak `null`. */
  greeting(): ColoringRudyMoment | null;
  /**
   * Cvak fotoaparátu: zarezervuje pochvalu, která čeká na uložení
   * a animaci; `null`, když od poslední neuplynuly 2 minuty nebo jiná
   * chvíle čeká či je otevřená.
   */
  reservePraise(now: number): ColoringRudyMoment | null;
  /** Čeká chvíle `moment` pořád (nikdo ji nevynechal ani nezrušil)? */
  isWaiting(moment: ColoringRudyMoment): boolean;
  /** Chvíle `moment` nepřijde (uložení se nepovedlo); nic se nepočítá. */
  withdraw(moment: ColoringRudyMoment): void;
  /** Pochvala, která by přišla teď (ke stažení dopředu); nic nemění. */
  upcomingPraise(now: number): ColoringRudyMoment | null;
  /** Okno čekající chvíle se ukázalo v čase `now`. */
  opened(now: number): void;
  /** Okno se zavřelo, nebo se chvíle vynechala (nestáhla se včas). */
  closed(): void;
  /**
   * Dítě se dotklo hry. Vrátí `true`, když tím vynechalo čekající chvíli
   * (volající zruší čekání okna).
   */
  childActed(): boolean;
  /** Scéna s chvílí skončila: chvíle se zapomene, nic se nepočítá. */
  cancel(): void;
}

type MomentState = { readonly moment: ColoringRudyMoment; readonly open: boolean } | null;

export function createColoringRudy(): ColoringRudy {
  let greeted = false;
  let current: MomentState = null;
  let lastPraiseAt: number | null = null;
  let nextPraiseIndex = 0;

  function praiseDue(now: number): boolean {
    if (lastPraiseAt === null) {
      return true;
    }
    const elapsed = now - lastPraiseAt;
    // Nesmyslný čas (hodiny šly pozpátku) pochvalu nepovolí, limit platí dál.
    return Number.isFinite(elapsed) && elapsed >= RUDY_PRAISE_INTERVAL_MS;
  }

  function nextPraise(): ColoringRudyMoment {
    const line =
      COLORING_RUDY_PRAISES[nextPraiseIndex % COLORING_RUDY_PRAISES.length] ?? 'praiseBeautiful';
    return { kind: 'praise', move: 'celebrate', line };
  }

  return {
    greeting() {
      if (greeted || current !== null) {
        return null;
      }
      greeted = true;
      const moment: ColoringRudyMoment = { kind: 'greeting', move: 'wave', line: 'greeting' };
      current = { moment, open: false };
      return moment;
    },

    reservePraise(now) {
      if (current !== null || !praiseDue(now)) {
        return null;
      }
      const moment = nextPraise();
      current = { moment, open: false };
      return moment;
    },

    upcomingPraise(now) {
      return current === null && praiseDue(now) ? nextPraise() : null;
    },

    opened(now) {
      if (current === null || current.open) {
        return;
      }
      current = { moment: current.moment, open: true };
      if (current.moment.kind === 'praise') {
        lastPraiseAt = now;
        nextPraiseIndex += 1;
      }
    },

    isWaiting(moment) {
      return current !== null && current.moment === moment && !current.open;
    },

    withdraw(moment) {
      if (current !== null && current.moment === moment) {
        current = null;
      }
    },

    closed() {
      current = null;
    },

    childActed() {
      if (current === null || current.open) {
        return false;
      }
      current = null;
      return true;
    },

    cancel() {
      current = null;
    },
  };
}

/** Co udělat s pochvalou zarezervovanou při cvaku: čekat, ukázat okno, nebo nic. */
export type CameraPraiseStep = 'wait' | 'show' | 'skip';

export interface CameraPraise {
  /** Ukládání skončilo: obrázek je v albu (`saved`), nebo se neuložil. */
  saveFinished(saved: boolean): CameraPraiseStep;
  /** Cvak a odlet fotky doběhly (nebo se animace přerušila). */
  photoEnded(): CameraPraiseStep;
}

/**
 * Pořadí pochvaly po cvaku (#175 AC2): okno se ukáže, až se obrázek uloží
 * a doběhne animace fotky, v libovolném pořadí, a jen jednou. Neuložený
 * obrázek pochvalu zruší (limit se nezapočítá); dotyk od cvaku pochvalu
 * vynechá (`childActed`), takže pak už nic nepřijde.
 */
export function trackCameraPraise(rudy: ColoringRudy, moment: ColoringRudyMoment): CameraPraise {
  let saved: boolean | null = null;
  let photoDone = false;
  let decided = false;

  function step(): CameraPraiseStep {
    if (decided) {
      return 'skip';
    }
    if (saved === false || !rudy.isWaiting(moment)) {
      decided = true;
      rudy.withdraw(moment);
      return 'skip';
    }
    if (saved === null || !photoDone) {
      return 'wait';
    }
    decided = true;
    return 'show';
  }

  return {
    saveFinished(result) {
      saved = result;
      return step();
    },
    photoEnded() {
      photoDone = true;
      return step();
    },
  };
}
