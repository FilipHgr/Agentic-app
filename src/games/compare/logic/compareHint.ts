/**
 * Nápověda Porovnávání (#180): po 2. špatném ťuknutí v příkladu se tečky
 * obou karet spojí do dvojic jedna k jedné (první tečka vlevo s první
 * vpravo, druhá s druhou…) a tečky bez dvojice se rozsvítí. Dítě tak
 * uvidí, kde jich zbylo víc; při stejném počtu má dvojici každá tečka.
 *
 * Tečky zůstanou na svém místě (nic se neposune). S volbou „čísla“ se pod
 * čísly objeví tečky jako u volby „tečky s číslem“ (číslo jde do pruhu
 * pod tečkami). Spojení dvojic zůstane po spárování vidět jako jemná čára
 * pod tečkami. Čistý TypeScript bez Phaseru: scéna jen nakreslí obrázek
 * a spojuje dvojice podle `playHintPairing`.
 */

import { cardDots, cardNumeral } from './compareLayout';
import type { CardLook, CompareLayout, Dot, Numeral, Point, Rect } from './compareLayout';
import type { CompareProblem } from './compareProblems';

/** Po kolika špatných ťuknutích v jednom příkladu se nápověda ukáže. */
export const HINT_AFTER_MISTAKES = 2;

/** Odstup mezi spojením dvou dvojic: nejvíc, a nejméně, aby šla vidět každá zvlášť. */
export const PAIR_STEP_MAX_MS = 220;
export const PAIR_STEP_MIN_MS = 90;
/** Poslední dvojice se začne spojovat nejpozději takhle brzy (i při 20 dvojicích). */
export const PAIRING_MAX_MS = 1800;
/** Tečky bez dvojice se rozsvítí chvíli po spojení poslední dvojice. */
const LIGHT_AFTER_LAST_PAIR_MS = 240;

/**
 * Záře kolem tečky jako násobek jejího poloměru (největší, i když září
 * pulzuje). Tečka má 0,4 políčka, záře 0,48: menší než půl políčka, takže
 * se záře sousedních teček nikdy nedotknou ani na telefonu na výšku.
 */
const GLOW_RADIUS_FACTOR = 1.2;

/** Tečka v dvojici, nebo tečka bez dvojice, která se rozsvítí. */
export type HintDotRole = 'paired' | 'extra';

export interface HintDot extends Dot {
  readonly role: HintDotRole;
  /** Pořadí dvojice (od 0), u tečky bez dvojice `null`. */
  readonly pair: number | null;
  /** Největší poloměr záře nebo kroužku kolem tečky. */
  readonly glowRadius: number;
}

/** Spojení dvojice: od tečky na levé kartě k tečce na pravé. */
export interface HintLink {
  readonly pair: number;
  readonly from: Point;
  readonly to: Point;
}

export interface CompareHintPicture {
  /** Tečky levé a pravé karty v pořadí po pěti. */
  readonly cards: readonly [HintDot[], HintDot[]];
  readonly links: HintLink[];
  /** Číslo na levé a pravé kartě (s volbou „tečky“ žádné). */
  readonly numerals: readonly [Numeral | null, Numeral | null];
}

/** Jak karta vypadá s nápovědou: místo samotného čísla tečky s číslem pod nimi. */
export function lookWithHint(look: CardLook): CardLook {
  return look.show === 'numbers' ? { ...look, show: 'both' } : look;
}

/**
 * Kdy se začne spojovat která dvojice (ms od ukázání nápovědy): první
 * hned, další po stejném odstupu, aby celé spárování netrvalo dlouho.
 */
export function pairStartTimes(pairs: number): number[] {
  if (pairs <= 0) {
    return [];
  }
  const step =
    pairs === 1
      ? 0
      : Math.max(
          PAIR_STEP_MIN_MS,
          Math.min(PAIR_STEP_MAX_MS, Math.floor(PAIRING_MAX_MS / (pairs - 1))),
        );
  return Array.from({ length: pairs }, (_, index) => index * step);
}

/** Tečky jedné karty s rolí: prvních `pairs` je v dvojicích, zbytek bez dvojice. */
function hintDotsOf(dots: readonly Dot[], pairs: number): HintDot[] {
  return dots.map((dot, index) => ({
    ...dot,
    role: index < pairs ? 'paired' : 'extra',
    pair: index < pairs ? index : null,
    glowRadius: dot.radius * GLOW_RADIUS_FACTOR,
  }));
}

/** Obrázek nápovědy pro rozehraný příklad v rozložení obrazovky. */
export function hintPicture(
  layout: CompareLayout,
  problem: CompareProblem,
  look: CardLook,
): CompareHintPicture {
  const hintLook = lookWithHint(look);
  const pairs = Math.min(problem.left, problem.right);
  const [leftCard, rightCard] = layout.cards;
  const left = hintDotsOf(cardDots(leftCard, problem.left, layout.dotGroups, hintLook), pairs);
  const right = hintDotsOf(cardDots(rightCard, problem.right, layout.dotGroups, hintLook), pairs);
  const links: HintLink[] = [];
  for (let pair = 0; pair < pairs; pair += 1) {
    const from = left[pair];
    const to = right[pair];
    if (from && to) {
      links.push({ pair, from: { x: from.x, y: from.y }, to: { x: to.x, y: to.y } });
    }
  }
  return {
    cards: [left, right],
    links,
    numerals: [cardNumeral(leftCard, hintLook), cardNumeral(rightCard, hintLook)],
  };
}

/**
 * Část úsečky uvnitř obdélníku (Liang–Barsky), nebo `null`, když jím
 * neprochází. Scéna tak kreslí spojení dvojice na kartě pod tečkami.
 */
export function clipSegment(
  from: Point,
  to: Point,
  rect: Rect,
): { readonly from: Point; readonly to: Point } | null {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const edges: Array<readonly [number, number]> = [
    [-dx, from.x - rect.left],
    [dx, rect.left + rect.width - from.x],
    [-dy, from.y - rect.top],
    [dy, rect.top + rect.height - from.y],
  ];
  let start = 0;
  let end = 1;
  for (const [direction, distance] of edges) {
    if (direction === 0) {
      if (distance < 0) {
        return null;
      }
      continue;
    }
    const ratio = distance / direction;
    if (direction < 0) {
      start = Math.max(start, ratio);
    } else {
      end = Math.min(end, ratio);
    }
  }
  if (start > end) {
    return null;
  }
  const at = (ratio: number): Point => ({ x: from.x + dx * ratio, y: from.y + dy * ratio });
  return { from: at(start), to: at(end) };
}

/** Hodiny pro spojování: zavolá `callback` za `ms` a vrátí zrušení. */
export interface HintTimers {
  after(ms: number, callback: () => void): () => void;
}

/** Co scéna při spojování nakreslí. */
export interface HintPairingActions {
  /** Spojí dvojici; s `animate` poskočí, blikne čára a cinkne, jinak hned hotová a tiše. */
  pairUp(pair: number, animate: boolean): void;
  /** Rozsvítí tečky bez dvojice (jednou). */
  lightExtras(): void;
}

export interface HintPairing {
  /** Dokreslí nápovědu hned celou, bez animace a bez cinknutí (správné ťuknutí). */
  finish(): void;
  /** Zastaví spojování bez dokreslení (nový příklad, odchod). */
  cancel(): void;
}

/**
 * Spojí `pairs` dvojic po jedné v časech z `pairStartTimes` (od `startMs`)
 * a po poslední rozsvítí tečky bez dvojice. Každá dvojice se spojí právě
 * jednou, ať s animací, nebo tiše při `finish`.
 */
export function playHintPairing(
  pairs: number,
  startMs: number,
  timers: HintTimers,
  actions: HintPairingActions,
): HintPairing {
  let nextPair = 0;
  let lit = false;
  let cancels: Array<() => void> = [];

  const light = (): void => {
    if (!lit) {
      lit = true;
      actions.lightExtras();
    }
  };
  const pairUpNext = (animate: boolean): void => {
    actions.pairUp(nextPair, animate);
    nextPair += 1;
  };
  const cancel = (): void => {
    for (const stop of cancels) {
      stop();
    }
    cancels = [];
  };

  const times = pairStartTimes(pairs);
  const schedule = (ms: number, callback: () => void): void => {
    if (ms <= 0) {
      callback();
    } else {
      cancels.push(timers.after(ms, callback));
    }
  };
  for (const time of times) {
    schedule(startMs + time, () => pairUpNext(true));
  }
  const lastPair = times[times.length - 1] ?? 0;
  schedule(startMs + lastPair + LIGHT_AFTER_LAST_PAIR_MS, light);

  return {
    finish: () => {
      cancel();
      while (nextPair < pairs) {
        pairUpNext(false);
      }
      light();
    },
    cancel,
  };
}
